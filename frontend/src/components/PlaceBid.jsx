/**
 * PlaceBid — inline bid form rendered inside an AuctionCard.
 *
 * Shows a bid amount input and submit button.  On success, triggers a
 * refresh of the parent auction card.
 */

import { useState } from "react";
import { placeBid, claimRefund, parseTokenAmount, getRefund } from "../utils/contract";
import { shortenKey } from "../utils/stellar";

export default function PlaceBid({ publicKey, auction, onBidPlaced }) {
  const [bidAmount, setBidAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [pendingRefund, setPendingRefund] = useState(null);
  const [status, setStatus] = useState({ type: "", message: "" });

  // Load refund balance when component mounts or auction changes
  async function loadRefund() {
    if (!publicKey) return;
    try {
      const refund = await getRefund(BigInt(auction.id), publicKey);
      setPendingRefund(refund);
    } catch {
      setPendingRefund(0n);
    }
  }

  async function handleBid(e) {
    e.preventDefault();
    if (!publicKey) {
      setStatus({ type: "error", message: "Connect your wallet to bid." });
      return;
    }

    const amountRaw = parseTokenAmount(bidAmount);
    if (amountRaw <= BigInt(auction.highest_bid)) {
      setStatus({
        type: "error",
        message: `Bid must exceed the current highest bid of ${auction.highest_bid}.`,
      });
      return;
    }

    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      await placeBid(publicKey, BigInt(auction.id), amountRaw);
      setStatus({ type: "success", message: "Bid placed successfully!" });
      setBidAmount("");
      if (onBidPlaced) onBidPlaced();
    } catch (err) {
      setStatus({ type: "error", message: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleClaim() {
    if (!publicKey) return;
    setClaimLoading(true);
    setStatus({ type: "", message: "" });

    try {
      await claimRefund(publicKey, BigInt(auction.id));
      setStatus({ type: "success", message: "Refund claimed successfully!" });
      setPendingRefund(0n);
      if (onBidPlaced) onBidPlaced();
    } catch (err) {
      setStatus({ type: "error", message: err.message });
    } finally {
      setClaimLoading(false);
    }
  }

  return (
    <div className="place-bid">
      {/* Pending refund banner */}
      {pendingRefund !== null && pendingRefund > 0n && (
        <div className="refund-banner">
          <span>You have a pending refund of {pendingRefund.toString()} units</span>
          <button
            className="btn btn-accent btn-sm"
            onClick={handleClaim}
            disabled={claimLoading}
          >
            {claimLoading ? "Claiming…" : "Claim Refund"}
          </button>
        </div>
      )}

      {/* Bid form — only show if auction is active */}
      {auction.status === "Active" && (
        <form onSubmit={handleBid} className="bid-form">
          <input
            className="form-input bid-input"
            type="number"
            step="0.0000001"
            min="0.0000001"
            placeholder="Your bid amount"
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            required
          />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading || !publicKey}
          >
            {loading ? "Placing…" : "Place Bid"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={loadRefund}
          >
            Check My Refund
          </button>
        </form>
      )}

      {status.message && (
        <p className={`status-msg status-${status.type}`}>{status.message}</p>
      )}
    </div>
  );
}
