import type {RevealSecret} from "./commit-reveal";
import type {PlanetState, Species} from "./game-model";
import type {PhaseState} from "./turn-state";

export type NextDirectiveTarget = "turn" | "evolution" | "portrait";

export type NextDirective = {
  kind: "advance" | "portrait" | "evolve" | "lock" | "reveal" | "restore" | "waiting";
  tone: "urgent" | "action" | "waiting";
  eyebrow: string;
  title: string;
  location: string;
  actionLabel: string;
  target: NextDirectiveTarget;
  speciesId?: string;
  slot?: number;
};

export function deriveNextDirective({
  planet,
  state,
  secrets,
  pendingPortrait,
  nextEvolvableSpecies,
}: {
  planet: PlanetState;
  state: PhaseState;
  secrets: Record<number, RevealSecret>;
  pendingPortrait: Species | null;
  nextEvolvableSpecies: Species | null;
}): NextDirective {
  if (state.canAdvance) {
    return {
      kind: "advance",
      tone: "urgent",
      eyebrow: "NEXT MOVE · TIMER COMPLETE",
      title: planet.phase === "commit" ? "Open the reveal phase now" : "Resolve natural selection now",
      location: "Find it in: TURN → required next step",
      actionLabel: "OPEN TURN CONTROLS",
      target: "turn",
    };
  }

  const portraitRequired = Boolean(
    pendingPortrait
    && planet.phase === "commit"
    && !state.expired
    && !state.locked
    && state.yourActions.length === 0,
  );
  if (portraitRequired && pendingPortrait) {
    return {
      kind: "portrait",
      tone: "urgent",
      eyebrow: "NEXT MOVE · PORTRAIT REQUIRED",
      title: `Finish ${pendingPortrait.name}'s reference portrait`,
      location: "Find it in: YOUR SPECIES → Create portrait",
      actionLabel: "SHOW PORTRAIT CONTROL",
      target: "portrait",
      speciesId: pendingPortrait.speciesId,
    };
  }

  if (state.canLock && state.yourActions.length === 0 && nextEvolvableSpecies) {
    return {
      kind: "evolve",
      tone: "action",
      eyebrow: "NEXT MOVE · EVOLVE",
      title: `Write ${nextEvolvableSpecies.name}'s next descendant`,
      location: "Find it in: ANCESTRAL DNA MAP → pulsing + node",
      actionLabel: "OPEN EVOLUTION LAB",
      target: "evolution",
      speciesId: nextEvolvableSpecies.speciesId,
    };
  }

  if (state.canLock) {
    const actionCount = state.yourActions.length;
    return {
      kind: "lock",
      tone: "action",
      eyebrow: "NEXT MOVE · FINISH PLANNING",
      title: actionCount
        ? `Lock your plan — ${actionCount} action${actionCount === 1 ? "" : "s"} sealed`
        : "Lock your plan or skip mutation",
      location: "Find it in: TURN → required next step",
      actionLabel: "OPEN TURN CONTROLS",
      target: "turn",
    };
  }

  const firstUnrevealed = state.unrevealedActions[0];
  if (state.canReveal && firstUnrevealed) {
    const hasSecret = Boolean(secrets[firstUnrevealed.slot]);
    return {
      kind: hasSecret ? "reveal" : "restore",
      tone: "urgent",
      eyebrow: hasSecret ? "NEXT MOVE · REVEAL" : "NEXT MOVE · KEY REQUIRED",
      title: hasSecret
        ? `Reveal sealed action ${firstUnrevealed.slot + 1}`
        : `Restore the key for action ${firstUnrevealed.slot + 1}`,
      location: `Find it in: TURN → ${hasSecret ? "Reveal action" : "Restore reveal key"}`,
      actionLabel: "OPEN TURN CONTROLS",
      target: "turn",
      slot: firstUnrevealed.slot,
    };
  }

  return {
    kind: "waiting",
    tone: "waiting",
    eyebrow: "CURRENT STATUS · YOUR MOVE IS COMPLETE",
    title: planet.phase === "commit" ? "Waiting for ecosystems to lock" : "Waiting for the era to resolve",
    location: "Track it in: TURN → ecosystem uplinks",
    actionLabel: "VIEW TURN STATUS",
    target: "turn",
  };
}
