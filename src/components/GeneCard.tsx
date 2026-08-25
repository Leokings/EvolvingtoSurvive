import {geneDefinition} from "../catalog";

export default function GeneCard({
  gene,
  selected,
  disabled,
  onToggle,
}: {
  gene: string;
  selected: boolean;
  disabled: boolean;
  onToggle: (gene: string) => void;
}) {
  const definition = geneDefinition(gene);
  return (
    <button
      className={`gene-card ${selected ? "selected" : ""}`}
      type="button"
      disabled={disabled && !selected}
      aria-pressed={selected}
      onClick={() => onToggle(gene)}
    >
      <span className="gene-symbol" aria-hidden="true">{definition.symbol}</span>
      <span className="gene-copy">
        <strong>{definition.name}</strong>
        <small>{definition.summary}</small>
      </span>
      <span className="gene-affinities">
        {definition.affinities.map((affinity) => <i key={affinity}>{affinity}</i>)}
      </span>
    </button>
  );
}
