# Substrate ↔ Ethereum L1 ↔ Base bridge starter

Opinionated, minimal scaffolding to move an ERC‑20 from Substrate to Base using only audited components:

* **Snowbridge** for Substrate ↔ Ethereum L1
* **OP Standard Bridge** for Ethereum L1 ↔ Base

This repo gives you ready‑to‑run scripts, tiny ABIs, and a clean way to lock in canonical addresses per network.

---

## Directory

```
substrate-to-base-bridge-starter/
├─ substrate-to-base-bridge-starter.md  ← this file
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

5. Verify your configured addresses exist on-chain before running transfers.

```
cd packages/hardhat
pnpm i
ETHEREUM_RPC=... ETHEREUM_SEPOLIA_RPC=... BASE_RPC=... BASE_SEPOLIA_RPC=... pnpm run verify:addresses
```

6. If the asset is Substrate‑native, first register an L1 representation with Snowbridge and move it L1↔AssetHub using the Snowbridge scripts.

---

## Configuration

**`ops/addresses.json`** holds canonical contract addresses per network. Fill in your L1 token and the L2 token address once created.

```json
{
  "ethereum": {
    "rpc": "${ETHEREUM_RPC}",
    "L1StandardBridge": "0x3154Cf16ccdb4C6d922629664174b904d80F2C35",
    "L1CrossDomainMessenger": "0x866E82a600A1414e583f7F13623F1aC5d58b0Afa",
    "OptimismMintableERC20Factory": "0x05cc379EBD9B30BbA19C6fA282AB29218EC61D84",
    "L1Token": "0xYOUR_L1_TOKEN"
  },
  "sepolia": {
    "rpc": "${ETHEREUM_SEPOLIA_RPC}",
    "L1StandardBridge": "0xfd0Bf71F60660E2f608ed56e1659C450eB113120",
    "L1CrossDomainMessenger": "0xC34855F4De64F1840e5686e64278da901e261f20",
    "OptimismMintableERC20Factory": "0xb1efB9650aD6d0CC1ed3Ac4a0B7f1D5732696D37",
    "L1Token": "0xYOUR_L1_TOKEN_ON_SEPOLIA"
  },
  "base": {
    "rpc": "${BASE_RPC}",
    "L2StandardBridge": "0x4200000000000000000000000000000000000010",
    "L2CrossDomainMessenger": "0x4200000000000000000000000000000000000007",
    "OptimismMintableERC20Factory": "0xF10122D428B4bc8A9d050D06a2037259b4c4B83B",
    "L2Token": "0xTO_BE_FILLED_AFTER_DEPLOY"
  },
  "base_sepolia": {
    "rpc": "${BASE_SEPOLIA_RPC}",
    "L2StandardBridge": "0x4200000000000000000000000000000000000010",
    "L2CrossDomainMessenger": "0x4200000000000000000000000000000000000007",
    "OptimismMintableERC20Factory": "0x4200000000000000000000000000000000000012",
    "L2Token": "0xTO_BE_FILLED_AFTER_DEPLOY"
  },
  "snowbridge": {
    "sepolia_gateway": "0x5b4909ce6ca82d2ce23bd46738953c7959e710cd",
    "mainnet_gateway": "0x27ca963c279c93801941e1eb8799c23f407d68e7"
  }
}
```

> Tip: keep this file as the single source of truth for addresses. Scripts load from here.

**`.env.sample`**

```
# RPC endpoints
ETHEREUM_RPC=https://mainnet.infura.io/v3/YOUR_KEY
ETHEREUM_SEPOLIA_RPC=https://sepolia.infura.io/v3/YOUR_KEY
BASE_RPC=https://mainnet.base.org
BASE_SEPOLIA_RPC=https://sepolia.base.org

# Private keys (use a throwaway for testnets)
DEPLOYER_PK=0xabc...
OPERATOR_PK=0xabc...

