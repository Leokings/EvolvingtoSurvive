import {useMemo} from "react";

import {geneDefinition, label} from "../catalog";
import type {Species} from "../game-model";
import {buildLineageNodes, type AncestrySelection, type LineageNode} from "../lineage-tree";

type PositionedNode = {
  lineage: LineageNode;
  species: Species;
  x: number;
  y: number;
};

function isSelected(selection: AncestrySelection, node: PositionedNode): boolean {
  return selection.speciesId === node.species.speciesId
    && selection.nodeId === node.lineage.nodeId;
}

export default function EvolutionTree({
  species,
  viewerAddress,
  selection,
  evolvableSpeciesIds,
  currentEra,
  eraLimit,
  onSelect,
  onEvolve,
}: {
  species: Species[];
  viewerAddress: string;
  selection: AncestrySelection;
  evolvableSpeciesIds: Set<string>;
  currentEra: number;
  eraLimit: number;
  onSelect: (selection: AncestrySelection) => void;
  onEvolve: (speciesId: string) => void;
}) {
  const viewer = viewerAddress.toLowerCase();
  const graph = useMemo(() => {
    const eraGap = 142;
    const laneGap = 132;
    const startX = 185;
    const startY = 78;
    const width = Math.max(980, startX + (eraLimit + 1) * eraGap + 130);
    const height = Math.max(410, startY + Math.max(1, species.length - 1) * laneGap + 94);
    const positioned: PositionedNode[] = [];

    species.forEach((entry, lane) => {
      const current = entry.nodes.find((node) => node.nodeId === entry.currentNodeId);
      for (const lineage of buildLineageNodes(entry)) {
        const era = lineage.kind === "next"
          ? Math.min(eraLimit, Math.max(currentEra, (current?.era ?? 0) + 1))
          : lineage.node?.era ?? 0;
        positioned.push({
          lineage,
          species: entry,
          x: startX + era * eraGap,
          y: startY + lane * laneGap,
        });
      }
    });

    return {eraGap, startX, width, height, positioned};
  }, [currentEra, eraLimit, species]);
  const positionById = useMemo(() => new Map(
    graph.positioned
      .filter((entry) => entry.lineage.kind !== "next")
      .map((entry) => [entry.lineage.nodeId, entry]),
  ), [graph.positioned]);

  return (
    <section className="phylogeny-map" aria-labelledby="lineage-tree-title">
      <header className="phylogeny-toolbar">
        <div>
          <span className="hud-kicker">Live phylogeny</span>
          <h2 id="lineage-tree-title">Ancestral DNA map</h2>
        </div>
        <div className="map-legend" aria-label="Map legend">
          <span><i className="legend-owned" />your lineage</span>
          <span><i className="legend-merge" />DNA fusion</span>
          <span><i className="legend-open" />open evolution</span>
        </div>
      </header>

      <div className="phylogeny-viewport">
        <div className="phylogeny-canvas" style={{width: graph.width, height: graph.height}}>
          <div className="era-axis" aria-hidden="true">
            {Array.from({length: eraLimit + 1}, (_, era) => (
              <span key={era} className={era === currentEra ? "current" : ""} style={{left: graph.startX + era * graph.eraGap}}>
                <b>{era === 0 ? "ORIGIN" : `ERA ${era}`}</b><i />
              </span>
            ))}
          </div>

          {species.map((entry, lane) => (
            <div className={`species-lane-label ${entry.owner === viewer ? "owned" : "rival"} ${entry.alive ? "" : "retired"}`} key={entry.speciesId} style={{top: 60 + lane * 132}}>
              <span>{entry.portraitUrl ? <img src={entry.portraitUrl} alt="" /> : entry.name.slice(0, 1)}</span>
              <b>{entry.name}</b>
              <small>{entry.owner === viewer ? "YOUR DNA" : "RIVAL"}</small>
            </div>
          ))}

          <svg className="ancestry-wires" viewBox={`0 0 ${graph.width} ${graph.height}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <filter id="wire-glow"><feGaussianBlur stdDeviation="2.6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            {species.map((_, lane) => <line className="lane-wire" key={lane} x1={150} y1={78 + lane * 132} x2={graph.width - 50} y2={78 + lane * 132} />)}
            {graph.positioned.flatMap((entry) => entry.lineage.parentIds.map((parentId) => {
              const parent = positionById.get(parentId);
              if (!parent) return null;
              const merge = entry.lineage.parentIds.length === 2;
              const delta = Math.max(40, (entry.x - parent.x) * .52);
              return (
                <path
                  key={`${entry.lineage.graphId}-${parentId}`}
                  className={merge ? "merge-wire" : entry.lineage.kind === "next" ? "open-wire" : "bloodline-wire"}
                  d={`M ${parent.x + 34} ${parent.y} C ${parent.x + delta} ${parent.y}, ${entry.x - delta} ${entry.y}, ${entry.x - 34} ${entry.y}`}
                />
              );
            }))}
          </svg>

          {graph.positioned.map((entry) => {
            const {lineage, species: entrySpecies} = entry;
            const node = lineage.node;
            const blank = lineage.kind === "next";
            const actionable = blank && evolvableSpeciesIds.has(entrySpecies.speciesId);
            const selected = isSelected(selection, entry);
            const portraitUrl = node?.portrait.status === "accepted" ? node.portrait.url : "";
            const symbol = node?.genes[0] ? geneDefinition(node.genes[0]).symbol : entrySpecies.name.slice(0, 1);
            return (
              <button
                key={lineage.graphId}
                type="button"
                className={`phylogeny-node node-${lineage.kind} ${entrySpecies.owner === viewer ? "owned" : "rival"} ${selected ? "selected" : ""} ${actionable ? "actionable" : ""} ${entrySpecies.alive ? "" : "retired"}`}
                style={{left: entry.x, top: entry.y}}
                aria-pressed={selected}
                aria-label={blank ? `${entrySpecies.name}: blank descendant${actionable ? ", evolve now" : ""}` : `${entrySpecies.name}: ${node?.name}`}
                onClick={() => {
                  onSelect({speciesId: entrySpecies.speciesId, nodeId: lineage.nodeId});
                  if (actionable) onEvolve(entrySpecies.speciesId);
                }}
              >
                <span className="phylogeny-orb">
                  {portraitUrl ? <img src={portraitUrl} alt="" /> : blank ? <i><b>+</b></i> : <b>{symbol}</b>}
                  {node?.parentNodeIds.length === 2 ? <em aria-hidden="true">DNA×2</em> : null}
                </span>
                <span className="phylogeny-label">
                  <strong>{blank ? "UNWRITTEN" : node?.kind === "founder" ? entrySpecies.name : node?.name}</strong>
                  <small>{blank ? actionable ? "EVOLVE" : "LOCKED" : node?.kind === "founder" ? label(entrySpecies.bodyPlan) : `${label(node?.kind ?? "adapt")} · E${node?.era}`}</small>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <footer className="phylogeny-status"><span><i />Click a filled node to inspect recorded biology.</span><span>A pulsing hollow node is the next writable descendant.</span></footer>
    </section>
  );
}
