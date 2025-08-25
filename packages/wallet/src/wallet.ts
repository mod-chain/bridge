import minimist from "minimist";
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
  console.log(account);
}

async function cmdFaucet(address?: string) {
  const addr = address || process.env.CDP_WALLET_ADDRESS;
  if (!addr) throw new Error("CDP_WALLET_ADDRESS not set; pass --address <0x...> or set env var");
  const account = await cdp.evm.getAccount({ address: addr as `0x${string}` });
  const res = await (account as any).requestFaucet?.();
  console.log(res ?? { status: "requested" });
}

async function main() {
  const argv = minimist(process.argv.slice(2), { string: ["address"], alias: { a: "address" } });
  const [command] = argv._ as string[];
  const address = argv.address as string | undefined;

  switch (command) {
    case "create":
      await cmdCreate();
      break;
    case "get":
      await cmdGet(address);
      break;
    case "faucet":
      await cmdFaucet(address);
      break;
    default:
      console.error(
        "Usage: pnpm -C packages/wallet run <create|get|faucet> [--address 0x...]\n" +
          "Env: CDP_API_KEY_NAME, CDP_API_KEY_PRIVATE_KEY, (optional) CDP_WALLET_ADDRESS"
      );
      process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
