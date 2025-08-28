import { FaucetNetwork } from "../wallet";
import { baseSepolia, sepolia, base, mainnet } from "viem/chains";

function getChain(network: FaucetNetwork | "ethereum" | "base" | "ethereum-sepolia" | "base-sepolia") {
    switch (network) {
        case "base-sepolia":
            return baseSepolia;
        case "ethereum-sepolia":
            return sepolia;
        case "base":
            return base;
        case "ethereum":
            return mainnet;
    }
}

export { getChain };
