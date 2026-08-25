import {currentNode, type PlanetState} from "../game-model";
import SpeciesPanel from "./SpeciesPanel";

export default function WaitingPlanet({
  planet,
  address,
  busy,
  onStart,
  onCancel,
  onGeneratePortrait,
}: {
  planet: PlanetState;
  address: string;
  busy: string;
  onStart: () => void;
  onCancel: () => void;
  onGeneratePortrait: (speciesId: string) => void;
}) {
  const viewer = address.toLowerCase();
  const creator = planet.creator === viewer;
  const foundersReady = planet.players.every((owner) => {
    const founder = planet.species.find((species) => species.owner === owner);
    return currentNode(founder ?? null)?.portrait.status === "accepted";
  });
  return (
    <main className="waiting-shell" id="top">
      <section className="waiting-hero">
        <span className={`large-orb ${planet.biome}`} aria-hidden="true"><i /><b /></span>
        <small>{planet.biomeName} · {planet.planetId}</small>
        <h1>{planet.name}</h1>
        <p>Each wallet must establish its founder portrait before simultaneous natural selection begins.</p>
        <div className="waiting-count"><strong>{planet.playerCount}</strong><span>/ {planet.maxPlayers} ecosystems</span></div>
        <div className={`founder-readiness ${foundersReady ? "ready" : ""}`}><i>{foundersReady ? "✓" : "◌"}</i><span><strong>{foundersReady ? "Every founder is canonical" : "Founder portraits still needed"}</strong><small>GenLayer validators inspect the exact generated pixels.</small></span></div>
        <div className="waiting-actions">
          {creator && planet.playerCount >= 2 ? <button className="primary-action" type="button" disabled={Boolean(busy) || !foundersReady} onClick={onStart}>{!foundersReady ? "Waiting for portraits" : busy === "start" ? "Starting onchain…" : "Begin simultaneous evolution"}<i>→</i></button> : null}
          {creator ? <button className="text-button" type="button" disabled={Boolean(busy)} onClick={onCancel}>Cancel planet</button> : null}
        </div>
      </section>
      <section className="founder-grid">
        {planet.species.map((species) => {
          const node = currentNode(species);
          const isYou = species.owner === viewer;
          const needsPortrait = node && node.portrait.status !== "accepted";
          return (
            <div className="founder-slot" key={species.speciesId}>
              <SpeciesPanel species={species} isYou={isYou} />
              {isYou && needsPortrait ? <button className="secondary-action wide" type="button" disabled={Boolean(busy)} onClick={() => onGeneratePortrait(species.speciesId)}>{busy === `portrait-${species.speciesId}` ? "Rendering + verifying…" : node.portrait.status === "rejected" ? "Try founder portrait again" : "Generate founder portrait"}</button> : null}
              {!isYou && needsPortrait ? <small className="waiting-on-portrait">Waiting for this wallet's founder portrait</small> : null}
            </div>
          );
        })}
        {Array.from({length: planet.maxPlayers - planet.playerCount}, (_, index) => <article className="empty-species-slot" key={index}><span>+</span><strong>Open ecosystem slot</strong><small>Share planet ID {planet.planetId}</small></article>)}
      </section>
    </main>
  );
}
