import {describe, expect, it, vi} from "vitest";
import type {EIP1193Provider} from "viem";

import {
  providerForGenLayerAction,
  routeWalletTransactionsThroughPrivy,
} from "../../src/wallet-network";

describe("Privy wallet transaction routing", () => {
  it("routes GenLayer's prepared transaction through Privy's supported sender", async () => {
    const baseRequest = vi.fn();
    const sendTransaction = vi.fn().mockResolvedValue({hash: `0x${"ab".repeat(32)}`});
    const provider = routeWalletTransactionsThroughPrivy(
      {request: baseRequest} as unknown as EIP1193Provider,
      "0x1111111111111111111111111111111111111111",
      sendTransaction,
    );

    const hash = await provider.request({
      method: "eth_sendTransaction",
      params: [{
        from: "0x1111111111111111111111111111111111111111",
        to: "0x2222222222222222222222222222222222222222",
        data: "0x1234",
        value: "0x0",
        gas: "0x7a120",
        gasPrice: "0x1",
        nonce: "0x18",
        type: "0x0",
      }],
    } as never);

    expect(hash).toBe(`0x${"ab".repeat(32)}`);
    expect(baseRequest).not.toHaveBeenCalled();
    expect(sendTransaction).toHaveBeenCalledWith(expect.objectContaining({
      data: "0x1234",
      nonce: 24n,
      gasLimit: 500_000n,
      gasPrice: 1n,
      value: 0n,
      chainId: 61_999,
      type: 0,
    }), {address: "0x1111111111111111111111111111111111111111"});
  });

  it("does not let Privy encode zero-value hex quantities as UTF-8 text", async () => {
    const sendTransaction = vi.fn().mockResolvedValue({hash: `0x${"cd".repeat(32)}`});
    const provider = routeWalletTransactionsThroughPrivy(
      {request: vi.fn()} as unknown as EIP1193Provider,
      "0x1111111111111111111111111111111111111111",
      sendTransaction,
    );

    await provider.request({
      method: "eth_sendTransaction",
      params: [{
        to: "0x2222222222222222222222222222222222222222",
        data: "0x1234",
        value: "0x0",
      }],
    } as never);

    expect(sendTransaction.mock.calls[0]?.[0]?.value).toBe(0n);
    expect(sendTransaction.mock.calls[0]?.[0]?.value).not.toBe("0x0");
  });

  it("leaves non-signing provider calls on the connected wallet", async () => {
    const baseRequest = vi.fn().mockResolvedValue("0xf22f");
    const provider = routeWalletTransactionsThroughPrivy(
      {request: baseRequest} as unknown as EIP1193Provider,
      "0x1111111111111111111111111111111111111111",
      vi.fn(),
    );

    await expect(provider.request({method: "eth_chainId"})).resolves.toBe("0xf22f");
    expect(baseRequest).toHaveBeenCalledOnce();
  });

  it("uses the connected provider directly for small game actions", () => {
    const baseProvider = {request: vi.fn()} as unknown as EIP1193Provider;
    const provider = providerForGenLayerAction(
      baseProvider,
      "0x1111111111111111111111111111111111111111",
      "concede_species",
      vi.fn(),
    );

    expect(provider).toBe(baseProvider);
  });

  it("reserves Privy's native transaction route for large portrait calldata", () => {
    const baseProvider = {request: vi.fn()} as unknown as EIP1193Provider;
    const provider = providerForGenLayerAction(
      baseProvider,
      "0x1111111111111111111111111111111111111111",
      "verify_portrait",
      vi.fn(),
    );

    expect(provider).not.toBe(baseProvider);
  });
});
