import { ethers, Log } from "ethers";
import fs from "fs";

// Load config (addresses) for sensible defaults
const cfg = JSON.parse(fs.readFileSync("../../ops/addresses.json", "utf8"));

// Simple argv parser: supports --key value and --key=value
function argvFlag(name: string): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === `--${name}`) {
      return argv[i + 1];
    }
    if (a.startsWith(`--${name}=`)) {
      return a.split("=").slice(1).join("=");
    }
  }
  return undefined;
}

function normalizePk(pk?: string): string {
  if (!pk) throw new Error("Private key is required (--pk or DEPLOYER_PK/PRIVATE_KEY)");
  const trimmed = pk.trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
  // Accept 0x-prefixed hex or 64-char hex without 0x
  const hex = trimmed.startsWith("0x") ? trimmed : /^([0-9a-fA-F]{64})$/.test(trimmed) ? `0x${trimmed}` : trimmed;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("Invalid private key format. Provide 32-byte hex, with or without 0x prefix.");
  }
  return hex;
}

function clean(val?: string | null): string | undefined {
  if (val == null) return undefined;
  const trimmed = String(val).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function firstNonEmpty(...vals: Array<string | undefined | null>): string | undefined {
  for (const v of vals) {
    const c = clean(v);
    if (c) return c;
  }
  return undefined;
}

// Resolve parameters with precedence: CLI flags > env vars > config defaults
const params = {
  rpc: firstNonEmpty(
    argvFlag("rpc"),
    process.env.BASE_RPC,
    process.env.BASE_SEPOLIA_RPC,
    process.env.BASE_RPC_URL,
    process.env.BASE_SEPOLIA_RPC_URL
  ),
  pk: argvFlag("pk") || process.env.DEPLOYER_PK || process.env.PRIVATE_KEY,
  factory: firstNonEmpty(
    argvFlag("factory"),
    cfg.base?.OptimismMintableERC20Factory,
    cfg.base_sepolia?.OptimismMintableERC20Factory
  ),
  l1Token: firstNonEmpty(argvFlag("l1Token"), cfg.ethereum?.L1Token, cfg.sepolia?.L1Token),
  name: argvFlag("name") || process.env.L2_TOKEN_NAME || "YourToken on Base",
  symbol: argvFlag("symbol") || process.env.L2_TOKEN_SYMBOL || "YTB",
};

async function main() {
  if (!params.rpc) throw new Error("Missing RPC. Provide --rpc or set BASE_SEPOLIA_RPC/BASE_RPC.");
  if (!params.factory) throw new Error("Missing OptimismMintableERC20Factory address (--factory)");
  if (!params.l1Token) throw new Error("Missing L1 token address (--l1Token)");
  if (!ethers.isAddress(params.factory)) throw new Error(`Factory is not a valid address: ${params.factory}`);
  if (!ethers.isAddress(params.l1Token)) throw new Error(`L1 token is not a valid address: ${params.l1Token}`);

  const provider = new ethers.JsonRpcProvider(params.rpc);
  const wallet = new ethers.Wallet(normalizePk(params.pk), provider);
  const factory = new ethers.Contract(params.factory, abi, wallet);

  console.log("Using:", {
    rpc: params.rpc,
    from: await wallet.getAddress(),
    factory: params.factory,
    l1Token: params.l1Token,
    name: params.name,
    symbol: params.symbol,
  });

  const tx = await factory.createStandardL2Token(params.l1Token, params.name, params.symbol);
  const rcpt = await tx.wait();
  const evt = rcpt?.logs
    .map((l: Log) => {
      try {
        return factory.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((e: any) => e && e.name === "StandardL2TokenCreated");
  console.log("L2 token:", evt?.args?._l2Token);
}

// Minimal ABI for the factory
const abi = [
  "function createStandardL2Token(address _l1Token, string _name, string _symbol) returns (address)",
  "event StandardL2TokenCreated(address indexed _l1Token, address indexed _l2Token)",
];

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
