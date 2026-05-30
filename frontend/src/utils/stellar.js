/**
 * stellar.js — Freighter wallet connection helpers
 *
 * Freighter API v2 key facts:
 *  - isConnected()   → true only if extension is installed AND site is already whitelisted
 *  - isAllowed()     → true if this site was previously granted access
 *  - setAllowed()    → legacy v1 API; does NOT open a popup in v2
 *  - requestAccess() → v2 API: opens the Freighter permission popup and returns
 *                      the public key when the user approves
 *  - getPublicKey()  → returns key if already allowed, otherwise errors
 */

import {
  isConnected,
  isAllowed,
  requestAccess,
  getPublicKey,
  getNetwork,
} from "@stellar/freighter-api";

// ──────────────────────────────────────────────────────────────────────────────

/**
 * Check whether the Freighter extension is present in the browser.
 *
 * Uses isConnected() — if the call resolves (any value, including false)
 * the extension is installed.  If it throws, the extension is absent.
 *
 * We do NOT check result.isConnected here because that is false on first
 * visit (site not yet whitelisted) even when the extension IS installed.
 */
export async function isFreighterInstalled() {
  try {
    await isConnected(); // resolves if extension exists, throws if absent
    return true;
  } catch {
    return false;
  }
}

/**
 * Connect the Freighter wallet and return the active public key.
 *
 * Flow:
 *  1. If already allowed  → call getPublicKey() directly (no popup).
 *  2. If not yet allowed  → call requestAccess() which opens the
 *     Freighter permission popup and returns the key on approval.
 *
 * requestAccess() is the correct Freighter API v2 method for step 2.
 * setAllowed() is a legacy v1 call that no longer opens a popup.
 *
 * @throws {Error} Extension not installed, user rejected, or key unavailable.
 * @returns {Promise<string>} Stellar public key (G…)
 */
export async function connectWallet() {
  // ── 1. Confirm extension is present ──────────────────────────────────────
  const installed = await isFreighterInstalled();
  if (!installed) {
    throw new Error(
      "Freighter wallet is not installed. " +
        "Please install it from https://www.freighter.app/ and refresh."
    );
  }

  // ── 2. Check if site is already whitelisted ───────────────────────────────
  let alreadyAllowed = false;
  try {
    const result = await isAllowed();
    alreadyAllowed = result.isAllowed;
  } catch {
    alreadyAllowed = false;
  }

  // ── 3a. Site already allowed — get key silently ───────────────────────────
  if (alreadyAllowed) {
    let keyResult;
    try {
      keyResult = await getPublicKey();
    } catch (err) {
      throw new Error("Could not retrieve public key from Freighter. Make sure the wallet is unlocked.");
    }
    if (keyResult.error) {
      throw new Error(`Could not retrieve public key: ${keyResult.error}`);
    }
    return keyResult.publicKey;
  }

  // ── 3b. Site not yet allowed — open the permission popup ─────────────────
  // requestAccess() is the Freighter v2 method that shows the popup and
  // returns { publicKey } on approval or { error } on rejection.
  let accessResult;
  try {
    accessResult = await requestAccess();
  } catch (err) {
    throw new Error(
      "Could not open Freighter. Make sure the extension is unlocked and try again."
    );
  }

  if (accessResult.error) {
    // User clicked Reject in the Freighter popup
    throw new Error("Access rejected. Please approve the connection in Freighter and try again.");
  }

  if (!accessResult.publicKey) {
    throw new Error("No public key returned. Make sure Freighter is unlocked and try again.");
  }

  return accessResult.publicKey;
}

/**
 * Return the currently allowed public key without prompting, or null.
 * Safe to call on page load — never throws.
 *
 * @returns {Promise<string|null>}
 */
export async function getConnectedPublicKey() {
  try {
    const allowed = await isAllowed();
    if (!allowed.isAllowed) return null;
    const keyResult = await getPublicKey();
    return keyResult.error ? null : keyResult.publicKey;
  } catch {
    return null;
  }
}

/**
 * Verify the wallet is pointed at Stellar Testnet.
 * Returns false on any error (non-blocking).
 *
 * @returns {Promise<boolean>}
 */
export async function assertTestnet() {
  try {
    const netResult = await getNetwork();
    return netResult.network === "TESTNET";
  } catch {
    return false;
  }
}

/**
 * Truncate a G… public key for display, e.g. "GABC12…XYZ99"
 *
 * @param {string} key   - Full Stellar public key
 * @param {number} chars - Characters to show on each side (default 6)
 */
export function shortenKey(key, chars = 6) {
  if (!key || key.length < chars * 2) return key;
  return `${key.slice(0, chars)}…${key.slice(-chars)}`;
}
