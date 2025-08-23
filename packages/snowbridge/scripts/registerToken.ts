import { ethers } from "ethers";
import fs from "fs";
const cfg = JSON.parse(fs.readFileSync("../../ops/addresses.json", "utf8"));

// Prefer mainnet if ETHEREUM_RPC is set; otherwise fallback to Sepolia
const RPC = process.env.ETHEREUM_RPC || process.env.ETHEREUM_SEPOLIA_RPC!;
const isMainnet = Boolean(process.env.ETHEREUM_RPC);

const PK = process.env.OPERATOR_PK!;
const GATEWAY = process.env.SNOWBRIDGE_GATEWAY || (isMainnet ? cfg.snowbridge.mainnet_gateway : cfg.snowbridge.sepolia_gateway);
const TOKEN = process.env.L1_TOKEN || (isMainnet ? cfg.ethereum?.L1Token : cfg.sepolia?.L1Token);

const abi = [
  "function quoteRegisterTokenFee(address token) view returns (uint256)",
  "function registerToken(address token) payable"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const gw = new ethers.Contract(GATEWAY, abi, wallet);

  if (!RPC) throw new Error("ETHEREUM_RPC or ETHEREUM_SEPOLIA_RPC must be set");
  if (!PK) throw new Error("OPERATOR_PK must be set");
  if (!GATEWAY || !TOKEN) throw new Error("GATEWAY or TOKEN not configured");
  if (String(TOKEN).startsWith("0xYOUR")) throw new Error("Please fill L1Token in ops/addresses.json or set L1_TOKEN env");

  const fee: bigint = await gw.quoteRegisterTokenFee(TOKEN);
  console.log("register fee:", fee.toString());
  const tx = await gw.registerToken(TOKEN, { value: fee });
  console.log("register tx:", tx.hash);
}

main().catch(console.error);
