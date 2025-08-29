import { createPublicClient, http, formatEther } from "viem";
import { mainnet, sepolia } from "viem/chains";

type EthNetworks = "ethereum" | "ethereum-sepolia";

function getClient(network: EthNetworks) {
  if (network === "ethereum") {
    const url = process.env.ETHEREUM_RPC_URL || process.env.ETHEREUM_RPC;
    return createPublicClient({ chain: mainnet, transport: http(url) });
  }
  const url = process.env.ETHEREUM_SEPOLIA_RPC_URL || process.env.ETHEREUM_SEPOLIA_RPC;
  return createPublicClient({ chain: sepolia, transport: http(url) });
}

export async function getNativeBalance(address: `0x${string}`, network: EthNetworks) {
  const client = getClient(network);
  const wei = await client.getBalance({ address });
  return formatEther(wei); // string in ETH
}
