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

  if (!RPC) throw new Error("ETHEREUM_RPC or ETHEREUM_SEPOLIA_RPC must be set");
  if (!PK) throw new Error("DEPLOYER_PK must be set");

  if (!L1_STANDARD_BRIDGE || !L1_TOKEN || !L2_TOKEN) throw new Error("Bridge or token addresses missing in ops/addresses.json");
  if (String(L1_TOKEN).startsWith("0xYOUR") || String(L2_TOKEN).startsWith("0xTO_BE")) {
    throw new Error("Please fill L1Token and L2Token in ops/addresses.json");
  }

  const amount = BigInt(process.env.AMOUNT || "0");
  if (amount <= 0n) throw new Error("AMOUNT must be > 0");
  await (await l1.approve(L1_STANDARD_BRIDGE, amount)).wait();
  const l2Gas = Number(process.env.L2_GAS || 200000);
  const tx = await bridge.depositERC20(L1_TOKEN, L2_TOKEN, amount, l2Gas, "0x");
  console.log("deposit tx:", tx.hash);
}

main().catch(console.error);
