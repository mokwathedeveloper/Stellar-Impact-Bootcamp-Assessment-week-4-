/**
 * stellar.js — Freighter wallet connection helpers
 *
 * Wraps the @stellar/freighter-api package with React-friendly async
 * utilities so components can request the user's public key without
 * duplicating wallet detection logic.
 *
 * NOTE on Freighter API v2 behaviour:
 *   isConnected() returns { isConnected: false } when the site has NOT yet
 *   been granted access — even if the extension IS installed.  It is therefore
 *   not a reliable "extension present" check.  We use setAllowed() as the
 *   gating call instead: it opens the Freighter popup when the extension is
 *   present, and throws / errors when it is absent.
 */

import {
  isConnected,
  getPublicKey,
  isAllowed,
  setAllowed,
  getNetwork,
} from "@stellar/freighter-api";

/**
 * Attempt to detect whether Freighter is installed.
 *
 * Strategy: call isAllowed() (a lightweight read-only call).
 * - If it resolves (any value) → extension is present.
 * - If it throws              → extension is absent.
 *
 * isConnected() is intentionally NOT used here because in Freighter API v2
 * it returns { isConnected: false } on first visit (site not yet whitelisted),
 * which is indistinguishable from the extension being absent.
 */
export async function isFreighterInstalled() {
  try {
    await isAllowed();   // resolves to { isAllowed: boolean } when extension exists
    return true;
  } catch {
    return false;
  }
}

/**
 * Request permission to read the user's Stellar public key.
 *
 * Flow:
 *  1. Try isAllowed() — if it throws the extension is absent.
 *  2. If not yet allowed, call setAllowed() to open the Freighter popup.
 *  3. Retrieve and return the active account's public key.
 *
 * @throws {Error} Extension not installed, user rejected, or key unavailable.
 * @returns {Promise<string>} Stellar public key (G…)
 */
export async function connectWallet() {
  // ── Step 1: detect extension ──────────────────────────────────────────────
  let alreadyAllowed = false;
  try {
    const result = await isAllowed();
    alreadyAllowed = result.isAllowed;
  } catch {
    // isAllowed() threw — extension is genuinely not installed
    throw new Error(
      "Freighter wallet is not installed. " +
        "Please install it from https://www.freighter.app/ and refresh."
    );
  }

  // ── Step 2: request site access if not yet granted ────────────────────────
  if (!alreadyAllowed) {
    let setResult;
    try {
      setResult = await setAllowed();
    } catch {
      throw new Error(
        "Freighter wallet is not installed. " +
          "Please install it from https://www.freighter.app/ and refresh."
      );
    }
    if (!setResult.isAllowed) {
      throw new Error(
        "Access denied. Please click 'Connect' in the Freighter popup and try again."
      );
    }
  }

  // ── Step 3: retrieve the active public key ────────────────────────────────
  let keyResult;
  try {
    keyResult = await getPublicKey();
  } catch {
    throw new Error("Could not retrieve public key from Freighter.");
  }

  if (keyResult.error) {
    throw new Error(`Could not retrieve public key: ${keyResult.error}`);
  }

  return keyResult.publicKey;
}

/**
 * Return the currently connected public key without prompting, or null.
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
 * Verify the user's wallet is pointed at Testnet.
 * Returns false on any error (non-blocking check).
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
