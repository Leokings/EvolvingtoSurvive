import {describe, expect, it} from "vitest";

import {currentNode, parseLobby, parsePlanet, parseProfile} from "../../src/game-model";

const VIEWER = "0x1111111111111111111111111111111111111111";

describe("v2 game model parsing", () => {
  it("normalizes the simultaneous contract projection", () => {
    const planet = parsePlanet({
      exists: true,
      planet_id: "ets2-4",
      name: "Pyra Prime",
      creator: VIEWER,
      biome: "ember_wastes",
      biome_name: "Ember Wastes",
      status: "active",
      players: [VIEWER],
      player_count: 1,
      max_players: 2,
      era: 2,
      era_limit: 6,
      phase: "reveal",
      phase_deadline: 123,
      phase_window_seconds: 300,
      winner: "",
      hazard: {era: 2, adaptation_class: "respiration", threshold: 5, name: "Ash Lung", description: "Ash fills the sky."},
      species: [{
        species_id: "ets2-4-s1",
        owner: VIEWER,
        name: "Cindermite",
        body_plan: "quadruped",
        founder_description: "A low four-legged grazer.",
        origin_kind: "founder",
        alive: true,
        retired_reason: "",
        population: 12,
        stats: {thermal: 6},
        genes: ["filter_gills"],
        phenotype: "A plated grazer.",
        accepted_mutations: 1,
        rejected_mutations: 0,
        legacy: 4,
        current_node_id: "ets2-4-n1",
        portrait_url: "",
        portrait_sha256: "",
        last_hazard_outcome: {
          hazard: "Glass Rain",
          checked_stat: "thermal",
          stat_value: 6,
          threshold: 5,
          population_before: 12,
          population_lost: 0,
          population_after: 12,
          survived: true,
          legacy_gained: 4,
        },
        nodes: [{
          node_id: "ets2-4-n1",
          kind: "adapt",
          era: 1,
          name: "Cinder Carapace",
          proposal: "Route cooled blood through plates.",
          genes: ["keratin_plates", "antifreeze_blood"],
          adaptation_class: "thermal",
          phenotype_summary: "A heat-dispersing plated grazer.",
          visual_traits: ["mineral plates"],
          parent_node_ids: ["ets2-4-s1-n0"],
          portrait: {status: "pending", attempts: 0},
        }],
      }],
      your_species: [],
      round_actions: [{owner: VIEWER, slot: 0, cost: 1, commitment: `sha256:${"aa".repeat(32)}`, revealed: false, result: null}],
      round_players: {[VIEWER]: {locked: true, committed_cost: 1}},
      your_round: {locked: true, committed_cost: 1},
      all_locked: true,
      all_revealed: false,
      is_player: true,
      max_species_per_wallet: 4,
      evolution_energy_per_era: 2,
      revision: 4,
      last_event: "Plans sealed.",
    }, VIEWER);

    expect(planet?.planetId).toBe("ets2-4");
    expect(planet?.phase).toBe("reveal");
    expect(planet?.hazard?.adaptationClass).toBe("respiration");
    expect(planet?.species[0].stats.thermal).toBe(6);
    expect(planet?.species[0].stats.awareness).toBe(3);
    expect(planet?.species[0].lastHazardOutcome?.populationAfter).toBe(12);
    expect(planet?.species[0].lastHazardOutcome?.checkedStat).toBe("thermal");
    expect(currentNode(planet?.species[0] ?? null)?.parentNodeIds).toEqual(["ets2-4-s1-n0"]);
    expect(planet?.roundPlayers[VIEWER].locked).toBe(true);
    expect(planet?.roundActions[0].kind).toBeUndefined();
  });

  it("returns null for no planet and parses lobby/profile fields", () => {
    expect(parsePlanet({exists: false}, VIEWER)).toBeNull();
    expect(parseLobby({planets: [{planet_id: "ets2-1", player_count: 1, max_players: 2, founders_ready: true}]})[0].foundersReady).toBe(true);
    expect(parseProfile({player: VIEWER, planets_played: 3, accepted_mutations: 8}).acceptedMutations).toBe(8);
  });
});
