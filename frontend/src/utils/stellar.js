/**
 * stellar.js — Freighter wallet connection helpers
 *
 * Wraps the @stellar/freighter-api package with React-friendly async
 * utilities so components can request the user's public key without
 * duplicating wallet detection logic.
 */

import {
  isConnected,
  getPublicKey,
  isAllowed,
  setAllowed,
  getNetwork,
} from "@stellar/freighter-api";

/**
 * Check whether the Freighter browser extension is installed.
 * Returns false in non-browser environments (SSR, Node tests).
 */
export async function isFreighterInstalled() {
  try {
    const result = await isConnected();
    return result.isConnected;
  } catch {
    return false;
  }
}

/**
 * Request permission to read the user's Stellar public key.
 *
 * - Checks extension presence.
 * - Requests `setAllowed` if not already approved.
 * - Retrieves and returns the G… public key.
 *
 * @throws {Error} If Freighter is not installed or the user rejects access.
 * @returns {Promise<string>} Stellar public key (G…)
 */
export async function connectWallet() {
  const installed = await isFreighterInstalled();
  if (!installed) {
    throw new Error(
      "Freighter wallet is not installed. " +
        "Please install it from https://www.freighter.app/ and refresh."
    );
  }

  // Grant access if not already allowed
  const allowed = await isAllowed();
  if (!allowed.isAllowed) {
    const setResult = await setAllowed();
    if (!setResult.isAllowed) {
      throw new Error("User denied wallet access.");
    }
  }

  // Retrieve the active account
  const keyResult = await getPublicKey();
  if (keyResult.error) {
    throw new Error(`Could not retrieve public key: ${keyResult.error}`);
  }

  return keyResult.publicKey;
}

/**
 * Return the currently connected public key without prompting, or null.
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
 * Warns (but does not block) if it is on a different network.
 *
 * @returns {Promise<boolean>} true when network is TESTNET
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
 * Truncate a G… public key for display: "GABC…XYZ"
 *
 * @param {string} key
 * @param {number} chars - characters to show on each end
 */
export function shortenKey(key, chars = 6) {
  if (!key || key.length < chars * 2) return key;
  return `${key.slice(0, chars)}…${key.slice(-chars)}`;
}
