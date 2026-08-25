import type {
  AncestryNode,
  PlanetState,
  PlayerProfile,
  PortraitState,
  Species,
} from "./game-model";

export const DEMO_ADDRESS = "0x7e57000000000000000000000000000000000001";
const RIVAL_ADDRESS = "0x7e57000000000000000000000000000000000002";
const PORTRAIT_URL = "/images/cindermite-cinder-carapace.png";

const ACCEPTED_PORTRAIT: PortraitState = {
  status: "accepted",
  attempts: 1,
  reasonCode: "ok",
  url: PORTRAIT_URL,
  sha256: `sha256:${"ab".repeat(32)}`,
};

function node(
  nodeId: string,
  kind: AncestryNode["kind"],
  era: number,
  name: string,
  parentNodeIds: string[],
  phenotypeSummary: string,
  adaptationClass = "",
  genes: string[] = [],
): AncestryNode {
  return {
    nodeId,
    kind,
    era,
    name,
    proposal: kind === "founder"
      ? ""
      : `Express a heritable ${name.toLowerCase()} suited to the hostile world.`,
    genes,
    adaptationClass,
    phenotypeSummary,
    visualTraits: kind === "founder"
      ? ["recognizable quadruped body plan", "dark heat-sensitive skin"]
      : ["overlapping mineral plates", "expanded breathing chambers"],
    parentNodeIds,
    portrait: ACCEPTED_PORTRAIT,
  };
}

const BASE_STATS = {
  resilience: 3,
  mobility: 3,
  foraging: 3,
  water: 3,
  thermal: 3,
  respiration: 3,
  awareness: 3,
};

const BASE_GENES = [
  "keratin_plates",
  "antifreeze_blood",
  "hollow_bones",
  "filter_gills",
  "fat_reserves",
  "symbiotic_algae",
  "compound_eyes",
  "reinforced_spine",
];

const founderNode = node(
  "ets2-demo-s1-n0",
  "founder",
  0,
  "Founder",
  [],
  "A low four-legged grazer with dark heat-sensitive skin.",
);
const carapaceNode = node(
  "ets2-demo-n1",
  "adapt",
  1,
  "Cinder Carapace",
  [founderNode.nodeId],
  "Overlapping heat-dispersing plates protect a cool vascular core.",
  "thermal",
  ["keratin_plates", "antifreeze_blood"],
);
const branchNode = node(
  "ets2-demo-n2",
  "split",
  2,
  "Tidal Branch",
  [carapaceNode.nodeId],
  "A smaller shore lineage carries plate ancestry into rhythmic gill fans.",
  "respiration",
  ["hollow_bones", "filter_gills"],
);
const hybridNode = node(
  "ets2-demo-n3",
  "merge",
  3,
  "Tidecinder Hybrid",
  [carapaceNode.nodeId, branchNode.nodeId],
  "A viable hybrid visibly inherits the plated trunk and tidal breathing fans.",
  "respiration",
  ["hollow_bones", "filter_gills"],
);

const retiredFounder: Species = {
  speciesId: "ets2-demo-s1",
  owner: DEMO_ADDRESS,
  name: "Cindermite",
  bodyPlan: "quadruped",
  founderDescription: founderNode.phenotypeSummary,
  originKind: "founder",
  alive: false,
  retiredReason: "merged",
  population: 0,
  stats: {...BASE_STATS, thermal: 6},
  genes: [...BASE_GENES],
  phenotype: carapaceNode.phenotypeSummary,
  nodes: [founderNode, carapaceNode],
  currentNodeId: carapaceNode.nodeId,
  acceptedMutations: 1,
  rejectedMutations: 0,
  legacy: 8,
  portraitUrl: PORTRAIT_URL,
  portraitSha256: ACCEPTED_PORTRAIT.sha256,
  lastHazardOutcome: null,
};

const retiredBranch: Species = {
  ...retiredFounder,
  speciesId: "ets2-demo-s2",
  name: "Tideglass Branch",
  originKind: "split",
  bodyPlan: "amphibious",
  stats: {...BASE_STATS, thermal: 4, respiration: 4},
  nodes: [branchNode],
  currentNodeId: branchNode.nodeId,
  acceptedMutations: 1,
  legacy: 3,
};

