/**
 * AuctionCard.test.jsx
 *
 * Tests the AuctionCard component for correct rendering of auction data,
 * status badges, conditional action buttons, and action callbacks.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AuctionCard from "../components/AuctionCard";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../utils/contract", () => ({
  finalizeAuction: vi.fn(),
  cancelAuction: vi.fn(),
  formatTokenAmount: (raw) => {
    const n = BigInt(raw);
    return `${(n / 10_000_000n)}.${String(n % 10_000_000n).padStart(7, "0").replace(/0+$/, "") || "0"}`;
  },
  formatDeadline: vi.fn(() => "23h 59m 59s"),
}));

vi.mock("../utils/stellar", () => ({
  shortenKey: (key) => (key ? `${key.slice(0, 6)}…${key.slice(-5)}` : "—"),
}));

// PlaceBid is a child that makes contract calls — mock it out
vi.mock("../components/PlaceBid", () => ({
  default: () => <div data-testid="place-bid-mock" />,
}));

import { finalizeAuction, cancelAuction } from "../utils/contract";

const OWNER = "GDPTMWBY6RCDEOCQ2WHUG2V7WWCXXIP7T56E46DTF2WZ3MCY47AGZICR";
const OTHER = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";
// Actual shortenKey(OTHER, 6) output: GAAZI4…OCCWN  (first 6, last 6 of OTHER)
const OTHER_SHORT = "GAAZI4…OCCWN";

const FUTURE_DEADLINE = Math.floor(Date.now() / 1000) + 86_400;
const PAST_DEADLINE   = Math.floor(Date.now() / 1000) - 100;

function makeAuction(overrides = {}) {
  return {
    id: 1,
    description: "Vintage Guitar",
    owner: OWNER,
    token: "CDLZFC3...",
    starting_bid: "10000000",
    highest_bid: "15000000",
    highest_bidder: null,
    deadline: FUTURE_DEADLINE,
    status: "Active",
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

// ── Rendering ─────────────────────────────────────────────────────────────────

describe("AuctionCard — data rendering", () => {
  it("renders the auction description", () => {
    render(<AuctionCard auction={makeAuction()} publicKey={OWNER} onRefresh={vi.fn()} />);
    expect(screen.getByText("Vintage Guitar")).toBeInTheDocument();
  });

  it("renders the auction ID", () => {
    render(<AuctionCard auction={makeAuction()} publicKey={OWNER} onRefresh={vi.fn()} />);
    expect(screen.getByText(/#1/)).toBeInTheDocument();
  });

  it("renders the highest bid formatted correctly", () => {
    render(<AuctionCard auction={makeAuction()} publicKey={OWNER} onRefresh={vi.fn()} />);
    expect(screen.getByText(/1\.5/)).toBeInTheDocument();
  });

  it("shows 'No bids yet' when highest_bidder is null", () => {
    render(<AuctionCard auction={makeAuction({ highest_bidder: null })} publicKey={OWNER} onRefresh={vi.fn()} />);
    expect(screen.getByText(/no bids yet/i)).toBeInTheDocument();
  });

  it("shows a shortened bidder address when one exists", () => {
    render(
      <AuctionCard
        auction={makeAuction({ highest_bidder: OTHER })}
        publicKey={OWNER}
        onRefresh={vi.fn()}
      />
    );
    // The AuctionCard mock of shortenKey uses slice(0,6)…slice(-5)
    // OTHER.slice(0,6) = "GAAZI4", OTHER.slice(-5) = "OCCWN"
    expect(screen.getByText(/GAAZI4…OCCWN/)).toBeInTheDocument();
  });

  it("always shows the Refresh button", () => {
    render(<AuctionCard auction={makeAuction()} publicKey={OWNER} onRefresh={vi.fn()} />);
    expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument();
  });
});

// ── Status badges ─────────────────────────────────────────────────────────────

describe("AuctionCard — status badges", () => {
  it("shows 'Active' badge for an active auction", () => {
    render(<AuctionCard auction={makeAuction({ status: "Active" })} publicKey={OWNER} onRefresh={vi.fn()} />);
    expect(screen.getByText(/^active$/i)).toBeInTheDocument();
  });

  it("shows 'Finalized' badge for a finalized auction", () => {
    render(<AuctionCard auction={makeAuction({ status: "Finalized" })} publicKey={OWNER} onRefresh={vi.fn()} />);
    expect(screen.getByText(/^finalized$/i)).toBeInTheDocument();
  });

  it("shows 'Cancelled' badge for a cancelled auction", () => {
    render(<AuctionCard auction={makeAuction({ status: "Cancelled" })} publicKey={OWNER} onRefresh={vi.fn()} />);
    expect(screen.getByText(/^cancelled$/i)).toBeInTheDocument();
  });
});

// ── Action button visibility ───────────────────────────────────────────────────

describe("AuctionCard — action button visibility", () => {
  it("does NOT show Finalize before the deadline", () => {
    render(<AuctionCard auction={makeAuction({ deadline: FUTURE_DEADLINE })} publicKey={OWNER} onRefresh={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /finalize/i })).not.toBeInTheDocument();
  });

  it("shows Finalize button after the deadline when connected", () => {
    render(
      <AuctionCard
        auction={makeAuction({ deadline: PAST_DEADLINE })}
        publicKey={OWNER}
        onRefresh={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /finalize auction/i })).toBeInTheDocument();
  });

  it("does NOT show Finalize when wallet is not connected", () => {
    render(
      <AuctionCard
        auction={makeAuction({ deadline: PAST_DEADLINE })}
        publicKey={null}
        onRefresh={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /finalize/i })).not.toBeInTheDocument();
  });

  it("shows Cancel button when owner is connected and there are no bids", () => {
    render(
      <AuctionCard
        auction={makeAuction({ highest_bidder: null })}
        publicKey={OWNER}
        onRefresh={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /cancel auction/i })).toBeInTheDocument();
  });

  it("does NOT show Cancel when bids exist", () => {
    render(
      <AuctionCard
        auction={makeAuction({ highest_bidder: OTHER })}
        publicKey={OWNER}
        onRefresh={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /cancel auction/i })).not.toBeInTheDocument();
  });

  it("does NOT show Cancel for non-owner wallets", () => {
    render(
      <AuctionCard
        auction={makeAuction({ highest_bidder: null })}
        publicKey={OTHER}
        onRefresh={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /cancel auction/i })).not.toBeInTheDocument();
  });

  it("renders the PlaceBid form for active auctions before deadline", () => {
    render(<AuctionCard auction={makeAuction()} publicKey={OTHER} onRefresh={vi.fn()} />);
    expect(screen.getByTestId("place-bid-mock")).toBeInTheDocument();
  });

  it("does NOT render PlaceBid for Finalized auctions", () => {
    render(
      <AuctionCard
        auction={makeAuction({ status: "Finalized" })}
        publicKey={OTHER}
        onRefresh={vi.fn()}
      />
    );
    expect(screen.queryByTestId("place-bid-mock")).not.toBeInTheDocument();
  });
});

// ── Action callbacks ───────────────────────────────────────────────────────────

describe("AuctionCard — action callbacks", () => {
  it("calls finalizeAuction and onRefresh on Finalize click", async () => {
    finalizeAuction.mockResolvedValue(undefined);
    const onRefresh = vi.fn();

    render(
      <AuctionCard
        auction={makeAuction({ deadline: PAST_DEADLINE })}
        publicKey={OWNER}
        onRefresh={onRefresh}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /finalize auction/i }));
    await waitFor(() => expect(finalizeAuction).toHaveBeenCalledWith(OWNER, 1n));
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
  });

  it("calls cancelAuction and onRefresh on Cancel click", async () => {
    cancelAuction.mockResolvedValue(undefined);
    const onRefresh = vi.fn();

    render(
      <AuctionCard
        auction={makeAuction({ highest_bidder: null })}
        publicKey={OWNER}
        onRefresh={onRefresh}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /cancel auction/i }));
    await waitFor(() => expect(cancelAuction).toHaveBeenCalledWith(OWNER, 1n));
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
  });

  it("displays contract error message on finalize failure", async () => {
    finalizeAuction.mockRejectedValue(new Error("Auction deadline has not passed yet"));
    render(
      <AuctionCard
        auction={makeAuction({ deadline: PAST_DEADLINE })}
        publicKey={OWNER}
        onRefresh={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /finalize auction/i }));
    expect(await screen.findByText(/auction deadline has not passed yet/i)).toBeInTheDocument();
  });

  it("calls onRefresh when the Refresh button is clicked", () => {
    const onRefresh = vi.fn();
    render(<AuctionCard auction={makeAuction()} publicKey={OWNER} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
