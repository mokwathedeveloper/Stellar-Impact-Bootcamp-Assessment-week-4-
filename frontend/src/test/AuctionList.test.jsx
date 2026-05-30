/**
 * AuctionList.test.jsx
 *
 * Tests the AuctionList component: loading state, empty state,
 * populated list, lookup by ID, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AuctionList from "../components/AuctionList";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../utils/contract", () => ({
  getAuctionCount: vi.fn(),
  getAuction: vi.fn(),
}));

// Stub out the heavy AuctionCard child
vi.mock("../components/AuctionCard", () => ({
  default: ({ auction }) => (
    <div data-testid={`auction-card-${auction.id}`}>
      {auction.description}
    </div>
  ),
}));

import { getAuctionCount, getAuction } from "../utils/contract";

const FUTURE = Math.floor(Date.now() / 1000) + 86_400;
const OWNER  = "GDPTMWBY6RCDEOCQ2WHUG2V7WWCXXIP7T56E46DTF2WZ3MCY47AGZICR";

function mockAuction(id) {
  return {
    id,
    description: `Auction ${id}`,
    owner: OWNER,
    token: "CTOKEN",
    starting_bid: "10000000",
    highest_bid: "10000000",
    highest_bidder: null,
    deadline: FUTURE,
    status: "Active",
  };
}

beforeEach(() => vi.clearAllMocks());

// ── Loading state ─────────────────────────────────────────────────────────────

describe("AuctionList — loading state", () => {
  it("shows a loading message while auctions are being fetched", async () => {
    getAuctionCount.mockReturnValue(new Promise(() => {})); // never resolves

    render(<AuctionList publicKey={OWNER} refreshTrigger={0} />);
    expect(await screen.findByText(/loading auctions/i)).toBeInTheDocument();
  });
});

// ── Empty state ───────────────────────────────────────────────────────────────

describe("AuctionList — empty state", () => {
  it("shows an empty state message when no auctions exist", async () => {
    getAuctionCount.mockResolvedValue(0n);

    render(<AuctionList publicKey={OWNER} refreshTrigger={0} />);
    expect(await screen.findByText(/no auctions yet/i)).toBeInTheDocument();
  });
});

// ── Populated state ───────────────────────────────────────────────────────────

describe("AuctionList — populated state", () => {
  it("renders an AuctionCard for each auction returned by the contract", async () => {
    getAuctionCount.mockResolvedValue(3n);
    getAuction.mockImplementation((id) => Promise.resolve(mockAuction(Number(id))));

    render(<AuctionList publicKey={OWNER} refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByTestId("auction-card-1")).toBeInTheDocument();
      expect(screen.getByTestId("auction-card-2")).toBeInTheDocument();
      expect(screen.getByTestId("auction-card-3")).toBeInTheDocument();
    });
  });

  it("calls getAuction for every ID from 1..count in parallel", async () => {
    getAuctionCount.mockResolvedValue(2n);
    getAuction.mockImplementation((id) => Promise.resolve(mockAuction(Number(id))));

    render(<AuctionList publicKey={OWNER} refreshTrigger={0} />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());

    expect(getAuction).toHaveBeenCalledWith(1n);
    expect(getAuction).toHaveBeenCalledWith(2n);
    expect(getAuction).toHaveBeenCalledTimes(2);
  });

  it("re-fetches when refreshTrigger changes", async () => {
    getAuctionCount.mockResolvedValue(1n);
    getAuction.mockResolvedValue(mockAuction(1));

    const { rerender } = render(<AuctionList publicKey={OWNER} refreshTrigger={0} />);
    await waitFor(() => expect(getAuctionCount).toHaveBeenCalledTimes(1));

    rerender(<AuctionList publicKey={OWNER} refreshTrigger={1} />);
    await waitFor(() => expect(getAuctionCount).toHaveBeenCalledTimes(2));
  });
});

// ── Lookup by ID ──────────────────────────────────────────────────────────────

describe("AuctionList — lookup by ID", () => {
  it("loads a specific auction when the lookup form is submitted", async () => {
    getAuctionCount.mockResolvedValue(0n);
    getAuction.mockResolvedValue(mockAuction(42));

    render(<AuctionList publicKey={OWNER} refreshTrigger={0} />);
    await waitFor(() => screen.getByText(/no auctions yet/i));

    fireEvent.change(screen.getByPlaceholderText(/auction id/i), {
      target: { value: "42" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^load$/i }));

    await waitFor(() => expect(screen.getByTestId("auction-card-42")).toBeInTheDocument());
  });

  it("shows an error when the looked-up ID does not exist", async () => {
    getAuctionCount.mockResolvedValue(0n);
    getAuction.mockRejectedValue(new Error("auction 99 does not exist"));

    render(<AuctionList publicKey={OWNER} refreshTrigger={0} />);
    await waitFor(() => screen.getByText(/no auctions yet/i));

    fireEvent.change(screen.getByPlaceholderText(/auction id/i), {
      target: { value: "99" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^load$/i }));

    expect(await screen.findByText(/auction 99 does not exist/i)).toBeInTheDocument();
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe("AuctionList — error handling", () => {
  it("shows an error message when getAuctionCount fails", async () => {
    getAuctionCount.mockRejectedValue(new Error("Network timeout"));

    render(<AuctionList publicKey={OWNER} refreshTrigger={0} />);
    expect(await screen.findByText(/failed to load auctions/i)).toBeInTheDocument();
  });
});
