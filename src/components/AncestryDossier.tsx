import {geneDefinition, label} from "../catalog";
import type {Species} from "../game-model";
import type {AncestrySelection} from "../lineage-tree";
import {CreatureSilhouette} from "./SpeciesPanel";

export default function AncestryDossier({
  species,
  selection,
  isYou,
  canEvolve,
  lockedMessage,
  onEvolve,
}: {
  species: Species;
  selection: AncestrySelection;
  isYou: boolean;
  canEvolve: boolean;
  lockedMessage: string;
  onEvolve: (speciesId: string) => void;
}) {
  const node = species.nodes.find((entry) => entry.nodeId === selection.nodeId) ?? null;
  const isNext = selection.nodeId === "next";
  const portraitUrl = node?.portrait.status === "accepted" ? node.portrait.url : "";
  const strongestStats = Object.entries(species.stats).sort((left, right) => right[1] - left[1]).slice(0, 3);

  if (isNext) {
    return (
      <article className={`specimen-codex blank-codex ${canEvolve ? "actionable" : ""}`}>
        <header><span className="hud-kicker">Unwritten descendant</span><b>{species.name}</b></header>
        <div className="codex-portrait blank-phenotype" aria-hidden="true"><i><b>?</b></i><span>NO PHENOTYPE</span></div>
        <div className="blank-readout">
          <h3>Evolution slot open</h3>
          <p>{isYou
            ? canEvolve
              ? "This living tip can adapt, fork into a new species, or fuse with another lineage."
              : lockedMessage
            : "Only the controlling ecosystem can write this branch."}</p>
        </div>
        <div className="codex-vitals"><span><small>Population</small><b>{species.population}m</b></span><span><small>Gene pool</small><b>{species.genes.length}</b></span><span><small>Origin</small><b>{label(species.originKind)}</b></span></div>
        {isYou && canEvolve ? <button className="codex-evolve-command" type="button" onClick={() => onEvolve(species.speciesId)}>Enter mutation lab <span>›</span></button> : null}
      </article>
    );
  }

  if (!node) return null;
  return (
    <article className="specimen-codex finalized-codex">
      <header><span className="hud-kicker">Specimen archive</span><b>{node.kind === "founder" ? "ORIGIN RECORD" : `ERA ${node.era} · ${label(node.kind)}`}</b></header>
      <div className="codex-portrait">
        {portraitUrl ? <img src={portraitUrl} alt={`${species.name}: ${node.name}`} /> : <CreatureSilhouette species={species} />}
        <span><i />{node.portrait.status === "accepted" ? "GENLAYER VERIFIED" : `PORTRAIT ${label(node.portrait.status)}`}</span>
      </div>
      <div className="codex-title">
        <small>{species.name} lineage</small>
        <h3>{node.kind === "founder" ? `${species.name} founder` : node.name}</h3>
        <p>{node.phenotypeSummary}</p>
      </div>

      {node.kind !== "founder" ? (
        <>
          <section className="dna-readout">
            <h4>Expressed DNA</h4>
            <div>{node.genes.map((gene) => {
              const definition = geneDefinition(gene);
              return <span key={gene}><i>{definition.symbol}</i><b>{definition.name}</b><small>{definition.affinities.map(label).join(" / ")}</small></span>;
            })}</div>
          </section>
          <section className="evolution-log">
            <h4>How it evolved</h4>
            <p>“{node.proposal}”</p>
            <div><span><small>Selected trait</small><b>{label(node.adaptationClass || "none")}</b></span><span><small>DNA parents</small><b>{node.parentNodeIds.length}</b></span></div>
          </section>
          {node.parentNodeIds.length ? <section className="parent-signatures"><h4>Parent signatures</h4>{node.parentNodeIds.map((parentId, index) => <span key={parentId}><i>{index + 1}</i><code>{parentId}</code></span>)}</section> : null}
          {node.visualTraits.length ? <section className="trait-tags"><h4>Visible phenotype</h4><div>{node.visualTraits.map((trait) => <span key={trait}>{trait}</span>)}</div></section> : null}
        </>
      ) : (
        <section className="evolution-log founder-log"><h4>Founder genome</h4><p>{species.founderDescription}</p></section>
      )}

      <div className="codex-stats">
        {strongestStats.map(([stat, value]) => <span key={stat}><small>{label(stat)}</small><i><b style={{width: `${value * 10}%`}} /></i><strong>{value}</strong></span>)}
      </div>
    </article>
  );
}
