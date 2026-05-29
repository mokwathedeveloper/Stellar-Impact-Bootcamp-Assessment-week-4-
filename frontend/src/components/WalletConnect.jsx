/**
 * WalletConnect — header wallet connection button.
 *
 * Shows a "Connect Wallet" button when no account is connected and
 * a shortened public key chip + disconnect option when one is active.
 */

import { useState } from "react";
import { connectWallet, shortenKey, assertTestnet } from "../utils/stellar";

export default function WalletConnect({ publicKey, onConnect }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConnect() {
    setLoading(true);
    setError("");
    try {
      const key = await connectWallet();

      // Warn (non-blocking) if the wallet is not on Testnet
      const onTestnet = await assertTestnet();
      if (!onTestnet) {
        setError(
          "Warning: your Freighter wallet is not set to Testnet. " +
            "Switch networks in Freighter settings to interact with this dApp."
        );
      }

      onConnect(key);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wallet-connect">
      {publicKey ? (
        <div className="wallet-info">
          <span className="wallet-badge">
            <span className="wallet-dot" />
            {shortenKey(publicKey)}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onConnect(null)}
            title="Disconnect wallet"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          className="btn btn-primary"
          onClick={handleConnect}
          disabled={loading}
        >
          {loading ? "Connecting…" : "Connect Freighter Wallet"}
        </button>
      )}
      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}
