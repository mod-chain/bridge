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

Deploy L2 token:
```bash
cd packages/foundry
forge script script/DeployL2Token.s.sol --rpc-url $BASE_RPC --broadcast
```

Deposit from L1 to Base:
```bash
AMOUNT=1000000000000000000 L2_GAS=200000 forge script script/DepositL1toBase.s.sol \
  --rpc-url $ETHEREUM_RPC --broadcast
```

### Hardhat Scripts

Deploy L2 token:
```bash
cd packages/hardhat
pnpm run deploy:l2
```

Deposit tokens:
```bash
AMOUNT=1000000000000000000 L2_GAS=200000 pnpm run deposit
```

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

## LICENSE

MIT