# For Foundry scripts only: decimal representation of the deployer private key (no 0x). Example: 123456...
DEPLOYER_PK_DEC=

# Token metadata
L2_TOKEN_NAME=YourToken on Base
L2_TOKEN_SYMBOL=YTB
```

---

## Foundry bits

**`packages/foundry/foundry.toml`**

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
ffi = true
optimizer = true
optimizer_runs = 200

[etherscan]
# optional, for verify
base = { key = "${BASESCAN_API_KEY}" }
```

**`packages/foundry/src/Interfaces.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function approve(address spender, uint256 value) external returns (bool);
}

interface IL1StandardBridge {
    function depositERC20(
        address _l1Token,
        address _l2Token,
        uint256 _amount,
        uint32 _l2Gas,
        bytes calldata _data
    ) external payable;
}

interface IOptimismMintableERC20Factory {
    event StandardL2TokenCreated(address indexed _l1Token, address indexed _l2Token);
    function createStandardL2Token(
        address _l1Token,
        string calldata _name,
        string calldata _symbol
    ) external returns (address);
}
```

**`packages/foundry/script/DeployL2Token.s.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Script.sol";
import { IOptimismMintableERC20Factory } from "../src/Interfaces.sol";

contract DeployL2Token is Script {
    function run() external {
        address factory = vm.parseJsonAddress(vm.readFile("../../ops/addresses.json"),
            "$.base.OptimismMintableERC20Factory");
        if (factory == address(0)) {
            factory = vm.parseJsonAddress(vm.readFile("../../ops/addresses.json"),
                "$.base_sepolia.OptimismMintableERC20Factory");
        }
        address l1Token = vm.parseJsonAddress(vm.readFile("../../ops/addresses.json"), "$.ethereum.L1Token");
        if (l1Token == address(0)) {
            l1Token = vm.parseJsonAddress(vm.readFile("../../ops/addresses.json"), "$.sepolia.L1Token");
        }
        string memory name = vm.envString("L2_TOKEN_NAME");
        string memory symbol = vm.envString("L2_TOKEN_SYMBOL");

        // Set DEPLOYER_PK_DEC (decimal, no 0x) in your .env
        vm.startBroadcast(vm.envUint("DEPLOYER_PK_DEC"));
        address l2Token = IOptimismMintableERC20Factory(factory).createStandardL2Token(l1Token, name, symbol);
        vm.stopBroadcast();

        console2.log("L2 token:", l2Token);
    }
}
```

**`packages/foundry/script/DepositL1toBase.s.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Script.sol";
import { IERC20, IL1StandardBridge } from "../src/Interfaces.sol";

contract DepositL1toBase is Script {
    function run() external {
        address bridge = vm.parseJsonAddress(vm.readFile("../../ops/addresses.json"), "$.ethereum.L1StandardBridge");
        address l1Token = vm.parseJsonAddress(vm.readFile("../../ops/addresses.json"), "$.ethereum.L1Token");
        address l2Token = vm.parseJsonAddress(vm.readFile("../../ops/addresses.json"), "$.base.L2Token");
        if (l2Token == address(0)) {
            l2Token = vm.parseJsonAddress(vm.readFile("../../ops/addresses.json"), "$.base_sepolia.L2Token");
        }

        uint256 amount = vm.envUint("AMOUNT");
        uint32 l2Gas = uint32(vm.envUint("L2_GAS"));

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        require(IERC20(l1Token).approve(bridge, amount));
        IL1StandardBridge(bridge).depositERC20(l1Token, l2Token, amount, l2Gas, "");
        vm.stopBroadcast();
    }
}
```

Run examples:

```
cd packages/foundry
DEPLOYER_PK_DEC=$(cast wallet import --json tmp | jq -r .privateKey) # or set manually (decimal)
AMOUNT=1000000000000000000 L2_GAS=200000 forge script script/DepositL1toBase.s.sol \
  --rpc-url $ETHEREUM_RPC --broadcast
```

