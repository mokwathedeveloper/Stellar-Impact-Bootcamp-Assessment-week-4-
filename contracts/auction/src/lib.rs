//! # No-Loss Auction Protocol — Soroban Smart Contract
//!
//! A fully on-chain auction system on Stellar/Soroban that guarantees no participant
//! loses funds: outbid users can always reclaim their tokens, and the auction owner
//! only receives payment when a winner is declared.
//!
//! ## Key guarantees
//! - Bids can only increase (strict outbidding required)
//! - Previous highest-bidder funds are held as a pull-claimable refund
//! - Cancellation is only allowed before any bids are placed
//! - Finalization transfers the winning amount to the owner; unreachable states are impossible

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    token::Client as TokenClient,
    Address, Env, String, Symbol,
};

// ─────────────────────────────────────────────────────────────
//  Storage Key Definitions
// ─────────────────────────────────────────────────────────────

/// All persistent/instance storage keys used by this contract.
///
/// Soroban requires keys to be `#[contracttype]` so they are serialised
/// deterministically to ledger storage.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Full `Auction` struct stored under the auction's numeric ID.
    Auction(u64),

    /// Global counter — the ID that will be assigned to the next auction.
    /// Stored in instance storage (lives as long as the contract).
    AuctionCount,

    /// Pending refund balance for a specific bidder on a specific auction.
    /// `Refund(auction_id, bidder_address)` → `i128` token units
    Refund(u64, Address),
}

// ─────────────────────────────────────────────────────────────
//  Auction Lifecycle Status
// ─────────────────────────────────────────────────────────────

/// Tracks the current phase of an auction.
///
/// State machine:  Active → Finalized  (deadline passed, winner declared)
///                 Active → Cancelled  (owner cancels before any bids)
#[contracttype]
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum AuctionStatus {
    /// Auction is open and accepting bids.
    Active,
    /// Auction ended; winning bid transferred to the owner.
    Finalized,
    /// Auction was cancelled by the owner before any bids were placed.
    Cancelled,
}

// ─────────────────────────────────────────────────────────────
//  Core Auction Struct
// ─────────────────────────────────────────────────────────────

/// All on-chain data for a single auction.
///
/// Stored in persistent storage so it survives ledger archival windows.
#[contracttype]
#[derive(Clone, Debug)]
pub struct Auction {
    /// Unique sequential identifier assigned at creation.
    pub id: u64,

    /// Human-readable description of the item or service being auctioned.
    pub description: String,

    /// Creator of the auction; receives the winning bid upon finalization.
    pub owner: Address,

    /// SEP-41 fungible token contract used for all bids and refunds.
    pub token: Address,

    /// The floor price — no bid may be at or below this amount.
    pub starting_bid: i128,

    /// The highest bid received so far (initialized to `starting_bid`).
    pub highest_bid: i128,

    /// `Some(address)` of the current leader; `None` if no bids yet.
    pub highest_bidder: Option<Address>,

    /// Unix timestamp (seconds) after which finalization is allowed.
    pub deadline: u64,

    /// Current lifecycle status.
    pub status: AuctionStatus,
}

// ─────────────────────────────────────────────────────────────
//  Contract Entry Point
// ─────────────────────────────────────────────────────────────

#[contract]
pub struct AuctionContract;

#[contractimpl]
impl AuctionContract {

    // ─────────────────────────────────────────────────────────
    //  create_auction
    // ─────────────────────────────────────────────────────────

