/**
 * contract.js — Soroban contract interaction utilities
 *
 * All contract calls go through this module.  Set CONTRACT_ID and NETWORK
 * to point at your deployed contract before running.
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  CONFIGURATION — update these two constants after deployment
 * ──────────────────────────────────────────────────────────────────────────
 */

/** @type {string} Soroban contract ID returned by `stellar contract deploy` */
export const CONTRACT_ID =
  import.meta.env.VITE_CONTRACT_ID ||
  "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM"; // placeholder

/** Stellar network passphrase */
export const NETWORK_PASSPHRASE =
  import.meta.env.VITE_NETWORK_PASSPHRASE ||
  "Test SDF Network ; September 2015";

/** Soroban RPC endpoint */
export const RPC_URL =
  import.meta.env.VITE_RPC_URL || "https://soroban-testnet.stellar.org";

// ──────────────────────────────────────────────────────────────────────────

import {
  Contract,
  SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  scValToNative,
  nativeToScVal,
  Address,
} from "@stellar/stellar-sdk";

/** Soroban RPC server instance */
export const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });

/** Shared contract instance */
export const auctionContract = new Contract(CONTRACT_ID);

// ──────────────────────────────────────────────────────────────────────────
//  Low-level helpers
// ──────────────────────────────────────────────────────────────────────────

/**
 * Build, simulate, sign (via Freighter), and submit a Soroban transaction.
 *
 * @param {string} publicKey  - Caller's Stellar public key (G…)
 * @param {Function} buildOp  - Receives the contract instance, returns an Operation
 * @returns {Promise<any>}    - Decoded return value of the contract call
 */
export async function invokeContract(publicKey, buildOp) {
  // 1. Load the account sequence number from the network
  const account = await server.getAccount(publicKey);

  // 2. Build the transaction with the Soroban operation
  const operation = buildOp(auctionContract);
  let tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  // 3. Simulate to get resource footprint and fee estimates
  const simResult = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`);
  }

  // 4. Assemble the transaction with correct soroban data / auth entries
  const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();

  // 5. Sign with Freighter wallet
  const { signTransaction } = await import("@stellar/freighter-api");
  const signedXdr = await signTransaction(preparedTx.toXDR(), {
    network: "TESTNET",
    networkPassphrase: NETWORK_PASSPHRASE,
    accountToSign: publicKey,
  });

  // 6. Submit and poll for the finalized ledger result
  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const sendResult = await server.sendTransaction(signedTx);

  if (sendResult.status === "ERROR") {
    throw new Error(`Submission failed: ${sendResult.errorResult}`);
  }

  // Poll until transaction is confirmed
  let getResult;
  do {
    await new Promise((r) => setTimeout(r, 2000));
    getResult = await server.getTransaction(sendResult.hash);
  } while (getResult.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND);

  if (getResult.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
    throw new Error(`Transaction failed: ${getResult.resultXdr}`);
  }

  // Decode and return the contract's return value
  const resultMeta = xdr.TransactionMeta.fromXDR(getResult.resultMetaXdr, "base64");
  const returnVal = resultMeta.v3().sorobanMeta().returnValue();
  return scValToNative(returnVal);
}

/**
 * Read-only simulation — no signature or submission required.
 *
 * @param {Function} buildOp - Receives the contract instance, returns an Operation
 * @returns {Promise<any>}   - Decoded return value
 */
export async function queryContract(buildOp) {
  // Use the zero-address account for view calls (no real account needed)
  const ZERO_KEY = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";
  const account = await server.getAccount(ZERO_KEY).catch(() => ({
    accountId: () => ZERO_KEY,
    sequenceNumber: () => "0",
    incrementSequenceNumber: () => {},
  }));

  const operation = buildOp(auctionContract);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Query failed: ${simResult.error}`);
  }

  return scValToNative(simResult.result.retval);
}

// ──────────────────────────────────────────────────────────────────────────
//  Contract method wrappers
// ──────────────────────────────────────────────────────────────────────────

/**
 * Create a new auction.
 *
 * @param {string} publicKey    - Caller / future owner public key
 * @param {string} description  - Item description
 * @param {string} tokenAddress - SEP-41 token contract ID
 * @param {bigint} startingBid  - Minimum bid in token's smallest unit
 * @param {bigint} deadline     - Unix timestamp (seconds)
 * @returns {Promise<bigint>}   - New auction ID
 */
