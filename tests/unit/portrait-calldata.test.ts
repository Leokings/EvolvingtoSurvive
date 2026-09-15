import {afterEach, describe, expect, it, vi} from "vitest";
import {abi, createClient} from "genlayer-js";
import {studionet} from "genlayer-js/chains";
import {decodeFunctionData, type EIP1193Provider} from "viem";

const CONTRACT = "0x579B79Ba871FA7a99E747026C5030D6d462C5118" as const;
const PLAYER = "0x1111111111111111111111111111111111111111" as const;
const TX_HASH = `0x${"ab".repeat(32)}` as const;
const ADD_TRANSACTION_ABI = [{
  type: "function",
  name: "addTransaction",
  stateMutability: "nonpayable",
  inputs: [
    {name: "_sender", type: "address"},
    {name: "_recipient", type: "address"},
    {name: "_numOfInitialValidators", type: "uint256"},
    {name: "_maxRotations", type: "uint256"},
    {name: "_txData", type: "bytes"},
  ],
  outputs: [],
}] as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("verify_portrait calldata", () => {
  it("reaches the wallet byte-for-byte with lossless large RPC quantities", async () => {
    const candidate = Uint8Array.from({length: 65_536}, (_, index) => index % 256);
    const ancestorA = new Uint8Array([0, 1, 127, 128, 254, 255]);
    const ancestorB = new Uint8Array([255, 128, 64, 0]);
    const portraitArgs = [
      "planet-9007199254740993123456789",
      "species-9007199254740993123456789",
      "node-9007199254740993123456789",
      "https://portraits.example/api/portraits/exact-candidate",
      `sha256:${"cd".repeat(32)}`,
      candidate,
      ancestorA,
      ancestorB,
    ];
    const rpcResults: Record<string, string> = {
      eth_getTransactionCount: "0x20000000000001",
      eth_estimateGas: "0x20000000000002",
      eth_gasPrice: "0x20000000000003",
    };
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const rpc = JSON.parse(String(init?.body)) as {id: number; method: string};
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: rpc.id,
        result: rpcResults[rpc.method] ?? "0x0",
      }), {status: 200, headers: {"content-type": "application/json"}});
    });

    let walletRequest: {method: string; params?: readonly unknown[]} | null = null;
    const provider = {
      request: vi.fn(async (request: {method: string; params?: readonly unknown[]}) => {
        if (request.method === "eth_chainId") return "0xf22f";
        if (request.method === "eth_sendTransaction") {
          walletRequest = request;
          return TX_HASH;
        }
        throw new Error(`Unexpected wallet method: ${request.method}`);
      }),
    } as unknown as EIP1193Provider;
    const client = createClient({chain: studionet, account: PLAYER, provider});

    await expect(client.writeContract({
      address: CONTRACT,
      functionName: "verify_portrait",
      args: portraitArgs,
      value: 0n,
    })).resolves.toBe(TX_HASH);

    expect(walletRequest).not.toBeNull();
    expect(() => JSON.stringify(walletRequest)).not.toThrow();
    const transaction = walletRequest!.params?.[0] as Record<string, string>;
    expect(transaction.nonce).toBe("0x20000000000001");
    expect(transaction.gas).toBe("0x20000000000002");
    expect(transaction.gasPrice).toBe("0x20000000000003");
    expect(transaction.value).toBe("0x0");

    const decoded = decodeFunctionData({
      abi: ADD_TRANSACTION_ABI,
      data: transaction.data as `0x${string}`,
    });
    const expectedApplicationData = abi.transactions.serialize([
      abi.calldata.encode(
        abi.calldata.makeCalldataObject("verify_portrait", portraitArgs, undefined),
      ),
      false,
    ]);
    expect(decoded.functionName).toBe("addTransaction");
    expect(decoded.args[4]).toBe(expectedApplicationData);
  });
});
