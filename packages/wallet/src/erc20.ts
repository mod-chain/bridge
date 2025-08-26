import { Address, createPublicClient, formatUnits, getContract, http } from "viem";
import { mainnet, sepolia } from "viem/chains";

export type EthNetworks = "ethereum" | "ethereum-sepolia";

const erc20Abi = [
  { "type": "function", "name": "balanceOf", "stateMutability": "view", "inputs": [{ "name": "owner", "type": "address" }], "outputs": [{ "name": "", "type": "uint256" }] },
  { "type": "function", "name": "decimals", "stateMutability": "view", "inputs": [], "outputs": [{ "name": "", "type": "uint8" }] },
  { "type": "function", "name": "symbol", "stateMutability": "view", "inputs": [], "outputs": [{ "name": "", "type": "string" }] },
] as const;

function clientFor(network: EthNetworks) {
  if (network === "ethereum") {
    const url = process.env.ETHEREUM_RPC_URL;
    return createPublicClient({ chain: mainnet, transport: http(url) });
  }
  const url = process.env.ETHEREUM_SEPOLIA_RPC_URL;
  return createPublicClient({ chain: sepolia, transport: http(url) });
}

export async function getErc20Balance(
  token: Address,
  wallet: Address,
  network: EthNetworks,
): Promise<{ raw: bigint; formatted: string; decimals: number; symbol: string }> {
  const client = clientFor(network);
  const contract = getContract({ address: token, abi: erc20Abi, client });
  const [raw, decimals, symbol] = await Promise.all([
    contract.read.balanceOf([wallet]),
    contract.read.decimals(),
    contract.read.symbol(),
  ]);
  const formatted = formatUnits(raw, decimals);
  return { raw, formatted, decimals, symbol };
}
