import {createClient} from "genlayer-js";
import {studionet} from "genlayer-js/chains";
import {
  CalldataAddress,
  TransactionHashVariant,
  TransactionStatus,
  type CalldataEncodable,
  type Hash,
} from "genlayer-js/types";
import {hexToBytes} from "viem";

import studionetDeployment from "../deployments/studionet.json";
import type {ActionPayload} from "./commit-reveal";
import {
  parseLobby,
  parsePlanet,
  parseProfile,
  type CreatePlanetInput,
  type JoinPlanetInput,
  type LobbyPlanet,
  type PlanetState,
  type PlayerProfile,
} from "./game-model";
import {receiptExecution} from "./transaction-reconciliation";
import {
  getStudionetProvider,
  providerForGenLayerAction,
  type ConnectedWallet,
} from "./wallet-network";

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const configuredAddress =
  import.meta.env.VITE_GENLAYER_CONTRACT_ADDRESS?.trim()
  || studionetDeployment.contractAddress;

if (!ADDRESS_PATTERN.test(configuredAddress)) {
  throw new Error("VITE_GENLAYER_CONTRACT_ADDRESS is not a valid address");
}

export const CONTRACT_ADDRESS = configuredAddress as `0x${string}`;
export const HAS_CONTRACT_DEPLOYMENT = studionetDeployment.contractVersion === 2;

export type EvolutionAdapter = {
  getPlanet: () => Promise<PlanetState | null>;
  getLobby: () => Promise<LobbyPlanet[]>;
  getProfile: () => Promise<PlayerProfile>;
  createPlanet: (input: CreatePlanetInput) => Promise<PlanetState>;
  joinPlanet: (planetId: string, input: JoinPlanetInput) => Promise<PlanetState>;
  startPlanet: (planetId: string) => Promise<PlanetState>;
  cancelPlanet: (planetId: string) => Promise<PlanetState>;
  commitAction: (
    planetId: string,
    commitment: string,
    cost: number,
  ) => Promise<PlanetState>;
  lockActions: (planetId: string) => Promise<PlanetState>;
  revealAction: (payload: ActionPayload) => Promise<PlanetState>;
  advancePhase: (planetId: string) => Promise<PlanetState>;
  concedeSpecies: (planetId: string, speciesId: string) => Promise<PlanetState>;
  verifyPortrait: (
    planetId: string,
    speciesId: string,
    nodeId: string,
    imageUrl: string,
    imageSha256: string,
    candidate: Uint8Array,
    ancestorA: Uint8Array,
    ancestorB: Uint8Array,
  ) => Promise<PlanetState>;
};

export class SubmittedTransactionError extends Error {
  readonly hash: Hash;

  constructor(hash: Hash, cause: unknown) {
    super(`Transaction ${hash} is still finalizing. Refresh in a moment.`, {cause});
    this.name = "SubmittedTransactionError";
    this.hash = hash;
  }
}

export class ContractExecutionError extends Error {
  constructor(detail?: string) {
    super(detail
      ? `Contract execution failed. ${detail}`
      : "Contract execution failed.");
    this.name = "ContractExecutionError";
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

function requireDeployment(): `0x${string}` {
  if (!HAS_CONTRACT_DEPLOYMENT) {
    throw new Error("EvolvingtoSurvive v2 has not been deployed to Studionet yet.");
  }
  return CONTRACT_ADDRESS;
}

export function calldataAddress(address: string): CalldataAddress {
  if (!ADDRESS_PATTERN.test(address)) {
    throw new Error("Wallet address is not a valid EVM address.");
  }
  return new CalldataAddress(hexToBytes(address as `0x${string}`));
}

function changed(previous: PlanetState | null, next: PlanetState | null): boolean {
  if (!next) return false;
  if (!previous) return true;
  return next.planetId !== previous.planetId || next.revision !== previous.revision;
}

export function createEvolutionAdapter(
  wallet: ConnectedWallet,
  onSubmitted?: (hash: Hash, action: string) => void,
): EvolutionAdapter {
  let lastPlanet: PlanetState | null = null;

  async function readOnce(functionName: string, args: CalldataEncodable[] = []) {
    const client = createClient({chain: studionet});
    return client.readContract({
      address: requireDeployment(),
      functionName,
      args,
      transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
    });
  }

  async function read(functionName: string, args: CalldataEncodable[] = []) {
    let lastCause: unknown;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await readOnce(functionName, args);
      } catch (cause) {
        lastCause = cause;
        if (attempt < 3) await wait(750 * (attempt + 1));
      }
    }
    throw lastCause;
  }

