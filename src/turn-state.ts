import type {PlanetState, RoundAction} from "./game-model";

export type PhasePresentation =
  | "planning"
  | "plan_locked"
  | "revealing"
  | "waiting_reveals"
  | "phase_expired";

export type PhaseState = {
  phase: PhasePresentation;
  timeLeft: number;
  expired: boolean;
  canCommit: boolean;
  canLock: boolean;
  canReveal: boolean;
  canAdvance: boolean;
  committedEnergy: number;
  remainingEnergy: number;
  locked: boolean;
  yourActions: RoundAction[];
  unrevealedActions: RoundAction[];
  playerLocks: number;
  playerCount: number;
  revealedCount: number;
  commitmentCount: number;
};

export function formatPhaseTime(seconds: number): string {
  if (seconds <= 0) return "Expired";
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor(seconds % 3_600 / 60);
  const remaining = seconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

export function derivePhaseState(
  planet: PlanetState,
  viewerAddress: string,
  now: number,
): PhaseState {
  const viewer = viewerAddress.toLowerCase();
  // Contract windows include the exact deadline second. Keep the UI on the
  // same boundary so it never offers Advance one second before the write is valid.
  const timeLeft = Math.max(0, planet.phaseDeadline - now + 1);
  const expired = planet.phaseDeadline > 0 && now > planet.phaseDeadline;
  const yourActions = planet.roundActions.filter((action) => action.owner === viewer);
  const unrevealedActions = yourActions.filter((action) => !action.revealed);
  const committedEnergy = planet.yourRound?.committedCost
    ?? yourActions.reduce((total, action) => total + action.cost, 0);
  const remainingEnergy = Math.max(
    0,
    planet.evolutionEnergyPerEra - committedEnergy,
  );
  const locked = planet.yourRound?.locked ?? false;
  const hasLivingSpecies = planet.yourSpecies.some((species) => species.alive);
  const isActivePlayer = planet.status === "active" && planet.isPlayer && hasLivingSpecies;
  const canCommit = isActivePlayer
    && planet.phase === "commit"
    && !expired
    && !locked
    && remainingEnergy > 0;
  const canLock = isActivePlayer
    && planet.phase === "commit"
    && !expired
    && !locked;
  const canReveal = isActivePlayer
    && planet.phase === "reveal"
    && !expired
    && unrevealedActions.length > 0;
  const canAdvance = planet.status === "active" && (
    expired
    || (planet.phase === "commit" && planet.allLocked)
    || (planet.phase === "reveal" && planet.allRevealed)
  );

  let phase: PhasePresentation;
  if (expired) phase = "phase_expired";
  else if (planet.phase === "commit") phase = locked ? "plan_locked" : "planning";
  else phase = canReveal ? "revealing" : "waiting_reveals";

  const activeOwners = new Set(
    planet.species.filter((species) => species.alive).map((species) => species.owner),
  );
  const playerLocks = planet.players.filter((owner) => {
    if (!activeOwners.has(owner)) return false;
    return planet.roundPlayers[owner]?.locked ?? false;
  }).length;

  return {
    phase,
    timeLeft,
    expired,
    canCommit,
    canLock,
    canReveal,
    canAdvance,
    committedEnergy,
    remainingEnergy,
    locked,
    yourActions,
    unrevealedActions,
    playerLocks,
    playerCount: activeOwners.size,
    revealedCount: planet.roundActions.filter((action) => action.revealed).length,
    commitmentCount: planet.roundActions.length,
  };
}