---

## Hardhat scripts (optional)

**`packages/hardhat/package.json`**

```json
{
  "name": "bridge-hardhat",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "deploy:l2": "ts-node scripts/deployL2Token.ts",
    "deposit": "ts-node scripts/deposit.ts"
  },
  "dependencies": {
    "ethers": "^6.13.2",
    "ts-node": "^10.9.2",
    "typescript": "^5.5.4"
  }
}
```

**`packages/hardhat/hardhat.config.ts`**

```ts
import { HardhatUserConfig } from "hardhat/config";
const config: HardhatUserConfig = { solidity: "0.8.20" };
export default config;
```

**`packages/hardhat/scripts/deployL2Token.ts`**

```ts
import { ethers } from "ethers";
import fs from "fs";
const cfg = JSON.parse(fs.readFileSync("../../ops/addresses.json", "utf8"));

const RPC = process.env.BASE_RPC || process.env.BASE_SEPOLIA_RPC!;
const PK = process.env.DEPLOYER_PK!;

const FACTORY = cfg.base?.OptimismMintableERC20Factory || cfg.base_sepolia.OptimismMintableERC20Factory;
const L1_TOKEN = cfg.ethereum?.L1Token || cfg.sepolia.L1Token;

const abi = [
  "function createStandardL2Token(address _l1Token, string _name, string _symbol) returns (address)",
  "event StandardL2TokenCreated(address indexed _l1Token, address indexed _l2Token)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const factory = new ethers.Contract(FACTORY, abi, wallet);
  const name = process.env.L2_TOKEN_NAME || "YourToken on Base";
  const symbol = process.env.L2_TOKEN_SYMBOL || "YTB";
  const tx = await factory.createStandardL2Token(L1_TOKEN, name, symbol);
  const rcpt = await tx.wait();
  const evt = rcpt?.logs.map(l => {
    try { return factory.interface.parseLog(l); } catch { return null; }
  }).find(e => e && e.name === "StandardL2TokenCreated");
  console.log("L2 token:", evt?.args?._l2Token);
}

main().catch(console.error);
```

**`packages/hardhat/scripts/deposit.ts`**

```ts
import { ethers } from "ethers";
import fs from "fs";
const cfg = JSON.parse(fs.readFileSync("../../ops/addresses.json", "utf8"));

const RPC = process.env.ETHEREUM_RPC || process.env.ETHEREUM_SEPOLIA_RPC!;
const PK = process.env.DEPLOYER_PK!;

const L1_STANDARD_BRIDGE = cfg.ethereum?.L1StandardBridge || cfg.sepolia.L1StandardBridge;
const L1_TOKEN = cfg.ethereum?.L1Token || cfg.sepolia.L1Token;
const L2_TOKEN = cfg.base?.L2Token || cfg.base_sepolia.L2Token;

const erc20Abi = ["function approve(address,uint256) returns (bool)"];
const bridgeAbi = [
  "function depositERC20(address,address,uint256,uint32,bytes) payable"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);

  const l1 = new ethers.Contract(L1_TOKEN, erc20Abi, wallet);
  const bridge = new ethers.Contract(L1_STANDARD_BRIDGE, bridgeAbi, wallet);

  const amount = BigInt(process.env.AMOUNT || "0");
  await (await l1.approve(L1_STANDARD_BRIDGE, amount)).wait();
  const l2Gas = Number(process.env.L2_GAS || 200000);
  const tx = await bridge.depositERC20(L1_TOKEN, L2_TOKEN, amount, l2Gas, "0x");
  console.log("deposit tx:", tx.hash);
}

main().catch(console.error);
```

---

## Snowbridge scripts

**`packages/snowbridge/package.json`**

