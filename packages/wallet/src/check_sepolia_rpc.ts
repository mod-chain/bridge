import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const client = createPublicClient({
  chain: base,
  transport: http("https://base-mainnet.g.alchemy.com/v2/aquFnGQ0FnqKHHgmFcYMC"),
});

async function main() { 
  const block = await client.getBlock({
    blockNumber: 123456n,
  });

  console.log(block);
}

main();