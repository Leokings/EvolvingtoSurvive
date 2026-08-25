import type {AncestryNode, PortraitCandidate, Species} from "./game-model";

const API_URL = (import.meta.env.VITE_EVOLUTION_API_URL?.trim() || "").replace(/\/$/, "");
const CANDIDATE_CACHE_PREFIX = "ets2:portrait-candidate:v1";
const CANDIDATE_CACHE_TTL_MS = 23 * 60 * 60 * 1_000;
const FETCH_RETRY_DELAYS_MS = [0, 300, 900];

type CachedPortraitCandidate = PortraitCandidate & {
  planetId: string;
  nodeId: string;
  speciesOwner: string;
  cachedAt: number;
};

function endpoint(path: string): string {
  return `${API_URL}${path}`;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let lastFailure: unknown;
  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt < FETCH_RETRY_DELAYS_MS.length; attempt += 1) {
    if (FETCH_RETRY_DELAYS_MS[attempt]) await wait(FETCH_RETRY_DELAYS_MS[attempt]);
    try {
      const response = await fetch(input, init);
      if (response.ok || (response.status < 500 && response.status !== 429)) return response;
      lastResponse = response;
    } catch (cause) {
      lastFailure = cause;
    }
  }
  if (lastResponse) return lastResponse;
  const detail = lastFailure instanceof Error ? lastFailure.message : String(lastFailure ?? "network unavailable");
  throw new Error(`Network request failed after 3 attempts. ${detail}`);
}

function candidateCacheKey(planetId: string, nodeId: string, speciesOwner: string): string {
  return `${CANDIDATE_CACHE_PREFIX}:${planetId}:${nodeId}:${speciesOwner.toLowerCase()}`;
}

function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function cachePortraitCandidate(
  planetId: string,
  nodeId: string,
  speciesOwner: string,
  candidate: PortraitCandidate,
): void {
  const storage = browserStorage();
  if (!storage) return;
  const cached: CachedPortraitCandidate = {
    ...candidate,
    planetId,
    nodeId,
    speciesOwner: speciesOwner.toLowerCase(),
    cachedAt: Date.now(),
  };
  try {
    storage.setItem(candidateCacheKey(planetId, nodeId, speciesOwner), JSON.stringify(cached));
  } catch {
    // A storage quota or privacy setting must never block portrait verification.
  }
}

export function loadCachedPortraitCandidate(
  planetId: string,
  nodeId: string,
  speciesOwner: string,
): PortraitCandidate | null {
  const storage = browserStorage();
  if (!storage) return null;
  const key = candidateCacheKey(planetId, nodeId, speciesOwner);
  try {
    const parsed = JSON.parse(storage.getItem(key) || "null") as Partial<CachedPortraitCandidate> | null;
    const valid = parsed
      && parsed.planetId === planetId
      && parsed.nodeId === nodeId
      && parsed.speciesOwner === speciesOwner.toLowerCase()
      && typeof parsed.candidateId === "string"
      && typeof parsed.url === "string"
      && typeof parsed.sha256 === "string"
      && typeof parsed.cachedAt === "number"
      && Date.now() - parsed.cachedAt < CANDIDATE_CACHE_TTL_MS;
    if (!valid) {
      try {
        storage.removeItem(key);
      } catch {
        // Ignore storage cleanup failures.
      }
      return null;
    }
    return {
      candidateId: parsed.candidateId!,
      url: parsed.url!,
      sha256: parsed.sha256!,
    };
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Ignore storage cleanup failures.
    }
    return null;
  }
}

export function clearCachedPortraitCandidate(
  planetId: string,
  nodeId: string,
  speciesOwner: string,
): void {
  try {
    browserStorage()?.removeItem(candidateCacheKey(planetId, nodeId, speciesOwner));
  } catch {
    // The candidate will expire server-side even if local cleanup is unavailable.
  }
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  const raw = await response.text();
  try {
    const parsed = JSON.parse(raw) as {error?: unknown};
    if (typeof parsed.error === "string" && parsed.error.trim()) return new Error(parsed.error);
  } catch {
    // The worker may return plain text during an infrastructure failure.
  }
  return new Error(raw.trim() || fallback);
}

export async function requestPortrait(
  planetId: string,
  species: Species,
  node: AncestryNode,
  ancestorUrls: string[],
  turnstileToken?: string,
): Promise<PortraitCandidate> {
  const response = await fetch(endpoint("/api/portraits/generate"), {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({
      planetId,
      nodeId: node.nodeId,
      nodeKind: node.kind,
      speciesOwner: species.owner,
      speciesName: species.name,
      bodyPlan: species.bodyPlan,
      founderDescription: species.founderDescription,
      phenotypeSummary: node.phenotypeSummary,
      visualTraits: node.visualTraits,
      ancestorUrls,
      reuseExisting: node.portrait.status !== "rejected",
      turnstileToken,
    }),
  });
  if (!response.ok) {
    throw await responseError(response, `Portrait generation failed (${response.status}).`);
  }
  return response.json() as Promise<PortraitCandidate>;
}

export async function markPortraitCanonical(
  candidate: PortraitCandidate,
  species: Species,
  node: AncestryNode,
): Promise<void> {
  const response = await resilientFetch(
    endpoint(`/api/portraits/${candidate.candidateId}/canonicalize`),
    {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({
        speciesOwner: species.owner,
        nodeId: node.nodeId,
        sha256: candidate.sha256,
      }),
    },
  );
  if (!response.ok) {
    throw await responseError(response, `Portrait retention sync failed (${response.status}).`);
  }
}

export async function retainCanonicalNode(
  species: Species,
  node: AncestryNode,
): Promise<void> {
  const url = new URL(node.portrait.url);
  const candidateId = url.pathname.match(/^\/api\/portraits\/([^/]+)$/)?.[1];
  if (!candidateId || !node.portrait.sha256) {
    throw new Error("A canonical ancestor is missing its portrait storage reference.");
  }
  await markPortraitCanonical({
    candidateId,
    url: node.portrait.url,
    sha256: node.portrait.sha256,
  }, species, node);
}

export async function fetchImageBytes(url: string): Promise<Uint8Array> {
  const response = await resilientFetch(url, {cache: "no-store"});
  if (!response.ok) {
    throw new Error(`Could not fetch portrait pixels (${response.status}).`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return `sha256:${Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}

export async function loadVerifiedCandidate(
  candidate: PortraitCandidate,
): Promise<Uint8Array> {
  const bytes = await fetchImageBytes(candidate.url);
  if (bytes.byteLength > 400_000) {
    throw new Error("Generated portrait exceeds the contract's 400 KB limit.");
  }
  if (await sha256(bytes) !== candidate.sha256.toLowerCase()) {
    throw new Error("Portrait bytes do not match the service hash.");
  }
  return bytes;
}
