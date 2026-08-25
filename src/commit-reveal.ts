import type {ActionKind, PlanetState} from "./game-model";

export type ActionDraft = {
  kind: ActionKind;
  speciesId: string;
  secondarySpeciesId?: string;
  firstGene?: string;
  secondGene?: string;
  proposal?: string;
  childName?: string;
};

export type ActionPayload = {
  planet_id: string;
  era: number;
  owner: string;
  slot: number;
  cost: number;
  kind: ActionKind;
  species_id: string;
  secondary_species_id: string;
  first_gene: string;
  second_gene: string;
  proposal: string;
  child_name: string;
  salt: string;
};

export type RevealSecret = {
  version: 2;
  commitment: string;
  payload: ActionPayload;
  savedAt: number;
};

export type PreparedCommitment = RevealSecret & {
  storageKey: string;
};

function normalizedText(value = ""): string {
  return value.replace(/[\r\n]/g, " ").trim().split(/\s+/).filter(Boolean).join(" ");
}

function normalizedGene(value = ""): string {
  return value.trim().toLowerCase().replaceAll("-", "_");
}

function randomSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function actionCost(kind: ActionKind): number {
  return kind === "merge" ? 2 : 1;
}

export function buildActionPayload(
  planet: Pick<PlanetState, "planetId" | "era">,
  owner: string,
  slot: number,
  draft: ActionDraft,
  salt = randomSalt(),
): ActionPayload {
  return {
    planet_id: planet.planetId.trim().toLowerCase(),
    era: planet.era,
    owner: owner.trim().toLowerCase(),
    slot,
    cost: actionCost(draft.kind),
    kind: draft.kind,
    species_id: draft.speciesId.trim().toLowerCase(),
    secondary_species_id: draft.secondarySpeciesId?.trim().toLowerCase() ?? "",
    first_gene: normalizedGene(draft.firstGene),
    second_gene: normalizedGene(draft.secondGene),
    proposal: normalizedText(draft.proposal),
    child_name: normalizedText(draft.childName),
    salt,
  };
}

export function canonicalActionJson(payload: ActionPayload): string {
  const sorted = Object.fromEntries(
    Object.keys(payload)
      .sort()
      .map((key) => [key, payload[key as keyof ActionPayload]]),
  );
  return JSON.stringify(sorted);
}

export async function hashActionPayload(payload: ActionPayload): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalActionJson(payload)),
  );
  return `sha256:${Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}

export function revealStorageKey(
  planetId: string,
  era: number,
  owner: string,
  slot: number,
): string {
  return `ets:v2:reveal:${planetId.toLowerCase()}:${era}:${owner.toLowerCase()}:${slot}`;
}

function localStorageAvailable(): boolean {
  return typeof globalThis.localStorage !== "undefined";
}

export async function prepareCommitment(
  planet: Pick<PlanetState, "planetId" | "era">,
  owner: string,
  slot: number,
  draft: ActionDraft,
): Promise<PreparedCommitment> {
  const payload = buildActionPayload(planet, owner, slot, draft);
  const commitment = await hashActionPayload(payload);
  const secret: RevealSecret = {
    version: 2,
    commitment,
    payload,
    savedAt: Date.now(),
  };
  const storageKey = revealStorageKey(planet.planetId, planet.era, owner, slot);
  if (!localStorageAvailable()) {
    throw new Error("This browser cannot save the reveal secret. Enable local storage first.");
  }
  globalThis.localStorage.setItem(storageKey, JSON.stringify(secret));
  return {...secret, storageKey};
}

export function loadRevealSecret(
  planetId: string,
  era: number,
  owner: string,
  slot: number,
): RevealSecret | null {
  if (!localStorageAvailable()) return null;
  const raw = globalThis.localStorage.getItem(
    revealStorageKey(planetId, era, owner, slot),
  );
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RevealSecret;
    return parsed.version === 2 && parsed.payload?.planet_id === planetId.toLowerCase()
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function removeRevealSecret(secret: RevealSecret): void {
  if (!localStorageAvailable()) return;
  const payload = secret.payload;
  globalThis.localStorage.removeItem(
    revealStorageKey(payload.planet_id, payload.era, payload.owner, payload.slot),
  );
}

export function persistRevealSecret(secret: RevealSecret): void {
  if (!localStorageAvailable()) {
    throw new Error("This browser cannot save the reveal secret.");
  }
  const payload = secret.payload;
  globalThis.localStorage.setItem(
    revealStorageKey(payload.planet_id, payload.era, payload.owner, payload.slot),
    JSON.stringify(secret),
  );
}

export function exportRevealBackup(secret: RevealSecret): string {
  return JSON.stringify(secret);
}

export async function verifyRevealBackup(raw: string): Promise<RevealSecret> {
  const parsed = JSON.parse(raw) as RevealSecret;
  const payload = parsed.payload;
  if (
    parsed.version !== 2
    || !payload
    || typeof parsed.commitment !== "string"
    || !parsed.commitment.startsWith("sha256:")
  ) {
    throw new Error("This is not an EvolvingtoSurvive v2 reveal backup.");
  }
  if (await hashActionPayload(payload) !== parsed.commitment.toLowerCase()) {
    throw new Error("The reveal backup does not match its commitment hash.");
  }
  return parsed;
}
