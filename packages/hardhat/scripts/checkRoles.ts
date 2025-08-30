import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import minimist from "minimist";

const ROOT = path.resolve(__dirname, "../../..");
const ADDR_PATH = path.join(ROOT, "ops/addresses.json");

const accessControlAbi = [
  "function hasRole(bytes32,address) view returns (bool)",
  "function getRoleAdmin(bytes32) view returns (bytes32)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
];
const bridgeMinterAbi = accessControlAbi.concat([
  "function RELAYER_ROLE() view returns (bytes32)",
]);
const erc20AccessControlAbi = [
  "function hasRole(bytes32,address) view returns (bool)",
  "function MINTER_ROLE() view returns (bytes32)",
];

function loadCfg() {
  const raw = fs.readFileSync(ADDR_PATH, "utf8");
  return JSON.parse(raw);
}

function addr(x?: string) {
  if (!x) return "";
  return x.toString();
}

function fmtHex32(x: string) {
  return x.startsWith("0x") && x.length === 66 ? x : x;
}

async function main() {
  const argv = minimist(process.argv.slice(2), {
    string: ["network", "l1-rpc", "minter", "relayer", "admin", "l1-token"],
    default: { network: "sepolia" },
  });

  const network = (argv.network || "sepolia").toLowerCase();
  if (!["mainnet", "sepolia"].includes(network)) {
    throw new Error("--network must be mainnet or sepolia");
  }
  const cfg = loadCfg();
  const l1Key = network === "mainnet" ? "ethereum" : "sepolia";

  const l1Rpc =
    argv["l1-rpc"] || (network === "mainnet" ? process.env.ETHEREUM_RPC : process.env.ETHEREUM_SEPOLIA_RPC);
  if (!l1Rpc) throw new Error("Missing L1 RPC. Use --l1-rpc or set ETHEREUM_RPC / ETHEREUM_SEPOLIA_RPC");
  const provider = new ethers.JsonRpcProvider(l1Rpc);

  const minterAddr = addr(argv.minter) || addr(cfg[l1Key]?.BridgeMinter);
  const relayerAddr = addr(argv.relayer) || "";
  const adminAddr = addr(argv.admin) || "";
  const l1TokenAddr = addr(argv["l1-token"]) || addr(cfg[l1Key]?.L1Token);

  if (!minterAddr) throw new Error("BridgeMinter address not provided (use --minter or fill ops/addresses.json)");
  if (!l1TokenAddr) throw new Error("L1 token address not provided (use --l1-token or fill ops/addresses.json)");

  const minter = new ethers.Contract(minterAddr, bridgeMinterAbi, provider);
  const token = new ethers.Contract(l1TokenAddr, erc20AccessControlAbi, provider);

  // Load role IDs
  const [RELAYER_ROLE, DEFAULT_ADMIN_ROLE, MINTER_ROLE] = await Promise.all([
    minter.RELAYER_ROLE(),
    minter.DEFAULT_ADMIN_ROLE(),
    token.MINTER_ROLE(),
  ]);

  console.log("L1 RPC:", l1Rpc);
  console.log("BridgeMinter:", minterAddr);
  console.log("L1 Token:", l1TokenAddr);
  console.log("RELAYER_ROLE:", fmtHex32(RELAYER_ROLE));
  console.log("DEFAULT_ADMIN_ROLE:", fmtHex32(DEFAULT_ADMIN_ROLE));
  console.log("MINTER_ROLE (L1 token):", fmtHex32(MINTER_ROLE));

  // Check minter has MINTER_ROLE on the L1 token
  const minterHasMinter = await token.hasRole(MINTER_ROLE, minterAddr);
  console.log("- L1 token MINTER_ROLE granted to BridgeMinter:", Boolean(minterHasMinter));

  // Optionally check a relayer address membership
  if (relayerAddr) {
    const hasRelayer = await minter.hasRole(RELAYER_ROLE, relayerAddr);
    console.log("- BridgeMinter RELAYER_ROLE for", relayerAddr, ":", Boolean(hasRelayer));
  } else {
    console.log("- BridgeMinter RELAYER_ROLE: pass --relayer 0x... to check a specific EOA");
  }

  // Optionally check an admin address membership
  if (adminAddr) {
    const hasAdmin = await minter.hasRole(DEFAULT_ADMIN_ROLE, adminAddr);
    console.log("- BridgeMinter DEFAULT_ADMIN_ROLE for", adminAddr, ":", Boolean(hasAdmin));
  } else {
    console.log("- BridgeMinter DEFAULT_ADMIN_ROLE: pass --admin 0x... to check a specific EOA");
  }

  // Show role admin of RELAYER_ROLE
  const relayerAdmin = await minter.getRoleAdmin(RELAYER_ROLE).catch(() => undefined);
  if (relayerAdmin) {
    console.log("- getRoleAdmin(RELAYER_ROLE):", fmtHex32(relayerAdmin));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

