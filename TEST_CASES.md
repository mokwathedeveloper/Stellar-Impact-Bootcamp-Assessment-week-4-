# No-Loss Auction Protocol — Test Cases

**Project:** No-Loss Auction Protocol — Stellar Soroban  
**Contract ID:** `CA2SXTCIJGNMQHC33EHTBF4KF3DW2EGA5GXFZMDTPHRGFWRWTEZ2RLWS`  
**Network:** Stellar Testnet  
**Frontend:** https://no-loss-auction.vercel.app  
**QA Date:** 2026-05-30  
**Status:** ✅ All tests passed on live testnet

---

## Test Environment

| Item | Value |
|---|---|
| Contract Network | Stellar Testnet |
| RPC Endpoint | `https://soroban-testnet.stellar.org` |
| Stellar CLI Version | `26.0.0` |
| Frontend Deployment | Vercel (Production) |
| Test Identity | `moffat` (`GDPTMWBY6RCDEOCQ2WHUG2V7WWCXXIP7T56E46DTF2WZ3MCY47AGZICR`) |
| Test Token | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

---

## Section 1 — Smart Contract: `create_auction`

---

### TC-001 — Create auction with valid parameters

| Field | Detail |
|---|---|
| **ID** | TC-001 |
| **Category** | Smart Contract / Positive |
| **Function** | `create_auction` |
| **Priority** | Critical |

**Preconditions**
- A funded testnet identity exists.
- A future Unix timestamp is available as the deadline.

**Input**

```
caller      = GDPTMWBY6RCDEOCQ2WHUG2V7WWCXXIP7T56E46DTF2WZ3MCY47AGZICR
description = "QA Auction: Active 24h"
token       = CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
starting_bid = 5000000
deadline    = now() + 86400
```

**Expected Result**
- Transaction succeeds.
- Returns a sequential numeric auction ID (e.g. `2`).
- Event `auction_created` is emitted with the correct parameters.
- `get_auction(id)` returns `status: Active`, `highest_bid = starting_bid`, `highest_bidder = null`.

**Actual Result** ✅  
Transaction succeeded. Auction ID `2` returned. `auction_created` event emitted. State confirmed via `get_auction`.

---

### TC-002 — Create auction with a deadline in the past

| Field | Detail |
|---|---|
| **ID** | TC-002 |
| **Category** | Smart Contract / Negative |
| **Function** | `create_auction` |
| **Priority** | Critical |

**Input**

```
deadline = 1000000  (Unix timestamp: 1970-01-12, far in the past)
```

**Expected Result**
- Transaction simulation fails with `HostError: Error(WasmVm, InvalidAction)`.
- No auction is created.
- Contract state unchanged.

**Actual Result** ✅  
Simulation rejected with `VM call trapped: UnreachableCodeReached` — assertion `deadline > ledger.timestamp()` fired correctly.

---

### TC-003 — Create auction with zero starting bid

| Field | Detail |
|---|---|
| **ID** | TC-003 |
| **Category** | Smart Contract / Negative |
| **Function** | `create_auction` |
| **Priority** | High |

**Input**

```
starting_bid = 0
```

**Expected Result**
- Transaction simulation fails.
- Assertion `starting_bid > 0` prevents execution.

**Actual Result** ✅  
Simulation rejected with `HostError: WasmVm / InvalidAction`.

---

## Section 2 — Smart Contract: `get_auction`

---

### TC-004 — Retrieve an existing auction by ID

| Field | Detail |
|---|---|
| **ID** | TC-004 |
| **Category** | Smart Contract / Positive |
| **Function** | `get_auction` |
| **Priority** | Critical |

**Input**

```
auction_id = 3
```

**Expected Result**
- Simulation returns the full `Auction` struct.
- All fields (`id`, `description`, `owner`, `token`, `starting_bid`, `highest_bid`, `highest_bidder`, `deadline`, `status`) are present and correct.

**Actual Result** ✅  
Returned `{"id":3,"description":"QA Bid Test Auction","status":"Active","starting_bid":"10000000","highest_bid":"10000000","highest_bidder":null,...}`.

---

### TC-005 — Retrieve a non-existent auction ID

| Field | Detail |
|---|---|
| **ID** | TC-005 |
| **Category** | Smart Contract / Negative |
| **Function** | `get_auction` |
| **Priority** | High |

**Input**

```
auction_id = 999
```

**Expected Result**
- Simulation fails with `HostError: WasmVm / InvalidAction`.
- Panic message `"auction 999 does not exist"` is raised.

**Actual Result** ✅  
Simulation rejected with the expected error.

---

## Section 3 — Smart Contract: `cancel_auction`

---

### TC-006 — Cancel an active auction with no bids

| Field | Detail |
|---|---|
| **ID** | TC-006 |
| **Category** | Smart Contract / Positive |
| **Function** | `cancel_auction` |
| **Priority** | Critical |

