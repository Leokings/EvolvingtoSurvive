import {describe, expect, it, vi} from "vitest";
import type {EIP1193Provider} from "viem";

import {
  normalizeWalletRpcValue,
  providerForGenLayerAction,
  routeWalletTransactionsSafely,
} from "../../src/wallet-network";

describe("wallet transaction routing", () => {
  it("forwards GenLayer's exact prepared transaction to the connected wallet", async () => {
    const expectedHash = `0x${"ab".repeat(32)}`;
    const baseRequest = vi.fn().mockResolvedValue(expectedHash);
    const provider = routeWalletTransactionsSafely(
      {request: baseRequest} as unknown as EIP1193Provider,
    );
    const transaction = {
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      data: "0x1234",
      value: "0x0",
      gas: "0x7a120",
      gasPrice: "0x1",
      nonce: "0x18",
      type: "0x0",
      chainId: "0xf22f",
    };

    const hash = await provider.request({
      method: "eth_sendTransaction",
      params: [transaction],
    } as never);

    expect(hash).toBe(expectedHash);
    expect(baseRequest).toHaveBeenCalledWith({
      method: "eth_sendTransaction",
      params: [transaction],
    });
  });

  it("normalizes nested and very large bigint values without touching calldata", async () => {
    const huge = (1n << 200n) + 123n;
    const exactCalldata = `0x${"00ff80".repeat(2_048)}`;
    const baseRequest = vi.fn().mockImplementation(async (request: unknown) => {
      expect(() => JSON.stringify(request)).not.toThrow();
      return `0x${"cd".repeat(32)}`;
    });
    const provider = routeWalletTransactionsSafely(
      {request: baseRequest} as unknown as EIP1193Provider,
    );

    await provider.request({
      method: "eth_sendTransaction",
      params: [{
        to: "0x2222222222222222222222222222222222222222",
        data: exactCalldata,
        value: 0n,
        nonce: huge,
        gas: "0x20000000000001",
        authorizationList: [{
          address: "0x3333333333333333333333333333333333333333",
          chainId: huge,
          nonce: 0n,
          r: huge,
        }],
      }],
    } as never);

    const forwarded = baseRequest.mock.calls[0]?.[0] as {
      params: Array<Record<string, unknown>>;
    };
    expect(forwarded.params[0]?.data).toBe(exactCalldata);
    expect(forwarded.params[0]?.gas).toBe("0x20000000000001");
    expect(forwarded.params[0]?.value).toBe("0x0");
    expect(forwarded.params[0]?.nonce).toBe(`0x${huge.toString(16)}`);
    expect(forwarded.params[0]?.authorizationList).toEqual([{
      address: "0x3333333333333333333333333333333333333333",
      chainId: `0x${huge.toString(16)}`,
      nonce: "0x0",
      r: `0x${huge.toString(16)}`,
    }]);
  });

  it("rejects invalid negative RPC quantities instead of rounding them", () => {
    expect(() => normalizeWalletRpcValue({nonce: -1n})).toThrow(
      "Wallet RPC quantities cannot be negative.",
    );
  });

  it("leaves non-signing provider calls on the connected wallet", async () => {
    const baseRequest = vi.fn().mockResolvedValue("0xf22f");
    const provider = routeWalletTransactionsSafely(
      {request: baseRequest} as unknown as EIP1193Provider,
    );

    await expect(provider.request({method: "eth_chainId"})).resolves.toBe("0xf22f");
    expect(baseRequest).toHaveBeenCalledOnce();
  });

  it("uses the connected provider directly for small game actions", () => {
    const baseProvider = {request: vi.fn()} as unknown as EIP1193Provider;
    const provider = providerForGenLayerAction(
      baseProvider,
      "concede_species",
    );

    expect(provider).toBe(baseProvider);
  });

  it("guards large portrait RPC calldata at the connected-provider boundary", () => {
    const baseProvider = {request: vi.fn()} as unknown as EIP1193Provider;
    const provider = providerForGenLayerAction(
      baseProvider,
      "verify_portrait",
    );

    expect(provider).not.toBe(baseProvider);
  });
});
