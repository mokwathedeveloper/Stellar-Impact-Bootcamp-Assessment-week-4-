# Stellar Impact Bootcamp — Week 4 Assessment Submission

---

## Full Name

Moffat Mokwa

---

## GitHub Repository

[https://github.com/mokwathedeveloper/Stellar-Impact-Bootcamp-Assessment-week-4-](https://github.com/mokwathedeveloper/Stellar-Impact-Bootcamp-Assessment-week-4-)

---

## Project: No-Loss Auction Protocol — Stellar Soroban

### Contract ID (Testnet)

```
CA2SXTCIJGNMQHC33EHTBF4KF3DW2EGA5GXFZMDTPHRGFWRWTEZ2RLWS
```

> View on Stellar Expert: [stellar.expert/explorer/testnet/contract/CA2SXTCIJGNMQHC33EHTBF4KF3DW2EGA5GXFZMDTPHRGFWRWTEZ2RLWS](https://stellar.expert/explorer/testnet/contract/CA2SXTCIJGNMQHC33EHTBF4KF3DW2EGA5GXFZMDTPHRGFWRWTEZ2RLWS)

---

## Deployed Frontend

**[https://no-loss-auction.vercel.app](https://no-loss-auction.vercel.app)**

---

## What Was Built

All core features are implemented and fully integrated with the frontend.

### Smart Contract (Rust / Soroban)

| Function | Description |
|---|---|
| `create_auction` | Creates an auction with an ID, description, SEP-41 token address, starting bid, and deadline timestamp |
| `place_bid` | Validates the bid exceeds the current highest bid, transfers tokens from the bidder to the contract, and stores the displaced bidder's stake as a claimable refund (pull-over-push pattern) |
| `claim_refund` | Outbid participants pull their tokens back at any time using the CEI (Checks-Effects-Interactions) pattern to prevent double-claims |
| `finalize_auction` | Permissionless after the deadline; transfers the winning bid to the auction owner |
| `cancel_auction` | Owner-only, blocked once any bid has been placed — the core no-loss guarantee |
| `get_auction` | Returns full auction data by ID |
| `get_refund` | Returns pending refund balance for a given bidder |
| `get_auction_count` | Returns total number of auctions ever created |

### Frontend (React + Vite + @stellar/stellar-sdk v13)

- Wallet connection via Freighter browser extension with Testnet network validation
- Create Auction form (description, SEP-41 token, starting bid, datetime deadline)
- Live auction list — all auctions fetched in parallel from the contract
- Per-auction card showing highest bid, highest bidder, live countdown, and status badge
- Inline bid form with validation against the current highest bid
- Claim Refund button with on-chain pending balance check
- Finalize and Cancel buttons with ownership and state guards
- Fully responsive across mobile, tablet, and desktop (4 breakpoints: 480 / 640 / 900 / 1200 px, iOS safe-area insets, 44 px minimum touch targets)

---

## Challenges Encountered

### 1. Rust Toolchain Misconfiguration

The `cargo` component was missing from the stable toolchain after installation, producing `"cargo binary not applicable"` errors. Fixed by removing and force-reinstalling the `cargo` and `rust-std` components individually via `rustup component remove / add`.

### 2. Missing x86\_64 Standard Library for Build Scripts

Soroban SDK dependencies (`serde`, `proc-macro2`) use build scripts that require the host target's standard library. The `rust-std` component for `x86_64-unknown-linux-gnu` was listed as installed but its `lib/` directory was empty. Fixed by removing and re-adding the component to force a fresh download.

### 3. Stellar SDK v13 Breaking Import Change

`@stellar/stellar-sdk` v13 moved all RPC utilities out of the main export — `SorobanRpc` no longer exists at the top level. It was renamed to `rpc` and relocated to the `@stellar/stellar-sdk/rpc` submodule. This caused a silent module-level crash that rendered a completely blank page with no visible console error. Fixed by updating all imports to use the correct submodule path and making `Server` / `Contract` initialization lazy, so any future import error cannot crash React before it mounts.

### 4. Vercel Root Directory Misconfiguration

The GitHub-based Vercel deployment failed with `ENOENT: package.json not found` because Vercel was scanning the repo root instead of the `frontend/` subdirectory. Fixed by patching the project's `rootDirectory` setting to `"frontend"` via the Vercel REST API, and adding a `.vercelignore` to exclude the Rust `target/` directory (243 MB of compiled build artifacts) from uploads.

### 5. iOS and Cross-Browser Responsive Design

The initial CSS used a single breakpoint and inputs with `font-size` below 16 px, causing iOS Safari to zoom in on focus. Fixed by rewriting the stylesheet mobile-first with four breakpoints (480 / 640 / 900 / 1200 px), setting all inputs to `font-size: 16px`, adding `env(safe-area-inset-*)` padding for notched phones (iPhone X+), ensuring 44 px minimum touch targets throughout, and adding a mobile tab switcher (Browse / Create) so both panels are accessible without scrolling below the fold on small screens.

---

## Quick Reference

| Field | Value |
|---|---|
| **Email** | mokwamoffat@gmail.com |
| **Full Name** | Moffat Mokwa |
| **GitHub** | https://github.com/mokwathedeveloper/Stellar-Impact-Bootcamp-Assessment-week-4- |
| **Contract ID** | `CA2SXTCIJGNMQHC33EHTBF4KF3DW2EGA5GXFZMDTPHRGFWRWTEZ2RLWS` |
| **Frontend** | https://no-loss-auction.vercel.app |
| **Network** | Stellar Testnet |
