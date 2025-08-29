import { formatUnits, parseUnits } from "viem";

// bigint-safe helpers using viem
function normalizeBalance(balance: bigint, decimals = 18): string {
  return formatUnits(balance, decimals);
}

function unnormalizeBalance(balance: string, decimals = 18): bigint {
  return parseUnits(balance, decimals);
}

function prettyPrintBalance(balance: bigint, decimals = 18): string {
  const s = formatUnits(balance, decimals);
  const [i, f = ""] = s.split(".");
  if (f.length === 0) return `${i}.000000`;
  const cut = f.length > 6 ? f.slice(0, 6) : f.padEnd(6, "0");
  return `${i}.${cut}`;
}

export { normalizeBalance, unnormalizeBalance, prettyPrintBalance };