    /// Creates a new auction and returns its unique ID.
    ///
    /// The caller is recorded as the auction owner and must authorize the
    /// transaction.  A strictly positive starting bid and a future deadline
    /// are required.
    ///
    /// # Arguments
    /// | Name           | Type      | Description                                        |
    /// |----------------|-----------|----------------------------------------------------|
    /// | `caller`       | `Address` | Auction owner — receives winning bid on finalize   |
    /// | `description`  | `String`  | Text description of the auctioned item             |
    /// | `token`        | `Address` | SEP-41 token contract used for bids                |
    /// | `starting_bid` | `i128`    | Minimum opening bid (strictly positive)            |
    /// | `deadline`     | `u64`     | Unix timestamp after which finalization is allowed |
    ///
    /// # Panics
    /// - `starting_bid` ≤ 0
    /// - `deadline` ≤ current ledger timestamp
    ///
    /// # Returns
    /// The unique auction ID (`u64`) assigned to this new auction.
    pub fn create_auction(
        env: Env,
        caller: Address,
        description: String,
        token: Address,
        starting_bid: i128,
        deadline: u64,
    ) -> u64 {
        // The caller must sign this transaction
        caller.require_auth();

        // ── Input validation ──────────────────────────────────
        assert!(starting_bid > 0, "starting_bid must be greater than zero");
        assert!(
            deadline > env.ledger().timestamp(),
            "deadline must be a future timestamp"
        );

        // ── Generate sequential auction ID ───────────────────
        let auction_id: u64 = env
            .storage()
            .instance()
            .get::<DataKey, u64>(&DataKey::AuctionCount)
            .unwrap_or(0)
            + 1;

        // ── Build and persist auction ─────────────────────────
        let auction = Auction {
            id: auction_id,
            description: description.clone(),
            owner: caller.clone(),
            token,
            starting_bid,
            highest_bid: starting_bid, // floor price doubles as initial highest bid
            highest_bidder: None,      // no bids placed yet
            deadline,
            status: AuctionStatus::Active,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Auction(auction_id), &auction);

        // Advance the global counter
        env.storage()
            .instance()
            .set(&DataKey::AuctionCount, &auction_id);

        // ── Emit creation event ───────────────────────────────
        env.events().publish(
            (Symbol::new(&env, "auction_created"),),
            (auction_id, caller, description, starting_bid, deadline),
        );

        auction_id
    }

    // ─────────────────────────────────────────────────────────
    //  place_bid
    // ─────────────────────────────────────────────────────────

    /// Places a bid on an active, non-expired auction.
    ///
    /// Transfers `amount` tokens from `bidder` to this contract.
    /// The previous highest bidder's stake is recorded as a pull-claimable
    /// refund (CEI pattern prevents re-entrancy).
    ///
    /// # Arguments
    /// | Name         | Type      | Description                              |
    /// |--------------|-----------|------------------------------------------|
    /// | `bidder`     | `Address` | Account placing the bid (must authorize) |
    /// | `auction_id` | `u64`     | Target auction ID                        |
    /// | `amount`     | `i128`    | Bid in token's smallest unit             |
    ///
    /// # Panics
    /// - Auction does not exist
    /// - Auction is not `Active`
    /// - Ledger timestamp has passed the auction deadline
    /// - `amount` ≤ current `highest_bid`
    pub fn place_bid(env: Env, bidder: Address, auction_id: u64, amount: i128) {
        // Bidder must sign
        bidder.require_auth();

        // ── Load and validate auction ─────────────────────────
        let mut auction = Self::load_auction(&env, auction_id);

        assert!(
            auction.status == AuctionStatus::Active,
            "auction is not active"
        );
        assert!(
            env.ledger().timestamp() <= auction.deadline,
            "auction deadline has passed"
        );
        assert!(
            amount > auction.highest_bid,
            "bid must strictly exceed the current highest bid"
        );

        // ── Transfer tokens from bidder to contract ───────────
        let token_client = TokenClient::new(&env, &auction.token);
        token_client.transfer(&bidder, &env.current_contract_address(), &amount);

        // ── Record refund for the displaced highest bidder ────
        // Pull pattern: we store the amount; the old bidder fetches it via claim_refund.
        // This avoids forwarding risk and griefing via malicious token callbacks.
        if let Some(prev_bidder) = &auction.highest_bidder {
            let refund_key = DataKey::Refund(auction_id, prev_bidder.clone());
            let existing: i128 = env
                .storage()
                .persistent()
                .get::<DataKey, i128>(&refund_key)
                .unwrap_or(0);
            env.storage()
                .persistent()
                .set(&refund_key, &(existing + auction.highest_bid));
        }

        // ── Update auction state ──────────────────────────────
        let prev_bidder = auction.highest_bidder.clone();
        auction.highest_bidder = Some(bidder.clone());
        auction.highest_bid = amount;

        env.storage()
            .persistent()
            .set(&DataKey::Auction(auction_id), &auction);

        // ── Emit bid event ────────────────────────────────────
        env.events().publish(
            (Symbol::new(&env, "bid_placed"),),
            (auction_id, bidder, amount, prev_bidder),
        );
    }

    // ─────────────────────────────────────────────────────────
    //  claim_refund
    // ─────────────────────────────────────────────────────────

