import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {
  cachePortraitCandidate,
  clearCachedPortraitCandidate,
  fetchImageBytes,
  loadCachedPortraitCandidate,
} from "../../src/portrait-service";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe("portrait candidate recovery", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: memoryStorage(),
    });
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("reuses a rendered candidate only for its exact owner and node", () => {
    const candidate = {
      candidateId: "candidate-1",
      url: "https://portraits.example/api/portraits/candidate-1",
      sha256: `sha256:${"ab".repeat(32)}`,
    };
    cachePortraitCandidate("planet-1", "node-1", "0xABC", candidate);

    expect(loadCachedPortraitCandidate("planet-1", "node-1", "0xabc")).toEqual(candidate);
    expect(loadCachedPortraitCandidate("planet-1", "node-2", "0xabc")).toBeNull();

    clearCachedPortraitCandidate("planet-1", "node-1", "0xabc");
    expect(loadCachedPortraitCandidate("planet-1", "node-1", "0xabc")).toBeNull();
  });

  it("retries a transient portrait download without generating another candidate", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {status: 200}));

    const loading = fetchImageBytes("https://portraits.example/candidate");
    await vi.runAllTimersAsync();

    await expect(loading).resolves.toEqual(new Uint8Array([1, 2, 3]));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
