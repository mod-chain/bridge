import { CdpClient } from "@coinbase/cdp-sdk";
import * as dotenv from "dotenv";
import path from "path";

// Ensure we load the monorepo root .env when invoked from this package
dotenv.config({ path: path.resolve(__dirname, "../../..", ".env") });

const cdp = new CdpClient();

async function cmdCreate() {
  const account = await cdp.evm.createAccount();
  console.log(account);
}

async function cmdGet(address?: string) {
  const addr = address || process.env.CDP_WALLET_ADDRESS;
  if (!addr) throw new Error("CDP_WALLET_ADDRESS not set; pass --address <0x...> or set env var");
  const account = await cdp.evm.getAccount({ address: addr as `0x${string}` });
  const accountMessage = `Collected account: ${account.address}`;
  console.log(accountMessage);
  return account;
}

type FaucetNetwork = "base-sepolia" | "ethereum-sepolia";
type FaucetToken = "eth" | "usdc" | "eurc" | "cbbtc";

async function cmdFaucet(address?: string, network?: FaucetNetwork, token?: FaucetToken) {
  const addr = address || process.env.CDP_WALLET_ADDRESS;
  if (!addr) throw new Error("CDP_WALLET_ADDRESS not set; pass --address <0x...> or set env var");

  const resolvedNetwork = (network || (process.env.CDP_FAUCET_NETWORK as FaucetNetwork) || "base-sepolia") as FaucetNetwork;
  const resolvedToken = (token || (process.env.CDP_FAUCET_TOKEN as FaucetToken) || "eth") as FaucetToken;

  const account = await cdp.evm.getAccount({ address: addr as `0x${string}` });
  const res = await (account as any).requestFaucet?.({ network: resolvedNetwork, token: resolvedToken });
  console.log(res ?? { status: "requested", network: resolvedNetwork, token: resolvedToken });
}

export { cmdGet, cmdFaucet, cmdCreate, FaucetNetwork, FaucetToken, cdp };
