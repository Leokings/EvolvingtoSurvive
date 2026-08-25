export const ADAPTATION_CLASSES = [
  "resilience",
  "mobility",
  "foraging",
  "water",
  "thermal",
  "respiration",
  "awareness",
] as const;

export const ACTION_KINDS = ["adapt", "conserve", "split", "merge"] as const;

export type AdaptationClass = (typeof ADAPTATION_CLASSES)[number];
export type ActionKind = (typeof ACTION_KINDS)[number];
export type PlanetPhase = "" | "commit" | "reveal";

export type Hazard = {
  era: number;
  adaptationClass: AdaptationClass;
  threshold: number;
  name: string;
  description: string;
};

export type PortraitState = {
  status: "pending" | "accepted" | "rejected" | "not_applicable";
  attempts: number;
  reasonCode: string;
  url: string;
  sha256: string;
};

export type AncestryNode = {
  nodeId: string;
  kind: "founder" | ActionKind;
  era: number;
  name: string;
  proposal: string;
  genes: string[];
  adaptationClass: string;
  phenotypeSummary: string;
  visualTraits: string[];
  parentNodeIds: string[];
  portrait: PortraitState;
};

export type HazardOutcome = {
  hazard: string;
  checkedStat: string;
  statValue: number;
  threshold: number;
  populationBefore: number;
  populationLost: number;
  populationAfter: number;
  survived: boolean;
  legacyGained: number;
};

export type Species = {
  speciesId: string;
  owner: string;
  name: string;
  bodyPlan: string;
  founderDescription: string;
  originKind: "founder" | "split" | "merge";
  alive: boolean;
  retiredReason: string;
  population: number;
  stats: Record<AdaptationClass, number>;
  genes: string[];
  phenotype: string;
  nodes: AncestryNode[];
  currentNodeId: string;
  acceptedMutations: number;
  rejectedMutations: number;
  legacy: number;
  portraitUrl: string;
  portraitSha256: string;
  lastHazardOutcome: HazardOutcome | null;
};

export type EvolutionDecision = {
  accepted: boolean;
  reasonCode: string;
  adaptationClass: string;
  adaptationName: string;
  phenotypeSummary: string;
  visualTraits: string[];
};

export type ActionResult = {
  applied: boolean;
  reasonCode: string;
  newSpeciesId: string;
  newNodeId: string;
  drawnGenes: string[];
  statBefore: number | null;
  statGain: number;
  statAfter: number | null;
  penalizedSpeciesId?: string;
  populationLost?: number;
};

export type RoundAction = {
  owner: string;
  slot: number;
  cost: number;
  commitment: string;
  revealed: boolean;
  result: ActionResult | null;
  kind?: ActionKind;
  speciesId?: string;
  secondarySpeciesId?: string;
  firstGene?: string;
  secondGene?: string;
  proposal?: string;
  childName?: string;
  decision?: EvolutionDecision | null;
};

export type RoundPlayer = {
  locked: boolean;
  committedCost: number;
};

export type PlanetState = {
  planetId: string;
  name: string;
  creator: string;
  biome: string;
  biomeName: string;
  status: "waiting" | "active" | "complete" | "cancelled";
  players: string[];
  playerCount: number;
  maxPlayers: number;
  era: number;
  eraLimit: number;
  phase: PlanetPhase;
  phaseDeadline: number;
  phaseWindowSeconds: number;
  winner: string;
  hazard: Hazard | null;
  species: Species[];
  yourSpecies: Species[];
  roundActions: RoundAction[];
  actionHistory: RoundAction[];
  roundPlayers: Record<string, RoundPlayer>;
  yourRound: RoundPlayer | null;
  allLocked: boolean;
  allRevealed: boolean;
  isPlayer: boolean;
  maxSpeciesPerWallet: number;
  evolutionEnergyPerEra: number;
  revision: number;
  lastEvent: string;
};

export type LobbyPlanet = {
  planetId: string;
  name: string;
  creator: string;
  biome: string;
  playerCount: number;
  maxPlayers: number;
  eraLimit: number;
  phaseWindowSeconds: number;
  foundersReady: boolean;
  revision: number;
};

export type PlayerProfile = {
  player: string;
  planetsPlayed: number;
  wins: number;
  extinctions: number;
  acceptedMutations: number;
  bestLegacy: number;
};

export type CreatePlanetInput = {
  planetName: string;
  biome: string;
  maxPlayers: number;
  eraLimit: number;
  phaseWindowSeconds: number;
  speciesName: string;
  bodyPlan: string;
  founderDescription: string;
};

