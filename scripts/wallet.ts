import { CdpClient } from "@coinbase/cdp-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const cdp = new CdpClient();

async function createWallet() {
    // Initialize the CDP client, which automatically loads
    // the API Key and Wallet Secret from the environment
    // variables.
    if (!process.env.CDP_WALLET_ADDRESS) {
        
        const account = await cdp.evm.createAccount();
        console.log(account);
    }
}

// createWallet();

async function getWallet() {
    if (!process.env.CDP_WALLET_ADDRESS) {
        throw new Error("CDP_WALLET_ADDRESS not set");
    }
    const account = await cdp.evm.getAccount({ address: process.env.CDP_WALLET_ADDRESS as `0x${string}` });
    console.log(account);
}

getWallet();
