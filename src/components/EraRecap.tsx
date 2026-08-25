import {useState} from "react";

import {label} from "../catalog";
import type {PlanetState} from "../game-model";

function shortAddress(address: string): string {
  return `${address.slice(0, 5)}…${address.slice(-3)}`;
}

export default function EraRecap({
  planet,
  viewerAddress,
  enabled = true,
}: {
  planet: PlanetState;
  viewerAddress: string;
  enabled?: boolean;
}) {
  const resolvedEra = Math.max(1, planet.era - 1);
  const storageKey = `ets2:era-recap:${planet.planetId}:${resolvedEra}`;
  const outcomes = planet.species.flatMap((species) => (
    species.lastHazardOutcome ? [{species, outcome: species.lastHazardOutcome}] : []
  ));
  const [open, setOpen] = useState(() => {
    if (!enabled || planet.era <= 1 || outcomes.length === 0) return false;
    try {
      return globalThis.localStorage.getItem(storageKey) !== "seen";
    } catch {
      return true;
    }
  });

  if (!enabled || !open || !outcomes.length) return null;

  function dismiss() {
    try {
      globalThis.localStorage.setItem(storageKey, "seen");
    } catch {
      // The recap may reappear after reload when storage is unavailable.
    }
    setOpen(false);
  }

  return (
    <div className="era-recap-backdrop" role="presentation">
      <section className="era-recap" role="dialog" aria-modal="true" aria-labelledby="era-recap-title">
        <header>
          <div><small>ERA {resolvedEra} RESOLVED</small><h2 id="era-recap-title">Natural selection still happened.</h2></div>
          <span>SURVIVAL REPORT</span>
        </header>

        <p className="era-recap-explainer">Even when no ecosystem submits a plan, the era hazard tests every living species. Population and legacy change before the next era begins.</p>

        <div className="era-recap-grid">
          {outcomes.map(({species, outcome}) => {
            const isYou = species.owner === viewerAddress.toLowerCase();
            return (
              <article key={species.speciesId} className={outcome.survived ? "survived" : "extinct"}>
                <div className="era-recap-species">
                  <span>{isYou ? "YOUR SPECIES" : `RIVAL · ${shortAddress(species.owner)}`}</span>
                  <strong>{species.name}</strong>
                  <small>{outcome.hazard}</small>
                </div>
                <div className="era-recap-population">
                  <small>POPULATION</small>
                  <strong>{outcome.populationBefore}m <i>→</i> {outcome.populationAfter}m</strong>
                  <b className={outcome.populationLost ? "loss" : "safe"}>{outcome.populationLost ? `−${outcome.populationLost}m` : "NO LOSS"}</b>
                </div>
                <dl>
                  <div><dt>Hazard check</dt><dd>{label(outcome.checkedStat)} {outcome.statValue} / {outcome.threshold}</dd></div>
                  <div><dt>Legacy</dt><dd>+{outcome.legacyGained}</dd></div>
                  <div><dt>Result</dt><dd>{outcome.survived ? "SURVIVED" : "EXTINCT"}</dd></div>
                </dl>
              </article>
            );
          })}
        </div>

        <aside><i>!</i><p>A sealed action that is never revealed also loses <strong>2 population</strong> before the hazard is applied.</p></aside>
        <footer><span>Next: inspect the new hazard, then evolve or lock your plan.</span><button type="button" onClick={dismiss}>ENTER ERA {planet.era}<b>›</b></button></footer>
      </section>
    </div>
  );
}
