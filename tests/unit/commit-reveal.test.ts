import {describe, expect, it} from "vitest";

import {
  actionCost,
  buildActionPayload,
  canonicalActionJson,
  hashActionPayload,
  verifyRevealBackup,
} from "../../src/commit-reveal";

const OWNER = "0x1111111111111111111111111111111111111111";

describe("commit/reveal payload", () => {
  it("normalizes the exact fields the contract hashes", () => {
    const payload = buildActionPayload(
      {planetId: "ETS2-1", era: 2},
      OWNER.toUpperCase(),
      0,
      {
        kind: "merge",
        speciesId: "ETS2-1-S1",
        secondarySpeciesId: "ETS2-1-S2",
        firstGene: "Hollow-Bones",
        secondGene: "filter_gills",
        proposal: "  Fuse  both\n breathing systems.  ",
        childName: "  Tidecinder  ",
      },
      "x".repeat(64),
    );
    expect(payload.cost).toBe(2);
    expect(payload.owner).toBe(OWNER);
    expect(payload.first_gene).toBe("hollow_bones");
    expect(payload.proposal).toBe("Fuse both breathing systems.");
    expect(payload.child_name).toBe("Tidecinder");
  });

  it("sorts keys exactly and produces a sha256 commitment", async () => {
    const payload = buildActionPayload(
      {planetId: "ets2-1", era: 1},
      OWNER,
      0,
      {kind: "conserve", speciesId: "ets2-1-s1"},
      "s".repeat(64),
    );
    expect(canonicalActionJson(payload)).toBe(
      `{"child_name":"","cost":1,"era":1,"first_gene":"","kind":"conserve","owner":"${OWNER}","planet_id":"ets2-1","proposal":"","salt":"${"s".repeat(64)}","second_gene":"","secondary_species_id":"","slot":0,"species_id":"ets2-1-s1"}`,
    );
    expect(await hashActionPayload(payload)).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(actionCost("merge")).toBe(2);
    expect(actionCost("split")).toBe(1);
  });

  it("verifies a restored secret before the caller persists it", async () => {
    const payload = buildActionPayload(
      {planetId: "ets2-3", era: 4},
      OWNER,
      1,
      {kind: "adapt", speciesId: "ets2-3-s1", firstGene: "filter_gills", secondGene: "hollow_bones", proposal: "Grow layered gill fans around expanded breathing chambers."},
      "r".repeat(64),
    );
    const commitment = await hashActionPayload(payload);
    const backup = JSON.stringify({version: 2, commitment, payload, savedAt: 42});
    await expect(verifyRevealBackup(backup)).resolves.toMatchObject({commitment, payload});
    await expect(verifyRevealBackup(JSON.stringify({version: 2, commitment, payload: {...payload, era: 5}, savedAt: 42}))).rejects.toThrow(/does not match/i);
  });
});
