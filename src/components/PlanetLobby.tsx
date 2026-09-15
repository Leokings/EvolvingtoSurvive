import {useMemo, useState} from "react";

import {BIOMES, label} from "../catalog";
import type {CreatePlanetInput, JoinPlanetInput, LobbyPlanet, PlayerProfile} from "../game-model";
import {discoverWorlds, type WorldFilter} from "../world-discovery";
import BodyPlanPicker from "./BodyPlanPicker";
import BrandMark from "./BrandMark";

const DEFAULT_SPECIES: JoinPlanetInput = {
  speciesName: "",
  bodyPlan: "quadruped",
  founderDescription: "",
};

const INITIAL_WORLD_LIMIT = 6;

function shortAddress(address: string): string {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Not linked";
}

function phaseWindow(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} hr`;
  return `${Math.round(seconds / 86_400)} day`;
}

export default function PlanetLobby({
  lobby,
  connected,
  address,
  demo,
  profile,
  busy,
  onConnect,
  onDisconnect,
  onRefresh,
  onHowToPlay,
  onCreate,
  onJoin,
}: {
  lobby: LobbyPlanet[];
  connected: boolean;
  address: string;
  demo: boolean;
  profile: PlayerProfile;
  busy: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  onHowToPlay: () => void;
  onCreate: (input: CreatePlanetInput) => Promise<boolean>;
  onJoin: (planetId: string, input: JoinPlanetInput) => Promise<boolean>;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [joinPlanet, setJoinPlanet] = useState<LobbyPlanet | null>(null);
  const [worldQuery, setWorldQuery] = useState("");
  const [worldFilter, setWorldFilter] = useState<WorldFilter>("open");
  const [visibleWorldCount, setVisibleWorldCount] = useState(INITIAL_WORLD_LIMIT);
  const [species, setSpecies] = useState(DEFAULT_SPECIES);
  const [create, setCreate] = useState<CreatePlanetInput>({
    planetName: "",
    biome: "ember_wastes",
    maxPlayers: 2,
    eraLimit: 6,
    phaseWindowSeconds: 300,
    ...DEFAULT_SPECIES,
  });
  const selectedBiome = BIOMES.find((biome) => biome.id === create.biome) ?? BIOMES[0];
  const discoveredWorlds = useMemo(
    () => discoverWorlds(lobby, worldQuery, worldFilter),
    [lobby, worldFilter, worldQuery],
  );
  const visibleWorlds = discoveredWorlds.slice(0, visibleWorldCount);

  async function submitCreate(event: React.FormEvent) {
    event.preventDefault();
    if (await onCreate(create)) setShowCreate(false);
  }

  async function submitJoin(event: React.FormEvent) {
    event.preventDefault();
    if (joinPlanet && await onJoin(joinPlanet.planetId, species)) setJoinPlanet(null);
  }

  function beginCampaign() {
    if (connected) setShowCreate(true);
    else onConnect();
  }

  return (
    <main className="command-lobby" id="top">
      <header className="lobby-hud">
        <a className="lobby-brand" href="#top" aria-label="EvolvingtoSurvive command center">
          <BrandMark small />
          <span><strong>Evolving</strong><b>toSurvive</b><small>BIOSPHERE COMMAND</small></span>
        </a>
        <nav className="lobby-primary-nav" aria-label="Main navigation"><button className="active" type="button">Home</button><button type="button" onClick={onHowToPlay}>How to play</button></nav>
        <div className="lobby-network-readout"><i /><span><small>Network</small><strong>Studionet</strong></span></div>
        {connected ? (
          <button className="commander-wallet" type="button" disabled={demo} onClick={onDisconnect} aria-label={demo ? "Preview commander" : `Disconnect ${shortAddress(address)}`}>
            <i>{address.slice(2, 4).toUpperCase() || "AI"}</i>
            <span><small>{demo ? "Simulation identity" : "Commander linked"}</small><strong>{shortAddress(address)}</strong></span>
            <em>{demo ? "Preview" : "Disconnect"}</em>
          </button>
        ) : (
          <button className="commander-connect" type="button" onClick={onConnect}><span>Connect wallet</span><i>→</i></button>
        )}
      </header>

      <div className="lobby-command-grid">
        <aside className="mission-rail" aria-label="Mission protocol">
          <header><small>Mission control</small><strong>Evolution protocol</strong><span className="online-signal"><i /> Online</span></header>
          <ol className="protocol-list">
            <li className="active"><i>01</i><span><strong>Seed a biosphere</strong><small>Choose the world pressure and campaign rules.</small></span></li>
            <li><i>02</i><span><strong>Found your lineage</strong><small>Select an ancestral body plan and phenotype.</small></span></li>
            <li><i>03</i><span><strong>Seal mutations</strong><small>Commit actions before rival ecosystems reveal.</small></span></li>
            <li><i>04</i><span><strong>Survive or merge</strong><small>Maintain four species, fork branches, or fuse DNA.</small></span></li>
          </ol>
          <section className="capacity-readout">
            <header><small>Command capacity</small><strong>0 / 4</strong></header>
            <div><i /><i /><i /><i /></div>
            <p>Four living species per wallet. Two evolution energy each era.</p>
          </section>
          <a className="simulator-link" href="?demo=1"><span><small>Training simulation</small><strong>Open active evolution cockpit</strong></span><i>↗</i></a>
        </aside>

        <section className="world-sector" aria-labelledby="world-sector-title">
          <header className="sector-heading">
            <div><small>Live world scanner</small><h1 id="world-sector-title">Biosphere sector</h1></div>
            <span><i /> {discoveredWorlds.length} shown · {lobby.length} waiting</span>
          </header>

          <div className="world-discovery-tools" role="search" aria-label="World discovery controls">
            <label>
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={worldQuery}
                onChange={(event) => {
                  setWorldQuery(event.target.value);
                  setVisibleWorldCount(INITIAL_WORLD_LIMIT);
                }}
                placeholder="Search world name or ID"
                aria-label="Search worlds by name or ID"
              />
              {worldQuery ? <button type="button" onClick={() => { setWorldQuery(""); setVisibleWorldCount(INITIAL_WORLD_LIMIT); }} aria-label="Clear world search">×</button> : null}
            </label>
            <div className="world-filter-tabs" role="group" aria-label="Filter waiting worlds">
              {([
                ["open", "Open slots"],
                ["ready", "Ready"],
                ["all", "All waiting"],
              ] as const).map(([value, copy]) => (
                <button
                  key={value}
                  className={worldFilter === value ? "active" : ""}
                  type="button"
                  aria-pressed={worldFilter === value}
                  onClick={() => { setWorldFilter(value); setVisibleWorldCount(INITIAL_WORLD_LIMIT); }}
                >{copy}</button>
              ))}
            </div>
          </div>

          <div className={`sector-radar ${lobby.length ? "has-worlds" : "empty"}`}>
            <div className="radar-grid" aria-hidden="true"><i /><i /><i /><b /><b /></div>
            {discoveredWorlds.length ? (
              <div className="world-node-grid">
                {visibleWorlds.map((planet) => {
                  const full = planet.playerCount >= planet.maxPlayers;
                  return (
                  <article className="world-signal-card" key={planet.planetId}>
                    <span className={`scanned-world ${planet.biome}`} aria-hidden="true"><i /></span>
                    <div className="world-signal-copy">
                      <small>{label(planet.biome)} · ID {planet.planetId}</small>
                      <h2>{planet.name}</h2>
                      <p>{planet.playerCount} of {planet.maxPlayers} ecosystems linked</p>
                    </div>
                    <div className="world-signal-rules">
                      <span><small>Campaign</small><strong>{planet.eraLimit} eras</strong></span>
                      <span><small>Window</small><strong>{phaseWindow(planet.phaseWindowSeconds)}</strong></span>
                      <span><small>Founders</small><strong>{planet.foundersReady ? "Verified" : "Pending"}</strong></span>
                    </div>
                    <div className="ecosystem-slots" aria-label={`${planet.playerCount} of ${planet.maxPlayers} slots filled`}>
                      {Array.from({length: planet.maxPlayers}, (_, slot) => <i key={slot} className={slot < planet.playerCount ? "filled" : ""} />)}
                    </div>
                    <button type="button" disabled={full || !connected || Boolean(busy)} onClick={() => setJoinPlanet(planet)}>{full ? "World full" : "Deploy founder"} <span>→</span></button>
                  </article>
                  );
                })}
                {visibleWorlds.length < discoveredWorlds.length ? (
                  <button
                    className="show-more-worlds"
                    type="button"
                    onClick={() => setVisibleWorldCount((count) => count + INITIAL_WORLD_LIMIT)}
                  >Show {Math.min(INITIAL_WORLD_LIMIT, discoveredWorlds.length - visibleWorlds.length)} more worlds <span>↓</span></button>
                ) : null}
              </div>
            ) : (
              <div className="no-world-signal">
                <div className={`scan-orb ${selectedBiome.id}`} aria-hidden="true"><i /><b /><span>+</span></div>
                <small>Scan complete · no matching signals</small>
                <h2>{lobby.length ? "No worlds match this scan" : "No active biospheres detected"}</h2>
                <p>{lobby.length ? "Search by another world name or ID, or include every waiting world." : "Initialize a hostile world, establish its first species, and invite another wallet into the ecosystem."}</p>
                <button type="button" onClick={lobby.length ? () => { setWorldQuery(""); setWorldFilter("all"); setVisibleWorldCount(INITIAL_WORLD_LIMIT); } : beginCampaign}>{lobby.length ? "Clear scanner filters" : connected ? "Initialize first biosphere" : "Link commander wallet"}<span>→</span></button>
              </div>
            )}
          </div>

          <footer className="sector-status">
            <span><i /> Scanner synchronized</span>
            <span>V2 commit / reveal active</span>
            <span>Consensus portraits enabled</span>
          </footer>
        </section>

        <aside className="campaign-console">
          <header><small>Launch console</small><strong>New campaign</strong><i>READY</i></header>
          <div className={`campaign-orb ${selectedBiome.id}`} aria-hidden="true"><i /><b /></div>
          <section className="campaign-biome-preview">
            <small>Selected environment</small>
            <h2>{selectedBiome.name}</h2>
            <p>{selectedBiome.summary}</p>
          </section>
          <div className="campaign-defaults">
            <span><small>Ecosystems</small><strong>{create.maxPlayers}</strong></span>
            <span><small>Eras</small><strong>{create.eraLimit}</strong></span>
            <span><small>Phase clock</small><strong>{phaseWindow(create.phaseWindowSeconds)}</strong></span>
            <span><small>Species cap</small><strong>4 each</strong></span>
          </div>
          <button className="launch-campaign" type="button" onClick={beginCampaign} disabled={Boolean(busy)}>
            <span><small>{connected ? "Command authorized" : "Authorization required"}</small><strong>{connected ? "Initialize biosphere" : "Connect to deploy"}</strong></span><i>→</i>
          </button>
          <p className="campaign-note"><i>!</i><span>A second wallet is required before natural selection can begin.</span></p>
          <section className="commander-record">
            <header><small>Commander record</small><button type="button" disabled={!connected || demo || Boolean(busy)} onClick={onRefresh}>{busy === "refresh" ? "Syncing…" : "Sync"}</button></header>
            <div><span><small>Worlds</small><strong>{profile.planetsPlayed}</strong></span><span><small>Wins</small><strong>{profile.wins}</strong></span><span><small>Mutations</small><strong>{profile.acceptedMutations}</strong></span><span><small>Legacy</small><strong>{profile.bestLegacy}</strong></span></div>
          </section>
        </aside>
      </div>

      <footer className="lobby-ticker">
        <span className="ticker-live"><i /> LIVE</span>
        <strong>Natural-selection command network operational.</strong>
        <span>GENLAYER STUDIONET · CONTRACT V2</span>
        {demo ? <b>INTERACTIVE SIMULATION</b> : null}
      </footer>

      {showCreate ? (
        <div className="modal-backdrop command-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowCreate(false)}>
          <form className="game-modal setup-console" role="dialog" aria-modal="true" aria-labelledby="create-title" onSubmit={submitCreate}>
            <header className="setup-console-header">
              <span><small>Campaign initializer</small><strong id="create-title">Configure a hostile biosphere</strong></span>
              <b>STUDIONET · V2</b>
              <button className="modal-close" type="button" aria-label="Close" onClick={() => setShowCreate(false)}>×</button>
            </header>
            <div className="setup-console-body">
              <aside className="setup-step-rail" aria-label="Campaign setup steps">
                <span className="active"><i>01</i><b>World</b><small>Environment</small></span>
                <span><i>02</i><b>Founder</b><small>Ancestry root</small></span>
                <span><i>03</i><b>Rules</b><small>Campaign clock</small></span>
              </aside>
              <div className="setup-form-scroll">
                <section className="setup-section">
                  <header><span>01</span><div><strong>Build the world</strong><small>The biome determines the survival pressure generated each era.</small></div></header>
                  <label>World designation<input required minLength={3} maxLength={32} value={create.planetName} onChange={(event) => setCreate({...create, planetName: event.target.value})} placeholder="Pyra Prime" /></label>
                  <fieldset className="biome-picker"><legend>Choose a hostile biome</legend><div className="biome-command-grid">{BIOMES.map((biome) => <label key={biome.id} className={`${biome.id} ${create.biome === biome.id ? "selected" : ""}`}><input type="radio" name="biome" value={biome.id} checked={create.biome === biome.id} onChange={() => setCreate({...create, biome: biome.id})} /><b>{biome.symbol}</b><span><strong>{biome.name}</strong><small>{biome.summary}</small></span><i aria-hidden="true">✓</i></label>)}</div></fieldset>
                </section>
                <section className="setup-section">
                  <header><span>02</span><div><strong>Found your first lineage</strong><small>This anatomy becomes the root of its permanent ancestry tree.</small></div></header>
                  <label>Species designation<input required minLength={3} maxLength={32} value={create.speciesName} onChange={(event) => setCreate({...create, speciesName: event.target.value})} placeholder="Cindermite" /></label>
                  <SpeciesFields value={create} onChange={(next) => setCreate({...create, ...next})} />
                </section>
                <section className="setup-section compact-rules">
                  <header><span>03</span><div><strong>Set the campaign rules</strong><small>Every ecosystem plans simultaneously, then reveals during a second window.</small></div></header>
                  <div className="field-row compact"><label>Players<select value={create.maxPlayers} onChange={(event) => setCreate({...create, maxPlayers: Number(event.target.value)})}><option value={2}>2 ecosystems</option><option value={3}>3 ecosystems</option><option value={4}>4 ecosystems</option></select></label><label>Eras<select value={create.eraLimit} onChange={(event) => setCreate({...create, eraLimit: Number(event.target.value)})}><option value={4}>4 eras</option><option value={6}>6 eras</option><option value={8}>8 eras</option></select></label><label>Phase window<select value={create.phaseWindowSeconds} onChange={(event) => setCreate({...create, phaseWindowSeconds: Number(event.target.value)})}><option value={300}>5 minutes</option><option value={3600}>1 hour</option><option value={86400}>24 hours</option></select></label></div>
                </section>
              </div>
            </div>
            <footer className="setup-submit-bar"><span><i /> Transaction will create the world and its first ancestral node.</span><button className="primary-action" disabled={Boolean(busy)} type="submit">{busy === "create" ? "Initializing on Studionet…" : "Deploy biosphere"}<i>→</i></button></footer>
          </form>
        </div>
      ) : null}

      {joinPlanet ? (
        <div className="modal-backdrop command-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setJoinPlanet(null)}>
          <form className="game-modal setup-console join-console" role="dialog" aria-modal="true" aria-labelledby="join-title" onSubmit={submitJoin}>
            <header className="setup-console-header">
              <span><small>Founder deployment · {joinPlanet.planetId}</small><strong id="join-title">Enter {joinPlanet.name}</strong></span>
              <b>{label(joinPlanet.biome)}</b>
              <button className="modal-close" type="button" aria-label="Close" onClick={() => setJoinPlanet(null)}>×</button>
            </header>
            <div className="setup-console-body">
              <aside className="setup-step-rail"><span className="active"><i>01</i><b>Founder</b><small>Ancestry root</small></span><span><i>02</i><b>Deploy</b><small>Join world</small></span></aside>
              <div className="setup-form-scroll"><section className="setup-section join-lineage-setup">
                <header><span>01</span><div><strong>Choose your ancestral root</strong><small>You can fork or merge descendants after the campaign begins.</small></div></header>
                <label>Species designation<input required minLength={3} maxLength={32} value={species.speciesName} onChange={(event) => setSpecies({...species, speciesName: event.target.value})} placeholder="Tideglass" /></label>
                <SpeciesFields value={species} onChange={setSpecies} />
              </section></div>
            </div>
            <footer className="setup-submit-bar"><span><i /> Founder portrait verification follows deployment.</span><button className="primary-action" disabled={Boolean(busy)} type="submit">{busy === "join" ? "Deploying on Studionet…" : "Deploy founder"}<i>→</i></button></footer>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function SpeciesFields({value, onChange}: {value: JoinPlanetInput; onChange: (value: JoinPlanetInput) => void}) {
  return (
    <>
      <BodyPlanPicker value={value.bodyPlan} onChange={(bodyPlan) => onChange({...value, bodyPlan})} />
      <label>Founder phenotype<textarea required minLength={20} maxLength={280} value={value.founderDescription} onChange={(event) => onChange({...value, founderDescription: event.target.value})} placeholder="Describe the creature before natural selection begins…" /></label>
    </>
  );
}
