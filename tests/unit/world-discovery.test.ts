import {describe, expect, it} from "vitest";

import type {LobbyPlanet} from "../../src/game-model";
import {discoverWorlds} from "../../src/world-discovery";

const WORLDS: LobbyPlanet[] = [
  {
    planetId: "ets2-11",
    name: "Silent Reef",
    creator: "0x1",
    biome: "abyssal_tides",
    playerCount: 2,
    maxPlayers: 2,
    eraLimit: 4,
    phaseWindowSeconds: 300,
    foundersReady: true,
    revision: 5,
  },
  {
    planetId: "ets2-12",
    name: "Cinder Crown",
    creator: "0x2",
    biome: "ember_wastes",
    playerCount: 1,
    maxPlayers: 3,
    eraLimit: 6,
    phaseWindowSeconds: 3_600,
    foundersReady: false,
    revision: 2,
  },
  {
    planetId: "ets2-13",
    name: "New Silent Moon",
    creator: "0x3",
    biome: "glacial_moon",
    playerCount: 1,
    maxPlayers: 2,
    eraLimit: 8,
    phaseWindowSeconds: 86_400,
    foundersReady: true,
    revision: 8,
  },
];

describe("world discovery", () => {
  it("hides full waiting worlds by default and ranks ready recent worlds first", () => {
    expect(discoverWorlds(WORLDS, "", "open").map((world) => world.planetId)).toEqual([
      "ets2-13",
      "ets2-12",
    ]);
  });

  it("searches case-insensitively by either world name or exact ID fragment", () => {
    expect(discoverWorlds(WORLDS, "SILENT", "all").map((world) => world.planetId)).toEqual([
      "ets2-13",
      "ets2-11",
    ]);
    expect(discoverWorlds(WORLDS, "2-12", "all")[0].name).toBe("Cinder Crown");
  });

  it("can isolate founder-ready worlds without hiding a full result", () => {
    expect(discoverWorlds(WORLDS, "", "ready").map((world) => world.planetId)).toEqual([
      "ets2-13",
      "ets2-11",
    ]);
  });
});
