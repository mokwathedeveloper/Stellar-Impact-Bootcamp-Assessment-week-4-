/**
 * AuctionCard — displays all information for a single auction and provides
 * inline actions: place bid, finalize, cancel.
 *
 * Props:
 *   auction     — raw auction object returned by getAuction()
 *   publicKey   — currently connected wallet address (or null)
 *   onRefresh   — callback to reload this auction from the chain
 */

import { useState } from "react";
import PlaceBid from "./PlaceBid";
import { finalizeAuction, cancelAuction, formatTokenAmount, formatDeadline } from "../utils/contract";
import { shortenKey } from "../utils/stellar";

// Map contract AuctionStatus enum values to badge styling
const STATUS_LABEL = {
  Active: { label: "Active", cls: "badge-active" },
  Finalized: { label: "Finalized", cls: "badge-finalized" },
  Cancelled: { label: "Cancelled", cls: "badge-cancelled" },
};

export default function AuctionCard({ auction, publicKey, onRefresh }) {
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");

  const isOwner = publicKey && auction.owner === publicKey;
  const isActive = auction.status === "Active";
  const hasNoBids = !auction.highest_bidder;

  // Determine if the auction deadline has passed
  const nowUnix = Math.floor(Date.now() / 1000);
  const deadlinePassed = nowUnix > Number(auction.deadline);

  const statusInfo = STATUS_LABEL[auction.status] || { label: auction.status, cls: "" };

  async function handleFinalize() {
    setActionLoading("finalize");
    setError("");
    try {
      await finalizeAuction(publicKey, BigInt(auction.id));
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading("");
    }
  }

  async function handleCancel() {
    setActionLoading("cancel");
    setError("");
    try {
      await cancelAuction(publicKey, BigInt(auction.id));
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading("");
    }
  }

  return (
    <div className="auction-card">
      {/* ── Header ── */}
      <div className="auction-header">
        <span className="auction-id">#{auction.id}</span>
        <span className={`badge ${statusInfo.cls}`}>{statusInfo.label}</span>
      </div>

      {/* ── Description ── */}
      <h3 className="auction-description">{auction.description}</h3>

      {/* ── Details grid ── */}
      <dl className="auction-details">
        <dt>Owner</dt>
        <dd title={auction.owner}>{shortenKey(auction.owner)}</dd>

        <dt>Starting Bid</dt>
        <dd>{formatTokenAmount(BigInt(auction.starting_bid))} tokens</dd>

        <dt>Highest Bid</dt>
        <dd className="highlight">
          {formatTokenAmount(BigInt(auction.highest_bid))} tokens
        </dd>

        <dt>Highest Bidder</dt>
        <dd>
          {auction.highest_bidder
            ? shortenKey(auction.highest_bidder)
            : "No bids yet"}
        </dd>

        <dt>Deadline</dt>
        <dd>
          {deadlinePassed
            ? "Expired"
            : formatDeadline(auction.deadline)}
          <span className="deadline-ts">
            {" "}({new Date(Number(auction.deadline) * 1000).toLocaleString()})
          </span>
        </dd>
      </dl>

      {/* ── Actions ── */}
      <div className="auction-actions">
        {/* Any connected user can finalize once the deadline passes */}
        {isActive && deadlinePassed && publicKey && (
          <button
            className="btn btn-success"
            onClick={handleFinalize}
            disabled={actionLoading === "finalize"}
          >
            {actionLoading === "finalize" ? "Finalizing…" : "Finalize Auction"}
          </button>
        )}

        {/* Owner can cancel only if no bids exist */}
        {isOwner && isActive && hasNoBids && (
          <button
            className="btn btn-danger"
            onClick={handleCancel}
            disabled={actionLoading === "cancel"}
          >
            {actionLoading === "cancel" ? "Cancelling…" : "Cancel Auction"}
          </button>
        )}

        {/* Refresh button */}
        <button className="btn btn-ghost btn-sm" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {/* ── Bid form (active auctions only) ── */}
      {isActive && !deadlinePassed && (
        <PlaceBid
          publicKey={publicKey}
          auction={auction}
          onBidPlaced={onRefresh}
        />
      )}

      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}
