/**
 * App — root component for the No-Loss Auction dApp.
 *
 * Layout:
 *   Header  → app name + WalletConnect
 *   Banner  → shows CONTRACT_ID so users know which contract they're talking to
 *   Main    → CreateAuction (left) | AuctionList (right / below on mobile)
 *   Footer  → network info
 */

import { useState, useCallback } from "react";
import WalletConnect from "./components/WalletConnect";
import CreateAuction from "./components/CreateAuction";
import AuctionList from "./components/AuctionList";
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from "./utils/contract";
import "./styles.css";

export default function App() {
  const [publicKey, setPublicKey] = useState(null);
  // Increment to trigger AuctionList to refresh after a new auction is created
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleAuctionCreated = useCallback(() => {
    setRefreshTrigger((n) => n + 1);
  }, []);

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-brand">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <circle cx="16" cy="16" r="15" stroke="#7B61FF" strokeWidth="2" />
            <path d="M10 22 L16 10 L22 22 M12.5 18 H19.5" stroke="#7B61FF" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <h1 className="brand-title">No-Loss Auction</h1>
          <span className="brand-network">Stellar Testnet</span>
        </div>
        <WalletConnect publicKey={publicKey} onConnect={setPublicKey} />
      </header>

      {/* ── Contract Info Banner ── */}
      <div className="contract-banner">
        <span className="contract-label">Contract ID:</span>
        <code className="contract-id">{CONTRACT_ID}</code>
        <span className="contract-label">Network:</span>
        <span>{NETWORK_PASSPHRASE}</span>
      </div>

      {/* ── Main Content ── */}
      <main className="app-main">
        <aside className="sidebar">
          <CreateAuction
            publicKey={publicKey}
            onAuctionCreated={handleAuctionCreated}
          />

          {/* Quick-reference info */}
          <div className="card info-card">
            <h3 className="card-title">How it works</h3>
            <ol className="how-list">
              <li>Connect your Freighter wallet (Testnet).</li>
              <li>Create an auction with a description, SEP-41 token, starting bid, and deadline.</li>
              <li>Other users place bids — each new bid refunds the previous leader.</li>
              <li>Anyone can finalize the auction once the deadline passes.</li>
              <li>The winner is declared; the owner receives the highest bid.</li>
              <li>Outbid participants click "Claim Refund" to recover their tokens.</li>
            </ol>
          </div>
        </aside>

        <div className="content">
          <AuctionList publicKey={publicKey} refreshTrigger={refreshTrigger} />
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="app-footer">
        <span>No-Loss Auction Protocol — Stellar Soroban Testnet</span>
        <a
          href="https://developers.stellar.org/docs/smart-contracts"
          target="_blank"
          rel="noreferrer"
        >
          Soroban Docs ↗
        </a>
        <a
          href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`}
          target="_blank"
          rel="noreferrer"
        >
          View on Stellar Expert ↗
        </a>
      </footer>
    </div>
  );
}
