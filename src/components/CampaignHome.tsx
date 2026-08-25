import {label} from "../catalog";
import {currentNode, type PlanetState, type PlayerProfile} from "../game-model";

function campaignObjective(planet: PlanetState): {eyebrow: string; title: string; copy: string} {
  if (planet.status === "waiting") {
    const portraitNeeded = planet.yourSpecies.some(
      (species) => currentNode(species)?.portrait.status !== "accepted",
    );
    return portraitNeeded
      ? {
          eyebrow: "Founder setup",
          title: "Verify your founder portrait",
          copy: "Your generated founder must be accepted onchain before the creator can launch natural selection.",
        }
      : {
          eyebrow: "World lobby",
          title: "Waiting for launch",
          copy: "Your founder is ready. The world creator can begin when at least two ecosystems have canonical portraits.",
        };
  }
  if (planet.phase === "reveal") {
    return {
      eyebrow: `Era ${planet.era} · Reveal`,
      title: "Reveal your sealed DNA",
      copy: "Open the campaign and reveal every committed action. Missing reveals lose population before the hazard resolves.",
    };
  }
  return {
    eyebrow: `Era ${planet.era} · Planning`,
    title: "Program this era's descendants",
    copy: "Spend up to two energy across your species, back up each secret, then lock your plan.",
  };
}

export default function CampaignHome({
  planet,
  profile,
  onResume,
  onHowToPlay,
}: {
  planet: PlanetState;
  profile: PlayerProfile;
  onResume: () => void;
  onHowToPlay: () => void;
}) {
  const objective = campaignObjective(planet);
  const living = planet.yourSpecies.filter((species) => species.alive);
  const totalPopulation = living.reduce((sum, species) => sum + species.population, 0);

  return (
    <main className="campaign-home" id="top">
      <section className="campaign-home-hero">
        <div className="campaign-home-copy">
          <span className="home-status"><i /> ACTIVE CAMPAIGN</span>
          <small>{planet.biomeName} · {planet.planetId}</small>
          <h1>{planet.name}</h1>
          <p>Your campaign is safe onchain. Return whenever you are ready—the clock and rival ecosystems continue independently.</p>
          <div className="campaign-home-actions">
            <button className="home-resume-command" type="button" onClick={onResume}>
              <span><small>{objective.eyebrow}</small><strong>Resume campaign</strong></span><i>→</i>
            </button>
            <button className="home-guide-command" type="button" onClick={onHowToPlay}>How to play <span>?</span></button>
          </div>
        </div>
        <div className={`home-world-orb ${planet.biome}`} aria-hidden="true"><i /><b /><span>ERA {planet.era}</span></div>
      </section>

      <section className="campaign-home-dashboard" aria-label="Active campaign overview">
        <article className="home-next-mission">
          <small>{objective.eyebrow}</small>
          <h2>{objective.title}</h2>
          <p>{objective.copy}</p>
          <button type="button" onClick={onResume}>Open required controls <span>→</span></button>
        </article>

        <article className="home-roster-summary">
          <header><span><small>Your ecosystem</small><strong>{living.length} of {planet.maxSpeciesPerWallet} living species</strong></span><b>{totalPopulation}m <small>POP</small></b></header>
          <div>
            {living.map((species) => (
              <span key={species.speciesId}>
                <i>{species.portraitUrl ? <img src={species.portraitUrl} alt="" /> : species.name.slice(0, 1)}</i>
                <b>{species.name}</b>
                <small>{label(species.originKind)} · {species.population}m</small>
              </span>
            ))}
          </div>
        </article>

        <article className="home-campaign-stats">
          <span><small>Campaign progress</small><strong>{planet.era} / {planet.eraLimit} eras</strong></span>
          <span><small>Current phase</small><strong>{planet.status === "waiting" ? "Setup" : label(planet.phase)}</strong></span>
          <span><small>Career worlds</small><strong>{profile.planetsPlayed}</strong></span>
          <span><small>Best legacy</small><strong>{profile.bestLegacy}</strong></span>
        </article>
      </section>

      <footer className="campaign-home-footer"><span><i /> STUDIONET SYNCED</span><strong>{planet.lastEvent}</strong><button type="button" onClick={onResume}>RETURN TO WORLD</button></footer>
    </main>
  );
}
