import type {LobbyPlanet} from "./game-model";

export type WorldFilter = "open" | "ready" | "all";

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function discoverWorlds(
  lobby: LobbyPlanet[],
  query: string,
  filter: WorldFilter,
): LobbyPlanet[] {
  const needle = normalized(query);
  return lobby
    .filter((planet) => {
      const hasOpenSlot = planet.playerCount < planet.maxPlayers;
      if (filter === "open" && !hasOpenSlot) return false;
      if (filter === "ready" && !planet.foundersReady) return false;
      return !needle
        || normalized(planet.planetId).includes(needle)
        || normalized(planet.name).includes(needle);
    })
    .sort((left, right) => {
      const leftOpen = left.playerCount < left.maxPlayers ? 1 : 0;
      const rightOpen = right.playerCount < right.maxPlayers ? 1 : 0;
      return rightOpen - leftOpen
        || Number(right.foundersReady) - Number(left.foundersReady)
        || right.revision - left.revision
        || left.planetId.localeCompare(right.planetId);
    });
}
