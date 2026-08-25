import BrandMark from "./BrandMark";

function shorten(address: string): string {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";
}

export default function SiteHeader({
  address,
  connected,
  demo,
  activePage,
  onHome,
  onHowToPlay,
  onConnect,
  onDisconnect,
}: {
  address: string;
  connected: boolean;
  demo: boolean;
  activePage: "home" | "guide";
  onHome: () => void;
  onHowToPlay: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <header className="site-header">
      <a className="site-brand" href="?view=home" aria-label="EvolvingtoSurvive home" onClick={(event) => { event.preventDefault(); onHome(); }}>
        <BrandMark small />
        <span><strong>Evolving</strong>toSurvive</span>
      </a>
      <nav className="site-navigation" aria-label="Main navigation">
        <button className={activePage === "home" ? "active" : ""} type="button" onClick={onHome}>Home</button>
        <button className={activePage === "guide" ? "active" : ""} type="button" onClick={onHowToPlay}>How to play</button>
      </nav>
      <div className="header-actions">
        <span className="network-pill"><i /> Studionet</span>
        {demo ? <span className="demo-pill">Preview</span> : null}
        {connected ? (
          <button className="wallet-button connected" type="button" disabled={demo} onClick={onDisconnect}>
            <span>{shorten(address)}</span><small>{demo ? "Preview identity" : "Disconnect"}</small>
          </button>
        ) : (
          <button className="wallet-button" type="button" onClick={onConnect}>
            Connect wallet
          </button>
        )}
      </div>
    </header>
  );
}