**Preconditions**
- Auction `#2` exists with `status: Active` and `highest_bidder: null`.

**Input**

```
caller     = owner address
auction_id = 2
```

**Expected Result**
- Transaction succeeds.
- Event `auction_cancelled` is emitted.
- `get_auction(2)` returns `status: Cancelled`.

**Actual Result** ✅  
Succeeded. `auction_cancelled` event emitted. Status confirmed as `Cancelled`.

---

### TC-007 — Cancel an already-cancelled auction

| Field | Detail |
|---|---|
| **ID** | TC-007 |
| **Category** | Smart Contract / Negative |
| **Function** | `cancel_auction` |
| **Priority** | High |

**Preconditions**
- Auction `#2` has `status: Cancelled` (from TC-006).

**Input**

```
caller     = owner address
auction_id = 2
```

**Expected Result**
- Transaction simulation fails.
- Assertion `status == Active` prevents double-cancellation.

**Actual Result** ✅  
Simulation rejected: `VM call trapped: UnreachableCodeReached` on `cancel_auction`.

---

### TC-008 — Cancel a Finalized auction

| Field | Detail |
|---|---|
| **ID** | TC-008 |
| **Category** | Smart Contract / Negative |
| **Function** | `cancel_auction` |
| **Priority** | High |

**Preconditions**
- Auction `#1` has `status: Finalized`.

**Input**

```
caller     = owner address
auction_id = 1
```

**Expected Result**
- Transaction simulation fails.
- Finalized auctions cannot be cancelled.

**Actual Result** ✅  
Simulation rejected with `HostError`.

---

## Section 4 — Smart Contract: `finalize_auction`

---

### TC-009 — Finalize an active auction after the deadline

| Field | Detail |
|---|---|
| **ID** | TC-009 |
| **Category** | Smart Contract / Positive |
| **Function** | `finalize_auction` |
| **Priority** | Critical |

**Preconditions**
- Auction `#1` is active and its deadline (`1780102667`) has passed (current time `1780102872`).

**Input**

```
auction_id = 1
```

**Expected Result**
- Transaction succeeds.
- With no bids: `auction_finalized_no_bids` event emitted, no token transfer occurs.
- `get_auction(1)` returns `status: Finalized`.

**Actual Result** ✅  
Succeeded. Event `auction_finalized_no_bids` emitted. Status confirmed as `Finalized`.

---

### TC-010 — Finalize an active auction before the deadline

| Field | Detail |
|---|---|
| **ID** | TC-010 |
| **Category** | Smart Contract / Negative |
| **Function** | `finalize_auction` |
| **Priority** | Critical |

**Preconditions**
- Auction `#3` is active with a deadline 24 hours in the future.

**Input**

```
auction_id = 3
```

**Expected Result**
- Transaction simulation fails.
- Assertion `ledger.timestamp() > deadline` prevents premature finalization.

**Actual Result** ✅  
Simulation rejected: `VM call trapped: UnreachableCodeReached` on `finalize_auction`.

---

## Section 5 — Smart Contract: `get_refund`

---

### TC-011 — Query refund for address with no pending refund

| Field | Detail |
|---|---|
| **ID** | TC-011 |
| **Category** | Smart Contract / Positive |
| **Function** | `get_refund` |
| **Priority** | Medium |

**Input**

```
auction_id = 3
bidder     = GDPTMWBY6RCDEOCQ2WHUG2V7WWCXXIP7T56E46DTF2WZ3MCY47AGZICR
```

**Expected Result**
- Returns `"0"` (no refund pending).
- Does not panic or throw.

**Actual Result** ✅  
Returned `"0"`.

---

## Section 6 — Smart Contract: `get_auction_count`

---

### TC-012 — Verify auction count reflects all created auctions

| Field | Detail |
|---|---|
| **ID** | TC-012 |
| **Category** | Smart Contract / Positive |
| **Function** | `get_auction_count` |
| **Priority** | Medium |

**Preconditions**
- Three auctions have been created (IDs 1, 2, 3).

**Expected Result**
- Returns `3`.

**Actual Result** ✅  
Returned `3`.

---

## Section 7 — Smart Contract: State Machine Integrity

---

### TC-013 — Contract preserves all three lifecycle statuses correctly

| Field | Detail |
|---|---|
| **ID** | TC-013 |
| **Category** | Smart Contract / Integration |
| **Priority** | Critical |

**Verification**

| Auction | Status | Verified |
|---|---|---|
| `#1` | `Finalized` | ✅ |
| `#2` | `Cancelled` | ✅ |
| `#3` | `Active` | ✅ |

**Actual Result** ✅  
All three states confirmed on-chain via `get_auction`.

---

## Section 8 — Frontend Deployment

---

### TC-014 — Live site returns HTTP 200

| Field | Detail |
|---|---|
| **ID** | TC-014 |
| **Category** | Frontend / Deployment |
| **Priority** | Critical |

**Steps**
1. Send `GET` request to `https://no-loss-auction.vercel.app`.

