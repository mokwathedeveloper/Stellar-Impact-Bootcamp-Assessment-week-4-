/**
 * WalletConnect.test.jsx
 *
 * Tests the WalletConnect component UI states.
 * Freighter API is mocked so tests run without the browser extension.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import WalletConnect from "../components/WalletConnect";

// ── Mock stellar utils ────────────────────────────────────────────────────────
vi.mock("../utils/stellar", () => ({
  connectWallet: vi.fn(),
  assertTestnet: vi.fn(),
  shortenKey: (key, chars = 6) =>
    key ? `${key.slice(0, chars)}…${key.slice(-chars)}` : key,
}));

import { connectWallet, assertTestnet } from "../utils/stellar";

const MOCK_KEY = "GDPTMWBY6RCDEOCQ2WHUG2V7WWCXXIP7T56E46DTF2WZ3MCY47AGZICR";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WalletConnect — disconnected state", () => {
  it("renders a connect button when no public key is provided", () => {
    render(<WalletConnect publicKey={null} onConnect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /connect freighter wallet/i })).toBeInTheDocument();
  });

  it("does not show a wallet badge when disconnected", () => {
    render(<WalletConnect publicKey={null} onConnect={vi.fn()} />);
    expect(screen.queryByText(/…/)).not.toBeInTheDocument();
  });
});

describe("WalletConnect — connected state", () => {
  it("shows a shortened public key badge when connected", () => {
    // GDPTMWBY6RCDEOCQ2WHUG2V7WWCXXIP7T56E46DTF2WZ3MCY47AGZICR → GDPTMW…AGZICR
    render(<WalletConnect publicKey={MOCK_KEY} onConnect={vi.fn()} />);
    expect(screen.getByText(/GDPTMW…AGZICR/)).toBeInTheDocument();
  });

  it("shows a Disconnect button when connected", () => {
    render(<WalletConnect publicKey={MOCK_KEY} onConnect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
  });

  it("calls onConnect(null) when Disconnect is clicked", () => {
    const onConnect = vi.fn();
    render(<WalletConnect publicKey={MOCK_KEY} onConnect={onConnect} />);
    fireEvent.click(screen.getByRole("button", { name: /disconnect/i }));
    expect(onConnect).toHaveBeenCalledWith(null);
  });
});

describe("WalletConnect — connect flow", () => {
  it("calls connectWallet and passes the key to onConnect on success", async () => {
    connectWallet.mockResolvedValue(MOCK_KEY);
    assertTestnet.mockResolvedValue(true);
    const onConnect = vi.fn();

    render(<WalletConnect publicKey={null} onConnect={onConnect} />);
    fireEvent.click(screen.getByRole("button", { name: /connect freighter wallet/i }));

    await waitFor(() => expect(onConnect).toHaveBeenCalledWith(MOCK_KEY));
  });

  it("shows 'Connecting…' label while the wallet handshake is in progress", async () => {
    // Never resolve so we can inspect the loading state
    connectWallet.mockReturnValue(new Promise(() => {}));

    render(<WalletConnect publicKey={null} onConnect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /connect freighter wallet/i }));

    expect(await screen.findByText(/connecting…/i)).toBeInTheDocument();
  });

  it("displays an error message when connectWallet rejects", async () => {
    connectWallet.mockRejectedValue(new Error("Freighter wallet is not installed."));

    render(<WalletConnect publicKey={null} onConnect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /connect freighter wallet/i }));

    expect(await screen.findByText(/freighter wallet is not installed/i)).toBeInTheDocument();
  });

  it("shows a network warning when wallet is not on Testnet", async () => {
    connectWallet.mockResolvedValue(MOCK_KEY);
    assertTestnet.mockResolvedValue(false); // wrong network

    render(<WalletConnect publicKey={null} onConnect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /connect freighter wallet/i }));

    expect(await screen.findByText(/not set to testnet/i)).toBeInTheDocument();
  });
});
