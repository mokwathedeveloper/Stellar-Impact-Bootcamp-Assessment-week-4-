#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────
# deploy.sh — Build and deploy the No-Loss Auction contract to Stellar Testnet
#
# Prerequisites:
#   1. Rust + wasm32-unknown-unknown target installed
#   2. Stellar CLI installed  (cargo install stellar-cli --locked)
#   3. A funded testnet identity configured in Stellar CLI
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh [identity-name]
#   Example: ./deploy.sh alice
# ──────────────────────────────────────────────────────────────────────────

set -euo pipefail

IDENTITY="${1:-default}"
NETWORK="testnet"
CONTRACT_WASM="target/wasm32-unknown-unknown/release/no_loss_auction.wasm"

echo "════════════════════════════════════════════"
echo "  No-Loss Auction — Soroban Deployment"
echo "  Identity : $IDENTITY"
echo "  Network  : $NETWORK"
echo "════════════════════════════════════════════"

# ── Step 1: Add the WASM compile target if not present ───────────────────
echo ""
echo "▶ Checking Rust WASM target..."
rustup target add wasm32-unknown-unknown

# ── Step 2: Compile the contract ─────────────────────────────────────────
echo ""
echo "▶ Compiling contract (release)..."
cargo build \
  --manifest-path contracts/auction/Cargo.toml \
  --target wasm32-unknown-unknown \
  --release

echo "   ✓ WASM compiled: $CONTRACT_WASM"

# ── Step 3: Optimise WASM size (optional but recommended) ─────────────────
if command -v stellar &>/dev/null; then
  echo ""
  echo "▶ Optimising WASM..."
  stellar contract optimize --wasm "$CONTRACT_WASM"
  OPTIMIZED="${CONTRACT_WASM%.wasm}.optimized.wasm"
  if [ -f "$OPTIMIZED" ]; then
    CONTRACT_WASM="$OPTIMIZED"
    echo "   ✓ Optimised WASM: $CONTRACT_WASM"
  fi
fi

# ── Step 4: Deploy ────────────────────────────────────────────────────────
echo ""
echo "▶ Deploying to $NETWORK..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$CONTRACT_WASM" \
  --source "$IDENTITY" \
  --network "$NETWORK")

echo ""
echo "════════════════════════════════════════════"
echo "  ✅  Contract deployed successfully!"
echo "  Contract ID: $CONTRACT_ID"
echo "════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Copy the Contract ID above."
echo "  2. Set it in frontend/.env:"
echo "       VITE_CONTRACT_ID=$CONTRACT_ID"
echo "  3. Run the frontend:"
echo "       cd frontend && npm install && npm run dev"
echo ""
echo "View on Stellar Expert:"
echo "  https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID"
