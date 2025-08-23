import { ethers } from "ethers";
import fs from "fs";

// Load config and env
const cfg = JSON.parse(fs.readFileSync("../../ops/addresses.json", "utf8"));

const providers: Record<string, ethers.JsonRpcProvider | null> = {
  ethereum: process.env.ETHEREUM_RPC ? new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC) : null,
  sepolia: process.env.ETHEREUM_SEPOLIA_RPC ? new ethers.JsonRpcProvider(process.env.ETHEREUM_SEPOLIA_RPC) : null,
  base: process.env.BASE_RPC ? new ethers.JsonRpcProvider(process.env.BASE_RPC) : null,
  base_sepolia: process.env.BASE_SEPOLIA_RPC ? new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC) : null,
};

const ADDRESS_FIELDS: Record<string, string[]> = {
  ethereum: ["L1StandardBridge", "L1CrossDomainMessenger", "OptimismMintableERC20Factory", "L1Token"],
  sepolia: ["L1StandardBridge", "L1CrossDomainMessenger", "OptimismMintableERC20Factory", "L1Token"],
  base: ["L2StandardBridge", "L2CrossDomainMessenger", "OptimismMintableERC20Factory", "L2Token"],
  base_sepolia: ["L2StandardBridge", "L2CrossDomainMessenger", "OptimismMintableERC20Factory", "L2Token"],
};

function isPlaceholder(addr: string): boolean {
  return addr.startsWith("0xTO_BE") || addr.startsWith("0xYOUR");
}

async function verify() {
  let failed = 0;
  for (const net of Object.keys(ADDRESS_FIELDS)) {
    const p = providers[net];
    if (!p) {
      console.warn(`[skip] ${net}: no RPC configured`);
      continue;
    }
    const fields = ADDRESS_FIELDS[net];
    for (const f of fields) {
      const addr = cfg[net]?.[f];
      if (!addr) {
        console.warn(`[warn] ${net}.${f}: missing`);
        failed++;
        continue;
      }
      if (isPlaceholder(addr)) {
        console.warn(`[warn] ${net}.${f}: placeholder ${addr}`);
        failed++;
        continue;
      }
      try {
        const code = await p.getCode(addr);
        const ok = code && code !== "0x";
        console.log(`${ok ? "OK  " : "FAIL"} ${net}.${f} ${addr}`);
        if (!ok) failed++;
      } catch (e) {
        console.error(`ERR  ${net}.${f} ${addr}:`, (e as Error).message);
        failed++;
      }
    }
  }
  if (failed > 0) {
    console.error(`\nVerification completed with ${failed} issue(s).`);
    process.exit(1);
  } else {
    console.log("\nAll addresses look good.");
  }
}

verify().catch((e) => {
  console.error(e);
  process.exit(1);
});
