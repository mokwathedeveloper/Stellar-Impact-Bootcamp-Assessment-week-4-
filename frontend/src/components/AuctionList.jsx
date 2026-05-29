/**
 * AuctionList — fetches and renders all auctions from the contract.
 *
 * Uses getAuctionCount() to determine how many auctions exist, then loads
 * each one in parallel.  Includes a manual Refresh button and a lookup
 * form to load a specific auction by ID.
 */

import { useState, useEffect, useCallback } from "react";
import AuctionCard from "./AuctionCard";
import { getAuction, getAuctionCount } from "../utils/contract";

export default function AuctionList({ publicKey, refreshTrigger }) {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lookupId, setLookupId] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const count = await getAuctionCount();
      if (count === 0n || count === 0) {
        setAuctions([]);
        return;
      }

      // Fetch all auctions in parallel (BigInt IDs from 1..count)
      const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
      const results = await Promise.allSettled(ids.map((id) => getAuction(id)));

      const loaded = results
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value);

      // Newest first
      setAuctions(loaded.reverse());
    } catch (err) {
      setError(`Failed to load auctions: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load on mount and whenever a new auction is created
  useEffect(() => {
    loadAll();
  }, [loadAll, refreshTrigger]);

  async function handleLookup(e) {
    e.preventDefault();
    if (!lookupId) return;
    setError("");
    try {
      const auction = await getAuction(BigInt(lookupId));
      // Insert at the top without duplicates
      setAuctions((prev) => {
        const filtered = prev.filter((a) => a.id !== auction.id);
        return [auction, ...filtered];
      });
    } catch (err) {
      setError(`Auction #${lookupId} not found: ${err.message}`);
    }
  }

  function refreshAuction(auctionId) {
    return async () => {
      try {
        const updated = await getAuction(BigInt(auctionId));
        setAuctions((prev) =>
          prev.map((a) => (a.id === updated.id ? updated : a))
        );
      } catch (err) {
        setError(err.message);
      }
    };
  }

  return (
    <section className="auction-list-section">
      <div className="auction-list-header">
        <h2 className="section-title">Live Auctions</h2>

        <div className="auction-controls">
          {/* Lookup by ID */}
          <form onSubmit={handleLookup} className="lookup-form">
            <input
              className="form-input lookup-input"
              type="number"
              min="1"
              placeholder="Auction ID"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
            />
            <button className="btn btn-secondary btn-sm" type="submit">
              Load
            </button>
          </form>

          {/* Manual refresh */}
          <button
            className="btn btn-ghost btn-sm"
            onClick={loadAll}
            disabled={loading}
          >
            {loading ? "Loading…" : "Refresh All"}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading && <p className="loading-msg">Loading auctions from the blockchain…</p>}

      {!loading && auctions.length === 0 && (
        <div className="empty-state">
          <p>No auctions yet. Create the first one above!</p>
        </div>
      )}

      <div className="auction-grid">
        {auctions.map((auction) => (
          <AuctionCard
            key={auction.id}
            auction={auction}
            publicKey={publicKey}
            onRefresh={refreshAuction(auction.id)}
          />
        ))}
      </div>
    </section>
  );
}
