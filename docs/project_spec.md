```markdown
# Mod-Net Bridge: Project Specs

This doc defines two cooperating projects:

1) **subspace** (your Substrate solo-chain repo): on-chain calls and node-integrated relayer.
2) **bridge** (L1 contracts and tools): ERC-20, BridgeMinter, and Standard Bridge wiring to Base Sepolia.

Keep everything testnet-friendly. Replace addresses when you promote to mainnet.

---

## 1) subspace (solo chain + node-integrated relayer)

### 1.1 Runtime pallet: `pallet-bridge-out`
**Purpose:** lock native tokens on your solo chain and emit a replay-safe fact that L1 relayers consume.

**Config**
- `type Currency: frame_support::traits::Currency<AccountId>`
- `#[pallet::constant] type PalletId: Get<PalletId>`
- `const SUBSTRATE_DECIMALS: u8` in runtime
- Weight hints for extrinsics

**Storage**
- `NextNonce: u64` (ValueQuery, starts at 0)

**Events**
- `BridgeToL1Locked(who: AccountId, amount_native: Balance, l2_recipient: H160, nonce: u64)`

**Errors**
- `AmountZero`

**Extrinsics**
- `lock_for_base(amount: Balance, l2_recipient: H160)`  
  Behavior:
  - `ensure_signed(origin)`  
  - `ensure!(amount > 0, AmountZero)`  
  - Transfer `amount` from `who` to `reserve_account = PalletId.into_account_truncating()` using `Currency::transfer(..., AllowDeath)`
  - `nonce = NextNonce::get(); NextNonce::put(nonce + 1);`
  - Emit `BridgeToL1Locked(who, amount, l2_recipient, nonce)`

**Deterministic Reserve Account**
- `reserve_account() -> AccountId = PalletId.into_account_truncating()`

**Invariants**
- `sum_locked_native >= sum_bridged_value_normalized` (checked off-chain by your scripts)
- Nonce strictly increases, never reused

**Test vectors**
- Locks with zero should fail
- Two calls with same sender are distinct due to nonce
- Event decodes in polkadot-js

---

### 1.2 Node-integrated relayer task (service layer, not runtime)
**Goal:** have chain nodes act as relayers. No separate infra.

**CLI flags**
```

\--bridge.enable
\--bridge.l1-rpc <https Sepolia RPC>
\--bridge.base-rpc <https Base Sepolia RPC>
\--bridge.pk 0x<hex EOA private key for this node>
\--bridge.l1-token 0x<L1 ERC20>
\--bridge.l2-token 0x<L2 OptimismMintable ERC20>
\--bridge.l1-bridge 0xfd0Bf71F60660E2f608ed56e1659C450eB113120  # Sepolia L1StandardBridge
\--bridge.l2-gas 200000
\--bridge.substrate-decimals 12
\--bridge.erc20-decimals 18
\--bridge.minter 0x<BridgeMinter on Sepolia>
\--bridge.poll-interval-ms 1500

```

**Leader selection**  
To avoid duplicate gas spends:
- Gather validator or authority IDs from the node.
- Compute `idx = keccak256(nonce || best_block_hash) % N`.
- Only leader index `idx` relays this nonce.
- Optional fallback: if no success receipt within `T` blocks, `idx+1 mod N` takes over.

**Event subscription**
- Subscribe to `BridgeToL1Locked` via client API in the service task.
- For each event, form a unique `eventId` for L1 replay:
```

eventId = keccak256(
abi.encode(
"SUBSPACE",
genesis\_hash,         // 32 bytes
nonce,                // u64
who,                  // SCALE-encoded AccountId bytes
amount\_native,        // SCALE-encoded
l2\_recipient          // 20 bytes
)
)

```

**Unit conversion**
- `SUB_DEC = --bridge.substrate-decimals`
- `ERC_DEC = --bridge.erc20-decimals`
- If `SUB_DEC < ERC_DEC`: `amount_wei = amount_native * 10^(ERC_DEC - SUB_DEC)`
- If `SUB_DEC > ERC_DEC`: `amount_wei = amount_native / 10^(SUB_DEC - ERC_DEC)`

**Relay procedure**
1) Check `BridgeMinter.consumed(eventId) == false` on Sepolia.
2) Call `BridgeMinter.mintAndBridge(eventId, l2_recipient, amount_wei, l2_gas)`.
3) Record success in logs and local node DB if desired.

