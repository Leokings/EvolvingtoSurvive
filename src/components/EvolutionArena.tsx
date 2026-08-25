import {useCallback, useEffect, useMemo, useState} from "react";

import type {ActionDraft, RevealSecret} from "../commit-reveal";
import {geneDefinition, label} from "../catalog";
import {currentNode, type ActionKind, type Hazard, type PlanetState, type Species} from "../game-model";
import type {AncestrySelection} from "../lineage-tree";
import {deriveNextDirective} from "../next-directive";
import {derivePhaseState, formatPhaseTime} from "../turn-state";
import AncestryDossier from "./AncestryDossier";
import BrandMark from "./BrandMark";
import ContextDrawer from "./ContextDrawer";
import EraRecap from "./EraRecap";
import EvolutionTree from "./EvolutionTree";
import GeneCard from "./GeneCard";
import TurnDirector from "./TurnDirector";

function hazardForecast(species: Species | null, hazard: Hazard | null) {
  if (!species || !hazard) return null;
  const value = species.stats[hazard.adaptationClass];
  const deficit = Math.max(0, hazard.threshold - value);
  const populationLoss = deficit === 0 ? 0 : deficit === 1 ? 2 : deficit === 2 ? 4 : 6;
  return {
    value,
    deficit,
    populationLoss,
    status: deficit === 0 ? "adapted" : deficit === 1 ? "strained" : "exposed",
  };
}

function actionTitle(kind: ActionKind): string {
  return {
    adapt: "Adapt",
    conserve: "Conserve",
    split: "Fork species",
    merge: "Fuse DNA",
  }[kind];
}

function actionGlyph(kind: ActionKind): string {
  return {adapt: "△", conserve: "◌", split: "⑂", merge: "◇"}[kind];
}

function shortAddress(address: string): string {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Observer";
}

type ContextPanel = "turn" | "dossier" | "lab" | "hazard" | "ecosystem";

