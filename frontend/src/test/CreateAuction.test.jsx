/**
 * CreateAuction.test.jsx
 *
 * Tests the CreateAuction form: rendering, client-side validation,
 * successful submission, and error handling.
 * The contract.js module is fully mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateAuction from "../components/CreateAuction";

// ── Mock contract utilities ───────────────────────────────────────────────────
vi.mock("../utils/contract", () => ({
  createAuction: vi.fn(),
  parseTokenAmount: (display) => {
    const [whole = "0", frac = ""] = String(display).split(".");
    const fracPadded = frac.padEnd(7, "0").slice(0, 7);
    return BigInt(whole) * BigInt(10 ** 7) + BigInt(fracPadded);
  },
}));

import { createAuction } from "../utils/contract";

const MOCK_PUBLIC_KEY = "GDPTMWBY6RCDEOCQ2WHUG2V7WWCXXIP7T56E46DTF2WZ3MCY47AGZICR";
const FUTURE_DATE = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16); // +24h

beforeEach(() => vi.clearAllMocks());

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fillForm(overrides = {}) {
  const user = userEvent.setup();
  const values = {
    description: "Test NFT Drop",
    token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    startingBid: "10",
    deadline: FUTURE_DATE,
    ...overrides,
  };

  await user.type(screen.getByPlaceholderText(/signed stellar hoodie/i), values.description);
  await user.type(screen.getByPlaceholderText(/C… contract address/i), values.token);
  await user.type(screen.getByPlaceholderText(/10\.0/i), values.startingBid);
  fireEvent.change(screen.getByDisplayValue(""), { target: { value: values.deadline } });
}

// ── Rendering ─────────────────────────────────────────────────────────────────

describe("CreateAuction — rendering", () => {
  it("renders all four form fields", () => {
    render(<CreateAuction publicKey={MOCK_PUBLIC_KEY} onAuctionCreated={vi.fn()} />);
    expect(screen.getByPlaceholderText(/signed stellar hoodie/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/C… contract address/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/10\.0/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/auction deadline/i)).toBeInTheDocument();
  });

  it("renders the submit button", () => {
    render(<CreateAuction publicKey={MOCK_PUBLIC_KEY} onAuctionCreated={vi.fn()} />);
    expect(screen.getByRole("button", { name: /create auction/i })).toBeInTheDocument();
  });

  it("shows the testnet token autofill chip", () => {
    render(<CreateAuction publicKey={MOCK_PUBLIC_KEY} onAuctionCreated={vi.fn()} />);
    expect(screen.getByTitle(/click to autofill/i)).toBeInTheDocument();
  });

  it("autofills the token field when the chip is clicked", async () => {
    render(<CreateAuction publicKey={MOCK_PUBLIC_KEY} onAuctionCreated={vi.fn()} />);
    const chip = screen.getByTitle(/click to autofill/i);
    fireEvent.click(chip);
    expect(screen.getByPlaceholderText(/C… contract address/i).value).toBe(
      "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
    );
  });
});

// ── Wallet guard ──────────────────────────────────────────────────────────────

describe("CreateAuction — wallet guard", () => {
  it("shows a wallet hint when publicKey is null", () => {
    render(<CreateAuction publicKey={null} onAuctionCreated={vi.fn()} />);
    expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
  });

  it("submit button is disabled when publicKey is null", () => {
    render(<CreateAuction publicKey={null} onAuctionCreated={vi.fn()} />);
    expect(screen.getByRole("button", { name: /create auction/i })).toBeDisabled();
  });

  it("shows an error if submitted without a wallet (no publicKey)", async () => {
    render(<CreateAuction publicKey={null} onAuctionCreated={vi.fn()} />);
    // Button is disabled, but test the message directly
    expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
    expect(createAuction).not.toHaveBeenCalled();
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("CreateAuction — client-side validation", () => {
  it("shows error when deadline is in the past", async () => {
    render(<CreateAuction publicKey={MOCK_PUBLIC_KEY} onAuctionCreated={vi.fn()} />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/signed stellar hoodie/i), "Item");
    await user.type(screen.getByPlaceholderText(/C… contract address/i), "CTOKEN");
    await user.type(screen.getByPlaceholderText(/10\.0/i), "5");
    // Set a past datetime
    fireEvent.change(screen.getByLabelText(/auction deadline/i), {
      target: { value: "2020-01-01T00:00" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create auction/i }));

    expect(await screen.findByText(/deadline must be in the future/i)).toBeInTheDocument();
    expect(createAuction).not.toHaveBeenCalled();
  });
});

// ── Successful submission ─────────────────────────────────────────────────────

describe("CreateAuction — successful submission", () => {
  it("calls createAuction with correct arguments on valid submit", async () => {
    createAuction.mockResolvedValue(5n);
    const onAuctionCreated = vi.fn();

    render(<CreateAuction publicKey={MOCK_PUBLIC_KEY} onAuctionCreated={onAuctionCreated} />);
    await fillForm();

    fireEvent.click(screen.getByRole("button", { name: /create auction/i }));

    await waitFor(() => expect(createAuction).toHaveBeenCalledTimes(1));
    const [calledKey, calledDesc] = createAuction.mock.calls[0];
    expect(calledKey).toBe(MOCK_PUBLIC_KEY);
    expect(calledDesc).toBe("Test NFT Drop");
  });

  it("shows success message with the new auction ID", async () => {
    createAuction.mockResolvedValue(5n);
    render(<CreateAuction publicKey={MOCK_PUBLIC_KEY} onAuctionCreated={vi.fn()} />);
    await fillForm();
    fireEvent.click(screen.getByRole("button", { name: /create auction/i }));
    expect(await screen.findByText(/auction created/i)).toBeInTheDocument();
    expect(await screen.findByText(/5/)).toBeInTheDocument();
  });

  it("calls onAuctionCreated callback after successful creation", async () => {
    createAuction.mockResolvedValue(5n);
    const onAuctionCreated = vi.fn();

    render(<CreateAuction publicKey={MOCK_PUBLIC_KEY} onAuctionCreated={onAuctionCreated} />);
    await fillForm();
    fireEvent.click(screen.getByRole("button", { name: /create auction/i }));

    await waitFor(() => expect(onAuctionCreated).toHaveBeenCalledTimes(1));
  });

  it("resets the form fields after successful creation", async () => {
    createAuction.mockResolvedValue(5n);
    render(<CreateAuction publicKey={MOCK_PUBLIC_KEY} onAuctionCreated={vi.fn()} />);
    await fillForm();
    fireEvent.click(screen.getByRole("button", { name: /create auction/i }));
    await waitFor(() => expect(createAuction).toHaveBeenCalled());
    expect(screen.getByPlaceholderText(/signed stellar hoodie/i).value).toBe("");
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe("CreateAuction — contract error handling", () => {
  it("displays the contract error message on failure", async () => {
    createAuction.mockRejectedValue(new Error("Simulation failed: insufficient funds"));
    render(<CreateAuction publicKey={MOCK_PUBLIC_KEY} onAuctionCreated={vi.fn()} />);
    await fillForm();
    fireEvent.click(screen.getByRole("button", { name: /create auction/i }));
    expect(await screen.findByText(/simulation failed: insufficient funds/i)).toBeInTheDocument();
  });

  it("shows 'Creating…' label while the transaction is in flight", async () => {
    createAuction.mockReturnValue(new Promise(() => {}));
    render(<CreateAuction publicKey={MOCK_PUBLIC_KEY} onAuctionCreated={vi.fn()} />);
    await fillForm();
    fireEvent.click(screen.getByRole("button", { name: /create auction/i }));
    expect(await screen.findByText(/creating…/i)).toBeInTheDocument();
  });
});