export async function createAuction(
  publicKey,
  description,
  tokenAddress,
  startingBid,
  deadline
) {
  return invokeContract(publicKey, (contract) =>
    contract.call(
      "create_auction",
      new Address(publicKey).toScVal(),
      nativeToScVal(description, { type: "string" }),
      new Address(tokenAddress).toScVal(),
      nativeToScVal(startingBid, { type: "i128" }),
      nativeToScVal(deadline, { type: "u64" })
    )
  );
}

/**
 * Place a bid on an existing auction.
 *
 * @param {string} publicKey  - Bidder's public key
 * @param {bigint} auctionId  - Target auction ID
 * @param {bigint} amount     - Bid amount in token's smallest unit
 */
export async function placeBid(publicKey, auctionId, amount) {
  return invokeContract(publicKey, (contract) =>
    contract.call(
      "place_bid",
      new Address(publicKey).toScVal(),
      nativeToScVal(auctionId, { type: "u64" }),
      nativeToScVal(amount, { type: "i128" })
    )
  );
}

/**
 * Claim a pending refund for a previously outbid participant.
 *
 * @param {string} publicKey  - Bidder's public key (must have a pending refund)
 * @param {bigint} auctionId  - Auction ID to claim from
 */
export async function claimRefund(publicKey, auctionId) {
  return invokeContract(publicKey, (contract) =>
    contract.call(
      "claim_refund",
      new Address(publicKey).toScVal(),
      nativeToScVal(auctionId, { type: "u64" })
    )
  );
}

/**
 * Finalize the auction after its deadline — anyone can call this.
 *
 * @param {string} publicKey  - Submitter public key (pays gas)
 * @param {bigint} auctionId  - Auction ID to finalize
 */
export async function finalizeAuction(publicKey, auctionId) {
  return invokeContract(publicKey, (contract) =>
    contract.call(
      "finalize_auction",
      nativeToScVal(auctionId, { type: "u64" })
    )
  );
}

/**
 * Cancel an auction that has received no bids (owner only).
 *
 * @param {string} publicKey  - Auction owner's public key
 * @param {bigint} auctionId  - Auction ID to cancel
 */
export async function cancelAuction(publicKey, auctionId) {
  return invokeContract(publicKey, (contract) =>
    contract.call(
      "cancel_auction",
      new Address(publicKey).toScVal(),
      nativeToScVal(auctionId, { type: "u64" })
    )
  );
}

/**
 * Fetch full auction data (read-only).
 *
 * @param {bigint} auctionId - Auction ID to fetch
 * @returns {Promise<object>} Decoded auction object
 */
export async function getAuction(auctionId) {
  return queryContract((contract) =>
    contract.call("get_auction", nativeToScVal(auctionId, { type: "u64" }))
  );
}

/**
 * Fetch pending refund amount for a bidder (read-only).
 *
 * @param {bigint} auctionId  - Auction ID
 * @param {string} bidder     - Bidder's public key
 * @returns {Promise<bigint>} Refund amount in token's smallest unit
 */
export async function getRefund(auctionId, bidder) {
  return queryContract((contract) =>
    contract.call(
      "get_refund",
      nativeToScVal(auctionId, { type: "u64" }),
      new Address(bidder).toScVal()
    )
  );
}

/**
 * Fetch the total number of auctions ever created (read-only).
 *
 * @returns {Promise<bigint>}
 */
export async function getAuctionCount() {
  return queryContract((contract) => contract.call("get_auction_count"));
}

// ──────────────────────────────────────────────────────────────────────────
//  Formatting helpers used by UI components
// ──────────────────────────────────────────────────────────────────────────

/** Convert raw token units (1 XLM = 10_000_000 stroops) to a display string. */
export function formatTokenAmount(raw, decimals = 7) {
  const divisor = BigInt(10 ** decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  return `${whole}.${frac.toString().padStart(decimals, "0").replace(/0+$/, "") || "0"}`;
}

/** Convert a display amount (e.g. "10.5") to raw token units. */
export function parseTokenAmount(display, decimals = 7) {
  const [whole = "0", frac = ""] = display.split(".");
  const fracPadded = frac.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole) * BigInt(10 ** decimals) + BigInt(fracPadded);
}

/** Return a human-readable countdown string from a Unix timestamp. */
export function formatDeadline(unixSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(unixSeconds) - now;
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return [h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(" ");
}
