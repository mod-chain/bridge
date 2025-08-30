#!/usr/bin/env bash
# Export selected variables from the repo root .env into the current shell
# Usage:
#   source packages/foundry/script/export-root-env.sh [--all | VAR1 VAR2 ...]
# If no VARs are provided, a sensible default set is exported for Foundry scripts.

set -euo pipefail

# Resolve repo root (works whether called from repo root or a subdir)
if ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null); then
  :
else
  # Fallback: this script lives at packages/foundry/script/, go up 3 levels
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  ROOT_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
fi

ENV_FILE="${ROOT_DIR}/.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[export-root-env] .env not found at ${ENV_FILE}" >&2
  return 1 2>/dev/null || exit 1
fi

# Default variables to export (safe, single-line)
DEFAULT_VARS=(
  L1_ADMIN
  L1_TOKEN_NAME
  L1_TOKEN_SYMBOL
  DEPLOYER_PK_DEC
  ETHEREUM_RPC
)

# Parse args: --all or explicit allowlist
EXPORT_ALL=false
ALLOWLIST=()
for arg in "$@"; do
  if [[ "$arg" == "--all" ]]; then
    EXPORT_ALL=true
  else
    ALLOWLIST+=("$arg")
  fi
done
if [[ ${#ALLOWLIST[@]} -eq 0 && "$EXPORT_ALL" != true ]]; then
  ALLOWLIST=("${DEFAULT_VARS[@]}")
fi

# Helper: trim surrounding quotes
trim_quotes() {
  local s="$1"
  if [[ ${s} == '"'*'"' ]] || [[ ${s} == "'"*"'" ]]; then
    echo "${s:1:${#s}-2}"
  else
    echo "${s}"
  fi
}

# Load .env and export keys
exported=()
while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip comments and empty lines
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
  # Normalize 'export KEY=VALUE' to 'KEY=VALUE'
  if [[ "$line" =~ ^[[:space:]]*export[[:space:]]+(.+)$ ]]; then
    line="${BASH_REMATCH[1]}"
  fi
  # Only simple KEY=VALUE pairs
  if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    # Respect allowlist unless --all was provided
    if [[ "$EXPORT_ALL" != true ]]; then
      found=false
      for allowed in "${ALLOWLIST[@]}"; do
        if [[ "$key" == "$allowed" ]]; then
          found=true
          break
        fi
      done
      [[ "$found" != true ]] && continue
    fi

    # Trim surrounding quotes and export
    value="$(trim_quotes "$value")"
    export "$key=$value"
    exported+=("$key")
  fi
done < "$ENV_FILE"

# Report
if [[ ${#exported[@]} -eq 0 ]]; then
  echo "[export-root-env] No variables exported (file: ${ENV_FILE}). Check allowlist or .env contents." >&2
else
  echo "[export-root-env] Exported (${#exported[@]}): ${exported[*]} (from ${ENV_FILE})"
fi
