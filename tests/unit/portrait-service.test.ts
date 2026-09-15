import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {
  cachePortraitCandidate,
  clearCachedPortraitCandidate,
  fetchImageBytes,
  loadCachedPortraitCandidate,
  sha256,
  submitPortraitCandidate,
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

  it("reuses the exact saved candidate after wallet submission fails", async () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255, 42]);
    const candidate = {
      candidateId: "candidate-retry",
      url: "https://portraits.example/api/portraits/candidate-retry",
      sha256: await sha256(bytes),
    };
    const generate = vi.fn().mockResolvedValue(candidate);
    const submit = vi.fn()
      .mockRejectedValueOnce(new TypeError("Do not know how to serialize a BigInt"))
      .mockResolvedValueOnce("FINALIZED");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => (
      new Response(bytes.slice(), {status: 200})
    ));
    const options = {
      planetId: "planet-1",
      nodeId: "node-1",
      speciesOwner: "0xABC",
      generate,
      submit,
    };

    await expect(submitPortraitCandidate(options)).rejects.toThrow(
      "Do not know how to serialize a BigInt",
    );
    expect(loadCachedPortraitCandidate("planet-1", "node-1", "0xabc")).toEqual(candidate);

    await expect(submitPortraitCandidate(options)).resolves.toEqual({
      candidate,
      result: "FINALIZED",
      reused: true,
    });
    expect(generate).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[0]?.[0]).toEqual(candidate);
    expect(submit.mock.calls[1]?.[0]).toEqual(candidate);
    expect(submit.mock.calls[0]?.[1]).toEqual(bytes);
    expect(submit.mock.calls[1]?.[1]).toEqual(bytes);
    expect(loadCachedPortraitCandidate("planet-1", "node-1", "0xabc")).toBeNull();
  });
});