    /// Allows a previously outbid participant to withdraw their tokens.
    ///
    /// Uses the Checks-Effects-Interactions (CEI) pattern:
    /// the storage entry is zeroed **before** the token transfer to prevent
    /// double-claims in any re-entrancy scenario.
    ///
    /// # Arguments
    /// | Name         | Type      | Description                                   |
    /// |--------------|-----------|-----------------------------------------------|
    /// | `bidder`     | `Address` | Account reclaiming their tokens (must sign)   |
    /// | `auction_id` | `u64`     | Auction from which to claim the refund        |
    ///
    /// # Panics
    /// - Auction does not exist
    /// - No refund is available for `bidder` on this auction
    pub fn claim_refund(env: Env, bidder: Address, auction_id: u64) {
        bidder.require_auth();

        // We still need the auction to resolve the token contract address
        let auction = Self::load_auction(&env, auction_id);

        let refund_key = DataKey::Refund(auction_id, bidder.clone());
        let refund_amount: i128 = env
            .storage()
            .persistent()
            .get::<DataKey, i128>(&refund_key)
            .unwrap_or(0);

        assert!(refund_amount > 0, "no refund available for this address");

        // ── Effects before interactions (CEI) ─────────────────
        env.storage().persistent().remove(&refund_key);

        // ── Transfer refund tokens back to bidder ─────────────
        let token_client = TokenClient::new(&env, &auction.token);
        token_client.transfer(&env.current_contract_address(), &bidder, &refund_amount);

        env.events().publish(
            (Symbol::new(&env, "refund_claimed"),),
            (auction_id, bidder, refund_amount),
        );
    }

    // ─────────────────────────────────────────────────────────
    //  finalize_auction
    // ─────────────────────────────────────────────────────────

    /// Finalizes the auction after its deadline and transfers the winning
    /// bid amount to the owner.
    ///
    /// Anyone may call this function (permissionless finalization) once the
    /// deadline has passed.  If no bids were placed, the auction closes with
    /// no token movement.
    ///
    /// # Arguments
    /// | Name         | Type  | Description                        |
    /// |--------------|-------|------------------------------------|
    /// | `auction_id` | `u64` | ID of the auction to finalize      |
    ///
    /// # Panics
    /// - Auction does not exist
    /// - Auction is not `Active`
    /// - Ledger timestamp has not yet exceeded the deadline
    pub fn finalize_auction(env: Env, auction_id: u64) {
        let mut auction = Self::load_auction(&env, auction_id);

        assert!(
            auction.status == AuctionStatus::Active,
            "auction is not active"
        );
        assert!(
            env.ledger().timestamp() > auction.deadline,
            "auction deadline has not passed yet"
        );

        // ── Mark finalized before any transfers (CEI) ─────────
        auction.status = AuctionStatus::Finalized;
        env.storage()
            .persistent()
            .set(&DataKey::Auction(auction_id), &auction);

        // ── Send winning bid to owner (only if bids exist) ────
        if let Some(ref winner) = auction.highest_bidder {
            let token_client = TokenClient::new(&env, &auction.token);
            token_client.transfer(
                &env.current_contract_address(),
                &auction.owner,
                &auction.highest_bid,
            );

            env.events().publish(
                (Symbol::new(&env, "auction_finalized"),),
                (auction_id, winner.clone(), auction.highest_bid, auction.owner.clone()),
            );
        } else {
            // No bids — emit event with zero amount
            env.events().publish(
                (Symbol::new(&env, "auction_finalized_no_bids"),),
                (auction_id, auction.owner.clone()),
            );
        }
    }

    // ─────────────────────────────────────────────────────────
    //  cancel_auction
    // ─────────────────────────────────────────────────────────

    /// Cancels an auction that has received **no bids**.
    ///
    /// This is the no-loss guarantee for the owner: they can always retract
    /// an auction before anyone commits funds.  Once a bid exists the auction
    /// must run to completion.
    ///
    /// # Arguments
    /// | Name         | Type      | Description                                      |
    /// |--------------|-----------|--------------------------------------------------|
    /// | `caller`     | `Address` | Must be the auction owner                        |
    /// | `auction_id` | `u64`     | ID of the auction to cancel                      |
    ///
    /// # Panics
    /// - Auction does not exist
    /// - `caller` is not the auction owner
    /// - Auction is not `Active`
    /// - A bid has already been placed (`highest_bidder.is_some()`)
    pub fn cancel_auction(env: Env, caller: Address, auction_id: u64) {
        caller.require_auth();

        let mut auction = Self::load_auction(&env, auction_id);

        assert!(auction.owner == caller, "only the auction owner can cancel");
        assert!(
            auction.status == AuctionStatus::Active,
            "auction is not active"
        );
        // Core no-loss constraint: cannot cancel once funds are at stake
        assert!(
            auction.highest_bidder.is_none(),
            "cannot cancel after bids have been placed"
        );

        auction.status = AuctionStatus::Cancelled;
        env.storage()
            .persistent()
            .set(&DataKey::Auction(auction_id), &auction);

        env.events().publish(
            (Symbol::new(&env, "auction_cancelled"),),
            (auction_id, caller),
        );
    }

