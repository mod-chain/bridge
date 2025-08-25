import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import minimist from "minimist";
import { CrossChainMessenger, MessageStatus } from "@eth-optimism/sdk";

const ROOT = path.resolve(__dirname, "../../..");
const ADDR_PATH = path.join(ROOT, "ops/addresses.json");
const ART_WITHDRAW_DIR = path.join(ROOT, "artifacts/withdraw");
const ART_FINALIZE_DIR = path.join(ROOT, "artifacts/finalize");

const l2BridgeAbi = [
  "function withdraw(address _l2Token, uint256 _amount, uint32 _l1Gas, bytes _data) payable",
  "function withdrawTo(address _l2Token, address _to, uint256 _amount, uint32 _l1Gas, bytes _data) payable",
];
const optimismMintableAbi = [
  "function remoteToken() view returns (address)",
  "function decimals() view returns (uint8)",
];
const erc20Abi = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
];

function loadConfig() {
  const raw = fs.readFileSync(ADDR_PATH, "utf8");
  return JSON.parse(raw);
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function nowIso(): string {
  return new Date().toISOString();
}

async function main() {
  const argv = minimist(process.argv.slice(2), {
    string: [
      "network",
      "l2-rpc",
      "l1-rpc",
      "pk",
      "l2-token",
      "l1-token",
      "amount",
      "recipient",
      "data",
      "mode",
      "poll-interval",
      "timeout",
    ],
    default: {
      mode: "initiate-only",
      "poll-interval": "30",
      timeout: "0",
      "l1-gas": "200000",
      data: "0x",
    },
  });

  const network = (argv.network || "sepolia").toLowerCase();
  if (!["mainnet", "sepolia"].includes(network)) {
    throw new Error("--network must be mainnet or sepolia");
  }

  const cfg = loadConfig();
  const l1Key = network === "mainnet" ? "ethereum" : "sepolia";
  const l2Key = network === "mainnet" ? "base" : "base_sepolia";

  const l2Rpc =
    argv["l2-rpc"] || (network === "mainnet" ? process.env.BASE_RPC : process.env.BASE_SEPOLIA_RPC);
  const l1Rpc =
    argv["l1-rpc"] ||
    (network === "mainnet" ? process.env.ETHEREUM_RPC : process.env.ETHEREUM_SEPOLIA_RPC);
  const pk = argv.pk || process.env.ETH_PRIVATE_KEY || process.env.DEPLOYER_PK;

  if (!l1Rpc || !l2Rpc) throw new Error("Missing RPCs. Use --l1-rpc/--l2-rpc or set env vars.");
  if (!pk) throw new Error("--pk or ETH_PRIVATE_KEY required");

  const l2BridgeAddr = cfg[l2Key]?.L2StandardBridge;
  const defaultL2Token = cfg[l2Key]?.L2Token;
  const defaultL1Token = cfg[l1Key]?.L1Token;
  const l2TokenAddr = (argv["l2-token"] || defaultL2Token || "").toString();
  const l1TokenAddr = (argv["l1-token"] || defaultL1Token || "").toString();

  if (!l2BridgeAddr || !l2TokenAddr || !l1TokenAddr)
    throw new Error("Missing L2 bridge or token addresses in ops/addresses.json");
  if (l1TokenAddr.startsWith("0xYOUR") || l2TokenAddr.startsWith("0xTO_BE"))
    throw new Error("Fill L1Token/L2Token in ops/addresses.json");

  const l2TxHash = argv["l2-tx"] as string | undefined;
  const amount = l2TxHash ? 0n : BigInt(argv.amount || "0");
  if (!l2TxHash && amount <= 0n) throw new Error("--amount must be > 0 (wei)");
  if ((argv.mode as string) === "finalize-only" && !l2TxHash) {
    throw new Error("--mode finalize-only requires --l2-tx <hash>");
  }
  const l1Gas = Number(argv["l1-gas"] || 200000);
  const data = argv.data || "0x";
  const mode = argv.mode as string;
  const pollIntervalSec = Number(argv["poll-interval"] || 30);
  const timeoutSec = Number(argv.timeout || 0);

  const l2Provider = new ethers.JsonRpcProvider(l2Rpc);
  const l1Provider = new ethers.JsonRpcProvider(l1Rpc);
  const l2Wallet = new ethers.Wallet(pk, l2Provider);
  const l1Wallet = new ethers.Wallet(pk, l1Provider);

  const [l1Net, l2Net] = await Promise.all([l1Provider.getNetwork(), l2Provider.getNetwork()]);
  console.log(`L1 chainId=${l1Net.chainId} RPC=${l1Rpc}`);
  console.log(`L2 chainId=${l2Net.chainId} RPC=${l2Rpc}`);

  // Validate canonical pairing via remoteToken()
  const l2Token = new ethers.Contract(l2TokenAddr, optimismMintableAbi, l2Wallet);
  const remote = await l2Token.remoteToken();
  if (remote.toLowerCase() !== l1TokenAddr.toLowerCase()) {
    throw new Error(`Non-canonical pairing: L2.remoteToken=${remote} != L1Token=${l1TokenAddr}`);
  }

  // If no L2 tx is provided (and not finalize-only), initiate a new withdrawal
  let receipt: any;
  const initiated = !l2TxHash && (argv.mode as string) !== "finalize-only";
  if (initiated) {
    const bridge = new ethers.Contract(l2BridgeAddr, l2BridgeAbi, l2Wallet);
    const to = (argv.recipient as string) || l1Wallet.address;
    const tx =
      to.toLowerCase() !== l1Wallet.address.toLowerCase()
        ? await bridge.withdrawTo(l2TokenAddr, to, amount, l1Gas, data)
        : await bridge.withdraw(l2TokenAddr, amount, l1Gas, data);
    console.log(`Initiated withdraw on L2: ${tx.hash}`);
    receipt = await tx.wait();
  } else {
    console.log(`Using existing L2 withdrawal tx: ${l2TxHash}`);
    receipt = await l2Provider.getTransactionReceipt(l2TxHash as string);
    if (!receipt) throw new Error("L2 tx not found, or not yet mined");
  }

  // Parse WithdrawalInitiated event
  const topic0 = ethers.id("WithdrawalInitiated(address,address,address,address,uint256,bytes)");
  const log = receipt.logs.find(
    (l: any) =>
      l.address.toLowerCase() === l2BridgeAddr.toLowerCase() && l.topics && l.topics[0] === topic0
  );
  if (!log) throw new Error("WithdrawalInitiated event not found in receipt");

  const iface = new ethers.Interface([
    "event WithdrawalInitiated(address indexed l1Token,address indexed l2Token,address indexed from,address to,uint256 amount,bytes data)",
  ]);
  const parsed = iface.parseLog({ topics: log.topics, data: log.data });
  const toAddr = (parsed?.args?.to as string) || (argv.recipient as string) || l1Wallet.address;

  if (initiated) {
    ensureDir(ART_WITHDRAW_DIR);
    const art = {
      network: l2Key,
      l2_tx_hash: receipt.hash,
      l2_block_number: receipt.blockNumber,
      log_index: (log as any).index ?? (log as any).logIndex ?? 0,
      l2_token: l2TokenAddr,
      l1_token: l1TokenAddr,
      from: parsed?.args?.from as string,
      to: toAddr,
      amount: amount.toString(),
      data,
      l1_gas: l1Gas,
    } as const;
    const artPath = path.join(ART_WITHDRAW_DIR, `${receipt.hash}.json`);
    fs.writeFileSync(artPath, JSON.stringify(art, null, 2));
    console.log(`Saved artifact: ${path.relative(ROOT, artPath)}`);
  }

  if (mode === "initiate-only") {
    return;
  }

  // Finalize path using CrossChainMessenger
  console.log("Mode is initiate-and-finalize; polling until ready...");
  // Optional contracts override if provided in ops/addresses.json
  const contractsOverride =
    cfg[l1Key]?.OptimismPortal ||
    cfg[l1Key]?.L1CrossDomainMessenger ||
    cfg[l2Key]?.L2CrossDomainMessenger
      ? {
          l1: {
            l1CrossDomainMessenger: cfg[l1Key]?.L1CrossDomainMessenger,
            portal: cfg[l1Key]?.OptimismPortal,
          },
          l2: {
            l2CrossDomainMessenger: cfg[l2Key]?.L2CrossDomainMessenger,
          },
        }
      : undefined;
  const messenger = new CrossChainMessenger({
    l1ChainId: Number(l1Net.chainId),
    l2ChainId: Number(l2Net.chainId),
    l1SignerOrProvider: l1Wallet,
    l2SignerOrProvider: l2Wallet,
    contracts: contractsOverride as any,
  } as any);

  const start = Date.now();
  let messageObj: any | undefined;
  // Fetch message object from the L2 tx
  const msgs = await messenger.getMessagesByTransaction(receipt.hash);
  if (!msgs || msgs.length === 0) {
    console.warn("SDK returned no messages for L2 tx; will attempt later during polling");
  } else {
    messageObj = msgs[0];
  }

  async function currentStatus(): Promise<MessageStatus> {
    if (messageObj) {
      return messenger.getMessageStatus(messageObj as any);
    }
    const arr = await messenger.getMessagesByTransaction(receipt.hash);
    if (arr && arr[0]) {
      messageObj = arr[0];
      return messenger.getMessageStatus(messageObj as any);
    }
    // As a last resort this will throw; better to wait until message is indexed
    return messenger.getMessageStatus(receipt.hash as any);
  }

  let last: MessageStatus | undefined;
  while (true) {
    const s = await currentStatus();
    if (s !== last) {
      console.log(`State: ${MessageStatus[s]} @ ${nowIso()}`);
      last = s;
    }
    if (s === MessageStatus.READY_TO_PROVE && messageObj) {
      console.log("Proving message...");
      await messenger.proveMessage(messageObj as any);
    }
    if (s === MessageStatus.IN_CHALLENGE_PERIOD || s === MessageStatus.READY_FOR_RELAY) {
      // keep waiting until ready for relay
    }
    if (s === MessageStatus.READY_FOR_RELAY && messageObj) {
      console.log("Finalizing on L1...");
      const l1Tx = await messenger.finalizeMessage(messageObj as any);
      const l1Rcpt = await l1Tx.wait();
      ensureDir(ART_FINALIZE_DIR);
      const finPath = path.join(ART_FINALIZE_DIR, `${receipt.hash}.json`);
      fs.writeFileSync(
        finPath,
        JSON.stringify(
          {
            l1_tx_hash: l1Tx.hash,
            finalized_at: nowIso(),
            status: "finalized",
          },
          null,
          2
        )
      );
      console.log(`Saved finalize artifact: ${path.relative(ROOT, finPath)}`);
      return;
    }
    if (timeoutSec > 0 && Date.now() - start > timeoutSec * 1000) {
      console.error("Finalize timed out; keep the withdraw artifact and retry later.");
      process.exitCode = 2;
      return;
    }
    await new Promise((r) => setTimeout(r, pollIntervalSec * 1000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
