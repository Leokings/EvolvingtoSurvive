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

export type WalletTransactionInput = {
  from?: string;
  to?: string;
  nonce?: string | number | bigint;
  gasLimit?: string | number | bigint;
  gasPrice?: string | number | bigint;
  data?: ArrayLike<number> | string;
  value?: string | number | bigint;
  chainId?: number;
  type?: number;
};

export type WalletTransactionSender = (
  input: WalletTransactionInput,
  options?: {address?: string},
) => Promise<{hash: `0x${string}`}>;

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

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalQuantity(value: unknown): bigint | undefined {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : undefined;
  }
  if (typeof value !== "string" || !/^(?:0x[0-9a-f]+|[0-9]+)$/i.test(value)) {
    return undefined;
  }
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

function optionalTransactionType(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;
  try {
    return Number(BigInt(value));
  } catch {
    return undefined;
  }
}

/**
 * GenLayer prepares the intelligent-contract calldata, while Privy's native
 * transaction path owns the wallet prompt and broadcast. This is especially
 * important for portrait verification, whose image bundle is much larger than
 * an ordinary game action.
 */
export function routeWalletTransactionsThroughPrivy(
  provider: EIP1193Provider,
  walletAddress: string,
  sendTransaction?: WalletTransactionSender,
): EIP1193Provider {
  if (!sendTransaction) return provider;
  return {
    request: async (request) => {
      if (request.method !== "eth_sendTransaction") {
        return provider.request(request as never);
      }
      const params = (request as {params?: readonly unknown[]}).params;
      const raw = params?.[0];
      if (!raw || typeof raw !== "object") {
        throw new Error("Wallet transaction payload is missing.");
      }
      const transaction = raw as Record<string, unknown>;
      const {hash} = await sendTransaction({
        from: optionalString(transaction.from),
        to: optionalString(transaction.to),
        nonce: optionalQuantity(transaction.nonce),
        gasLimit: optionalQuantity(transaction.gas ?? transaction.gasLimit),
        gasPrice: optionalQuantity(transaction.gasPrice),
        data: optionalString(transaction.data),
        value: optionalQuantity(transaction.value),
        chainId: STUDIONET_CHAIN_ID,
        type: optionalTransactionType(transaction.type),
      }, {address: walletAddress});
      return hash;
    },
  } as EIP1193Provider;
}

/**
 * Small GenLayer actions are best submitted through the connected wallet's
 * EIP-1193 provider. It preserves the exact JSON-RPC payload and avoids adding
 * a second relay timeout between the wallet approval and Studionet. Portrait
 * verification is the exception: its image calldata is large enough that the
 * Privy native transaction route is more reliable for embedded wallets.
 */
export function providerForGenLayerAction(
  provider: EIP1193Provider,
  walletAddress: string,
  functionName: string,
  sendTransaction?: WalletTransactionSender,
): EIP1193Provider {
  return functionName === "verify_portrait"
    ? routeWalletTransactionsThroughPrivy(provider, walletAddress, sendTransaction)
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