export type JoinPlanetInput = Pick<
  CreatePlanetInput,
  "speciesName" | "bodyPlan" | "founderDescription"
>;

export type PortraitCandidate = {
  candidateId: string;
  url: string;
  sha256: string;
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function string(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function number(value: unknown, fallback = 0): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : number(value);
}

function boolean(value: unknown): boolean {
  return value === true;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function snake(source: UnknownRecord, key: string, camelKey: string): unknown {
  return source[key] ?? source[camelKey];
}

function parsePortrait(value: unknown): PortraitState {
  const source = record(value);
  const rawStatus = string(source.status, "not_applicable");
  const status = ["pending", "accepted", "rejected", "not_applicable"].includes(rawStatus)
    ? rawStatus as PortraitState["status"]
    : "not_applicable";
  return {
    status,
    attempts: number(source.attempts),
    reasonCode: string(snake(source, "reason_code", "reasonCode")),
    url: string(source.url),
    sha256: string(source.sha256),
  };
}

function parseNode(value: unknown): AncestryNode {
  const source = record(value);
  const rawKind = string(source.kind, "founder");
  const kind = ["founder", ...ACTION_KINDS].includes(rawKind as ActionKind)
    ? rawKind as AncestryNode["kind"]
    : "founder";
  return {
    nodeId: string(snake(source, "node_id", "nodeId")),
    kind,
    era: number(source.era),
    name: string(source.name, "Unnamed adaptation"),
    proposal: string(source.proposal),
    genes: strings(source.genes),
    adaptationClass: string(snake(source, "adaptation_class", "adaptationClass")),
    phenotypeSummary: string(snake(source, "phenotype_summary", "phenotypeSummary")),
    visualTraits: strings(snake(source, "visual_traits", "visualTraits")),
    parentNodeIds: strings(snake(source, "parent_node_ids", "parentNodeIds")),
    portrait: parsePortrait(source.portrait),
  };
}

function parseStats(value: unknown): Record<AdaptationClass, number> {
  const source = record(value);
  return Object.fromEntries(
    ADAPTATION_CLASSES.map((key) => [key, number(source[key], 3)]),
  ) as Record<AdaptationClass, number>;
}

function parseHazardOutcome(value: unknown): HazardOutcome | null {
  if (!value) return null;
  const source = record(value);
  return {
    hazard: string(source.hazard),
    checkedStat: string(snake(source, "checked_stat", "checkedStat")),
    statValue: number(snake(source, "stat_value", "statValue")),
    threshold: number(source.threshold),
    populationBefore: number(snake(source, "population_before", "populationBefore")),
    populationLost: number(snake(source, "population_lost", "populationLost")),
    populationAfter: number(snake(source, "population_after", "populationAfter")),
    survived: boolean(source.survived),
    legacyGained: number(snake(source, "legacy_gained", "legacyGained")),
  };
}

export function parseSpecies(value: unknown): Species {
  const source = record(value);
  const rawOrigin = string(snake(source, "origin_kind", "originKind"), "founder");
  const originKind = ["founder", "split", "merge"].includes(rawOrigin)
    ? rawOrigin as Species["originKind"]
    : "founder";
  return {
    speciesId: string(snake(source, "species_id", "speciesId")),
    owner: string(source.owner).toLowerCase(),
    name: string(source.name, "Unknown species"),
    bodyPlan: string(snake(source, "body_plan", "bodyPlan")),
    founderDescription: string(
      snake(source, "founder_description", "founderDescription"),
      string(source.phenotype),
    ),
    originKind,
    alive: source.alive !== false,
    retiredReason: string(snake(source, "retired_reason", "retiredReason")),
    population: number(source.population),
    stats: parseStats(source.stats),
    genes: strings(source.genes),
    phenotype: string(source.phenotype),
    nodes: Array.isArray(source.nodes) ? source.nodes.map(parseNode) : [],
    currentNodeId: string(snake(source, "current_node_id", "currentNodeId")),
    acceptedMutations: number(snake(source, "accepted_mutations", "acceptedMutations")),
    rejectedMutations: number(snake(source, "rejected_mutations", "rejectedMutations")),
    legacy: number(source.legacy),
    portraitUrl: string(snake(source, "portrait_url", "portraitUrl")),
    portraitSha256: string(snake(source, "portrait_sha256", "portraitSha256")),
    lastHazardOutcome: parseHazardOutcome(
      snake(source, "last_hazard_outcome", "lastHazardOutcome"),
    ),
  };
}

function parseHazard(value: unknown): Hazard | null {
  if (!value) return null;
  const source = record(value);
  const adaptationClass = string(snake(source, "adaptation_class", "adaptationClass"));
  if (!ADAPTATION_CLASSES.includes(adaptationClass as AdaptationClass)) return null;
  return {
    era: number(source.era),
    adaptationClass: adaptationClass as AdaptationClass,
    threshold: number(source.threshold),
    name: string(source.name),
    description: string(source.description),
  };
}

function parseDecision(value: unknown): EvolutionDecision | null {
  if (!value) return null;
  const source = record(value);
  return {
    accepted: boolean(source.accepted),
    reasonCode: string(snake(source, "reason_code", "reasonCode")),
    adaptationClass: string(snake(source, "adaptation_class", "adaptationClass")),
    adaptationName: string(snake(source, "adaptation_name", "adaptationName")),
    phenotypeSummary: string(snake(source, "phenotype_summary", "phenotypeSummary")),
    visualTraits: strings(snake(source, "visual_traits", "visualTraits")),
  };
}

function parseActionResult(value: unknown): ActionResult | null {
  if (!value) return null;
  const source = record(value);
  return {
    applied: boolean(source.applied),
    reasonCode: string(snake(source, "reason_code", "reasonCode")),
    newSpeciesId: string(snake(source, "new_species_id", "newSpeciesId")),
    newNodeId: string(snake(source, "new_node_id", "newNodeId")),
    drawnGenes: strings(snake(source, "drawn_genes", "drawnGenes")),
    statBefore: nullableNumber(snake(source, "stat_before", "statBefore")),
    statGain: number(snake(source, "stat_gain", "statGain")),
    statAfter: nullableNumber(snake(source, "stat_after", "statAfter")),
    penalizedSpeciesId: string(
      snake(source, "penalized_species_id", "penalizedSpeciesId"),
    ) || undefined,
    populationLost: source.population_lost === undefined && source.populationLost === undefined
      ? undefined
      : number(snake(source, "population_lost", "populationLost")),
  };
}

function parseAction(value: unknown): RoundAction {
  const source = record(value);
  const rawKind = string(source.kind);
  const kind = ACTION_KINDS.includes(rawKind as ActionKind)
    ? rawKind as ActionKind
    : undefined;
  return {
    owner: string(source.owner).toLowerCase(),
    slot: number(source.slot),
    cost: number(source.cost),
    commitment: string(source.commitment),
    revealed: boolean(source.revealed),
    result: parseActionResult(source.result),
    kind,
    speciesId: kind ? string(snake(source, "species_id", "speciesId")) : undefined,
    secondarySpeciesId: kind
      ? string(snake(source, "secondary_species_id", "secondarySpeciesId"))
      : undefined,
    firstGene: kind ? string(snake(source, "first_gene", "firstGene")) : undefined,
    secondGene: kind ? string(snake(source, "second_gene", "secondGene")) : undefined,
    proposal: kind ? string(source.proposal) : undefined,
    childName: kind ? string(snake(source, "child_name", "childName")) : undefined,
    decision: kind ? parseDecision(source.decision) : undefined,
  };
}

function parseRoundPlayer(value: unknown): RoundPlayer | null {
  if (!value) return null;
  const source = record(value);
  return {
    locked: boolean(source.locked),
    committedCost: number(snake(source, "committed_cost", "committedCost")),
  };
}

function parseRoundPlayers(value: unknown): Record<string, RoundPlayer> {
  const source = record(value);
  return Object.fromEntries(
    Object.entries(source).flatMap(([owner, state]) => {
      const parsed = parseRoundPlayer(state);
      return parsed ? [[owner.toLowerCase(), parsed]] : [];
    }),
  );
}

export function parsePlanet(value: unknown, viewer = ""): PlanetState | null {
  const source = record(value);
  if (source.exists === false || !snake(source, "planet_id", "planetId")) return null;
  const species = Array.isArray(source.species) ? source.species.map(parseSpecies) : [];
  const viewerAddress = viewer.toLowerCase();
  const explicit = source.your_species ?? source.yourSpecies;
  const yourSpecies = Array.isArray(explicit)
    ? explicit.map(parseSpecies)
    : species.filter((entry) => entry.owner === viewerAddress);
  const rawStatus = string(source.status, "waiting");
  const status = ["waiting", "active", "complete", "cancelled"].includes(rawStatus)
    ? rawStatus as PlanetState["status"]
    : "waiting";
  const rawPhase = string(source.phase);
  const phase = ["", "commit", "reveal"].includes(rawPhase)
    ? rawPhase as PlanetPhase
    : "";
  return {
    planetId: string(snake(source, "planet_id", "planetId")),
    name: string(source.name),
    creator: string(source.creator).toLowerCase(),
    biome: string(source.biome),
    biomeName: string(snake(source, "biome_name", "biomeName")),
    status,
    players: strings(source.players).map((entry) => entry.toLowerCase()),
    playerCount: number(snake(source, "player_count", "playerCount")),
    maxPlayers: number(snake(source, "max_players", "maxPlayers")),
    era: number(source.era, 1),
    eraLimit: number(snake(source, "era_limit", "eraLimit"), 6),
    phase,
    phaseDeadline: number(snake(source, "phase_deadline", "phaseDeadline")),
    phaseWindowSeconds: number(
      snake(source, "phase_window_seconds", "phaseWindowSeconds"),
    ),
    winner: string(source.winner).toLowerCase(),
    hazard: parseHazard(source.hazard),
    species,
    yourSpecies,
    roundActions: Array.isArray(snake(source, "round_actions", "roundActions"))
      ? (snake(source, "round_actions", "roundActions") as unknown[]).map(parseAction)
      : [],
    actionHistory: Array.isArray(snake(source, "action_history", "actionHistory"))
      ? (snake(source, "action_history", "actionHistory") as unknown[]).map(parseAction)
      : [],
    roundPlayers: parseRoundPlayers(
      snake(source, "round_players", "roundPlayers"),
    ),
    yourRound: parseRoundPlayer(snake(source, "your_round", "yourRound")),
    allLocked: boolean(snake(source, "all_locked", "allLocked")),
    allRevealed: boolean(snake(source, "all_revealed", "allRevealed")),
    isPlayer: boolean(snake(source, "is_player", "isPlayer")),
    maxSpeciesPerWallet: number(
      snake(source, "max_species_per_wallet", "maxSpeciesPerWallet"),
      4,
    ),
    evolutionEnergyPerEra: number(
      snake(source, "evolution_energy_per_era", "evolutionEnergyPerEra"),
      2,
    ),
    revision: number(source.revision),
    lastEvent: string(snake(source, "last_event", "lastEvent")),
  };
}

export function parseLobby(value: unknown): LobbyPlanet[] {
  const source = record(value);
  if (!Array.isArray(source.planets)) return [];
  return source.planets.map((entry) => {
    const planet = record(entry);
    return {
      planetId: string(snake(planet, "planet_id", "planetId")),
      name: string(planet.name),
      creator: string(planet.creator).toLowerCase(),
      biome: string(planet.biome),
      playerCount: number(snake(planet, "player_count", "playerCount")),
      maxPlayers: number(snake(planet, "max_players", "maxPlayers")),
      eraLimit: number(snake(planet, "era_limit", "eraLimit")),
      phaseWindowSeconds: number(
        snake(planet, "phase_window_seconds", "phaseWindowSeconds"),
      ),
      foundersReady: boolean(snake(planet, "founders_ready", "foundersReady")),
      revision: number(planet.revision),
    };
  });
}

export function parseProfile(value: unknown): PlayerProfile {
  const source = record(value);
  return {
    player: string(source.player).toLowerCase(),
    planetsPlayed: number(snake(source, "planets_played", "planetsPlayed")),
    wins: number(source.wins),
    extinctions: number(source.extinctions),
    acceptedMutations: number(
      snake(source, "accepted_mutations", "acceptedMutations"),
    ),
    bestLegacy: number(snake(source, "best_legacy", "bestLegacy")),
  };
}

export function currentNode(species: Species | null): AncestryNode | null {
  if (!species) return null;
  return species.nodes.find((node) => node.nodeId === species.currentNodeId) ?? null;
}

export function findNode(planet: PlanetState, nodeId: string): AncestryNode | null {
  for (const species of planet.species) {
    const node = species.nodes.find((entry) => entry.nodeId === nodeId);
    if (node) return node;
  }
  return null;
}

export function speciesById(planet: PlanetState, speciesId: string): Species | null {
  return planet.species.find((species) => species.speciesId === speciesId) ?? null;
}
