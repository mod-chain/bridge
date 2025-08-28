#!/usr/bin/env bash
set -euo pipefail

# --- config ---
AMOUNT_WEI="${AMOUNT_WEI:-1000000000000000000}"   # 1 token if 18 decimals
ENV_FILE="${ENV_FILE:-.env}"

# --- load env ---
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

# Required env: L1_TOKEN, ETHEREUM_SEPOLIA_RPC, DEPLOYER_PK (HEX!)
: "${L1_TOKEN:?set L1_TOKEN in .env}"
: "${ETHEREUM_SEPOLIA_RPC:?set ETHEREUM_SEPOLIA_RPC in .env}"
: "${DEPLOYER_PK:?set DEPLOYER_PK (hex, 0x...) in .env}"

# If you only have PRIVATE_KEY in decimal (for Foundry), convert it:
if [[ -z "${DEPLOYER_PK}" && -n "${PRIVATE_KEY:-}" ]]; then
  echo "Converting PRIVATE_KEY decimal to hex..."
  DEPLOYER_PK="$(cast to-hex "$PRIVATE_KEY")"
fi

# Recipient defaults to admin EOA if provided, else the EOA for DEPLOYER_PK
RECIPIENT="${L1_ADMIN:-$(cast wallet address --private-key "$DEPLOYER_PK")}"

echo "Minting $AMOUNT_WEI to $RECIPIENT on Sepolia..."
cast send "$L1_TOKEN" \
  "mint(address,uint256)" "$RECIPIENT" "$AMOUNT_WEI" \
  --rpc-url "$ETHEREUM_SEPOLIA_RPC" \
  --private-key "$DEPLOYER_PK"

echo "Minted. Balances:"
echo -n "recipient: "
cast call "$L1_TOKEN" "balanceOf(address)(uint256)" "$RECIPIENT" --rpc-url "$ETHEREUM_SEPOLIA_RPC"
echo -n "totalSupply: "
cast call "$L1_TOKEN" "totalSupply()(uint256)"          --rpc-url "$ETHEREUM_SEPOLIA_RPC"
