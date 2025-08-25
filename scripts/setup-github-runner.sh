#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'
log() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

command -v docker >/dev/null || err "docker is required"
command -v curl >/dev/null || err "curl is required"

# Load config if present
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF_FILE="${SCRIPT_DIR}/runner.conf"
[ -f "$CONF_FILE" ] && . "$CONF_FILE"

# Defaults
: "${LABELS:=self-hosted,linux,x64,modnet-runner}"
: "${BASE_DIR:=/home/github-runner/actions-runner}"
: "${IMAGE:=tcardonne/github-runner:latest}"

# Resolve owner/repo
if [ -z "$REPO" ]; then
  # try to detect from git remote
  if git -C "${SCRIPT_DIR}/.." remote -v | grep -Eo 'github.com[:/][^ ]+' >/dev/null; then
    REPO=$(git -C "${SCRIPT_DIR}/.." remote -v | awk '/fetch/{print $2}' | sed -n 's#.*github.com[:/]\([^/.]*\)/\([^/.]*\).*#\1/\2#p' | head -n1)
  fi
fi

[ -z "$REPO" ] && read -p "Enter owner/repo (e.g. mod-net/bridge): " REPO
[ -z "$GITHUB_PAT" ] && read -p "Enter GitHub PAT (repo scope): " GITHUB_PAT
[ -z "$REPO" ] && err "REPO is required"
[ -z "$GITHUB_PAT" ] && err "GITHUB_PAT is required"

OWNER_REPO="$REPO"
REPO_URL="https://github.com/${OWNER_REPO}"
SAFE_NAME=${OWNER_REPO//\//_}
RUNNER_DIR="${BASE_DIR}/${SAFE_NAME}"
RUNNER_NAME="modnet-${SAFE_NAME}-$(hostname)-$(date +%s)"
CONTAINER_NAME="github-runner-${SAFE_NAME}"

log "Setting up runner for ${REPO_URL}"
mkdir -p "$RUNNER_DIR" && sudo chmod -R 777 "$RUNNER_DIR" || true

# Remove existing
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  warn "Removing existing container ${CONTAINER_NAME}"
  docker rm -f "${CONTAINER_NAME}" || true
fi

# Get registration token
log "Requesting registration token for ${OWNER_REPO}"
REG_TOKEN=$(curl -fsSL -X POST \
  -H "Authorization: token ${GITHUB_PAT}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${OWNER_REPO}/actions/runners/registration-token" \
  | sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"\n]*\)".*/\1/p' | head -n1)

if [ -z "$REG_TOKEN" ]; then
  err "Failed to obtain registration token (check PAT scope and repo access)"
fi

# Start container
log "Starting container ${CONTAINER_NAME}"
docker run -d --name "${CONTAINER_NAME}" \
  --restart always \
  --privileged \
  --network host \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "${RUNNER_DIR}":/home/runner/_work \
  -e RUNNER_TOKEN="${REG_TOKEN}" \
  -e RUNNER_REPOSITORY_URL="${REPO_URL}" \
  -e RUNNER_NAME="${RUNNER_NAME}" \
  -e RUNNER_LABELS="${LABELS}" \
  -e RUNNER_WORK_DIRECTORY="_work" \
  -e DISABLE_RUNNER_UPDATE=true \
  -e RUNNER_ALLOW_RUNASROOT=true \
  "$IMAGE"

# Minimal in-container setup
log "Applying minimal in-container setup"
docker exec "${CONTAINER_NAME}" bash -lc "\
  set -e; \
  if [ -e /var/run/docker.sock ]; then chmod 666 /var/run/docker.sock || true; fi; \
  mkdir -p /__w/_temp /__w/_actions /__w/_tool /__w/_work; \
  chmod 777 /__w/_temp /__w/_actions /__w/_tool /__w/_work 2>/dev/null || true; \
  mkdir -p /home/runner/_work 2>/dev/null || true; \
  chmod 777 /home/runner/_work 2>/dev/null || true; \
" || true

log "Done. Check registration at ${REPO_URL}/settings/actions/runners"
