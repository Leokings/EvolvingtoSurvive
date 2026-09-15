import type {EIP1193Provider} from "viem";

import {
  STUDIONET_CHAIN_ID,
  STUDIONET_EXPLORER_URL,
  STUDIONET_RPC_URL,
} from "./studionet";

export type WalletNetworkClient = {
  switchChain: (chainId: number) => Promise<void>;
  getEthereumProvider: () => Promise<EIP1193Provider>;
  chainId?: string;
  walletClientType?: string;
  meta?: {name?: string};
};

export type ConnectedWallet = WalletNetworkClient & {address: string};

const STUDIONET_CHAIN_ID_HEX = `0x${STUDIONET_CHAIN_ID.toString(16)}`;

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function errorCode(cause: unknown): number | undefined {
  if (!cause || typeof cause !== "object") return undefined;
  const value = cause as {code?: unknown; cause?: unknown};
  if (typeof value.code === "number") return value.code;
  return errorCode(value.cause);
}

function rejected(cause: unknown): boolean {
  return errorCode(cause) === 4001 || /user (?:rejected|denied)/i.test(message(cause));
}

function chainNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const raw = value.includes(":") ? value.slice(value.lastIndexOf(":") + 1) : value;
  try {
    const parsed = raw.startsWith("0x") ? Number(BigInt(raw)) : Number(raw);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

async function providerChainId(provider: EIP1193Provider): Promise<number> {
  const value = await provider.request({method: "eth_chainId"});
  return typeof value === "string" ? Number(BigInt(value)) : Number(value);
}

export function normalizeWalletRpcValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    if (value < 0n) {
      throw new Error("Wallet RPC quantities cannot be negative.");
    }
    return `0x${value.toString(16)}`;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeWalletRpcValue);
  }
  if (ArrayBuffer.isView(value)) {
    return Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, normalizeWalletRpcValue(nested)]),
    );
  }
  return value;
}

/**
 * GenLayer already prepares a valid EIP-1193 transaction, including its exact
 * encoded intelligent-contract calldata. Keep that normal connected-wallet
 * flow intact. The only boundary work done here is a lossless, recursive
 * conversion of any bigint a caller may have added into a JSON-RPC hex value.
 */
export function routeWalletTransactionsSafely(
  provider: EIP1193Provider,
): EIP1193Provider {
  return {
    request: async (request) => {
      if (request.method !== "eth_sendTransaction") {
        return provider.request(request as never);
      }
      const params = (request as {params?: readonly unknown[]}).params;
      if (!params?.[0] || typeof params[0] !== "object") {
        throw new Error("Wallet transaction payload is missing.");
      }
      return provider.request({
        ...request,
        params: normalizeWalletRpcValue(params),
      } as never);
    },
  } as EIP1193Provider;
}

/**
 * Small GenLayer actions are best submitted through the connected wallet's
 * EIP-1193 provider. Portrait verification adds the JSON-safe boundary guard
 * because its large calldata previously passed through a second SDK adapter
 * that introduced bigint values immediately before RPC serialization.
 */
export function providerForGenLayerAction(
  provider: EIP1193Provider,
  functionName: string,
): EIP1193Provider {
  return functionName === "verify_portrait"
    ? routeWalletTransactionsSafely(provider)
    : provider;
}

export async function getStudionetProvider(
  wallet: WalletNetworkClient,
): Promise<EIP1193Provider> {
  if (chainNumber(wallet.chainId) !== STUDIONET_CHAIN_ID) {
    try {
      await wallet.switchChain(STUDIONET_CHAIN_ID);
    } catch (switchCause) {
      if (rejected(switchCause)) {
        throw new Error("The Studionet network request was rejected.");
      }
      const fallback = await wallet.getEthereumProvider();
      try {
        await fallback.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: STUDIONET_CHAIN_ID_HEX,
            chainName: "GenLayer Studionet",
            nativeCurrency: {name: "GEN", symbol: "GEN", decimals: 18},
            rpcUrls: [STUDIONET_RPC_URL],
            blockExplorerUrls: [STUDIONET_EXPLORER_URL],
          }],
        });
        await fallback.request({
          method: "wallet_switchEthereumChain",
          params: [{chainId: STUDIONET_CHAIN_ID_HEX}],
        });
      } catch (fallbackCause) {
        throw new Error(`Could not add GenLayer Studionet: ${message(fallbackCause)}`);
      }
    }
  }

  const provider = await wallet.getEthereumProvider();
  const activeChain = await providerChainId(provider);
  if (activeChain !== STUDIONET_CHAIN_ID) {
    throw new Error(`Wallet is on chain ${activeChain}, not Studionet ${STUDIONET_CHAIN_ID}.`);
  }
  return provider;
}