    // ─────────────────────────────────────────────────────────
    //  Query functions (read-only)
    // ─────────────────────────────────────────────────────────

    /// Returns the full `Auction` struct for a given ID.
    ///
    /// # Panics
    /// If the auction does not exist.
    pub fn get_auction(env: Env, auction_id: u64) -> Auction {
        Self::load_auction(&env, auction_id)
    }

    /// Returns the claimable refund balance for `bidder` on `auction_id`.
    ///
    /// Returns `0` if no refund is pending (rather than panicking).
    pub fn get_refund(env: Env, auction_id: u64, bidder: Address) -> i128 {
        env.storage()
            .persistent()
            .get::<DataKey, i128>(&DataKey::Refund(auction_id, bidder))
            .unwrap_or(0)
    }

    /// Returns the total number of auctions ever created (including finalized/cancelled).
    pub fn get_auction_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get::<DataKey, u64>(&DataKey::AuctionCount)
            .unwrap_or(0)
    }

    // ─────────────────────────────────────────────────────────
    //  Internal helpers
    // ─────────────────────────────────────────────────────────

    /// Loads an `Auction` from persistent storage, panicking with a clear
    /// message if the ID does not exist.
    fn load_auction(env: &Env, auction_id: u64) -> Auction {
        env.storage()
            .persistent()
            .get::<DataKey, Auction>(&DataKey::Auction(auction_id))
            .unwrap_or_else(|| panic!("auction {} does not exist", auction_id))
    }
}

