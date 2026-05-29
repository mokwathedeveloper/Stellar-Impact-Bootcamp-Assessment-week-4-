# No-Loss Auction Protocol — Stellar Soroban

A fully on-chain, trustless auction protocol built on **Stellar Soroban**.  
Every participant is guaranteed not to lose funds: outbid users can always
reclaim their tokens, and the auction owner only receives payment when a
winner is declared.

---

## Deployed Contract (Testnet)

| Field | Value |
|---|---|
| **Contract ID** | `CA2SXTCIJGNMQHC33EHTBF4KF3DW2EGA5GXFZMDTPHRGFWRWTEZ2RLWS` |
| **Network** | Stellar Testnet |
| **Explorer** | [stellar.expert/explorer/testnet/contract/CA2SXTCIJGNMQHC33EHTBF4KF3DW2EGA5GXFZMDTPHRGFWRWTEZ2RLWS](https://stellar.expert/explorer/testnet/contract/CA2SXTCIJGNMQHC33EHTBF4KF3DW2EGA5GXFZMDTPHRGFWRWTEZ2RLWS) |
| **RPC** | `https://soroban-testnet.stellar.org` |

> Deployed by identity `moffat` (GDPTMWBY6RCDEOCQ2WHUG2V7WWCXXIP7T56E46DTF2WZ3MCY47AGZICR) on 2026-05-30.
> Deployment tx: [abac00e…](https://stellar.expert/explorer/testnet/tx/abac00e60b54fa1238bb2a06231f6deeac4d8cdb924f786433e588450615696b)

---

## Architecture

```
.
├── contracts/
│   └── auction/
│       ├── Cargo.toml          # Contract package (soroban-sdk v22)
│       └── src/
│           └── lib.rs          # Full contract: structs, functions, tests
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── WalletConnect.jsx   # Freighter wallet connect/disconnect
│   │   │   ├── CreateAuction.jsx   # Form to create a new auction
│   │   │   ├── AuctionList.jsx     # Fetches & renders all auctions
│   │   │   ├── AuctionCard.jsx     # Single auction display + actions
│   │   │   └── PlaceBid.jsx        # Inline bid form + claim refund
│   │   ├── utils/
│   │   │   ├── contract.js         # Soroban SDK wrappers for all methods
│   │   │   └── stellar.js          # Freighter wallet helpers
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── .env.example
│   ├── vercel.json
│   ├── package.json
│   └── vite.config.js
├── Cargo.toml                  # Workspace root
├── deploy.sh                   # Build + deploy script
└── README.md
```

---

## Contract Functions

| Function | Description |
|---|---|
| `create_auction(caller, description, token, starting_bid, deadline)` | Creates a new auction, returns its ID |
| `place_bid(bidder, auction_id, amount)` | Places a bid; stores previous leader's refund |
| `claim_refund(bidder, auction_id)` | Outbid user pulls their tokens back |
| `finalize_auction(auction_id)` | Anyone can call after deadline; sends winning bid to owner |
| `cancel_auction(caller, auction_id)` | Owner cancels before any bids are placed |
| `get_auction(auction_id)` | Read auction data |
| `get_refund(auction_id, bidder)` | Check pending refund balance |
| `get_auction_count()` | Total auctions created |

### Security Guarantees

- **No-loss bidding** — previous highest bidder's stake is always claimable
- **CEI pattern** — storage cleared before token transfers (prevents double-claim)
- **Pull over push** — refunds are stored, not auto-forwarded (avoids griefing)
- **Permissionless finalization** — anyone can trigger finalization after deadline
- **Cancel guard** — cancellation blocked once any bid exists

---

## Prerequisites

### Tools Required

| Tool | Install |
|---|---|
| Rust + Cargo | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| wasm32 target | `rustup target add wasm32-unknown-unknown` |
| Stellar CLI | `cargo install stellar-cli --locked` |
| Node.js ≥ 18 | [nodejs.org](https://nodejs.org) |
| Freighter Wallet | [freighter.app](https://www.freighter.app/) (browser extension) |

### Testnet Account

Fund a testnet account via the Stellar Friendbot:
```bash
stellar keys generate alice --network testnet
stellar keys fund alice --network testnet
```

---

## Deployment — Smart Contract

```bash
# 1. Clone the repo
git clone <repo-url>
cd Stellar-Impact-Bootcamp-Assessment-week-4-

# 2. Deploy (builds + optimises + deploys in one step)
./deploy.sh alice          # replace 'alice' with your stellar identity name

# Output will look like:
# ✅  Contract deployed successfully!
# Contract ID: CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

After deploying, copy the Contract ID.

---

## Frontend Setup

### Run Locally

```bash
cd frontend
cp .env.example .env

# Edit .env and set your contract ID:
# VITE_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

npm install
npm run dev
# → http://localhost:5173
```

### Deploy to Vercel

1. Push this repository to GitHub.
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your repo.
3. Set **Root Directory** to `frontend`.
4. Add environment variables in Vercel dashboard:
   - `VITE_CONTRACT_ID` → your deployed contract ID
   - `VITE_NETWORK_PASSPHRASE` → `Test SDF Network ; September 2015`
   - `VITE_RPC_URL` → `https://soroban-testnet.stellar.org`
5. Deploy — Vercel uses `vercel.json` automatically.

---

## Running Tests

```bash
cd contracts/auction
cargo test --features testutils
```

Tests cover:
- ✅ Create auction with valid parameters
- ✅ Place bid updates highest bidder
- ✅ Previous bidder gets claimable refund
- ✅ Claim refund transfers tokens back
- ✅ Finalize sends winning bid to owner
- ✅ Cancel auction with no bids
- ✅ Cancel with bids panics
- ✅ Bid too low panics
- ✅ Bid after deadline panics

---

## How to Test All Features (Manual)

1. **Connect wallet** — click "Connect Freighter Wallet", ensure Testnet is selected in Freighter.

2. **Create an auction**
   - Description: `Vintage Ledger Device`
   - Token: use the testnet XLM asset contract `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
   - Starting bid: `10`
   - Deadline: any future datetime
   - Click **Create Auction** → note the returned ID.

3. **Place a bid**
   - On the auction card, enter `15` and click **Place Bid**.
   - Switch to a second Freighter account, enter `20`, click **Place Bid**.
   - First account is now outbid.

4. **Claim a refund**
   - Switch back to the first account.
   - Click **Check My Refund** → banner appears showing 15 tokens pending.
   - Click **Claim Refund** → tokens returned.

5. **Finalize the auction**
   - Wait until the deadline passes (or set a near-future deadline for testing).
   - Click **Finalize Auction** — the owner receives the winning bid.

6. **Cancel an auction**
   - Create a new auction.
   - While no bids exist, click **Cancel Auction** → status changes to Cancelled.

---

## Token Address Reference (Testnet)

The native XLM wrapped SEP-41 contract on testnet:

```
CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

You can also deploy your own test token:
```bash
stellar contract deploy \
  --wasm ~/.stellar/bin/soroban_token_contract.wasm \
  --source alice \
  --network testnet
```

---

## Git Commit History

Every feature was committed individually following professional conventions:

```
115ecbd Add .gitignore excluding Cargo target/, WASM, node_modules, and .env files
db393ca Add .env.example with VITE_CONTRACT_ID, VITE_NETWORK_PASSPHRASE, and VITE_RPC_URL placeholders
8cb9e65 Add global CSS with dark-mode Stellar-branded design system
c84a983 Add React entry point with StrictMode and Buffer polyfill
6884301 Add App root component with header, contract banner, and layout
07e5ec4 Add AuctionList component with parallel fetch, lookup by ID, and per-card refresh
60c4b98 Add AuctionCard component with auction info, deadline countdown, and actions
3b9394b Implement PlaceBid component with bid validation and claim refund flow
2634132 Add CreateAuction React component with all auction creation fields
1d38267 Add WalletConnect component with Freighter connect/disconnect and Testnet validation
092cf7d Add Freighter wallet utility: connectWallet, getConnectedPublicKey, assertTestnet
7213010 Connect frontend to Soroban contract via Stellar SDK
4dae00c Add Vite build config and HTML entry point with Buffer polyfill
08885a6 Add frontend package.json with React 18, Stellar SDK v13, and Freighter API
9f32173 Add Auction struct with all fields, AuctionStatus, DataKey, and full contract implementation
dd059dc Add contract package manifest with soroban-sdk v22 dependency
4f72a97 Add Cargo workspace configuration with release profile optimized for WASM size
```

---

## License

MIT — free to use, modify, and distribute.