export default function EvolutionArena({
  planet,
  address,
  secrets,
  busy,
  demo,
  lastSyncedAt,
  onCommit,
  onLock,
  onReveal,
  onAdvance,
  onCopyBackup,
  onRestoreBackup,
  onConcede,
  onEndRun,
  onGeneratePortrait,
  onRefresh,
  onHome,
  onHowToPlay,
}: {
  planet: PlanetState;
  address: string;
  secrets: Record<number, RevealSecret>;
  busy: string;
  demo: boolean;
  lastSyncedAt: number;
  onCommit: (draft: ActionDraft) => Promise<boolean>;
  onLock: () => void;
  onReveal: (slot: number) => void;
  onAdvance: () => void;
  onCopyBackup: (slot: number) => void;
  onRestoreBackup: (backup: string) => Promise<boolean>;
  onConcede: (speciesId: string) => Promise<boolean>;
  onEndRun: (speciesIds: string[]) => Promise<boolean>;
  onGeneratePortrait: (speciesId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onHome: () => void;
  onHowToPlay: () => void;
}) {
  const viewer = address.toLowerCase();
  const firstOwned = planet.yourSpecies.find((species) => species.alive) ?? planet.yourSpecies[0];
  const firstVisible = firstOwned ?? planet.species[0];
  const [selection, setSelection] = useState<AncestrySelection>(() => ({
    speciesId: firstVisible?.speciesId ?? "",
    nodeId: firstVisible?.currentNodeId ?? "next",
  }));
  const [primarySpeciesId, setPrimarySpeciesId] = useState(firstOwned?.speciesId ?? "");
  const [secondarySpeciesId, setSecondarySpeciesId] = useState("");
  const [kind, setKind] = useState<ActionKind>("adapt");
  const [firstGene, setFirstGene] = useState("");
  const [secondGene, setSecondGene] = useState("");
  const [proposal, setProposal] = useState("");
  const [childName, setChildName] = useState("");
  const [confirmConcede, setConfirmConcede] = useState("");
  const [endRunOpen, setEndRunOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<ContextPanel | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1_000));

  const phaseState = derivePhaseState(planet, address, now);
  const usedSpeciesIds = useMemo(() => {
    const used = new Set<string>();
    for (const secret of Object.values(secrets)) {
      used.add(secret.payload.species_id);
      if (secret.payload.secondary_species_id) used.add(secret.payload.secondary_species_id);
    }
    return used;
  }, [secrets]);
  const evolvableSpeciesIds = useMemo(() => new Set(
    planet.yourSpecies
      .filter((species) => (
        phaseState.canCommit
        && species.alive
        && currentNode(species)?.portrait.status === "accepted"
        && !usedSpeciesIds.has(species.speciesId)
      ))
      .map((species) => species.speciesId),
  ), [phaseState.canCommit, planet.yourSpecies, usedSpeciesIds]);
  const selectedSpecies = planet.species.find(
    (species) => species.speciesId === selection.speciesId,
  ) ?? firstVisible ?? null;
  const primary = planet.yourSpecies.find((species) => species.speciesId === primarySpeciesId) ?? firstOwned ?? null;
  const secondary = planet.yourSpecies.find((species) => species.speciesId === secondarySpeciesId) ?? null;
  const forecast = hazardForecast(selectedSpecies, planet.hazard);
  const livingOwned = planet.yourSpecies.filter((species) => species.alive);
  const rivalSpecies = planet.species.filter((species) => species.owner !== viewer && species.alive);
  const pendingPortraits = planet.yourSpecies.filter((species) => {
    const node = currentNode(species);
    return species.alive && node && ["pending", "rejected"].includes(node.portrait.status);
  });
  const nextEvolvableSpecies = planet.yourSpecies.find((species) => evolvableSpeciesIds.has(species.speciesId)) ?? null;
  const nextDirective = deriveNextDirective({
    planet,
    state: phaseState,
    secrets,
    pendingPortrait: pendingPortraits[0] ?? null,
    nextEvolvableSpecies,
  });
  const availableKinds = {
    adapt: phaseState.remainingEnergy >= 1,
    conserve: phaseState.remainingEnergy >= 1,
    split: phaseState.remainingEnergy >= 1 && livingOwned.length < planet.maxSpeciesPerWallet,
    merge: phaseState.remainingEnergy >= 2 && livingOwned.length >= 2,
  };

  useEffect(() => {
    const timer = globalThis.setInterval(() => setNow(Math.floor(Date.now() / 1_000)), 1_000);
    return () => globalThis.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!demo && phaseState.expired) void onRefresh();
  }, [demo, onRefresh, phaseState.expired, planet.phase, planet.phaseDeadline]);

  useEffect(() => {
    if (demo) return;
    const syncVisibleGame = () => {
      if (globalThis.document.visibilityState === "visible") void onRefresh();
    };
    globalThis.addEventListener("focus", syncVisibleGame);
    globalThis.document.addEventListener("visibilitychange", syncVisibleGame);
    return () => {
      globalThis.removeEventListener("focus", syncVisibleGame);
      globalThis.document.removeEventListener("visibilitychange", syncVisibleGame);
    };
  }, [demo, onRefresh]);

  useEffect(() => {
    if (!planet.species.some((species) => species.speciesId === selection.speciesId)) {
      const fallback = planet.yourSpecies.find((species) => species.alive) ?? planet.species[0];
      setSelection({speciesId: fallback?.speciesId ?? "", nodeId: fallback?.currentNodeId ?? "next"});
    }
  }, [planet.species, planet.yourSpecies, selection.speciesId]);

  useEffect(() => {
    setFirstGene("");
    setSecondGene("");
    setSecondarySpeciesId("");
  }, [kind, primarySpeciesId]);

  useEffect(() => {
    if (globalThis.innerWidth > 860 || !selection.speciesId) return;
    const frame = globalThis.requestAnimationFrame(() => {
      globalThis.document.getElementById(`roster-species-${selection.speciesId}`)?.scrollIntoView({
        block: "nearest",
        inline: "center",
      });
    });
    return () => globalThis.cancelAnimationFrame(frame);
  }, [selection.speciesId]);

  function openActionLab(speciesId: string) {
    setPrimarySpeciesId(speciesId);
    setSelection({speciesId, nodeId: "next"});
    setActivePanel("lab");
  }

  function selectSpecies(species: Species) {
    setSelection({speciesId: species.speciesId, nodeId: species.currentNodeId});
    if (species.owner === viewer && species.alive) setPrimarySpeciesId(species.speciesId);
    setActivePanel("dossier");
  }

  function selectTreeNode(nextSelection: AncestrySelection) {
    setSelection(nextSelection);
    if (nextSelection.nodeId !== "next") setActivePanel("dossier");
  }

  const closeContextPanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  function followNextDirective() {
    if (nextDirective.target === "evolution" && nextDirective.speciesId) {
      openActionLab(nextDirective.speciesId);
      return;
    }
    if (nextDirective.target === "portrait" && nextDirective.speciesId) {
      const portraitSpecies = planet.yourSpecies.find((species) => species.speciesId === nextDirective.speciesId);
      if (portraitSpecies) {
        setSelection({speciesId: portraitSpecies.speciesId, nodeId: portraitSpecies.currentNodeId});
      }
      globalThis.requestAnimationFrame(() => {
        const control = globalThis.document.getElementById(`portrait-control-${nextDirective.speciesId}`);
        control?.scrollIntoView({behavior: "smooth", block: "center"});
        control?.focus();
      });
      return;
    }
    setActivePanel("turn");
  }

  function toggleSharedGene(gene: string) {
    if (gene === firstGene) setFirstGene("");
    else if (gene === secondGene) setSecondGene("");
    else if (!firstGene) setFirstGene(gene);
    else if (!secondGene) setSecondGene(gene);
    else {
      setFirstGene(secondGene);
      setSecondGene(gene);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!primary || !phaseState.canCommit) return;
    const succeeded = await onCommit({
      kind,
      speciesId: primary.speciesId,
      secondarySpeciesId: kind === "merge" ? secondary?.speciesId : "",
      firstGene: kind === "conserve" ? "" : firstGene,
      secondGene: kind === "conserve" ? "" : secondGene,
      proposal: kind === "conserve" ? "" : proposal,
      childName: kind === "split" || kind === "merge" ? childName : "",
    });
    if (succeeded) {
      setFirstGene("");
      setSecondGene("");
      setProposal("");
      setChildName("");
      setActivePanel("turn");
    }
  }

  async function retireSelectedSpecies() {
    if (!confirmConcede) return;
    if (await onConcede(confirmConcede)) setConfirmConcede("");
  }

  async function confirmEndRun() {
    const succeeded = await onEndRun(livingOwned.map((species) => species.speciesId));
    if (succeeded) setEndRunOpen(false);
  }

  const proposalLength = proposal.trim().split(/\s+/).filter(Boolean).join(" ").length;
  const primaryCanonical = currentNode(primary)?.portrait.status === "accepted";
  const secondaryCanonical = currentNode(secondary)?.portrait.status === "accepted";
  const actionReady = Boolean(primary)
    && !usedSpeciesIds.has(primary?.speciesId ?? "")
    && (kind === "conserve" || Boolean(
      firstGene
      && secondGene
      && firstGene !== secondGene
      && proposalLength >= 20
      && primaryCanonical
      && (kind !== "split" || (primary?.population ?? 0) >= 8)
      && (kind === "adapt" || (
        childName.trim().length >= 3
        && (kind !== "merge" || (
          secondary
          && secondaryCanonical
          && !usedSpeciesIds.has(secondary.speciesId)
        ))
      )),
    ));
  const lockedMessage = planet.phase === "reveal"
    ? "Reveal is underway. New evolution opens after the era resolves."
    : phaseState.locked
      ? "Your ecosystem plan is locked for this era."
      : phaseState.expired
        ? "This phase expired. Open Turn in the command dock to advance."
        : "This species already has a sealed action this era.";
  const mutationDeckTitle = phaseState.canCommit
    ? "Program your next descendant"
    : phaseState.expired
      ? "Mutation controls suspended"
      : planet.phase === "reveal"
        ? "DNA reveal in progress"
        : phaseState.locked
          ? "Plan locked"
          : "Energy spent — lock your plan";
  const lockdownObjective = phaseState.expired
    ? planet.phase === "commit" ? "Advance to reveal" : "Resolve this era"
    : planet.phase === "reveal"
      ? phaseState.unrevealedActions.length ? "Reveal your encrypted actions" : "Wait for remaining ecosystems"
      : phaseState.locked ? "Your plan is locked" : "Lock your plan to finish";

  return (
    <main className={`game-cockpit biome-${planet.biome}`} id="top">
      <div className="biome-backdrop" aria-hidden="true"><i className="world-horizon" /><i className="atmosphere" /><i className="scan-grid" /><span className="particle p1" /><span className="particle p2" /><span className="particle p3" /></div>

      <header className="hud-topbar">
        <a className="cockpit-brand" href="?view=home" aria-label="Go to EvolvingtoSurvive home" onClick={(event) => { event.preventDefault(); onHome(); }}><BrandMark small /><span><b>EVOLVING</b><small>TO SURVIVE</small></span></a>
        <div className="planet-hud-identity"><span className={`micro-planet ${planet.biome}`}><i /></span><div><small>{planet.biomeName} · {planet.planetId}</small><strong>{planet.name}</strong></div></div>
        <div className="campaign-meter">
          <span><small>Natural selection campaign</small><b>ERA {planet.era} / {planet.eraLimit}</b></span>
          <div>{Array.from({length: planet.eraLimit}, (_, index) => <i key={index} className={index + 1 < planet.era ? "survived" : index + 1 === planet.era ? "current" : "future"}><b>{index + 1}</b></i>)}</div>
        </div>
        {demo ? <nav className="hud-scenario-switcher" aria-label="Preview phase"><a className={planet.phase === "commit" && !phaseState.locked && phaseState.yourActions.length === 0 ? "active" : ""} href="?demo=1&phase=plan">PLAN</a><a className={planet.phase === "commit" && !phaseState.locked && phaseState.yourActions.length > 0 ? "active" : ""} href="?demo=1&phase=sealed">SEALED</a><a className={phaseState.locked && planet.phase === "commit" && !phaseState.expired ? "active" : ""} href="?demo=1&phase=locked">LOCK</a><a className={planet.phase === "reveal" && !phaseState.expired ? "active" : ""} href="?demo=1&phase=reveal">REVEAL</a><a className={phaseState.expired ? "active" : ""} href="?demo=1&phase=expired">EXPIRED</a></nav> : null}
        <div className="hud-player-controls">
          <button className="hud-nav-command" type="button" onClick={onHome} aria-label="Go to campaign home"><i>⌂</i><span>HOME</span></button>
          <button className="hud-nav-command" type="button" onClick={onHowToPlay} aria-label="Open How to Play"><i>?</i><span>HOW TO PLAY</span></button>
          <div className="commander-chip"><span><i />STUDIONET</span><b>{shortAddress(address)}</b></div>
        </div>
      </header>

      <section className={`next-directive directive-${nextDirective.tone}`} aria-live="polite" aria-label="What to do next">
        <span className="directive-signal" aria-hidden="true"><i /><b>›</b></span>
        <div className="directive-copy"><small>{nextDirective.eyebrow}</small><strong>{nextDirective.title}</strong></div>
        <p>{nextDirective.location}</p>
        <button type="button" onClick={followNextDirective}>{nextDirective.actionLabel}<span>›</span></button>
      </section>

      <aside className="ecosystem-rail hud-panel">
        <header><div><span className="hud-kicker">Your ecosystem</span><h2>Your species</h2></div><strong>{livingOwned.length}<small> / {planet.maxSpeciesPerWallet}</small></strong></header>
        <div className="species-slots">
          {planet.yourSpecies.map((species, index) => {
            const node = currentNode(species);
            const selected = selection.speciesId === species.speciesId;
            const portraitNeedsWork = node && node.portrait.status !== "accepted";
            return (
              <article id={`roster-species-${species.speciesId}`} key={species.speciesId} className={`roster-species ${selected ? "selected" : ""} ${species.alive ? "living" : "retired"}`}>
                <button type="button" className="roster-select" onClick={() => selectSpecies(species)} aria-pressed={selected}>
                  <span className="roster-index">0{index + 1}</span>
                  <span className="roster-portrait">{species.portraitUrl ? <img src={species.portraitUrl} alt="" /> : species.name.slice(0, 1)}<i /></span>
                  <span className="roster-copy"><strong>{species.name}</strong><small>{species.alive ? `${label(species.originKind)} · ${species.population}m` : `ARCHIVED · ${label(species.retiredReason)}`}</small><i><b style={{width: `${Math.min(100, species.population * 7)}%`}} /></i></span>
                </button>
                {species.alive && evolvableSpeciesIds.has(species.speciesId) ? <button className="roster-evolve" type="button" onClick={() => openActionLab(species.speciesId)}>EVOLVE <span>+</span></button> : null}
                {species.alive && portraitNeedsWork ? <button id={`portrait-control-${species.speciesId}`} className="roster-portrait-command" type="button" disabled={Boolean(busy)} onClick={() => void onGeneratePortrait(species.speciesId)}>{busy === `portrait-${species.speciesId}` ? "VERIFYING…" : node.portrait.status === "rejected" ? "RETRY PORTRAIT" : "CREATE PORTRAIT"}</button> : null}
              </article>
            );
          })}
          {Array.from({length: Math.max(0, planet.maxSpeciesPerWallet - livingOwned.length)}, (_, index) => <div className="empty-species-slot" key={index}><span>+</span><div><b>OPEN SPECIES SLOT</b><small>Create with fork or DNA fusion</small></div></div>)}
        </div>
        <button className="ecosystem-menu-command" type="button" onClick={() => setActivePanel("ecosystem")}><span>ECOSYSTEM MENU</span><small>Rivals · capacity · retire species</small><b>›</b></button>
      </aside>

      <section className="ancestry-theater">
        <nav className="context-dock" aria-label="Game panels">
          <button type="button" onClick={() => setActivePanel("turn")}><i className={phaseState.canAdvance ? "urgent" : "live"}>⌁</i><span><b>TURN</b><small>{phaseState.canAdvance ? "ADVANCE READY" : formatPhaseTime(phaseState.timeLeft)}</small></span></button>
          <button type="button" disabled={!planet.hazard} onClick={() => setActivePanel("hazard")}><i className="hazard">!</i><span><b>EVENT</b><small>{planet.hazard?.name ?? "NO EVENT"}</small></span></button>
          <button type="button" disabled={!selectedSpecies} onClick={() => setActivePanel("dossier")}><i>◉</i><span><b>SPECIES</b><small>{selectedSpecies?.name ?? "NONE SELECTED"}</small></span></button>
          <button type="button" onClick={() => setActivePanel("ecosystem")}><i>⌬</i><span><b>ECOSYSTEM</b><small>{livingOwned.length}/{planet.maxSpeciesPerWallet} LIVING</small></span></button>
        </nav>
        <EvolutionTree species={planet.species} viewerAddress={address} selection={selection} evolvableSpeciesIds={evolvableSpeciesIds} currentEra={planet.era} eraLimit={planet.eraLimit} onSelect={selectTreeNode} onEvolve={openActionLab} />
      </section>

      <footer className="hud-event-ticker"><span className="live-pulse"><i />LIVE</span><small>LATEST BIOSPHERE EVENT</small><strong>{planet.lastEvent}</strong>{pendingPortraits.length ? <span className="portrait-warning">⚠ {pendingPortraits.length} PORTRAIT{pendingPortraits.length === 1 ? "" : "S"} REQUIRED</span> : null}<span className="free-for-all">SIMULTANEOUS · {planet.playerCount} ECOSYSTEMS</span></footer>

      {activePanel === "turn" ? (
        <ContextDrawer eyebrow="Era command panel" title="Turn controls" onClose={closeContextPanel}>
          <TurnDirector planet={planet} address={address} state={phaseState} secrets={secrets} busy={busy} pendingPortrait={pendingPortraits[0] ?? null} nextEvolvableSpecies={nextEvolvableSpecies} lastSyncedAt={lastSyncedAt} onLock={onLock} onReveal={onReveal} onAdvance={onAdvance} onCopyBackup={onCopyBackup} onRestoreBackup={onRestoreBackup} onGeneratePortrait={onGeneratePortrait} onEvolveSpecies={openActionLab} onRefresh={() => void onRefresh()} />
        </ContextDrawer>
      ) : null}

      {activePanel === "dossier" && selectedSpecies ? (
        <ContextDrawer eyebrow="Recorded biology" title={selectedSpecies.name} onClose={closeContextPanel}>
          <AncestryDossier species={selectedSpecies} selection={selection} isYou={selectedSpecies.owner === viewer} canEvolve={evolvableSpeciesIds.has(selectedSpecies.speciesId)} lockedMessage={lockedMessage} onEvolve={openActionLab} />
        </ContextDrawer>
      ) : null}

      {activePanel === "hazard" && planet.hazard && forecast ? (
        <ContextDrawer eyebrow={`Era ${planet.era} extinction event`} title={planet.hazard.name} onClose={closeContextPanel}>
          <section className={`hazard-report ${forecast.status}`}>
            <div className="hazard-report-intro"><span>!</span><p>{planet.hazard.description}</p></div>
            <dl><div><dt>Survival trait</dt><dd>{label(planet.hazard.adaptationClass)}</dd></div><div><dt>Threshold</dt><dd>{planet.hazard.threshold}</dd></div><div><dt>{selectedSpecies?.name ?? "Selected species"}</dt><dd>{forecast.value} / {planet.hazard.threshold}</dd></div><div><dt>Forecast</dt><dd>{forecast.populationLoss === 0 ? "Survival likely" : `Projected −${forecast.populationLoss}m`}</dd></div></dl>
            <div className="hazard-report-meter"><i style={{width: `${Math.min(100, forecast.value / planet.hazard.threshold * 100)}%`}} /></div>
            <p className="hazard-report-help">Select another filled lineage node or species card to compare its survival forecast.</p>
          </section>
        </ContextDrawer>
      ) : null}

      {activePanel === "ecosystem" ? (
        <ContextDrawer eyebrow="Wallet biosphere" title="Ecosystem controls" onClose={closeContextPanel}>
          <section className="ecosystem-context-panel">
            <div className="species-capacity"><span><small>Living capacity</small><b>{livingOwned.length} / {planet.maxSpeciesPerWallet}</b></span><i><b style={{width: `${livingOwned.length / planet.maxSpeciesPerWallet * 100}%`}} /></i></div>
            <section className="rival-radar">
              <header><span>Rival biosignatures</span><b>{rivalSpecies.length}</b></header>
              {rivalSpecies.map((species) => <button type="button" key={species.speciesId} className={selection.speciesId === species.speciesId ? "selected" : ""} onClick={() => selectSpecies(species)}><i>{species.portraitUrl ? <img src={species.portraitUrl} alt="" /> : species.name.slice(0, 1)}</i><span><b>{species.name}</b><small>{species.population}m · {species.legacy} legacy</small></span><em>INSPECT</em></button>)}
            </section>
            <div className="concede-zone">
              <button className="end-run-command" type="button" disabled={!livingOwned.length || Boolean(busy)} onClick={() => setEndRunOpen(true)}><strong>END MY RUN</strong><small>Retire all {livingOwned.length} living species</small></button>
              {!confirmConcede ? <button className="retire-species-command" type="button" disabled={!primary?.alive || Boolean(busy)} onClick={() => setConfirmConcede(primary?.speciesId ?? "")}>Retire selected species only</button> : <div role="alert"><p>Retire {planet.species.find((species) => species.speciesId === confirmConcede)?.name}? Your other species remain in play.</p><span><button type="button" onClick={() => setConfirmConcede("")}>Cancel</button><button type="button" disabled={Boolean(busy)} onClick={() => void retireSelectedSpecies()}>Confirm retirement</button></span></div>}
            </div>
          </section>
        </ContextDrawer>
      ) : null}

      {activePanel === "lab" ? (
        <ContextDrawer eyebrow="Ancestral DNA editor" title="Evolution lab" wide onClose={closeContextPanel}>
          <section className={`mutation-deck ${phaseState.canCommit ? "online" : "offline"}`} id="mutation-lab">
            <header className="mutation-deck-header">
              <div><span className="hud-kicker">Mutation command deck</span><h2>{mutationDeckTitle}</h2></div>
              <div className="mutation-deck-tools"><span className="deck-energy">ENERGY {Array.from({length: planet.evolutionEnergyPerEra}, (_, index) => <i key={index} className={index < phaseState.remainingEnergy ? "charged" : "spent"} />)}</span></div>
            </header>

            {phaseState.canCommit ? (
              <form onSubmit={submit} className="mutation-console-form">
                <fieldset className="action-protocols" disabled={Boolean(busy)}>
                  <legend>EVOLUTION PROTOCOL</legend>
                  {(["adapt", "conserve", "split", "merge"] as ActionKind[]).map((actionKind) => <button key={actionKind} type="button" className={kind === actionKind ? "selected" : ""} disabled={!availableKinds[actionKind]} onClick={() => setKind(actionKind)}><i>{actionGlyph(actionKind)}</i><span><b>{actionTitle(actionKind)}</b><small>{actionKind === "merge" ? "2 ENERGY · 2→1" : actionKind === "split" ? "1 ENERGY · 1→2" : actionKind === "conserve" ? "1 ENERGY · DRAW" : "1 ENERGY · +TRAIT"}</small></span></button>)}
                </fieldset>

                <fieldset className="dna-sources" disabled={Boolean(busy)}>
                  <legend>{kind === "merge" ? "DNA SOURCES" : "ACTIVE SPECIES"}</legend>
                  <label><span>PRIMARY</span><select value={primary?.speciesId ?? ""} onChange={(event) => setPrimarySpeciesId(event.target.value)}>{livingOwned.map((species) => <option key={species.speciesId} value={species.speciesId} disabled={usedSpeciesIds.has(species.speciesId)}>{species.name}{usedSpeciesIds.has(species.speciesId) ? " · used" : ""}</option>)}</select></label>
                  {kind === "merge" ? <label><span>SECONDARY</span><select required value={secondarySpeciesId} onChange={(event) => setSecondarySpeciesId(event.target.value)}><option value="">Choose DNA parent</option>{livingOwned.filter((species) => species.speciesId !== primary?.speciesId).map((species) => <option key={species.speciesId} value={species.speciesId} disabled={usedSpeciesIds.has(species.speciesId)}>{species.name}</option>)}</select></label> : null}
                  <div className="source-vitals"><span><small>POP</small><b>{primary?.population ?? 0}m</b></span><span><small>GENES</small><b>{primary?.genes.length ?? 0}</b></span><span><small>PORTRAIT</small><b>{primaryCanonical ? "READY" : "NEEDED"}</b></span></div>
                </fieldset>

                {kind !== "conserve" && primary ? (
                  <fieldset className="gene-bank" disabled={Boolean(busy)}>
                    <legend>SELECT 2 GENES <b>{firstGene && secondGene ? "DNA PAIR READY" : `${[firstGene, secondGene].filter(Boolean).length}/2`}</b></legend>
                    {kind === "merge" ? <div className="merge-gene-banks"><section><h3>{primary.name}</h3><div>{Array.from(new Set(primary.genes)).map((gene) => <GeneCard key={gene} gene={gene} selected={firstGene === gene} disabled={false} onToggle={() => setFirstGene(firstGene === gene ? "" : gene)} />)}</div></section><section><h3>{secondary?.name ?? "SELECT SECOND PARENT"}</h3><div>{Array.from(new Set(secondary?.genes ?? [])).map((gene) => <GeneCard key={gene} gene={gene} selected={secondGene === gene} disabled={false} onToggle={() => setSecondGene(secondGene === gene ? "" : gene)} />)}</div></section></div> : <div className="deck-gene-scroll">{Array.from(new Set(primary.genes)).map((gene) => <GeneCard key={gene} gene={gene} selected={firstGene === gene || secondGene === gene} disabled={false} onToggle={toggleSharedGene} />)}</div>}
                  </fieldset>
                ) : <div className="conserve-protocol"><i>◌</i><span><b>DORMANT STRATEGY</b><p>{primary?.name} gains one deterministic gene draw, makes no immediate trait change, and still faces the era hazard.</p></span></div>}

                {kind !== "conserve" ? (
                  <fieldset className="mutation-brief" disabled={Boolean(busy)}>
                    <legend>HERITABLE BIOLOGY <b>{proposalLength}/20 MIN</b></legend>
                    {kind === "split" || kind === "merge" ? <label><span>NEW SPECIES DESIGNATION</span><input required minLength={3} maxLength={32} value={childName} onChange={(event) => setChildName(event.target.value)} placeholder={kind === "merge" ? "Tidecinder" : "Cindercrest"} /></label> : null}
                    <label><span>EVOLUTION DIRECTIVE</span><textarea value={proposal} onChange={(event) => setProposal(event.target.value)} minLength={20} maxLength={500} placeholder={`Explain how ${firstGene ? geneDefinition(firstGene).name.toLowerCase() : "gene one"} and ${secondGene ? geneDefinition(secondGene).name.toLowerCase() : "gene two"} form a survival trait…`} /></label>
                  </fieldset>
                ) : null}

                <div className="seal-command-zone"><span><i />A private salt is stored locally before your wallet opens.<small>Keep the reveal backup secret until the reveal phase.</small></span><button type="submit" disabled={Boolean(busy) || !actionReady}>{busy === "commit" ? "SEALING DNA…" : `SEAL ${actionTitle(kind).toUpperCase()}`}<i>›</i></button></div>
              </form>
            ) : (
              <div className="deck-lockdown">
                <div className="lockdown-visual"><i /><b>{phaseState.expired ? "!" : planet.phase === "reveal" ? "⌁" : "✓"}</b></div>
                <span><small>CURRENT OBJECTIVE</small><h3>{lockdownObjective}</h3><p>Close this panel, then open Turn in the command dock for the next available action.</p></span>
                <div className="lockdown-actions">{phaseState.yourActions.map((action) => <span key={action.slot}><i>{action.slot + 1}</i><b>{action.revealed ? action.kind ?? "REVEALED" : "ENCRYPTED ACTION"}</b><small>{action.cost} energy</small></span>)}</div>
              </div>
            )}
          </section>
        </ContextDrawer>
      ) : null}
      {endRunOpen ? (
        <div className="modal-backdrop end-run-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && setEndRunOpen(false)}>
          <section className="end-run-dialog" role="dialog" aria-modal="true" aria-labelledby="end-run-title" aria-describedby="end-run-description">
            <header><span>!</span><div><small>IRREVERSIBLE ONCHAIN EXIT</small><h2 id="end-run-title">End your run on {planet.name}?</h2></div></header>
            <p id="end-run-description">This retires every living species controlled by your wallet. Going Home does not do this—you can safely leave the cockpit instead.</p>
            <div className="end-run-species-list">
              {livingOwned.map((species, index) => <span key={species.speciesId}><i>{index + 1}</i><b>{species.name}</b><small>{species.population}m population</small></span>)}
            </div>
            <div className="end-run-warning"><strong>{livingOwned.length} wallet approval{livingOwned.length === 1 ? "" : "s"} required</strong><p>The contract retires one species per transaction. If you stop midway, already-approved retirements remain permanent.</p></div>
            <footer><button type="button" disabled={Boolean(busy)} onClick={() => setEndRunOpen(false)}>Keep playing</button><button className="confirm-end-run" type="button" disabled={Boolean(busy)} onClick={() => void confirmEndRun()}>{busy === "end-run" ? "COMPLETE THE WALLET APPROVALS…" : `END MY RUN · ${livingOwned.length} APPROVAL${livingOwned.length === 1 ? "" : "S"}`}</button></footer>
          </section>
        </div>
      ) : null}
      <EraRecap key={`${planet.planetId}:${planet.era}`} planet={planet} viewerAddress={address} enabled={!demo || new URLSearchParams(globalThis.location.search).get("recap") === "1"} />
      {demo ? <span className="cockpit-demo-stamp">INTERACTIVE V2 SIMULATION</span> : null}
    </main>
  );
}