  async function readPlanetOnce(): Promise<PlanetState | null> {
    return parsePlanet(
      await readOnce("get_player_planet", [calldataAddress(wallet.address)]),
      wallet.address,
    );
  }

  async function getPlanet(): Promise<PlanetState | null> {
    lastPlanet = parsePlanet(
      await read("get_player_planet", [calldataAddress(wallet.address)]),
      wallet.address,
    );
    return lastPlanet;
  }

  async function reconcile(
    client: ReturnType<typeof createClient>,
    hash: Hash,
    previous: PlanetState | null,
  ): Promise<PlanetState> {
    let lastCause: unknown;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        const receipt = await client.waitForTransactionReceipt({
          hash,
          status: TransactionStatus.FINALIZED,
          interval: 0,
          retries: 0,
        });
        const execution = receiptExecution(receipt);
        if (execution.outcome === "failure") {
          throw new ContractExecutionError(execution.detail);
        }
      } catch (cause) {
        lastCause = cause;
        if (cause instanceof ContractExecutionError) throw cause;
      }
      try {
        const next = await readPlanetOnce();
        if (next && changed(previous, next)) {
          lastPlanet = next;
          return next;
        }
      } catch (cause) {
        lastCause = cause;
      }
      await wait(4_000);
    }
    throw new SubmittedTransactionError(hash, lastCause);
  }

  async function write(
    functionName: string,
    args: CalldataEncodable[] = [],
  ): Promise<PlanetState> {
    const previous = lastPlanet;
    const baseProvider = await getStudionetProvider(wallet);
    const provider = providerForGenLayerAction(
      baseProvider,
      functionName,
    );
    const client = createClient({
      chain: studionet,
      account: wallet.address as `0x${string}`,
      provider,
    });
    const hash = await client.writeContract({
      address: requireDeployment(),
      functionName,
      args,
      value: 0n,
    });
    onSubmitted?.(hash, functionName);
    return reconcile(client, hash, previous);
  }

  return {
    getPlanet,
    async getLobby() {
      return parseLobby(await read("get_lobby", [calldataAddress(wallet.address)]));
    },
    async getProfile() {
      return parseProfile(await read("get_profile", [calldataAddress(wallet.address)]));
    },
    createPlanet(input) {
      return write("create_planet", [
        input.planetName,
        input.biome,
        input.maxPlayers,
        input.eraLimit,
        input.phaseWindowSeconds,
        input.speciesName,
        input.bodyPlan,
        input.founderDescription,
      ]);
    },
    joinPlanet(planetId, input) {
      return write("join_planet", [
        planetId,
        input.speciesName,
        input.bodyPlan,
        input.founderDescription,
      ]);
    },
    startPlanet: (planetId) => write("start_planet", [planetId]),
    cancelPlanet: (planetId) => write("cancel_planet", [planetId]),
    commitAction: (planetId, commitment, cost) =>
      write("commit_action", [planetId, commitment, cost]),
    lockActions: (planetId) => write("lock_actions", [planetId]),
    revealAction: (payload) => write("reveal_action", [
      payload.planet_id,
      payload.slot,
      payload.kind,
      payload.species_id,
      payload.secondary_species_id,
      payload.first_gene,
      payload.second_gene,
      payload.proposal,
      payload.child_name,
      payload.salt,
    ]),
    advancePhase: (planetId) => write("advance_phase", [planetId]),
    concedeSpecies: (planetId, speciesId) =>
      write("concede_species", [planetId, speciesId]),
    verifyPortrait: (
      planetId,
      speciesId,
      nodeId,
      imageUrl,
      imageSha256,
      candidate,
      ancestorA,
      ancestorB,
    ) => write("verify_portrait", [
      planetId,
      speciesId,
      nodeId,
      imageUrl,
      imageSha256,
      candidate,
      ancestorA,
      ancestorB,
    ]),
  };
}