**Backoff and retries**
- Exponential backoff on RPC errors.
- Drop or quarantine events that revert with `AlreadyConsumed`.
- Periodic liveness probes on RPCs.

**Observability**
- Logs: one line per event with nonce, tx hash.
- Metrics (optional): Prometheus counters for seen, relayed, failed, retried.

**Security**
- Each node EOA must be whitelisted in BridgeMinter.
- Private keys live in node process env or keystore.
- No mint capability on EOAs, only the minter contract holds `MINTER_ROLE`.

---

## 2) bridge (L1 contracts and tools)

### 2.1 ERC-20 on Sepolia: `MyL1Token`
**Requirements**
- OpenZeppelin `ERC20`, `ERC20Permit`, `AccessControl`
- Roles:
- `DEFAULT_ADMIN_ROLE` for admin ops
- `MINTER_ROLE` for mint
- Functions:
- `mint(address to, uint256 amount)` onlyRole(MINTER_ROLE)

**Admin model**
- Start with your EOA for testnet.
- Later, move `DEFAULT_ADMIN_ROLE` to a Safe.
- Minter will be the BridgeMinter contract.

**Decimals**
- 18, unless you have a reason to change

---

### 2.2 L2 token on Base Sepolia
**Type**
- `OptimismMintableERC20` created by the official factory on Base Sepolia

**Invariant**
- `OptimismMintableERC20.remoteToken() == <L1 token address>`

---

### 2.3 BridgeMinter.sol (on Sepolia)
**Purpose**
- Hold `MINTER_ROLE` on L1 token
- Enforce one-time consumption of each Subspace event
- Execute Standard Bridge deposit to Base in a single call

**Constructor**
```

constructor(address \_token, address \_l1StandardBridge, address \_l2Token, address \_admin)

```
- `token` = L1 ERC-20
- `bridge` = Sepolia L1StandardBridge
- `l2Token` = Base Sepolia OptimismMintable token
- `admin` = owner or AccessControl admin

**State**
- `mapping(bytes32 => bool) consumed`
- `mapping(address => bool) isRelayer`
- `address admin` or AccessControl `DEFAULT_ADMIN_ROLE`

**Events**
- `RelayerSet(address relayer, bool enabled)`
- `Bridged(bytes32 indexed eventId, address indexed to, uint256 amount)`
- `Consumed(bytes32 indexed eventId)`

**Errors**
- `NotRelayer()`
- `AlreadyConsumed()`
- `ZeroAmount()`

**Functions**
```

function setRelayer(address who, bool on) external onlyAdmin;
function setAdmin(address newAdmin) external onlyAdmin;              // or use AccessControl
function consumed(bytes32 eventId) external view returns (bool);

function mintAndBridge(
bytes32 eventId,
address to,
uint256 amountWei,
uint32 l2Gas
) external onlyRelayer nonReentrant {
if (consumed\[eventId]) revert AlreadyConsumed();
if (amountWei == 0) revert ZeroAmount();
consumed\[eventId] = true;
token.mint(address(this), amountWei);
require(token.approve(address(bridge), amountWei), "approve");
bridge.depositERC20To(address(token), l2Token, to, amountWei, l2Gas, "");
emit Consumed(eventId);
emit Bridged(eventId, to, amountWei);
}

````

**Security posture**
- Only whitelisted relayers can call
- Replay-proof via `consumed[eventId]`
- No token custody risk on EOA. Only contract holds minter power

**Upgrade path (later)**
- Replace whitelist with M-of-N attestation verification
- Event hash becomes the message, contract verifies signatures of validator set
- Same external interface, so nodes only add a signature collection step

---

### 2.4 Standard Bridge addresses and networks (testnet)
- **Ethereum Sepolia L1StandardBridge:** `0xfd0Bf71F60660E2f608ed56e1659C450eB113120`
- **Base Sepolia L2StandardBridge:** `0x4200000000000000000000000000000000000010`
- **Base Sepolia L2CrossDomainMessenger:** `0x4200000000000000000000000000000000000007`
- **Base Sepolia OptimismMintableERC20Factory:** `0x4200000000000000000000000000000000000012`

Confirm against current Base docs before mainnet work.

---

## 3) Shared config and tooling

### 3.1 `ops/addresses.json` schema
```json
{
  "sepolia": {
    "rpc": "${ETHEREUM_SEPOLIA_RPC}",
    "L1StandardBridge": "0xfd0Bf71F60660E2f608ed56e1659C450eB113120",
    "L1CrossDomainMessenger": "0xC34855F4De64F1840e5686e64278da901e261f20",
    "OptimismMintableERC20Factory": "0xb1efB9650aD6d0CC1ed3Ac4a0B7f1D5732696D37",
    "L1Token": "0xd035e701BEFaE437d9eC5237646Ff7AD8E9174c4",
    "BridgeMinter": "0x<filled after deploy>"
  },
  "base_sepolia": {
    "rpc": "${BASE_SEPOLIA_RPC}",
    "L2StandardBridge": "0x4200000000000000000000000000000000000010",
    "L2CrossDomainMessenger": "0x4200000000000000000000000000000000000007",
    "OptimismMintableERC20Factory": "0x4200000000000000000000000000000000000012",
    "L2Token": "0x4997665C5AFBe3422C95f5133cc81607C47a7fd0"
  }
}
````

