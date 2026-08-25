import type {PlanetState} from "../game-model";

const ACTIONS = [
  {name: "Adapt", cost: "1 energy", copy: "Combine two genes into a proposed survival trait for one species."},
  {name: "Conserve", cost: "1 energy", copy: "Draw a deterministic gene without changing a trait this era."},
  {name: "Fork", cost: "1 energy", copy: "Split one healthy lineage into a second species. You may own four living species."},
  {name: "Fuse DNA", cost: "2 energy", copy: "Merge two canonical species into one descendant with two recorded parents."},
] as const;

export default function HowToPlay({planet, onHome, onResume}: {planet: PlanetState | null; onHome: () => void; onResume: () => void}) {
  return (
    <main className="how-to-play" id="top">
      <section className="guide-hero">
        <span>FIELD MANUAL · CONTRACT V2</span>
        <h1>Survive one era at a time.</h1>
        <p>Every wallet plans in parallel. Your goal is to keep at least one species alive, build useful ancestry, and finish with the strongest ecosystem.</p>
        <div><button className="primary-action" type="button" onClick={planet ? onResume : onHome}>{planet ? "Resume my campaign" : "Go to command home"}<i>→</i></button><button className="secondary-action" type="button" onClick={onHome}>Home</button></div>
      </section>

      <section className="guide-turn-loop" aria-labelledby="turn-loop-title">
        <header><small>The complete era loop</small><h2 id="turn-loop-title">Plan. Lock. Reveal. Survive.</h2><p>No player owns a sequential turn. Every living wallet acts during the same phase window.</p></header>
        <ol>
          <li><i>01</i><span><small>PLAN</small><strong>Evolve or conserve</strong><p>Spend up to two energy. Each species can be used once per era.</p></span></li>
          <li><i>02</i><span><small>LOCK</small><strong>Finish your plan</strong><p>Copy each private reveal backup, then lock—even when you choose no action.</p></span></li>
          <li><i>03</i><span><small>REVEAL</small><strong>Open sealed DNA</strong><p>Reveal every commitment so the contract can judge and apply it.</p></span></li>
          <li><i>04</i><span><small>SURVIVE</small><strong>Face the hazard</strong><p>The extinction event affects every living species and starts the next era.</p></span></li>
        </ol>
      </section>

      <section className="guide-grid">
        <article className="guide-actions-card">
          <header><small>Your evolution choices</small><h2>Two energy per era</h2></header>
          <div>{ACTIONS.map((action, index) => <span key={action.name}><i>{index + 1}</i><b>{action.name}</b><em>{action.cost}</em><p>{action.copy}</p></span>)}</div>
        </article>

        <article className="guide-timer-card">
          <small>Important timer rule</small>
          <h2>Expired does not mean executed.</h2>
          <p>A browser timer cannot write to GenLayer by itself. When a phase expires, the cockpit exposes an <strong>Advance to Reveal</strong> or <strong>Resolve Era</strong> button. Any player may submit that transaction.</p>
          <div><b>Planning expired</b><span>Advance opens Reveal. Wallets that never locked simply contribute no action.</span></div>
          <div><b>Reveal expired</b><span>Resolve applies a 2-population penalty for each unrevealed commitment, then applies the hazard to every living species.</span></div>
        </article>

        <article className="guide-portrait-card">
          <small>Portraits and ancestry</small>
          <h2>Each current descendant needs a canonical image.</h2>
          <p>The founder starts from your body-plan description. Later portraits use the accepted parent image—or both parent images after DNA fusion—as visual references.</p>
          <ul><li>Generated pixels are hashed before wallet verification.</li><li>A pending portrait blocks that species' next evolution.</li><li>Every accepted node remains inspectable in the ancestry tree.</li></ul>
        </article>

        <article className="guide-ending-card">
          <small>Leaving a campaign</small>
          <h2>Home is safe. End My Run is permanent.</h2>
          <p>Going Home only leaves the cockpit. <strong>End My Run</strong> retires every living species you own onchain and cannot be undone.</p>
          <ul><li>One wallet approval is required per living species.</li><li>The campaign settles when only one viable ecosystem remains.</li><li>Before launch, only the world creator can cancel the waiting planet.</li></ul>
        </article>
      </section>

      <section className="guide-win-condition"><span><small>Win condition</small><h2>Keep one lineage alive.</h2></span><p>A campaign can settle early when only one ecosystem remains, or after its final era. Ranking favors survival, then legacy, living population, and accepted mutations.</p><button type="button" onClick={planet ? onResume : onHome}>{planet ? "Resume campaign" : "Enter command home"} <i>→</i></button></section>
    </main>
  );
}
