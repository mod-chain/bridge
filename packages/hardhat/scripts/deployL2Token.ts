import { ethers, Log } from "ethers";
import fs from "fs";
const cfg = JSON.parse(fs.readFileSync("../../ops/addresses.json", "utf8"));

const RPC = process.env.BASE_RPC || process.env.BASE_SEPOLIA_RPC!;
const PK = process.env.DEPLOYER_PK!;

const FACTORY =
  cfg.base?.OptimismMintableERC20Factory || cfg.base_sepolia.OptimismMintableERC20Factory;
const L1_TOKEN = cfg.ethereum?.L1Token || cfg.sepolia.L1Token;

const abi = [
  "function createStandardL2Token(address _l1Token, string _name, string _symbol) returns (address)",
  "event StandardL2TokenCreated(address indexed _l1Token, address indexed _l2Token)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const factory = new ethers.Contract(FACTORY, abi, wallet);
  const name = process.env.L2_TOKEN_NAME || "YourToken on Base";
  const symbol = process.env.L2_TOKEN_SYMBOL || "YTB";
  const tx = await factory.createStandardL2Token(L1_TOKEN, name, symbol);
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

main().catch(console.error);
