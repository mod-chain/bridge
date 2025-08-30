import minimist from "minimist";
import { parseEther } from "viem";
import { cmdGet, cmdCreate, cmdFaucet, FaucetNetwork, FaucetToken, cdp } from "./wallet";
import { cmdBalance } from "./balance";
import * as dotenv from "dotenv";
import path from "path";

// Always load monorepo root .env
dotenv.config({ path: path.resolve(__dirname, "../../..", ".env") });

function usage(exitCode = 2) {
  console.error(
    "Usage: pnpm -C packages/wallet run <create|get|balance|faucet|send|receive|check-env|help> [options]\n" +
      "\nCommands:\n" +
      "  create                      Create or fetch a wallet (uses CDP env keys)\n" +
      "  get [--address 0x...]       Show wallet/account info (defaults to CDP_WALLET_ADDRESS)\n" +
      "  balance                     Show balances across Base/Ethereum networks\n" +
      "  faucet [--address 0x...]    Request funds from faucet\n" +
      "  send --address 0x... --amount <float> --network base-sepolia|ethereum-sepolia\n" +
      "  receive (alias of send)     Same as send (from our perspective)\n" +
      "  check-env                   Validate required env vars are present\n" +
      "  help                        Show this help message\n" +
      "\nFaucet options:\n" +
      "  --network base-sepolia|ethereum-sepolia\n" +
      "  --token eth|usdc|eurc|cbbtc\n" +
      "\nSend/Receive options:\n" +
      "  --address 0x... --amount <float> --network base-sepolia|ethereum-sepolia [--token eth]\n" +
      "\nEnv:\n" +
      "  CDP_API_KEY_NAME, CDP_API_KEY_PRIVATE_KEY, (optional) CDP_WALLET_ADDRESS, CDP_FAUCET_NETWORK, CDP_FAUCET_TOKEN\n"
  );
  process.exitCode = exitCode;
}

async function cmdSend(to: `0x${string}`, amount: string, network: FaucetNetwork, token: FaucetToken = "eth") {
  const account = await cmdGet();
  if (token !== "eth") {
    throw new Error("Only native ETH transfers are supported in this CLI right now. Use token bridges or extend CLI.");
  }
  // Build a minimal EIP-1559 tx. CDP will populate nonce/gas/fees and SIGN it server-side.
  const tx = {
    to,
    value: parseEther(amount),
    // Optionals (left for CDP to fill): nonce, maxPriorityFeePerGas, maxFeePerGas, gas
  } as const;

  const { transactionHash } = await cdp.evm.sendTransaction({
    address: account.address,
    transaction: tx,
    network,
  });
  console.log({ transactionHash });
}

function boolIcon(ok: boolean) {
  return ok ? "✅" : "❌";
}

function isHexAddress(x?: string) {
  return !!x && /^0x[0-9a-fA-F]{40}$/.test(x);
}

async function cmdCheckEnv() {
  const required = {
    CDP_API_KEY_NAME: !!process.env.CDP_API_KEY_NAME,
    CDP_API_KEY_PRIVATE_KEY: !!process.env.CDP_API_KEY_PRIVATE_KEY,
  };
  const optional = {
    CDP_WALLET_ADDRESS: process.env.CDP_WALLET_ADDRESS || "",
    CDP_FAUCET_NETWORK: process.env.CDP_FAUCET_NETWORK || "",
    CDP_FAUCET_TOKEN: process.env.CDP_FAUCET_TOKEN || "",
  };

  // Print report
  console.log("Required:");
  console.log(`  ${boolIcon(required.CDP_API_KEY_NAME)} CDP_API_KEY_NAME`);
  console.log(`  ${boolIcon(required.CDP_API_KEY_PRIVATE_KEY)} CDP_API_KEY_PRIVATE_KEY`);
  console.log("Optional:");
  const addrOk = optional.CDP_WALLET_ADDRESS ? isHexAddress(optional.CDP_WALLET_ADDRESS) : true;
  console.log(`  ${boolIcon(addrOk)} CDP_WALLET_ADDRESS${optional.CDP_WALLET_ADDRESS ? `=${optional.CDP_WALLET_ADDRESS}` : " (unset)"}`);
  if (!addrOk) console.warn("  -> CDP_WALLET_ADDRESS must be a 0x-prefixed 20-byte address");
  console.log(`  ${boolIcon(true)} CDP_FAUCET_NETWORK${optional.CDP_FAUCET_NETWORK ? `=${optional.CDP_FAUCET_NETWORK}` : " (unset; defaults to base-sepolia)"}`);
  console.log(`  ${boolIcon(true)} CDP_FAUCET_TOKEN${optional.CDP_FAUCET_TOKEN ? `=${optional.CDP_FAUCET_TOKEN}` : " (unset; defaults to eth)"}`);

  const ok = required.CDP_API_KEY_NAME && required.CDP_API_KEY_PRIVATE_KEY && addrOk;
  if (!ok) {
    process.exitCode = 1;
  }
}

async function main() {
  const raw = process.argv.slice(2);
  const argv = minimist(raw, {
    string: ["address", "to", "network", "token", "amount"],
    alias: { a: "address", n: "network", t: "token" },
  });

  // Handle pnpm inserting a standalone "--" which causes minimist to stop parsing flags
  let command = (argv._[0] as string | undefined) || "";
  let address = (argv.address || argv.to) as `0x${string}` | undefined;
  let network = argv.network as FaucetNetwork | undefined;
  let token = (argv.token as FaucetToken | undefined) || (process.env.CDP_FAUCET_TOKEN as FaucetToken | undefined);
  let amount = argv.amount as string | undefined;
  const ddIndex = raw.indexOf("--");
  if (ddIndex >= 0) {
    const tail = raw.slice(ddIndex + 1);
    const tailParsed = minimist(tail, { string: ["address", "to", "network", "token", "amount"], alias: { a: "address", n: "network", t: "token" } });
    // Prefer flags from tail if provided
    address = ((tailParsed.address || tailParsed.to) as `0x${string}` | undefined) ?? address;
    network = (tailParsed.network as FaucetNetwork | undefined) ?? network;
    token = (tailParsed.token as FaucetToken | undefined) ?? token;
    amount = (tailParsed.amount as string | undefined) ?? amount;
    // If command was not set, try from head (before --)
    if (!command && argv._.length > 0) command = argv._[0] as string;
  }

  if (argv.help || command === "help" || !command) {
    usage(0);
    return;
  }

  switch (command) {
    case "create":
      await cmdCreate();
      break;
    case "get":
      await cmdGet(address);
      break;
    case "balance": {
      await cmdBalance();
      break;
    }
    case "faucet": {
      await cmdFaucet(address, network, token);
      break;
    }
    case "check-env": {
      await cmdCheckEnv();
      break;
    }
    case "send": {
      if (!address) throw new Error("--address/--to is required");
      if (!amount) throw new Error("--amount is required");
      if (!network) throw new Error("--network is required (base-sepolia|ethereum-sepolia)");
      await cmdSend(address, amount, network, (token || "eth") as FaucetToken);
      break;
    }
    case "receive": {
      // alias for send (same semantics from our perspective)
      if (!address) throw new Error("--address/--to is required");
      if (!amount) throw new Error("--amount is required");
      if (!network) throw new Error("--network is required (base-sepolia|ethereum-sepolia)");
      await cmdSend(address, amount, network, (token || "eth") as FaucetToken);
      break;
    }
    default: {
      usage(2);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
