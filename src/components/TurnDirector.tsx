import {useState} from "react";

import type {RevealSecret} from "../commit-reveal";
import type {PlanetState, Species} from "../game-model";
import {formatPhaseTime, type PhaseState} from "../turn-state";

function shortAddress(address: string): string {
  return `${address.slice(0, 5)}…${address.slice(-3)}`;
}

function phaseCopy(planet: PlanetState, state: PhaseState) {
  if (state.expired) {
    return planet.phase === "commit"
      ? {eyebrow: "Window expired", title: "Open the reveal phase", detail: "Planning is closed. Any player can advance; sealed moves remain hidden."}
      : {eyebrow: "Window expired", title: "Resolve natural selection", detail: "Reveals are closed. Advance now to apply actions, the hazard, and the next era."};
  }
  if (planet.phase === "commit") {
    return state.locked
      ? {eyebrow: "Plan transmitted", title: "Waiting for ecosystems", detail: "Your moves are sealed. The reveal phase opens when every living ecosystem locks or time ends."}
      : state.yourActions.length
        ? {eyebrow: "Planning still open", title: "Action sealed — now lock your plan", detail: "Committing DNA did not finish your turn. Locking is a separate final transaction."}
        : {eyebrow: "Planning phase", title: "Your ecosystem can act", detail: "Spend up to two energy, back up each secret, then lock your plan."};
  }
  if (state.unrevealedActions.length > 0) {
    return {eyebrow: "Reveal phase", title: "Reveal your sealed DNA", detail: "Reveal every saved action before the clock reaches zero."};
  }
  return {eyebrow: "Reveal transmitted", title: "Awaiting resolution", detail: "Your actions are visible. The era resolves after every ecosystem reveals or the clock ends."};
}

