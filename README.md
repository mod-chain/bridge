# Substrate ↔ Ethereum L1 ↔ Base bridge starter

Opinionated, minimal scaffolding to move an ERC‑20 from Substrate to Base using only audited components:

* **Snowbridge** for Substrate ↔ Ethereum L1
* **OP Standard Bridge** for Ethereum L1 ↔ Base

This repo gives you ready‑to‑run scripts, tiny ABIs, and a clean way to lock in canonical addresses per network.

---

## Directory

```
substrate-to-base-bridge-starter/
├─ README.md  ← this file
├─ .env.sample
├─ ops/
│  └─ addresses.json
├─ packages/
│  ├─ foundry/
│  │  ├─ foundry.toml
│  │  ├─ script/
│  │  │  ├─ DeployL2Token.s.sol
│  │  │  └─ DepositL1toBase.s.sol
│  │  └─ src/
│  │     └─ Interfaces.sol
│  ├─ hardhat/
│  │  ├─ package.json
│  │  ├─ hardhat.config.ts
│  │  └─ scripts/
│  │     ├─ deployL2Token.ts
│  │     └─ deposit.ts
│  └─ snowbridge/
│     ├─ package.json
│     ├─ tsconfig.json
│     ├─ scripts/
│     │  ├─ registerToken.ts
│     │  └─ sendToken.ts
│     └─ abis/
│        └─ Gateway.json
└─ LICENSE
```

---

## Quick start

1. Copy `.env.sample` to `.env` and fill values.

2. Install toolchains:

* Foundry: `curl -L https://foundry.paradigm.xyz | bash && foundryup`
* Node 20+: `corepack enable && corepack prepare pnpm@latest --activate`

3. Install deps:

```
cd packages/hardhat && pnpm i
cd ../snowbridge && pnpm i
```

4. Create the L2 token on Base using the canonical factory (via Foundry or Hardhat script), then deposit from L1 with the Standard Bridge.

5. If the asset is Substrate‑native, first register an L1 representation with Snowbridge and move it L1↔AssetHub using the Snowbridge scripts.

---

## Configuration

**`ops/addresses.json`** holds canonical contract addresses per network. Fill in your L1 token and the L2 token address once created.

> Tip: keep this file as the single source of truth for addresses. Scripts load from here.

**`.env.sample`** contains environment variables for RPC endpoints, private keys, and token metadata.

---

## Usage Examples

### Foundry Scripts

**Install Foundry**

```bash
curl -L https://foundry.paradigm.xyz | bash
# restart your shell or:
source ~/.bashrc  # or ~/.profile / ~/.zshrc, depending on your shell
foundryup
forge --version
```

**Deploy L2 token**
```bash
cd packages/foundry
forge script script/DeployL2Token.s.sol --rpc-url $BASE_RPC --broadcast
```

**Deposit from L1 to Base**
```bash
AMOUNT=1000000000000000000 L2_GAS=200000 forge script script/DepositL1toBase.s.sol \
  --rpc-url $ETHEREUM_RPC --broadcast
```

### Hardhat Scripts

**Deploy L2 token**
```bash
cd packages/hardhat
pnpm run deploy:l2
```

**Deposit tokens**
```bash
AMOUNT=1000000000000000000 L2_GAS=200000 pnpm run deposit
```

**Withdraw from Base to L1 (initiate only):**
```bash
cd packages/hardhat
pnpm run withdraw -- --network sepolia \
  --amount 100000000000000 \
  --mode initiate-only \
  --pk 0xYOUR_PRIVATE_KEY
```

Withdraw and auto-finalize on L1 (uses OP SDK; polls until ready):
```bash
pnpm run withdraw -- --network sepolia \
  --amount 100000000000000 \
  --mode initiate-and-finalize \
  --poll-interval 30 \
  --timeout 0 \
  --pk 0xYOUR_PRIVATE_KEY
```

Finalize-only (retry later from an existing L2 withdraw tx):
```bash
pnpm run withdraw -- --network sepolia \
  --mode finalize-only \
  --l2-tx 0xYOUR_L2_WITHDRAW_TX_HASH \
  --pk 0xYOUR_PRIVATE_KEY
```

Notes:
- The script validates canonical pairing via `remoteToken()` and writes machine-readable artifacts under `artifacts/withdraw/` and `artifacts/finalize/`.
- Optional OP Stack contract overrides can be provided via `ops/addresses.json`:
  - `ethereum|sepolia.L1CrossDomainMessenger`
  - `ethereum|sepolia.OptimismPortal` (optional)
  - `base|base_sepolia.L2CrossDomainMessenger`
  If present, they are passed to the OP SDK to ensure compatibility across chain configs.

Check supply + escrow invariant:
```bash
pnpm run check:supply -- --network sepolia --pretty --verify-codehash
```
Output JSON includes:
- `l1.escrow_balance`, `l2.total_supply`, per-account `l1_balance`/`l2_balance` (when `--accounts a,b,...` is provided)
- Invariant `invariants.l1_escrow_equals_l2_supply` and `invariants.delta_wei`
- Exits non-zero if invariant fails unless `--no-strict` is set

### Snowbridge Scripts

Register token with Snowbridge:
```bash
cd packages/snowbridge
pnpm run register
```

Send tokens to Substrate:
```bash
AMOUNT=1000000000000000000 DEST_BYTES=0x... pnpm run send
```

---

## Ops notes

* Set `L2_GAS` conservatively for deposits, then tune.
* Always track supply conservation across Substrate, L1 escrow, and Base L2 total supply.
* Prefer a Safe for any admin keys.

---

## Branching and Release

**Policy**

- **develop**: default branch. All work lands here via PRs.
- **production**: release branch. Only merge from `develop` via reviewed PRs.
- No direct pushes to `production`.

**Protect `production`** (GitHub Settings → Branches → Add rule)

- Branch name pattern: `production`
- Require a pull request before merging
  - Require approvals (e.g., 1–2)
  - Dismiss stale approvals on new commits
- Require status checks to pass (enable this repo’s CI checks)
- Restrict who can push to matching branches (optional, recommended)
- Do not allow bypassing the above settings

**Check branch divergence**

```bash
git fetch --all --prune
# Counts: A = commits only on develop, B = commits only on production
git rev-list --left-right --count develop...production

# Recent diverged commits (up to 50)
git log --oneline --decorate --graph --left-right develop...production -n 50
```

**Syncing**

- Bring `develop` up-to-date with `production`:
  ```bash
  git checkout develop
  git merge --no-ff production
  git push origin develop
  ```
- If unwanted commits landed on `production`:
  - Prefer revert via PR:
    ```bash
    git checkout production
    git revert <sha1> <sha2> ...
    git push origin production
    ```
  - Hard reset only if safe (destructive):
    ```bash
    git checkout production
    git reset --hard origin/develop
    git push --force-with-lease origin production
    ```

---

## LICENSE

MIT
