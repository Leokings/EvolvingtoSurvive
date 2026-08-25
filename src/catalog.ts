import type {AdaptationClass} from "./game-model";

export type GeneDefinition = {
  name: string;
  symbol: string;
  affinities: AdaptationClass[];
  summary: string;
};

export const GENE_CATALOG: Record<string, GeneDefinition> = {
  keratin_plates: {
    name: "Keratin Plates",
    symbol: "⬡",
    affinities: ["resilience", "thermal"],
    summary: "Armored layers that buffer heat and impact.",
  },
  hollow_bones: {
    name: "Hollow Bones",
    symbol: "⌁",
    affinities: ["mobility", "respiration"],
    summary: "A lighter frame with expanded air channels.",
  },
  filter_gills: {
    name: "Filter Gills",
    symbol: "≋",
    affinities: ["water", "respiration"],
    summary: "Layered folds that extract and clean dissolved gases.",
  },
  fat_reserves: {
    name: "Fat Reserves",
    symbol: "●",
    affinities: ["thermal", "foraging"],
    summary: "Insulation and energy stored around the core.",
  },
  rooted_lungs: {
    name: "Rooted Lungs",
    symbol: "Y",
    affinities: ["respiration", "water"],
    summary: "Branching vents that seal against debris.",
  },
  spring_tendons: {
    name: "Spring Tendons",
    symbol: "⌇",
    affinities: ["mobility"],
    summary: "Elastic connective tissue for sudden movement.",
  },
  compound_eyes: {
    name: "Compound Eyes",
    symbol: "◉",
    affinities: ["awareness"],
    summary: "Faceted vision with almost no blind side.",
  },
  symbiotic_algae: {
    name: "Symbiotic Algae",
    symbol: "✣",
    affinities: ["foraging", "water"],
    summary: "Living tissue that harvests light and recycles waste.",
  },
  electroreceptors: {
    name: "Electroreceptors",
    symbol: "ϟ",
    affinities: ["awareness", "water"],
    summary: "Sensory pores that read faint electric fields.",
  },
  antifreeze_blood: {
    name: "Antifreeze Blood",
    symbol: "✧",
    affinities: ["thermal"],
    summary: "Circulation that resists destructive temperature shifts.",
  },
  reinforced_spine: {
    name: "Reinforced Spine",
    symbol: "⋮",
    affinities: ["resilience", "mobility"],
    summary: "A segmented load-bearing ridge.",
  },
  digestive_vats: {
    name: "Digestive Vats",
    symbol: "◒",
    affinities: ["foraging", "resilience"],
    summary: "Protected chambers that ferment difficult food.",
  },
};

export const BIOMES = [
  {
    id: "ember_wastes",
    name: "Ember Wastes",
    symbol: "△",
    summary: "Heat, ash, drought, and moving stone.",
  },
  {
    id: "glacial_moon",
    name: "Glacial Moon",
    symbol: "✦",
    summary: "Long nights, icequakes, and inverted oceans.",
  },
  {
    id: "abyssal_tides",
    name: "Abyssal Tides",
    symbol: "≋",
    summary: "Crushing depth, darkness, and electric storms.",
  },
] as const;

export const BODY_PLAN_OPTIONS = [
  {id: "bilateral", name: "Bilateral", symbol: "Y", summary: "Upright symmetry and grasping limbs."},
  {id: "quadruped", name: "Quadruped", symbol: "M", summary: "Four-limbed stability and speed."},
  {id: "serpentine", name: "Serpentine", symbol: "S", summary: "Limbless flexibility and constriction."},
  {id: "radial", name: "Radial", symbol: "✣", summary: "A central body with repeating limbs."},
  {id: "amphibious", name: "Amphibious", symbol: "≋", summary: "Built to cross water and land."},
] as const;

export const BODY_PLANS = BODY_PLAN_OPTIONS.map(
  ({id, name}) => [id, name] as const,
);

export function geneDefinition(gene: string): GeneDefinition {
  return GENE_CATALOG[gene] ?? {
    name: gene.replaceAll("_", " "),
    symbol: "◌",
    affinities: [],
    summary: "An inherited biological pathway.",
  };
}

export function label(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
