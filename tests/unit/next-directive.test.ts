import {describe, expect, it} from "vitest";

import {createDemoPlanet, DEMO_ADDRESS} from "../../src/demo-state";
import {deriveNextDirective} from "../../src/next-directive";
import {derivePhaseState} from "../../src/turn-state";

function directiveFor(scenario: Parameters<typeof createDemoPlanet>[0], secrets = {}) {
  const planet = createDemoPlanet(scenario);
  const state = derivePhaseState(
    planet,
    DEMO_ADDRESS,
    scenario === "expired" ? planet.phaseDeadline + 1 : planet.phaseDeadline - 30,
  );
  const nextSpecies = planet.yourSpecies.find((species) => species.alive) ?? null;
  return deriveNextDirective({
    planet,
    state,
    secrets,
    pendingPortrait: null,
    nextEvolvableSpecies: nextSpecies,
  });
}

describe("next game directive", () => {
  it("points a fresh player at the writable tree node", () => {
    const directive = directiveFor("plan");
    expect(directive.kind).toBe("evolve");
    expect(directive.location).toContain("pulsing + node");
    expect(directive.target).toBe("evolution");
  });

  it("makes locking explicit after an action is sealed", () => {
    const directive = directiveFor("sealed");
    expect(directive.kind).toBe("lock");
    expect(directive.location).toContain("TURN");
  });

  it("blocks evolution behind a missing living-species portrait", () => {
    const planet = createDemoPlanet("plan");
    const pendingSpecies = planet.yourSpecies.find((species) => species.alive);
    expect(pendingSpecies).toBeDefined();
    const node = pendingSpecies?.nodes.find((entry) => entry.nodeId === pendingSpecies.currentNodeId);
    if (node) node.portrait.status = "pending";
    const state = derivePhaseState(planet, DEMO_ADDRESS, planet.phaseDeadline - 30);
    const directive = deriveNextDirective({
      planet,
      state,
      secrets: {},
      pendingPortrait: pendingSpecies ?? null,
      nextEvolvableSpecies: pendingSpecies ?? null,
    });
    expect(directive.kind).toBe("portrait");
    expect(directive.location).toContain("YOUR SPECIES");
  });

  it("routes a missing reveal secret to recovery", () => {
    const directive = directiveFor("reveal");
    expect(directive.kind).toBe("restore");
    expect(directive.location).toContain("Restore reveal key");
  });

  it("makes phase advance prominent when the window expires", () => {
    const directive = directiveFor("expired");
    expect(directive.kind).toBe("advance");
    expect(directive.tone).toBe("urgent");
  });
});