```json
{
  "name": "snowbridge-scripts",
  "version": "0.1.0",
  "type": "module",
  "dependencies": {
    "ethers": "^6.13.2",
    "ts-node": "^10.9.2",
    "typescript": "^5.5.4"
  },
  "scripts": {
    "register": "ts-node scripts/registerToken.ts",
    "send": "ts-node scripts/sendToken.ts"
  }
}
```

**`packages/snowbridge/scripts/registerToken.ts`**

```ts
import { ethers } from "ethers";
import fs from "fs";
const cfg = JSON.parse(fs.readFileSync("../../ops/addresses.json", "utf8"));
const RPC = process.env.ETHEREUM_RPC || process.env.ETHEREUM_SEPOLIA_RPC!;
const PK = process.env.OPERATOR_PK!;
const GATEWAY = process.env.SNOWBRIDGE_GATEWAY || cfg.snowbridge.sepolia_gateway;
const TOKEN = process.env.L1_TOKEN || cfg.sepolia.L1Token;

const abi = [
  "function quoteRegisterTokenFee(address token) view returns (uint256)",
  "function registerToken(address token) payable"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const gw = new ethers.Contract(GATEWAY, abi, wallet);

  const fee: bigint = await gw.quoteRegisterTokenFee(TOKEN);
  console.log("register fee:", fee.toString());
  const tx = await gw.registerToken(TOKEN, { value: fee });
  console.log("register tx:", tx.hash);
}

main().catch(console.error);
```

**`packages/snowbridge/scripts/sendToken.ts`**

```ts
import { ethers } from "ethers";
import fs from "fs";
const cfg = JSON.parse(fs.readFileSync("../../ops/addresses.json", "utf8"));
const RPC = process.env.ETHEREUM_RPC || process.env.ETHEREUM_SEPOLIA_RPC!;
const PK = process.env.OPERATOR_PK!;
const GATEWAY = process.env.SNOWBRIDGE_GATEWAY || cfg.snowbridge.sepolia_gateway;
const TOKEN = process.env.L1_TOKEN || cfg.sepolia.L1Token;

// destinationChain is the parachain id. Example: 1000 for Asset Hub on some testnets. Parameterize it.
const DEST_CHAIN = Number(process.env.DEST_CHAIN || 1000);
// Destination address kind and bytes are chain‑specific. For Asset Hub, this is a 32‑byte AccountId, encoded as hex.
const DEST_KIND = Number(process.env.DEST_KIND || 0); // 0 = AccountId32, per Snowbridge docs
const DEST_BYTES = process.env.DEST_BYTES!; // 0x...
const DEST_FEE = BigInt(process.env.DEST_FEE || "0"); // often 0 for Asset Hub
const AMOUNT = BigInt(process.env.AMOUNT || "0");

const abi = [
  "function quoteSendTokenFee(address token, uint32 destinationChain, (uint8 kind, bytes data) destinationAddress, uint128 destinationFee, uint128 amount) view returns (uint256)",
  "function sendToken(address token, uint32 destinationChain, (uint8 kind, bytes data) destinationAddress, uint128 destinationFee, uint128 amount) payable"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const gw = new ethers.Contract(GATEWAY, abi, wallet);

  const dest = { kind: DEST_KIND, data: DEST_BYTES };
  const fee: bigint = await gw.quoteSendTokenFee(TOKEN, DEST_CHAIN, dest, DEST_FEE, AMOUNT);
  console.log("send fee:", fee.toString());
  const tx = await gw.sendToken(TOKEN, DEST_CHAIN, dest, DEST_FEE, AMOUNT, { value: fee });
  console.log("send tx:", tx.hash);
}

main().catch(console.error);
```

**`packages/snowbridge/abis/Gateway.json`** is intentionally thin. The two functions above are all you need.

---

## Ops notes

* Set `L2_GAS` conservatively for deposits, then tune.
* Always track supply conservation across Substrate, L1 escrow, and Base L2 total supply.
* Prefer a Safe for any admin keys.

---

## LICENSE

MIT
