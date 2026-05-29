/**
 * CreateAuction — form for creating a new on-chain auction.
 *
 * Accepts a description, SEP-41 token contract ID, starting bid (human-readable),
 * and deadline (datetime-local input).  On submit it calls createAuction() from
 * the contract utility and reports the new auction ID.
 */

import { useState } from "react";
import { createAuction, parseTokenAmount } from "../utils/contract";

export default function CreateAuction({ publicKey, onAuctionCreated }) {
  const [form, setForm] = useState({
    description: "",
    token: "",
    startingBid: "",
    deadline: "",
  });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!publicKey) {
      setStatus({ type: "error", message: "Connect your wallet first." });
      return;
    }

    // Validate deadline is in the future
    const deadlineUnix = BigInt(Math.floor(new Date(form.deadline).getTime() / 1000));
    const nowUnix = BigInt(Math.floor(Date.now() / 1000));
    if (deadlineUnix <= nowUnix) {
      setStatus({ type: "error", message: "Deadline must be in the future." });
      return;
    }

    // Validate starting bid is a positive number
    const startBidRaw = parseTokenAmount(form.startingBid);
    if (startBidRaw <= 0n) {
      setStatus({ type: "error", message: "Starting bid must be positive." });
      return;
    }

    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const auctionId = await createAuction(
        publicKey,
        form.description,
        form.token.trim(),
        startBidRaw,
        deadlineUnix
      );

      setStatus({
        type: "success",
        message: `Auction created! ID: ${auctionId}`,
      });

      // Reset form
      setForm({ description: "", token: "", startingBid: "", deadline: "" });

      // Notify parent so it can refresh the auction list
      if (onAuctionCreated) onAuctionCreated(auctionId);
    } catch (err) {
      setStatus({ type: "error", message: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <h2 className="card-title">Create New Auction</h2>

      <form onSubmit={handleSubmit} className="form">
        <label className="form-label">
          Item Description
          <input
            className="form-input"
            name="description"
            type="text"
            placeholder="e.g. Signed Stellar hoodie"
            value={form.description}
            onChange={handleChange}
            required
          />
        </label>

        <label className="form-label">
          Token Contract ID (SEP-41)
          <input
            className="form-input"
            name="token"
            type="text"
            placeholder="C… contract address"
            value={form.token}
            onChange={handleChange}
            required
          />
          <span className="form-hint">
            The Stellar testnet XLM asset contract:
            CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
          </span>
        </label>

        <label className="form-label">
          Starting Bid (token units)
          <input
            className="form-input"
            name="startingBid"
            type="number"
            step="0.0000001"
            min="0.0000001"
            placeholder="10.0"
            value={form.startingBid}
            onChange={handleChange}
            required
          />
        </label>

        <label className="form-label">
          Auction Deadline
          <input
            className="form-input"
            name="deadline"
            type="datetime-local"
            value={form.deadline}
            onChange={handleChange}
            required
          />
        </label>

        <button
          type="submit"
          className="btn btn-primary btn-full"
          disabled={loading || !publicKey}
        >
          {loading ? "Creating…" : "Create Auction"}
        </button>

        {!publicKey && (
          <p className="form-hint">Connect your wallet to create an auction.</p>
        )}
      </form>

      {status.message && (
        <div className={`alert alert-${status.type}`}>{status.message}</div>
      )}
    </section>
  );
}
