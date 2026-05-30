import { useState, useCallback } from "react";
import WalletConnect from "./components/WalletConnect";
import CreateAuction from "./components/CreateAuction";
import AuctionList from "./components/AuctionList";
import { CONTRACT_ID, NETWORK_PASSPHRASE } from "./utils/contract";
import "./styles.css";

export default function App() {
  const [publicKey, setPublicKey] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // Mobile tab: "create" | "browse"
  const [mobileTab, setMobileTab] = useState("browse");

  const handleAuctionCreated = useCallback(() => {
    setRefreshTrigger((n) => n + 1);
    // After creating, switch to browse tab so user sees their new auction
    setMobileTab("browse");
  }, []);

  return (
    <div className="app">

      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-brand">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <circle cx="16" cy="16" r="15" stroke="#7B61FF" strokeWidth="2" />
            <path
              d="M10 22 L16 10 L22 22 M12.5 18 H19.5"
              stroke="#7B61FF"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <h1 className="brand-title">No-Loss Auction</h1>
          <span className="brand-network" aria-label="Network: Stellar Testnet">
            Testnet
          </span>
        </div>

        <WalletConnect publicKey={publicKey} onConnect={setPublicKey} />
      </header>

      {/* ── Contract Info Banner ── */}
      <div className="contract-banner" role="complementary" aria-label="Deployed contract info">
        <span className="contract-label">Contract:</span>
        <code className="contract-id" title={CONTRACT_ID}>{CONTRACT_ID}</code>
        {/* Hide the long passphrase on mobile via CSS class */}
        <span className="banner-network">
          <span className="contract-label">Network:</span>
          <span>{NETWORK_PASSPHRASE}</span>
        </span>
      </div>

      {/* ── Main ── */}
      <main className="app-main">

        {/* Mobile tab switcher — hidden on ≥900px by CSS */}
        <div className="mobile-tabs" role="tablist" aria-label="Section navigation">
          <button
            role="tab"
            aria-selected={mobileTab === "browse"}
            className={`mobile-tab ${mobileTab === "browse" ? "active" : ""}`}
            onClick={() => setMobileTab("browse")}
          >
            Browse Auctions
          </button>
          <button
            role="tab"
            aria-selected={mobileTab === "create"}
            className={`mobile-tab ${mobileTab === "create" ? "active" : ""}`}
            onClick={() => setMobileTab("create")}
          >
            + Create
          </button>
        </div>

        {/* Sidebar — hidden on mobile when browse tab is active */}
        <aside
          className={`sidebar ${mobileTab === "browse" ? "hidden" : ""}`}
          role="tabpanel"
          aria-label="Create auction"
        >
          <CreateAuction publicKey={publicKey} onAuctionCreated={handleAuctionCreated} />

          <div className="card info-card">
            <h3 className="card-title">How it works</h3>
            <ol className="how-list">
              <li>Connect your Freighter wallet (Testnet).</li>
              <li>Create an auction with a description, token, starting bid, and deadline.</li>
              <li>Other users place bids — each new bid refunds the previous leader automatically.</li>
              <li>Anyone can finalize the auction once the deadline passes.</li>
              <li>The winner is declared; the owner receives the highest bid.</li>
              <li>Outbid participants click "Claim Refund" to recover their tokens.</li>
            </ol>
          </div>
        </aside>

        {/* Content — hidden on mobile when create tab is active */}
        <div
          className={`content ${mobileTab === "create" ? "hidden" : ""}`}
          role="tabpanel"
          aria-label="Auction list"
        >
          <AuctionList publicKey={publicKey} refreshTrigger={refreshTrigger} />
        </div>

      </main>

      {/* ── Footer ── */}
      <footer className="app-footer">
        <span>No-Loss Auction · Stellar Soroban Testnet</span>
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
          Explorer ↗
        </a>
      </footer>

    </div>
  );
}