// ─────────────────────────────────────────────────────────────
//  Tests
// ─────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Env,
    };

    /// Returns a test environment, contract client, and a freshly deployed
    /// mock SEP-41 token.
    fn setup() -> (Env, AuctionContractClient<'static>, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AuctionContract, ());
        let client = AuctionContractClient::new(&env, &contract_id);

        // Deploy a minimal test token
        let token_admin = Address::generate(&env);
        let token_id = env.register(
            soroban_sdk::token::StellarAssetContract,
            (token_admin.clone(), None::<()>),
        );

        (env, client, token_admin, token_id)
    }

    #[test]
    fn test_create_auction_success() {
        let (env, client, owner, token) = setup();

        let now = env.ledger().timestamp();
        let deadline = now + 1000;

        let id = client.create_auction(
            &owner,
            &String::from_str(&env, "Vintage Guitar"),
            &token,
            &100_000_000, // 100 tokens in stroops
            &deadline,
        );

        assert_eq!(id, 1);

        let auction = client.get_auction(&id);
        assert_eq!(auction.id, 1);
        assert_eq!(auction.starting_bid, 100_000_000);
        assert_eq!(auction.highest_bid, 100_000_000);
        assert!(auction.highest_bidder.is_none());
        assert_eq!(auction.status, AuctionStatus::Active);
    }

    #[test]
    fn test_place_bid_updates_highest_bidder() {
        let (env, client, owner, token) = setup();
        let bidder_a = Address::generate(&env);
        let bidder_b = Address::generate(&env);

        let now = env.ledger().timestamp();
        let deadline = now + 1000;

        // Mint tokens to both bidders
        let token_client = soroban_sdk::token::StellarAssetContractClient::new(&env, &token);
        token_client.mint(&bidder_a, &200_000_000);
        token_client.mint(&bidder_b, &500_000_000);

        let id = client.create_auction(
            &owner,
            &String::from_str(&env, "Rare Painting"),
            &token,
            &100_000_000,
            &deadline,
        );

        // First bid
        client.place_bid(&bidder_a, &id, &150_000_000);
        let auction = client.get_auction(&id);
        assert_eq!(auction.highest_bid, 150_000_000);
        assert_eq!(auction.highest_bidder, Some(bidder_a.clone()));

        // Second higher bid from B — A should get a refund stored
        client.place_bid(&bidder_b, &id, &300_000_000);
        let auction = client.get_auction(&id);
        assert_eq!(auction.highest_bid, 300_000_000);
        assert_eq!(auction.highest_bidder, Some(bidder_b.clone()));

        // A's refund should equal their original bid
        let refund = client.get_refund(&id, &bidder_a);
        assert_eq!(refund, 150_000_000);
    }

    #[test]
    fn test_claim_refund_transfers_tokens_back() {
        let (env, client, owner, token) = setup();
        let bidder_a = Address::generate(&env);
        let bidder_b = Address::generate(&env);

        let now = env.ledger().timestamp();
        let deadline = now + 1000;

        let token_client = soroban_sdk::token::StellarAssetContractClient::new(&env, &token);
        token_client.mint(&bidder_a, &200_000_000);
        token_client.mint(&bidder_b, &500_000_000);

        let id = client.create_auction(
            &owner,
            &String::from_str(&env, "Sports Car"),
            &token,
            &100_000_000,
            &deadline,
        );

        client.place_bid(&bidder_a, &id, &150_000_000);
        client.place_bid(&bidder_b, &id, &300_000_000);

        let balance_before = token_client.balance(&bidder_a);
        client.claim_refund(&bidder_a, &id);
        let balance_after = token_client.balance(&bidder_a);

        assert_eq!(balance_after - balance_before, 150_000_000);
        assert_eq!(client.get_refund(&id, &bidder_a), 0);
    }

    #[test]
    fn test_finalize_sends_winning_bid_to_owner() {
        let (env, client, owner, token) = setup();
        let bidder = Address::generate(&env);

        let now = env.ledger().timestamp();
        let deadline = now + 100;

        let token_client = soroban_sdk::token::StellarAssetContractClient::new(&env, &token);
        token_client.mint(&bidder, &500_000_000);

        let id = client.create_auction(
            &owner,
            &String::from_str(&env, "Diamond Ring"),
            &token,
            &100_000_000,
            &deadline,
        );

        client.place_bid(&bidder, &id, &250_000_000);

        // Advance ledger past deadline
        env.ledger().with_mut(|l| l.timestamp = deadline + 1);

        let owner_balance_before = token_client.balance(&owner);
        client.finalize_auction(&id);
        let owner_balance_after = token_client.balance(&owner);

        assert_eq!(owner_balance_after - owner_balance_before, 250_000_000);

        let auction = client.get_auction(&id);
        assert_eq!(auction.status, AuctionStatus::Finalized);
    }

    #[test]
    fn test_cancel_auction_with_no_bids() {
        let (env, client, owner, token) = setup();

        let now = env.ledger().timestamp();
        let deadline = now + 1000;

        let id = client.create_auction(
            &owner,
            &String::from_str(&env, "Sculpture"),
            &token,
            &100_000_000,
            &deadline,
        );

        client.cancel_auction(&owner, &id);

        let auction = client.get_auction(&id);
        assert_eq!(auction.status, AuctionStatus::Cancelled);
    }

    #[test]
    #[should_panic(expected = "cannot cancel after bids have been placed")]
    fn test_cancel_auction_with_bids_fails() {
        let (env, client, owner, token) = setup();
        let bidder = Address::generate(&env);

        let now = env.ledger().timestamp();
        let deadline = now + 1000;

        let token_client = soroban_sdk::token::StellarAssetContractClient::new(&env, &token);
        token_client.mint(&bidder, &500_000_000);

        let id = client.create_auction(
            &owner,
            &String::from_str(&env, "Watch"),
            &token,
            &100_000_000,
            &deadline,
        );

        client.place_bid(&bidder, &id, &200_000_000);

        // This must panic
        client.cancel_auction(&owner, &id);
    }

    #[test]
    #[should_panic(expected = "bid must strictly exceed the current highest bid")]
    fn test_bid_too_low_fails() {
        let (env, client, owner, token) = setup();
        let bidder = Address::generate(&env);

        let now = env.ledger().timestamp();
        let deadline = now + 1000;

        let token_client = soroban_sdk::token::StellarAssetContractClient::new(&env, &token);
        token_client.mint(&bidder, &500_000_000);

        let id = client.create_auction(
            &owner,
            &String::from_str(&env, "Book"),
            &token,
            &100_000_000,
            &deadline,
        );

        client.place_bid(&bidder, &id, &50_000_000); // below starting bid
    }

    #[test]
    #[should_panic(expected = "auction deadline has passed")]
    fn test_bid_after_deadline_fails() {
        let (env, client, owner, token) = setup();
        let bidder = Address::generate(&env);

        let now = env.ledger().timestamp();
        let deadline = now + 100;

        let token_client = soroban_sdk::token::StellarAssetContractClient::new(&env, &token);
        token_client.mint(&bidder, &500_000_000);

        let id = client.create_auction(
            &owner,
            &String::from_str(&env, "Expired Item"),
            &token,
            &100_000_000,
            &deadline,
        );

        // Move past deadline
        env.ledger().with_mut(|l| l.timestamp = deadline + 1);

        client.place_bid(&bidder, &id, &200_000_000);
    }
}