const hybrid: Species = {
  ...retiredFounder,
  speciesId: "ets2-demo-s3",
  name: "Tidecinder",
  originKind: "merge",
  bodyPlan: "hybrid",
  founderDescription: hybridNode.phenotypeSummary,
  alive: true,
  retiredReason: "",
  population: 9,
  stats: {...BASE_STATS, thermal: 5, respiration: 6},
  phenotype: hybridNode.phenotypeSummary,
  nodes: [hybridNode],
  currentNodeId: hybridNode.nodeId,
  acceptedMutations: 1,
  legacy: 6,
  lastHazardOutcome: {
    hazard: "Obsidian Hail",
    checkedStat: "resilience",
    statValue: 3,
    threshold: 5,
    populationBefore: 13,
    populationLost: 4,
    populationAfter: 9,
    survived: true,
    legacyGained: 0,
  },
};

const rivalFounderNode = node(
  "ets2-demo-s4-n0",
  "founder",
  0,
  "Founder",
  [],
  "A translucent shore crawler with broad feet and rhythmic throat sacs.",
);
const rival: Species = {
  ...hybrid,
  speciesId: "ets2-demo-s4",
  owner: RIVAL_ADDRESS,
  name: "Glassfin",
  bodyPlan: "amphibious",
  founderDescription: rivalFounderNode.phenotypeSummary,
  originKind: "founder",
  population: 8,
  stats: {...BASE_STATS, respiration: 5},
  phenotype: rivalFounderNode.phenotypeSummary,
  nodes: [rivalFounderNode],
  currentNodeId: rivalFounderNode.nodeId,
  acceptedMutations: 0,
  legacy: 4,
  lastHazardOutcome: {
    hazard: "Obsidian Hail",
    checkedStat: "resilience",
    statValue: 4,
    threshold: 5,
    populationBefore: 10,
    populationLost: 2,
    populationAfter: 8,
    survived: true,
    legacyGained: 1,
  },
};

export type DemoPhaseScenario = "plan" | "sealed" | "locked" | "reveal" | "expired";

export function createDemoPlanet(scenario: DemoPhaseScenario = "plan"): PlanetState {
  const now = Math.floor(Date.now() / 1_000);
  const phase = scenario === "reveal" || scenario === "expired" ? "reveal" : "commit";
  const locked = scenario === "locked" || scenario === "reveal" || scenario === "expired";
  const hasCommittedAction = scenario === "sealed" || phase === "reveal";
  const roundActions = hasCommittedAction ? [{
    owner: DEMO_ADDRESS,
    slot: 0,
    cost: 1,
    commitment: `sha256:${"cd".repeat(32)}`,
    revealed: false,
    result: null,
  }] : [];
  const species = [retiredFounder, retiredBranch, hybrid, rival].map((entry) => ({
    ...entry,
    stats: {...entry.stats},
    genes: [...entry.genes],
    nodes: entry.nodes.map((entryNode) => ({
      ...entryNode,
      genes: [...entryNode.genes],
      visualTraits: [...entryNode.visualTraits],
      parentNodeIds: [...entryNode.parentNodeIds],
      portrait: {...entryNode.portrait},
    })),
  }));
  return {
    planetId: "ets2-demo",
    name: "Pyra Prime",
    creator: DEMO_ADDRESS,
    biome: "ember_wastes",
    biomeName: "Ember Wastes",
    status: "active",
    players: [DEMO_ADDRESS, RIVAL_ADDRESS],
    playerCount: 2,
    maxPlayers: 2,
    era: 4,
    eraLimit: 6,
    phase,
    phaseDeadline: scenario === "expired" ? now - 10 : now + 900,
    phaseWindowSeconds: 3_600,
    winner: "",
    hazard: {
      era: 4,
      adaptationClass: "water",
      threshold: 6,
      name: "Black Drought",
      description: "Surface water vanishes beneath hot rock.",
    },
    species,
    yourSpecies: species.filter((entry) => entry.owner === DEMO_ADDRESS),
    roundActions,
    actionHistory: [],
    roundPlayers: {
      [DEMO_ADDRESS]: {locked, committedCost: roundActions.length},
      [RIVAL_ADDRESS]: {locked: scenario === "expired", committedCost: 0},
    },
    yourRound: {locked, committedCost: roundActions.length},
    allLocked: scenario === "expired",
    allRevealed: false,
    isPlayer: true,
    maxSpeciesPerWallet: 4,
    evolutionEnergyPerEra: 2,
    revision: 12,
    lastEvent: scenario === "expired"
      ? "The reveal window expired. Anyone may resolve the era."
      : "Era 4 plans are forming across every ecosystem.",
  };
}

export const DEMO_PLANET = createDemoPlanet();

export const DEMO_PROFILE: PlayerProfile = {
  player: DEMO_ADDRESS,
  planetsPlayed: 3,
  wins: 1,
  extinctions: 1,
  acceptedMutations: 9,
  bestLegacy: 31,
};
