import {ADAPTATION_CLASSES, currentNode, type Species} from "../game-model";
import {label} from "../catalog";

export function CreatureSilhouette({species}: {species: Species}) {
  const variant = species.bodyPlan || "bilateral";
  return (
    <div className={`creature-silhouette ${variant}`} aria-hidden="true">
      <span className="creature-core" />
      <i className="limb limb-one" />
      <i className="limb limb-two" />
      <i className="limb limb-three" />
      <i className="limb limb-four" />
      <b className="creature-eye" />
      <em className="creature-ridge" />
    </div>
  );
}

export default function SpeciesPanel({
  species,
  isYou,
  isActive = false,
}: {
  species: Species;
  isYou: boolean;
  isActive?: boolean;
}) {
  const populationPercent = Math.max(0, Math.min(100, species.population / 12 * 100));
  const strongest = ADAPTATION_CLASSES.reduce((best, current) =>
    species.stats[current] > species.stats[best] ? current : best,
  );
  const node = currentNode(species);
  return (
    <article className={`species-panel ${isYou ? "your-species" : ""} ${isActive ? "active" : ""} ${species.alive ? "" : "extinct"}`}>
      <div className="species-portrait">
        {species.portraitUrl ? (
          <img src={species.portraitUrl} alt={`${species.name}, canonical phenotype`} />
        ) : <CreatureSilhouette species={species} />}
        <span>{species.alive ? `${label(species.originKind)} lineage` : label(species.retiredReason || "retired")}</span>
      </div>
      <div className="species-details">
        <div className="species-heading">
          <div><small>{isYou ? "Your species" : "Rival species"}</small><h2>{species.name}</h2></div>
          <span>{species.acceptedMutations} evolutions</span>
        </div>
        <p>{node?.phenotypeSummary || species.founderDescription}</p>
        <div className="population-line"><span><small>Population</small><strong>{species.population}m</strong></span><i><b style={{width: `${populationPercent}%`}} /></i></div>
        <div className="species-stat-row">
          <span><small>Best trait</small><strong>{label(strongest)} {species.stats[strongest]}</strong></span>
          <span><small>Genes</small><strong>{species.genes.length}</strong></span>
          <span><small>Legacy</small><strong>{species.legacy}</strong></span>
        </div>
        <small className={`portrait-state ${node?.portrait.status ?? "pending"}`}>
          Portrait: {label(node?.portrait.status ?? "pending")}
        </small>
      </div>
    </article>
  );
}