### 3.2 Env vars

```
# RPCs
ETHEREUM_SEPOLIA_RPC=...
BASE_SEPOLIA_RPC=...

# Keys
DEPLOYER_PK=0x<hex key>               # used by scripts and node service
DEPLOYER_PK_DEC=<decimal>              # only for Foundry scripts

# Node bridge task
BRIDGE_ENABLE=true
BRIDGE_L1_RPC=${ETHEREUM_SEPOLIA_RPC}
BRIDGE_BASE_RPC=${BASE_SEPOLIA_RPC}
BRIDGE_PK=${DEPLOYER_PK}
BRIDGE_L1_TOKEN=0xd035e701BEFaE437d9eC5237646Ff7AD8E9174c4
BRIDGE_L2_TOKEN=0x4997665C5AFBe3422C95f5133cc81607C47a7fd0
BRIDGE_L1_BRIDGE=0xfd0Bf71F60660E2f608ed56e1659C450eB113120
BRIDGE_L2_GAS=200000
BRIDGE_MINTER=0x<BridgeMinter>
BRIDGE_SUBSTRATE_DECIMALS=12
BRIDGE_ERC20_DECIMALS=18
```

---

## 4) End-to-end flow

1. User calls `lock_for_base(amount_native, l2_recipient)` on subspace.
2. Event `BridgeToL1Locked(..., nonce)` fires.
3. Node bridge task sees the event, computes `eventId`, wins leader, calls `BridgeMinter.mintAndBridge(eventId, l2_recipient, amount_wei, l2_gas)` on Sepolia.
4. BridgeMinter mints, approves, and calls `depositERC20To` to Base Sepolia.
5. On Base Sepolia, the L2 token mints to `l2_recipient`.
6. `check:supply` shows `l1_escrow_equals_l2_supply == true` and `delta_wei == 0`.

---

## 5) Acceptance criteria

* Pallet compiles, event visible in polkadot-js and decoded by node.
* Node service relays first deposit on devnet with one validator.
* Replay safety proven: two nodes racing the same nonce leads to exactly one L1 tx, others revert with `AlreadyConsumed`.
* `remoteToken()` on L2 equals L1 token.
* `check:supply` passes on every run after deposits and after optional withdraw tests.
* Configurable decimals conversion behaves as expected.

---

## 6) Testing plan

* **Unit**

  * Pallet: nonce increments, reserve account receives funds, event fields correct.
  * BridgeMinter: onlyRelayer guard, replay guard, zero amount revert, happy path.

* **Integration (testnets)**

  * Deploy MyL1Token to Sepolia, L2 token to Base Sepolia via factory.
  * Deploy BridgeMinter to Sepolia, grant it `MINTER_ROLE`, set relayers.
  * Start one node with bridge task.
  * Call `lock_for_base`, observe L2 balance and `check:supply`.
  * Add a second node, verify leader selection prevents duplicate mints.

* **Chaos**

  * Kill leader after emitting event. Confirm backoff and next leader relays.
  * Submit duplicate events with same nonce on-chain, confirm second fails at pallet or is ignored by node.

---

## 7) Future upgrade option: M-of-N attestations

* Replace `isRelayer` with validator-set attestations.
* Each validator signs EIP-712 typed data of the `eventId` payload.
* Contract verifies `sigCount >= threshold`, then mints and bridges.
* Node task collects sigs off-chain, any node submits.

---

```
::contentReference[oaicite:0]{index=0}
```
