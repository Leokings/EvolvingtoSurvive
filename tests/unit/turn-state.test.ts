import {describe, expect, it} from "vitest";

import {createDemoPlanet, DEMO_ADDRESS} from "../../src/demo-state";
import {derivePhaseState, formatPhaseTime} from "../../src/turn-state";

describe("simultaneous phase presentation", () => {
  it("lets an unlocked player plan with two energy", () => {
    const planet = createDemoPlanet("plan");
    const state = derivePhaseState(planet, DEMO_ADDRESS, planet.phaseDeadline - 30);
    expect(state.phase).toBe("planning");
    expect(state.canCommit).toBe(true);
    expect(state.canLock).toBe(true);
    expect(state.remainingEnergy).toBe(2);
  });

  it("shows a sealed plan waiting for the other ecosystem", () => {
    const planet = createDemoPlanet("locked");
    const state = derivePhaseState(planet, DEMO_ADDRESS, planet.phaseDeadline - 30);
    expect(state.phase).toBe("plan_locked");
    expect(state.canCommit).toBe(false);
    expect(state.locked).toBe(true);
  });

  it("keeps the lock command available after an action is sealed", () => {
    const planet = createDemoPlanet("sealed");
    const state = derivePhaseState(planet, DEMO_ADDRESS, planet.phaseDeadline - 30);
    expect(state.phase).toBe("planning");
    expect(state.canCommit).toBe(true);
    expect(state.canLock).toBe(true);
    expect(state.locked).toBe(false);
    expect(state.committedEnergy).toBe(1);
    expect(state.remainingEnergy).toBe(1);
    expect(state.yourActions).toHaveLength(1);
  });

  it("identifies an unrevealed local action", () => {
    const planet = createDemoPlanet("reveal");
    const state = derivePhaseState(planet, DEMO_ADDRESS, planet.phaseDeadline - 30);
    expect(state.phase).toBe("revealing");
    expect(state.canReveal).toBe(true);
    expect(state.unrevealedActions).toHaveLength(1);
  });

  it("lets anyone advance an expired phase", () => {
    const planet = createDemoPlanet("expired");
    const state = derivePhaseState(planet, DEMO_ADDRESS, planet.phaseDeadline + 1);
    expect(state.phase).toBe("phase_expired");
    expect(state.canAdvance).toBe(true);
    expect(state.expired).toBe(true);
  });

  it("matches the contract's inclusive deadline boundary", () => {
    const planet = createDemoPlanet("plan");
    const atDeadline = derivePhaseState(planet, DEMO_ADDRESS, planet.phaseDeadline);
    const afterDeadline = derivePhaseState(planet, DEMO_ADDRESS, planet.phaseDeadline + 1);
    expect(atDeadline.expired).toBe(false);
    expect(atDeadline.canLock).toBe(true);
    expect(atDeadline.timeLeft).toBe(1);
    expect(afterDeadline.expired).toBe(true);
    expect(afterDeadline.canAdvance).toBe(true);
  });

  it("formats short and long phase windows", () => {
    expect(formatPhaseTime(0)).toBe("Expired");
    expect(formatPhaseTime(65)).toBe("1:05");
    expect(formatPhaseTime(3_661)).toBe("1:01:01");
  });
});