export default function TurnDirector({
  planet,
  address,
  state,
  secrets,
  busy,
  guided,
  pendingPortrait,
  nextEvolvableSpecies,
  lastSyncedAt,
  onLock,
  onReveal,
  onAdvance,
  onCopyBackup,
  onRestoreBackup,
  onGeneratePortrait,
  onEvolveSpecies,
  onRefresh,
}: {
  planet: PlanetState;
  address: string;
  state: PhaseState;
  secrets: Record<number, RevealSecret>;
  busy: string;
  guided: boolean;
  pendingPortrait: Species | null;
  nextEvolvableSpecies: Species | null;
  lastSyncedAt: number;
  onLock: () => void;
  onReveal: (slot: number) => void;
  onAdvance: () => void;
  onCopyBackup: (slot: number) => void;
  onRestoreBackup: (backup: string) => Promise<boolean>;
  onGeneratePortrait: (speciesId: string) => Promise<void>;
  onEvolveSpecies: (speciesId: string) => void;
  onRefresh: () => void;
}) {
  const [showRecovery, setShowRecovery] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [backup, setBackup] = useState("");
  const actionCount = state.yourActions.length;
  const portraitRequired = Boolean(
    pendingPortrait
    && planet.phase === "commit"
    && !state.expired
    && !state.locked
    && actionCount === 0,
  );
  const copy = portraitRequired && pendingPortrait
    ? {
        eyebrow: "Portrait required",
        title: `Finish ${pendingPortrait.name}'s portrait`,
        detail: "Evolution unlocks after this descendant has a verified reference image.",
      }
    : phaseCopy(planet, state);
  const networkPlayers = planet.players.filter((owner) => (
    planet.species.some((species) => species.owner === owner && species.alive)
  ));
  const firstUnrevealed = state.unrevealedActions[0];
  const firstRevealSecret = firstUnrevealed ? secrets[firstUnrevealed.slot] : undefined;
  let commandTitle = "";
  let commandDetail = "";
  let commandLabel = "";
  let commandClass = "lock-command";
  let commandBusy = false;
  let commandAction: (() => void) | null = null;

  if (state.canAdvance) {
    commandTitle = "Timer finished — advance is available";
    commandDetail = "Any wallet can advance now. No approval or additional waiting is required.";
    commandLabel = busy === "advance"
      ? "ADVANCING PHASE…"
      : planet.phase === "commit" ? "OPEN REVEAL NOW" : "RESOLVE ERA NOW";
    commandClass = "advance-command";
    commandBusy = busy === "advance";
    commandAction = onAdvance;
  } else if (portraitRequired && pendingPortrait) {
    commandTitle = `Finish ${pendingPortrait.name}'s new portrait`;
    commandDetail = "Create the image, then approve one wallet transaction to verify it. If the wallet step fails, your image is saved for a retry.";
    commandLabel = busy === `portrait-${pendingPortrait.speciesId}`
      ? "RENDERING + VERIFYING…"
      : "CREATE + VERIFY PORTRAIT";
    commandClass = "portrait-command-primary";
    commandBusy = busy === `portrait-${pendingPortrait.speciesId}`;
    commandAction = () => void onGeneratePortrait(pendingPortrait.speciesId);
  } else if (guided && state.canLock && actionCount === 0 && nextEvolvableSpecies) {
    commandTitle = `Choose ${nextEvolvableSpecies.name}'s adaptation`;
    commandDetail = "Open the evolution lab, choose two genes, explain the survival trait, and seal it.";
    commandLabel = `EVOLVE ${nextEvolvableSpecies.name}`;
    commandClass = "evolve-command-primary";
    commandAction = () => onEvolveSpecies(nextEvolvableSpecies.speciesId);
  } else if (state.canLock) {
    commandTitle = actionCount ? "Action sealed. Turn not finished." : "Ready to finish planning?";
    commandDetail = actionCount
      ? "Lock your plan in one final transaction. Reveal opens immediately when every ecosystem locks."
      : "You can lock without spending energy; you never need to wait for the timer when every player is ready.";
    commandLabel = busy === "lock"
      ? "LOCKING PLAN…"
      : actionCount ? `LOCK PLAN · ${actionCount} ACTION${actionCount === 1 ? "" : "S"} SEALED` : "LOCK PLAN · SKIP MUTATION";
    commandBusy = busy === "lock";
    commandAction = onLock;
  } else if (state.canReveal && firstUnrevealed) {
    commandTitle = firstRevealSecret ? "Reveal your sealed DNA" : "Reveal key required";
    commandDetail = firstRevealSecret
      ? "Revealing is the second transaction. Submit the saved action before this window closes."
      : "Restore the private backup saved when you committed this action, then reveal it.";
    commandLabel = busy === `reveal-${firstUnrevealed.slot}`
      ? "REVEALING ACTION…"
      : firstRevealSecret ? `REVEAL ACTION ${firstUnrevealed.slot + 1} NOW` : `RESTORE KEY FOR ACTION ${firstUnrevealed.slot + 1}`;
    commandClass = "reveal-command-primary";
    commandBusy = busy === `reveal-${firstUnrevealed.slot}`;
    commandAction = firstRevealSecret
      ? () => onReveal(firstUnrevealed.slot)
      : () => {
          setShowRecovery(true);
          setShowDetails(true);
        };
  }

  const loopIndex = state.canAdvance || state.expired
    ? 3
    : planet.phase === "reveal"
      ? state.unrevealedActions.length ? 2 : 3
      : state.locked ? 2 : actionCount ? 1 : 0;
  const detailsVisible = !guided || showDetails;

  async function restore() {
    if (!backup.trim()) return;
    const restored = await onRestoreBackup(backup);
    if (restored) {
      setBackup("");
      setShowRecovery(false);
    }
  }

  return (
    <section className={`phase-console phase-${state.phase}`} aria-labelledby="phase-console-title">
      <header className="phase-console-header">
        <div>
          <small>{copy.eyebrow}</small>
          <h2 id="phase-console-title">{copy.title}</h2>
        </div>
        <span className={`phase-signal ${state.expired ? "danger" : ""}`}><i />{planet.phase || "offline"}</span>
      </header>

      <div className="phase-clock" aria-live="polite">
        <span>{formatPhaseTime(state.timeLeft)}</span>
        <small>{state.expired ? "advance available now" : planet.phase === "commit" ? "lock plans to finish early" : "remaining in this phase"}</small>
      </div>

      <ol className="turn-loop" aria-label="Era turn steps">
        {["Evolve", "Lock", "Reveal", "Survive"].map((step, index) => (
          <li key={step} className={index < loopIndex ? "done" : index === loopIndex ? "active" : "future"}>
            <i>{index < loopIndex ? "✓" : index + 1}</i><span>{step}</span>
          </li>
        ))}
      </ol>

      {commandAction ? (
        <div className={`phase-next-command ${state.canAdvance ? "urgent" : ""}`}>
          <small>Required next step</small>
          <strong>{commandTitle}</strong>
          <p>{commandDetail}</p>
          <button className={commandClass} type="button" disabled={Boolean(busy) || commandBusy} onClick={commandAction}>{commandLabel}<span>›</span></button>
        </div>
      ) : (
        <div className="phase-next-command waiting-command">
          <small>Current status</small>
          <strong>{copy.title}</strong>
          <p>{copy.detail}</p>
        </div>
      )}

      {guided && state.canLock && actionCount === 0 && nextEvolvableSpecies && !portraitRequired ? <button className="skip-turn-command" type="button" disabled={Boolean(busy)} onClick={onLock}>Skip evolution and lock plan</button> : null}

      {guided ? <button className="phase-details-toggle" type="button" aria-expanded={detailsVisible} onClick={() => setShowDetails((shown) => !shown)}>{detailsVisible ? "HIDE TURN DETAILS" : "SHOW TURN DETAILS"}<span>{detailsVisible ? "−" : "+"}</span></button> : null}

      <div className={`phase-detail-stack ${detailsVisible ? "" : "is-hidden"}`}>
        <div className="utility-commands">
          <button type="button" onClick={() => setShowRecovery((shown) => !shown)}>Restore reveal key</button>
          <button type="button" disabled={busy === "refresh"} onClick={onRefresh}>{busy === "refresh" ? "Syncing…" : "Sync chain"}</button>
        </div>

        {showRecovery ? (
          <div className="recovery-console">
            <label htmlFor="reveal-backup">Paste private reveal backup</label>
            <textarea id="reveal-backup" value={backup} onChange={(event) => setBackup(event.target.value)} placeholder="ets2-reveal:{…}" />
            <div><button type="button" onClick={() => setShowRecovery(false)}>Cancel</button><button type="button" disabled={!backup.trim()} onClick={() => void restore()}>Verify + restore</button></div>
          </div>
        ) : null}

        <p className="phase-instruction">{copy.detail}</p>

        <div className="energy-bank" aria-label={`${state.remainingEnergy} of ${planet.evolutionEnergyPerEra} energy remaining`}>
          <span><small>Evolution energy</small><b>{state.remainingEnergy}/{planet.evolutionEnergyPerEra}</b></span>
          <div>{Array.from({length: planet.evolutionEnergyPerEra}, (_, index) => <i key={index} className={index < state.remainingEnergy ? "charged" : "spent"} />)}</div>
        </div>

        <div className="ecosystem-readiness">
          <div className="readiness-heading"><span>Ecosystem uplinks</span><b>{planet.phase === "commit" ? `${state.playerLocks}/${state.playerCount} locked` : `${state.revealedCount}/${state.commitmentCount} revealed`}</b></div>
          <ol>
            {networkPlayers.map((owner) => {
              const isYou = owner === address.toLowerCase();
              const round = planet.roundPlayers[owner];
              const ownerActions = planet.roundActions.filter((action) => action.owner === owner);
              const ready = planet.phase === "commit"
                ? Boolean(round?.locked)
                : ownerActions.every((action) => action.revealed);
              return (
                <li key={owner} className={ready ? "ready" : "waiting"}>
                  <i />
                  <span>{isYou ? "You" : shortAddress(owner)}</span>
                  <b>{planet.phase === "commit" ? ready ? "Locked" : "Planning" : ready ? "Revealed" : "Hidden"}</b>
                </li>
              );
            })}
          </ol>
        </div>

        {state.yourActions.length ? (
          <div className="sealed-action-list">
            {state.yourActions.map((action) => (
              <article key={action.slot} className={action.revealed ? "revealed" : "sealed"}>
                <span><i>{action.slot + 1}</i><b>{action.revealed ? action.kind ?? "Action" : "Encrypted DNA"}</b><small>{action.cost} energy · {action.revealed ? "public" : "sealed"}</small></span>
                {!action.revealed && planet.phase === "commit" ? <button type="button" onClick={() => onCopyBackup(action.slot)} disabled={!secrets[action.slot]}>Backup</button> : null}
                {!action.revealed && planet.phase === "reveal" ? <button type="button" className="reveal-command" onClick={() => onReveal(action.slot)} disabled={Boolean(busy) || !secrets[action.slot]}>{busy === `reveal-${action.slot}` ? "Revealing…" : secrets[action.slot] ? "Reveal" : "Restore key"}</button> : null}
              </article>
            ))}
          </div>
        ) : null}

        <footer><span><i />Studionet synced</span><time dateTime={new Date(lastSyncedAt * 1_000).toISOString()}>{new Date(lastSyncedAt * 1_000).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit", second: "2-digit"})}</time></footer>
      </div>
    </section>
  );
}
