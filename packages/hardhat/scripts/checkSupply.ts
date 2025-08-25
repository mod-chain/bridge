import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import minimist from "minimist";

const ROOT = path.resolve(__dirname, "../../..");
const ADDR_PATH = path.join(ROOT, "ops/addresses.json");

const erc20Abi = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
];
const optimismMintableAbi = [
  "function remoteToken() view returns (address)",
];

function loadConfig() {
  const raw = fs.readFileSync(ADDR_PATH, "utf8");
  return JSON.parse(raw);
}

function toArrayCsv(v?: string): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function main() {
  const argv = minimist(process.argv.slice(2), {
    boolean: ["pretty", "no-strict", "verify-codehash"],
    string: [
      "network",
      "l1-rpc",
      "l2-rpc",
      "substrate-ws",
      "l1-token",
      "l2-token",
      "accounts",
      "decimals",
    ],
    default: {
      network: "sepolia",
      pretty: false,
    },
  });

  const network = (argv.network || "sepolia").toLowerCase();
  if (!["mainnet", "sepolia"].includes(network)) throw new Error("--network must be mainnet or sepolia");
  const cfg = loadConfig();
  const l1Key = network === "mainnet" ? "ethereum" : "sepolia";
  const l2Key = network === "mainnet" ? "base" : "base_sepolia";

  const l1Rpc = argv["l1-rpc"] || (network === "mainnet" ? process.env.ETHEREUM_RPC : process.env.ETHEREUM_SEPOLIA_RPC);
  const l2Rpc = argv["l2-rpc"] || (network === "mainnet" ? process.env.BASE_RPC : process.env.BASE_SEPOLIA_RPC);
  if (!l1Rpc || !l2Rpc) throw new Error("Missing RPCs; pass --l1-rpc/--l2-rpc or set env vars");

  const l1Token = (argv["l1-token"] || cfg[l1Key]?.L1Token || "").toString();
  const l2Token = (argv["l2-token"] || cfg[l2Key]?.L2Token || "").toString();
  const l1Bridge = cfg[l1Key]?.L1StandardBridge;

  if (!l1Token || !l2Token || !l1Bridge) throw new Error("Missing L1/L2 token or L1 bridge in ops/addresses.json");
  if (l1Token.startsWith("0xYOUR") || l2Token.startsWith("0xTO_BE")) throw new Error("Fill L1Token/L2Token in ops/addresses.json");

  const accountsCsv = (argv.accounts as string) || "";
  const accounts = toArrayCsv(accountsCsv);

  const l1 = new ethers.JsonRpcProvider(l1Rpc);
  const l2 = new ethers.JsonRpcProvider(l2Rpc);
  const [l1Net, l2Net] = await Promise.all([l1.getNetwork(), l2.getNetwork()]);
  console.error(`L1 chainId=${l1Net.chainId} RPC=${l1Rpc}`);
  console.error(`L2 chainId=${l2Net.chainId} RPC=${l2Rpc}`);

  const l1TokenC = new ethers.Contract(l1Token, erc20Abi, l1);
  const l2TokenC = new ethers.Contract(l2Token, erc20Abi.concat(optimismMintableAbi), l2);

  // Validate canonical pair
  const remote = await l2TokenC.remoteToken();
  if (remote.toLowerCase() !== l1Token.toLowerCase()) {
    throw new Error(`Non-canonical pairing: L2.remoteToken=${remote} != L1Token=${l1Token}`);
  }

  // Determine decimals (for informational display)
  const decimals = argv.decimals ? Number(argv.decimals) : Number(await l1TokenC.decimals());

  // Escrow balance on L1StandardBridge
  const escrowBalance: bigint = await l1TokenC.balanceOf(l1Bridge);
  const l1TotalSupply: bigint = await l1TokenC.totalSupply();
  const l2TotalSupply: bigint = await l2TokenC.totalSupply();

  const perAccounts: { address: string; l1_balance: string; l2_balance: string }[] = [];
  for (const addr of accounts) {
    const [b1, b2] = await Promise.all([
      l1TokenC.balanceOf(addr).catch(() => 0n),
      l2TokenC.balanceOf(addr).catch(() => 0n),
    ]);
    perAccounts.push({ address: addr, l1_balance: b1.toString(), l2_balance: b2.toString() });
  }

  const delta = l2TotalSupply - escrowBalance;
  const l1EqL2 = delta === 0n;

  const substrate = {
    enabled: false,
    note: argv["substrate-ws"] ? "not implemented in this script; skipped" : "skipped",
  };

  const report = {
    timestamp: new Date().toISOString(),
    network,
    l1: {
      token: l1Token,
      bridge: l1Bridge,
      escrow_balance: escrowBalance.toString(),
      total_supply: l1TotalSupply.toString(),
    },
    l2: {
      token: l2Token,
      total_supply: l2TotalSupply.toString(),
      accounts: perAccounts,
    },
    substrate,
    invariants: {
      l1_escrow_equals_l2_supply: l1EqL2,
      delta_wei: delta.toString(),
    },
    decimals,
  };

  // Optional: verify the L1 bridge has code and print a codehash fingerprint
  if (argv["verify-codehash"]) {
    const code = await l1.getCode(l1Bridge);
    if (code === "0x") throw new Error("L1StandardBridge has no code at configured address");
    const codehash = ethers.keccak256(code as any);
    console.error(`L1StandardBridge codehash=${codehash}`);
  }

  const out = argv.pretty ? JSON.stringify(report, null, 2) : JSON.stringify(report);
  console.log(out);

  if (!argv["no-strict"] && !l1EqL2) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
