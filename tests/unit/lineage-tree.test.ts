import {describe, expect, it} from "vitest";

import {DEMO_PLANET} from "../../src/demo-state";
import {buildLineageNodes, parentCount} from "../../src/lineage-tree";

describe("v2 lineage ancestry graph", () => {
  it("uses the contract's exact ancestry IDs", () => {
    const founderSpecies = DEMO_PLANET.species[0];
    const nodes = buildLineageNodes(founderSpecies);
    expect(nodes.map((node) => node.kind)).toEqual(["founder", "adapt"]);
    expect(nodes[1].parentIds).toEqual([nodes[0].nodeId]);
  });

  it("adds a blank tip only to living species", () => {
    const living = DEMO_PLANET.species.find((species) => species.alive)!;
    const nodes = buildLineageNodes(living);
    expect(nodes.at(-1)?.kind).toBe("next");
    expect(nodes.at(-1)?.parentIds).toEqual([living.currentNodeId]);
  });

  it("preserves both parents of a DNA merge", () => {
    const hybrid = DEMO_PLANET.species.find((species) => species.originKind === "merge")!;
    const merge = buildLineageNodes(hybrid)[0];
    expect(merge.kind).toBe("merge");
    expect(parentCount(merge)).toBe(2);
    expect(merge.parentIds).toHaveLength(2);
  });
});