**Expected Result**
- HTTP status: `200 OK`.
- `content-type: text/html; charset=utf-8`.
- Response body includes `<div id="root">` and correct asset references.

**Actual Result** ✅  
`200 OK` in `0.81s`. CDN cache: HIT. Content-type correct.

---

### TC-015 — JS bundle contains the deployed contract ID

| Field | Detail |
|---|---|
| **ID** | TC-015 |
| **Category** | Frontend / Configuration |
| **Priority** | Critical |

**Steps**
1. Fetch the JS bundle from the live URL.
2. Search for the contract ID string.

**Expected Result**
- Bundle contains `CA2SXTCIJGNMQHC33EHTBF4KF3DW2EGA5GXFZMDTPHRGFWRWTEZ2RLWS`.
- Placeholder value `CAAAAAAAAAAAAA...` is absent.

**Actual Result** ✅  
Contract ID confirmed in production bundle.

---

### TC-016 — CSS bundle contains all responsive utility classes

| Field | Detail |
|---|---|
| **ID** | TC-016 |
| **Category** | Frontend / Responsiveness |
| **Priority** | High |

**Steps**
1. Fetch the CSS bundle from the live URL.
2. Check for responsive class names.

**Expected Result**
- `.mobile-tab` — mobile tab switcher class present.
- `safe-area` — iOS notch inset support present.
- `dvh` — dynamic viewport height present.
- `.hint-address` — token address autofill chip present.

**Actual Result** ✅  
All four classes confirmed in production CSS.

---

### TC-017 — SPA routing: arbitrary paths return 200

| Field | Detail |
|---|---|
| **ID** | TC-017 |
| **Category** | Frontend / Routing |
| **Priority** | Medium |

**Steps**
1. Send `GET` request to `https://no-loss-auction.vercel.app/auction/1`.

**Expected Result**
- HTTP `200 OK` (Vercel rewrite rule redirects to `index.html`).
- React app loads and handles routing client-side.

**Actual Result** ✅  
`200 OK` returned for deep path.

---

## Section 9 — Frontend Logic (Code Review)

---

### TC-018 — `queryContract` uses a random valid keypair for simulation

| Field | Detail |
|---|---|
| **ID** | TC-018 |
| **Category** | Frontend / SDK Integration |
| **Priority** | Critical |

**Steps**
1. Review `frontend/src/utils/contract.js`, function `queryContract`.
2. Verify it does not use a hardcoded public key.

**Expected Result**
- `Keypair.random().publicKey()` is used as the simulation source account.
- No `getAccount` network call is made for read-only queries.
- `Account` constructor always receives a valid Ed25519 key.

**Actual Result** ✅  
`queryContract` uses `new Account(Keypair.random().publicKey(), "0")` — confirmed in source.

---

### TC-019 — `invokeContract` uses correct SDK v13 RPC import path

| Field | Detail |
|---|---|
| **ID** | TC-019 |
| **Category** | Frontend / SDK Integration |
| **Priority** | Critical |

**Steps**
1. Review `frontend/src/utils/contract.js` imports.

**Expected Result**
- `Server`, `Api`, and `assembleTransaction` are imported from `@stellar/stellar-sdk/rpc`.
- `SorobanRpc` (removed in v13) is **not** referenced anywhere.

**Actual Result** ✅  
Imports confirmed:
```js
import { Server, Api as RpcApi, assembleTransaction } from "@stellar/stellar-sdk/rpc";
```

---

## QA Summary

| Section | Total | Passed | Failed |
|---|---|---|---|
| `create_auction` | 3 | 3 | 0 |
| `get_auction` | 2 | 2 | 0 |
| `cancel_auction` | 3 | 3 | 0 |
| `finalize_auction` | 2 | 2 | 0 |
| `get_refund` | 1 | 1 | 0 |
| `get_auction_count` | 1 | 1 | 0 |
| State Machine Integrity | 1 | 1 | 0 |
| Frontend Deployment | 4 | 4 | 0 |
| Frontend Logic | 2 | 2 | 0 |
| **Total** | **19** | **19** | **0** |

**Overall Result: ✅ PASS — All 19 test cases passed on live Stellar Testnet.**

---

## On-Chain Evidence

| Transaction | Purpose | Explorer |
|---|---|---|
| `ed15f92b…` | Create auction #1 | [View](https://stellar.expert/explorer/testnet/tx/ed15f92b73152cd5710b9ad00a1890393371bb9c31e1ce8450e07ccd2f332bcf) |
| `95a3e807…` | Finalize auction #1 (no bids, deadline elapsed) | [View](https://stellar.expert/explorer/testnet/tx/95a3e80770865eb4e34d50fef7f1d353457b06dc0a244606b1cdab37d75cc480) |
| QA Auction #2 | Created + cancelled | Testnet ledger |
| QA Auction #3 | Created, Active, finalize-before-deadline rejected | Testnet ledger |
