import { ethers } from "ethers";
import fs from "fs";
const cfg = JSON.parse(fs.readFileSync("../../ops/addresses.json", "utf8"));

// Prefer mainnet if ETHEREUM_RPC is set; otherwise fallback to Sepolia
const RPC = process.env.ETHEREUM_RPC || process.env.ETHEREUM_SEPOLIA_RPC!;
const isMainnet = Boolean(process.env.ETHEREUM_RPC);

const PK = process.env.OPERATOR_PK!;
const GATEWAY = process.env.SNOWBRIDGE_GATEWAY || (isMainnet ? cfg.snowbridge.mainnet_gateway : cfg.snowbridge.sepolia_gateway);
const TOKEN = process.env.L1_TOKEN || (isMainnet ? cfg.ethereum?.L1Token : cfg.sepolia?.L1Token);

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

  if (!RPC) throw new Error("ETHEREUM_RPC or ETHEREUM_SEPOLIA_RPC must be set");
  if (!PK) throw new Error("OPERATOR_PK must be set");
  if (!GATEWAY || !TOKEN) throw new Error("GATEWAY or TOKEN not configured");
  if (String(TOKEN).startsWith("0xYOUR")) throw new Error("Please fill L1Token in ops/addresses.json or set L1_TOKEN env");
  if (!DEST_BYTES) throw new Error("DEST_BYTES must be set (hex-encoded destination AccountId)");
  if (AMOUNT <= 0n) throw new Error("AMOUNT must be > 0");

  const dest = { kind: DEST_KIND, data: DEST_BYTES };
  const fee: bigint = await gw.quoteSendTokenFee(TOKEN, DEST_CHAIN, dest, DEST_FEE, AMOUNT);
  console.log("send fee:", fee.toString());
  const tx = await gw.sendToken(TOKEN, DEST_CHAIN, dest, DEST_FEE, AMOUNT, { value: fee });
  console.log("send tx:", tx.hash);
}

main().catch(console.error);
