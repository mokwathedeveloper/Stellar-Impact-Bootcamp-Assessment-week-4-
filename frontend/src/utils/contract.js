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
  "CA2SXTCIJGNMQHC33EHTBF4KF3DW2EGA5GXFZMDTPHRGFWRWTEZ2RLWS";

/** Stellar network passphrase */
export const NETWORK_PASSPHRASE =
  import.meta.env.VITE_NETWORK_PASSPHRASE ||
  "Test SDF Network ; September 2015";

/** Soroban RPC endpoint */
export const RPC_URL =
  import.meta.env.VITE_RPC_URL || "https://soroban-testnet.stellar.org";

// ──────────────────────────────────────────────────────────────────────────
// SDK imports — @stellar/stellar-sdk v13 moved RPC to a separate submodule
// ──────────────────────────────────────────────────────────────────────────

import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  scValToNative,
  nativeToScVal,
  Address,
  Keypair,
  Account,
} from "@stellar/stellar-sdk";

// In SDK v13 the RPC utilities live at "@stellar/stellar-sdk/rpc"
import {
  Server,
  Api as RpcApi,
  assembleTransaction,
} from "@stellar/stellar-sdk/rpc";

// ──────────────────────────────────────────────────────────────────────────
//  Lazy singletons — created on first use so module-level errors can't
//  crash the whole page during initial React render.
// ──────────────────────────────────────────────────────────────────────────

let _server = null;
let _contract = null;

function getServer() {
  if (!_server) _server = new Server(RPC_URL);
  return _server;
}

function getContract() {
  if (!_contract) _contract = new Contract(CONTRACT_ID);
  return _contract;
}

// ──────────────────────────────────────────────────────────────────────────
//  Core invocation helpers
// ──────────────────────────────────────────────────────────────────────────

/**
 * Build, simulate, sign (via Freighter), and submit a Soroban transaction.
 *
 * @param {string} publicKey  - Caller's Stellar public key (G…)
 * @param {Function} buildOp  - Receives the contract instance, returns an Operation
 * @returns {Promise<any>}    - Decoded return value of the contract call
 */
export async function invokeContract(publicKey, buildOp) {
  const server = getServer();
  const contract = getContract();

  // 1. Load the account sequence number from the network
  const account = await server.getAccount(publicKey);

  // 2. Build the transaction with the Soroban operation
  const operation = buildOp(contract);
  let tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  // 3. Simulate to get resource footprint and fee estimates
  const simResult = await server.simulateTransaction(tx);
  if (RpcApi.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`);
  }

  // 4. Assemble the transaction with correct soroban data / auth entries
  const preparedTx = assembleTransaction(tx, simResult).build();

  // 5. Sign with Freighter wallet (imported here to avoid SSR issues)
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
  } while (getResult.status === RpcApi.GetTransactionStatus.NOT_FOUND);

  if (getResult.status === RpcApi.GetTransactionStatus.FAILED) {
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
  const server = getServer();
  const contract = getContract();

  // Soroban simulation does not require a funded account — generate a fresh
  // random keypair so the Account constructor always receives a valid key.
  const account = new Account(Keypair.random().publicKey(), "0");

  const operation = buildOp(contract);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);
  if (RpcApi.isSimulationError(simResult)) {
    throw new Error(`Query simulation failed: ${simResult.error}`);
  }

  return scValToNative(simResult.result.retval);
}

// ──────────────────────────────────────────────────────────────────────────
//  Contract method wrappers
// ──────────────────────────────────────────────────────────────────────────

export async function createAuction(publicKey, description, tokenAddress, startingBid, deadline) {
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

export async function claimRefund(publicKey, auctionId) {
  return invokeContract(publicKey, (contract) =>
    contract.call(
      "claim_refund",
      new Address(publicKey).toScVal(),
      nativeToScVal(auctionId, { type: "u64" })
    )
  );
}

export async function finalizeAuction(publicKey, auctionId) {
  return invokeContract(publicKey, (contract) =>
    contract.call(
      "finalize_auction",
      nativeToScVal(auctionId, { type: "u64" })
    )
  );
}

export async function cancelAuction(publicKey, auctionId) {
  return invokeContract(publicKey, (contract) =>
    contract.call(
      "cancel_auction",
      new Address(publicKey).toScVal(),
      nativeToScVal(auctionId, { type: "u64" })
    )
  );
}

export async function getAuction(auctionId) {
  return queryContract((contract) =>
    contract.call("get_auction", nativeToScVal(auctionId, { type: "u64" }))
  );
}

export async function getRefund(auctionId, bidder) {
  return queryContract((contract) =>
    contract.call(
      "get_refund",
      nativeToScVal(auctionId, { type: "u64" }),
      new Address(bidder).toScVal()
    )
  );
}

export async function getAuctionCount() {
  return queryContract((contract) => contract.call("get_auction_count"));
}

// ──────────────────────────────────────────────────────────────────────────
//  Formatting helpers used by UI components
// ──────────────────────────────────────────────────────────────────────────

/** Convert raw token units to display string (7 decimal places = XLM stroops). */
export function formatTokenAmount(raw, decimals = 7) {
  if (raw === null || raw === undefined) return "0";
  const bigRaw = BigInt(raw);
  const divisor = BigInt(10 ** decimals);
  const whole = bigRaw / divisor;
  const frac = bigRaw % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "") || "0";
  return `${whole}.${fracStr}`;
}

/** Convert a display amount string (e.g. "10.5") to raw token units. */
export function parseTokenAmount(display, decimals = 7) {
  const [whole = "0", frac = ""] = String(display).split(".");
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
