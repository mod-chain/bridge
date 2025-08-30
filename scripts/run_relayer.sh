#!/usr/bin/env bash
set -euo pipefail

# Helper to launch the node-integrated bridge relayer using values from .env
#
# Usage:
#   NODE_BIN=./subspace/target/release/your-node \
#   EXTRA_NODE_FLAGS="--ws-external --rpc-cors all" \
#   ./scripts/run_relayer.sh
#
# Dry run (only print command): DRY_RUN=1 ./scripts/run_relayer.sh

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

NODE_BIN="${NODE_BIN:-./subspace/target/release/node-subspace}"
if [[ ! -x "$NODE_BIN" ]]; then
  echo "WARN: NODE_BIN not executable: $NODE_BIN (continuing; node may still be runnable if it’s a script)" >&2
fi

# Determine whether to enable bridge relayer (minimal: only --bridge-enable)
BRIDGE_ENABLE_VAL="${BRIDGE_ENABLE:-}"
BRIDGE_ENABLE_LC="${BRIDGE_ENABLE_VAL,,}"
BRIDGE_ENABLED=0
case "$BRIDGE_ENABLE_LC" in
  1|true|yes|on)
    BRIDGE_ENABLED=1
    ;;
esac

if (( BRIDGE_ENABLED == 1 )); then
  echo "Bridge relayer: enabled."
  # Resolve minimal defaults without complex network logic
  BRIDGE_L1_RPC="${BRIDGE_L1_RPC:-${ETHEREUM_SEPOLIA_RPC:-}}"
  BRIDGE_PK="${BRIDGE_PK:-}"
  BRIDGE_MINTER="${BRIDGE_MINTER:-}"
  BRIDGE_L1_TOKEN="${BRIDGE_L1_TOKEN:-${L1_TOKEN:-}}"
  BRIDGE_L2_GAS="${BRIDGE_L2_GAS:-${L2_GAS:-200000}}"
  BRIDGE_SUBSTRATE_DECIMALS="${BRIDGE_SUBSTRATE_DECIMALS:-12}"
  BRIDGE_ERC20_DECIMALS="${BRIDGE_ERC20_DECIMALS:-18}"

  miss=()
  [[ -z "$BRIDGE_L1_RPC" ]] && miss+=(BRIDGE_L1_RPC)
  [[ -z "$BRIDGE_PK" ]] && miss+=(BRIDGE_PK)
  [[ -z "$BRIDGE_MINTER" ]] && miss+=(BRIDGE_MINTER)
  [[ -z "$BRIDGE_L1_TOKEN" ]] && miss+=(BRIDGE_L1_TOKEN/L1_TOKEN)
  if (( ${#miss[@]} > 0 )); then
    echo "Missing required env: ${miss[*]}" >&2
    exit 1
  fi

  # Derive relayer address (optional)
  RELAYER_ADDR=""
  if command -v cast >/dev/null 2>&1; then
    RELAYER_ADDR=$(cast wallet address --private-key "$BRIDGE_PK" 2>/dev/null || true)
  fi

  echo "Bridge relayer configuration:"
  echo "  Chain Spec:       ${CHAIN_SPEC:-<from --chain in EXTRA_NODE_FLAGS>}"
  echo "  L1 RPC:           $BRIDGE_L1_RPC"
  echo "  L1 Token:         $BRIDGE_L1_TOKEN"
  echo "  BridgeMinter:     $BRIDGE_MINTER"
  echo "  Relayer EOA:      ${RELAYER_ADDR:-<unknown>}"
  echo "  L2 Gas:           $BRIDGE_L2_GAS"
  echo "  Substrate Dec:    $BRIDGE_SUBSTRATE_DECIMALS"
  echo "  ERC20 Dec:        $BRIDGE_ERC20_DECIMALS"

  BRIDGE_FLAGS=(
    --bridge-enable
    --bridge-l1-rpc "$BRIDGE_L1_RPC"
    --bridge-pk "$BRIDGE_PK"
    --bridge-l1-token "$BRIDGE_L1_TOKEN"
    --bridge-l2-gas "$BRIDGE_L2_GAS"
    --bridge-substrate-decimals "$BRIDGE_SUBSTRATE_DECIMALS"
    --bridge-erc20-decimals "$BRIDGE_ERC20_DECIMALS"
    --bridge-minter "$BRIDGE_MINTER"
  )
else
  echo "Node-only mode: Bridge relayer disabled (set BRIDGE_ENABLE=true to enable)."
  BRIDGE_FLAGS=()
fi

CMD=("$NODE_BIN")

# Detect if EXTRA_NODE_FLAGS already includes a chain flag
EXTRA_HAS_CHAIN=0
if [[ -n "${EXTRA_NODE_FLAGS:-}" ]]; then
  case " $EXTRA_NODE_FLAGS " in
    *" --chain "*|*" --chain-spec "*) EXTRA_HAS_CHAIN=1 ;;
  esac
  # shellcheck disable=SC2206
  CMD+=($EXTRA_NODE_FLAGS)
fi

# Pass bridge flags next
CMD+=("${BRIDGE_FLAGS[@]}")

# Append chain flag if not set by extras
if (( EXTRA_HAS_CHAIN == 0 )); then
  if [[ -n "${CHAIN_SPEC:-}" ]]; then
    CMD+=("--chain" "$CHAIN_SPEC")
  else
    echo "ERROR: No chain specified. Set CHAIN_SPEC to a chain spec path (e.g., subspace/node/chain-specs/main.json or test.json), or include --chain <path> in EXTRA_NODE_FLAGS." >&2
    exit 1
  fi
fi

echo "Launching node:"
printf '  %q ' "${CMD[@]}"; echo

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "DRY_RUN=1 set; not executing."
  exit 0
fi

exec "${CMD[@]}"
