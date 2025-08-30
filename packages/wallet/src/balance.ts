import { cmdGet } from "./wallet";
import { EvmServerAccount } from "@coinbase/cdp-sdk";
import { prettyPrintBalance } from "./utils/normalize_balance";
import { getNativeBalance } from "./eth";
import { getErc20Balance, type EthNetworks } from "./erc20";

// Infer the correct network type from the SDK method signature
type NetworkInput = Parameters<EvmServerAccount["listTokenBalances"]>[0]["network"];
type TokenBalances = Awaited<ReturnType<EvmServerAccount["listTokenBalances"]>>;

type BaseNetworks = "base-sepolia" | "base";
type Networks = BaseNetworks | EthNetworks;

function prettyPrintBalances(balances: TokenBalances) {
  const prettyMessage = balances.balances
    .map((balance) => {
      const amt = BigInt(balance.amount.amount as unknown as string);
      return `${balance.token.network}\n${balance.token.symbol}: ${prettyPrintBalance(amt)}`;
    })
    .join("\n");
  console.log(prettyMessage);
}

async function getBaseBalances(account: EvmServerAccount, network: BaseNetworks) {
    const balances = await account.listTokenBalances({ network });
    prettyPrintBalances(balances);
    return balances;
}

export async function cmdBalance() {
    const account = await cmdGet();
    const networks: Networks[] = ["base-sepolia", "base", "ethereum-sepolia", "ethereum"];
    for (const network of networks) {
        console.log(network);
        if (network === "base" || network === "base-sepolia") {
            await getBaseBalances(account, network);
        } else {
            const eth = await getNativeBalance(account.address as `0x${string}`, network as EthNetworks);
            console.log(`ETH: ${eth}`);
            // Optional: fetch ERC-20s from env-delimited list
            const listEnv = network === "ethereum" ? process.env.ETHEREUM_TOKENS : process.env.ETHEREUM_SEPOLIA_TOKENS;
            if (listEnv) {
                const tokens = listEnv.split(/[\,\s]+/).filter(Boolean) as `0x${string}`[];
                for (const token of tokens) {
                    try {
                        const { formatted, symbol } = await getErc20Balance(token, account.address as `0x${string}`, network as EthNetworks);
                        console.log(`${symbol}: ${formatted}`);
                    } catch (err) {
                        console.warn(`Failed to fetch token ${token} on ${network}:`, (err as Error).message);
                    }
                }
            }
        }
    }
}
    
