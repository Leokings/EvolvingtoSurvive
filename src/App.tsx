import {useCallback, useEffect, useMemo, useState} from "react";
import type {Hash} from "genlayer-js/types";

import type {ActionDraft, RevealSecret} from "./commit-reveal";
import {
  exportRevealBackup,
  loadRevealSecret,
  persistRevealSecret,
  prepareCommitment,
  removeRevealSecret,
  verifyRevealBackup,
} from "./commit-reveal";
import {readAppView, urlForAppView, type AppView} from "./app-navigation";
import CampaignHome from "./components/CampaignHome";
import EvolutionArena from "./components/EvolutionArena";
import HowToPlay from "./components/HowToPlay";
import PlanetLobby from "./components/PlanetLobby";
import SiteHeader from "./components/SiteHeader";
import WaitingPlanet from "./components/WaitingPlanet";
import {createDemoPlanet, DEMO_ADDRESS, DEMO_PROFILE, type DemoPhaseScenario} from "./demo-state";
import {
  currentNode,
  findNode,
  speciesById,
  type CreatePlanetInput,
  type JoinPlanetInput,
  type LobbyPlanet,
  type PlanetState,
  type PlayerProfile,
  type PortraitCandidate,
} from "./game-model";
import {
  createEvolutionAdapter,
  HAS_CONTRACT_DEPLOYMENT,
  SubmittedTransactionError,
} from "./genlayer-game";
import {
  clearCachedPortraitCandidate,
  fetchImageBytes,
  loadCachedPortraitCandidate,
  markPortraitCanonical,
  requestPortrait,
  retainCanonicalNode,
  submitPortraitCandidate,
} from "./portrait-service";
import type {ConnectedWallet} from "./wallet-network";

const EMPTY_PROFILE: PlayerProfile = {
  player: "",
  planetsPlayed: 0,
  wins: 0,
  extinctions: 0,
  acceptedMutations: 0,
  bestLegacy: 0,
};

function requestedDemoScenario(): DemoPhaseScenario {
  const scenario = new URLSearchParams(globalThis.location.search).get("phase");
  return scenario === "sealed" || scenario === "locked" || scenario === "reveal" || scenario === "expired"
    ? scenario
    : "plan";
}

function requestedDemoLobby(): boolean {
  return new URLSearchParams(globalThis.location.search).get("view") === "lobby";
}

function friendlyError(cause: unknown): string {
  if (cause instanceof SubmittedTransactionError) return cause.message;
  const raw = cause instanceof Error ? cause.message : String(cause);
  const messages: Record<string, string> = {
    player_already_has_active_planet: "Finish or cancel your current planet first.",
    planet_name_taken: "That planet name has already been claimed.",
    planet_not_waiting: "That biosphere has already started or was cancelled.",
    planet_is_full: "Every ecosystem slot on that planet is filled.",
    species_name_taken: "Another species on this planet already uses that name.",
    only_creator_can_start: "Only the founding wallet can begin this planet.",
    not_enough_species: "At least two wallets are needed to begin.",
    founder_portraits_not_ready: "Every wallet must verify its founder portrait first.",
    planet_not_active: "This campaign is no longer active. Sync the latest onchain state.",
    species_not_owned: "This species belongs to a different wallet.",
    species_is_not_living: "This species has already been retired.",
    not_commit_phase: "Planning has ended. Refresh the current phase.",
    not_reveal_phase: "The planet is not accepting reveals right now.",
    commit_window_expired: "The planning window expired. Advance to reveal.",
    reveal_window_expired: "The reveal window expired. Resolve the era.",
    action_plan_already_locked: "Your plan is already locked for this era.",
    evolution_energy_exceeded: "You only have two evolution energy per era.",
    action_commitment_mismatch: "This reveal does not match the sealed plan. Restore the exact backup.",
    species_already_used_this_era: "Each species can take only one action per era.",
    species_limit_reached: "A wallet can control at most four living species.",
    species_portrait_not_canonical: "Generate and verify this species' current portrait first.",
    population_too_low_to_split: "A species needs at least 8 population to split.",
    genes_must_be_distinct: "Select two different genes.",
    first_gene_not_in_species: "The first selected gene is no longer available.",
    second_gene_not_in_species: "The second selected gene is no longer available.",
    invalid_proposal: "Describe the biology in at least 20 characters.",
    image_hash_mismatch: "The generated pixels changed before verification. Generate again.",
    ancestor_hash_mismatch: "A canonical parent picture no longer matches its onchain hash.",
    first_ancestor_hash_mismatch: "The first DNA parent's pixels do not match its onchain hash.",
    second_ancestor_hash_mismatch: "The second DNA parent's pixels do not match its onchain hash.",
    evolution_response_shape_invalid: "The natural-selection council returned an incomplete ruling. Try again.",
    portrait_response_shape_invalid: "The phenotype verifier returned an incomplete ruling. Try again.",
  };
  const marked = raw.match(/\[(?:EXPECTED|LLM_ERROR|EXTERNAL|TRANSIENT)\]\s*([a-z][a-z0-9_]+)/i)?.[1];
  const key = marked ?? Object.keys(messages).find((candidate) => raw.includes(candidate));
  if (key && messages[key]) return messages[key];
  if (/non-payable method[\s\S]*non-zero value/i.test(raw)) {
    return "The wallet encoded this zero-value Studionet action incorrectly. Refresh the app to load the fix, then try again.";
  }
  if (/wallet timeout/i.test(raw)) {
    return "The wallet stopped responding before returning a transaction hash.";
  }
  const tracebackSummary = raw.match(/(?:ValueError|RuntimeError|AssertionError):\s*([^\r\n]+)/)?.[1];
  return tracebackSummary ?? raw;
}

function shortHash(hash: string): string {
  return hash.length > 18 ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : hash;
}

function finalizedNotice(action: string, next: PlanetState): string {
  if (action === "commit") {
    return "Action sealed. Your turn is still open—use LOCK PLAN when you are finished planning.";
  }
  if (action === "lock") {
    return next.phase === "reveal"
      ? "Plan locked. Every ecosystem is ready, so the reveal phase is open now."
      : "Plan locked. Reveal opens automatically when the remaining ecosystems lock.";
  }
  if (action === "advance") {
    return next.phase === "reveal"
      ? "Reveal phase opened. Reveal each sealed action before the new timer ends."
      : `Era ${next.era} began. Natural selection has been resolved.`;
  }
  if (action.startsWith("reveal-")) {
    return next.phase === "commit"
      ? `Reveal finalized. Era ${next.era} is now open for planning.`
      : "Action revealed. Waiting for the remaining sealed DNA.";
  }
  return "Finalized on GenLayer Studionet.";
}

export default function App({
  wallet,
  authenticated,
  demo = false,
  onConnect,
  onDisconnect,
}: {
  wallet: ConnectedWallet | null;
  authenticated: boolean;
  demo?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const [planet, setPlanet] = useState<PlanetState | null>(() => demo
    ? requestedDemoLobby() ? null : createDemoPlanet(requestedDemoScenario())
    : null);
  const [lobby, setLobby] = useState<LobbyPlanet[]>([]);
  const [profile, setProfile] = useState<PlayerProfile>(() => demo ? DEMO_PROFILE : EMPTY_PROFILE);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [transaction, setTransaction] = useState<{hash: Hash; action: string} | null>(null);
  const [showArchive, setShowArchive] = useState(true);
  const [secretRevision, setSecretRevision] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState(() => Math.floor(Date.now() / 1_000));
  const [appView, setAppView] = useState<AppView>(() => readAppView(globalThis.location.search, globalThis.location.pathname));
  const address = wallet?.address || (demo ? DEMO_ADDRESS : "");

  const navigateTo = useCallback((view: AppView) => {
    globalThis.history.pushState({}, "", urlForAppView(globalThis.location.href, view));
    setAppView(view);
    globalThis.scrollTo({top: 0, behavior: "smooth"});
  }, []);

  const exitSimulation = useCallback(() => {
    const url = new URL(globalThis.location.href);
    url.pathname = "/";
    url.search = "";
    url.searchParams.set("demo", "1");
    url.searchParams.set("view", "lobby");
    url.hash = "";
    globalThis.location.assign(`${url.pathname}${url.search}`);
  }, []);

  useEffect(() => {
    const followBrowserHistory = () => setAppView(readAppView(globalThis.location.search, globalThis.location.pathname));
    globalThis.addEventListener("popstate", followBrowserHistory);
    return () => globalThis.removeEventListener("popstate", followBrowserHistory);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = globalThis.setTimeout(() => setNotice(""), 8_000);
    return () => globalThis.clearTimeout(timer);
  }, [notice]);

  const adapter = useMemo(() => {
    if (!wallet || !HAS_CONTRACT_DEPLOYMENT) return null;
    return createEvolutionAdapter(wallet, (hash, action) => {
      setTransaction({hash, action});
      setNotice("Transaction submitted. GenLayer validators are reaching consensus…");
    });
  }, [wallet]);

  const secrets = useMemo(() => {
    if (!planet || !address) return {};
    const result: Record<number, RevealSecret> = {};
    for (const action of planet.roundActions) {
      if (action.owner !== address.toLowerCase()) continue;
      const secret = loadRevealSecret(
        planet.planetId,
        planet.era,
        address,
        action.slot,
      );
      if (secret?.commitment.toLowerCase() === action.commitment.toLowerCase()) {
        result[action.slot] = secret;
      }
    }
    return result;
  }, [address, planet, secretRevision]);

  const refresh = useCallback(async () => {
    if (!adapter) return;
    setBusy("refresh");
    setError("");
    try {
      const [nextPlanet, nextLobby, nextProfile] = await Promise.all([
        adapter.getPlanet(),
        adapter.getLobby(),
        adapter.getProfile(),
      ]);
      setPlanet(nextPlanet);
      setLobby(nextLobby);
      setProfile(nextProfile);
      setLastSyncedAt(Math.floor(Date.now() / 1_000));
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy("");
    }
  }, [adapter]);

  useEffect(() => {
    if (adapter) void refresh();
  }, [adapter, refresh]);

  useEffect(() => {
    if (!adapter || planet?.status !== "active") return;
    const timer = globalThis.setInterval(() => {
      void adapter.getPlanet().then((nextPlanet) => {
        if (nextPlanet) {
          setPlanet((current) => !current || nextPlanet.revision >= current.revision ? nextPlanet : current);
          setLastSyncedAt(Math.floor(Date.now() / 1_000));
        }
      }).catch(() => undefined);
    }, 12_000);
    return () => globalThis.clearInterval(timer);
  }, [adapter, planet?.status]);

  async function updateSupplementary() {
    if (!adapter) return;
    const [nextLobby, nextProfile] = await Promise.all([
      adapter.getLobby(),
      adapter.getProfile(),
    ]);
    setLobby(nextLobby);
    setProfile(nextProfile);
  }

  async function transact(
    action: string,
    task: () => Promise<PlanetState>,
  ): Promise<boolean> {
    if (demo) {
      setError("This is a local preview. Connect a wallet to submit v2 transactions.");
      return false;
    }
    if (!adapter) {
      if (!authenticated) onConnect();
      else if (!HAS_CONTRACT_DEPLOYMENT) {
        setError("The v2 Studionet deployment is not configured yet.");
      } else {
        setError("Privy is connected, but no compatible EVM wallet is available yet.");
      }
      return false;
    }
    setBusy(action);
    setError("");
    setNotice("");
    setTransaction(null);
    try {
      const next = await task();
      setPlanet(next);
      setLastSyncedAt(Math.floor(Date.now() / 1_000));
      setShowArchive(true);
      setNotice(finalizedNotice(action, next));
      await updateSupplementary();
      return true;
    } catch (cause) {
      setError(friendlyError(cause));
      return false;
    } finally {
      setBusy("");
    }
  }

  async function commitDraft(draft: ActionDraft): Promise<boolean> {
    if (!planet || !address || demo || !adapter) {
      return transact("commit", async () => {
        throw new Error("A live wallet is required to seal an action.");
      });
    }
    const ownActions = planet.roundActions.filter(
      (action) => action.owner === address.toLowerCase(),
    );
    try {
      const prepared = await prepareCommitment(
        planet,
        address,
        ownActions.length,
        draft,
      );
      setSecretRevision((revision) => revision + 1);
      setNotice("Reveal secret saved locally. Confirm the commitment in your wallet.");
      return transact("commit", () => adapter.commitAction(
        planet.planetId,
        prepared.commitment,
        prepared.payload.cost,
      ));
    } catch (cause) {
      setError(friendlyError(cause));
      return false;
    }
  }

  async function revealAction(slot: number) {
    if (!planet || !adapter) return;
    const secret = secrets[slot];
    if (!secret) {
      setError("The local reveal secret is missing. Restore the copied backup first.");
      return;
    }
    const succeeded = await transact(`reveal-${slot}`, () => adapter.revealAction(secret.payload));
    if (succeeded) {
      removeRevealSecret(secret);
      setSecretRevision((revision) => revision + 1);
    }
  }

  async function copyBackup(slot: number) {
    const secret = secrets[slot];
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(exportRevealBackup(secret));
      setNotice(`Reveal backup for action ${slot + 1} copied. Keep it private until reveal.`);
    } catch {
      setError("The browser could not copy the backup. Allow clipboard access and try again.");
    }
  }

  async function restoreBackup(raw: string): Promise<boolean> {
    if (!planet || !address) return false;
    try {
      const secret = await verifyRevealBackup(raw);
      const payload = secret.payload;
      const action = planet.roundActions.find(
        (candidate) => candidate.owner === address.toLowerCase() && candidate.slot === payload.slot,
      );
      if (
        payload.planet_id !== planet.planetId
        || payload.era !== planet.era
        || payload.owner !== address.toLowerCase()
        || action?.commitment.toLowerCase() !== secret.commitment.toLowerCase()
      ) {
        throw new Error("This backup does not belong to your current sealed action.");
      }
      persistRevealSecret(secret);
      setSecretRevision((revision) => revision + 1);
      setNotice(`Reveal backup for action ${payload.slot + 1} restored locally.`);
      return true;
    } catch (cause) {
      setError(friendlyError(cause));
      return false;
    }
  }

  async function generatePortrait(speciesId: string) {
    const species = planet ? speciesById(planet, speciesId) : null;
    const node = currentNode(species);
    if (!planet || !species || !node) return;
    if (demo || !adapter) {
      setError("Live portrait generation starts after Privy, the Worker, and v2 are connected.");
      return;
    }
    setBusy(`portrait-${speciesId}`);
    setError("");
    setNotice("Preparing a verification-ready phenotype…");
    let candidate: PortraitCandidate | null = null;
    const progress: {stage: "parents" | "candidate" | "pixels" | "wallet"} = {
      stage: "parents",
    };
    try {
      if (node.portrait.status === "rejected") {
        clearCachedPortraitCandidate(planet.planetId, node.nodeId, species.owner);
      }
      const parentNodes = node.parentNodeIds.map((nodeId) => findNode(planet, nodeId));
      if (parentNodes.some((parent) => !parent || parent.portrait.status !== "accepted" || !parent.portrait.url)) {
        throw new Error("Every DNA parent needs a canonical portrait before this image can be generated.");
      }
      const parentSpecies = parentNodes.map((parent) => planet.species.find(
        (candidateSpecies) => candidateSpecies.nodes.some(
          (candidateNode) => candidateNode.nodeId === parent!.nodeId,
        ),
      ));
      if (parentSpecies.some((candidateSpecies) => !candidateSpecies)) {
        throw new Error("A DNA parent no longer belongs to a visible species lineage.");
      }
      await Promise.all(parentNodes.map((parent, index) => (
        retainCanonicalNode(parentSpecies[index]!, parent!)
      )));
      const parentUrls = parentNodes.map((parent) => parent!.portrait.url);
      progress.stage = "candidate";
      const ancestorBytesPromise = Promise.all(parentUrls.map(fetchImageBytes));
      const submission = await submitPortraitCandidate({
        planetId: planet.planetId,
        nodeId: node.nodeId,
        speciesOwner: species.owner,
        generate: async () => {
          setNotice("Rendering a compact phenotype for wallet verification…");
          return requestPortrait(planet.planetId, species, node, parentUrls);
        },
        onCandidateReady: (readyCandidate, reused) => {
          candidate = readyCandidate;
          progress.stage = "pixels";
          if (reused) {
            setNotice("Saved portrait found. Retrying its onchain verification—no new render needed.");
          }
        },
        submit: async (readyCandidate, candidateBytes) => {
          const ancestorBytes = await ancestorBytesPromise;
          setNotice("Portrait ready. Confirm the wallet transaction so GenLayer can verify it…");
          progress.stage = "wallet";
          return adapter.verifyPortrait(
            planet.planetId,
            species.speciesId,
            node.nodeId,
            readyCandidate.url,
            readyCandidate.sha256,
            candidateBytes,
            ancestorBytes[0] ?? new Uint8Array(),
            ancestorBytes[1] ?? new Uint8Array(),
          );
        },
      });
      candidate = submission.candidate;
      const next = submission.result;
      setPlanet(next);
      setLastSyncedAt(Math.floor(Date.now() / 1_000));
      const verifiedSpecies = speciesById(next, species.speciesId);
      const verifiedNode = currentNode(verifiedSpecies);
      if (
        verifiedSpecies
        && verifiedNode?.portrait.url === candidate.url
        && verifiedNode.portrait.sha256.toLowerCase() === candidate.sha256.toLowerCase()
      ) {
        try {
          await markPortraitCanonical(candidate, verifiedSpecies, verifiedNode);
          setNotice("Portrait decision finalized on Studionet.");
        } catch {
          setNotice("Portrait is canonical onchain; storage retention is still syncing.");
        }
      } else {
        setNotice("Portrait was rejected by GenLayer vision consensus. Generate another candidate.");
      }
    } catch (cause) {
      candidate ??= loadCachedPortraitCandidate(planet.planetId, node.nodeId, species.owner);
      const detail = friendlyError(cause);
      if (cause instanceof SubmittedTransactionError) {
        setError(detail);
      } else if (!candidate) {
        setError(detail);
      } else if (progress.stage === "parents") {
        setError(`The portrait is saved, but its parent reference could not be prepared. ${detail} Retry to reuse the same image.`);
      } else if (progress.stage === "pixels") {
        setError(`The portrait is saved, but its verification pixels could not be loaded. ${detail} Retry to reuse the same image.`);
      } else if (progress.stage === "wallet") {
        setError(`The portrait is saved, but the wallet could not submit its verification transaction. ${detail} Reconnect the wallet, then retry to reuse the same image.`);
      } else {
        setError(`The portrait is saved, but verification could not start. ${detail} Retry to reuse the same image.`);
      }
    } finally {
      setBusy("");
    }
  }

  async function endRun(speciesIds: string[]): Promise<boolean> {
    if (!planet) return false;
    if (demo || !adapter) {
      setError(demo
        ? "This is a local preview. A live wallet is required to end an onchain run."
        : "Reconnect your wallet before ending this run.");
      return false;
    }
    const livingIds = new Set(
      planet.yourSpecies.filter((species) => species.alive).map((species) => species.speciesId),
    );
    const targets = speciesIds.filter((speciesId) => livingIds.has(speciesId));
    if (!targets.length) {
      setError("You do not have a living species to retire.");
      return false;
    }

    setBusy("end-run");
    setError("");
    setNotice("");
    setTransaction(null);
    let retired = 0;
    let next = planet;
    try {
      for (const speciesId of targets) {
        setNotice(`Approve retirement ${retired + 1} of ${targets.length} in your wallet.`);
        next = await adapter.concedeSpecies(planet.planetId, speciesId);
        retired += 1;
        setPlanet(next);
        setLastSyncedAt(Math.floor(Date.now() / 1_000));
        if (next.status !== "active") break;
      }
      setShowArchive(true);
      await updateSupplementary().catch(() => undefined);
      setNotice(next.status === "complete"
        ? "Your run ended onchain. The surviving ecosystem and final standings are now settled."
        : "Every selected species was retired onchain.");
      return true;
    } catch (cause) {
      let latest: PlanetState | null = null;
      try {
        latest = await adapter.getPlanet();
        if (latest) {
          setPlanet(latest);
          setLastSyncedAt(Math.floor(Date.now() / 1_000));
        }
      } catch {
        // Preserve the original wallet or transaction error if the safety read
        // is temporarily unavailable.
      }

      const retiredOnchain = latest
        ? targets.filter((speciesId) => speciesById(latest, speciesId)?.alive === false).length
        : 0;
      const confirmedRetired = Math.max(retired, retiredOnchain);
      if (latest && confirmedRetired === targets.length) {
        setShowArchive(true);
        await updateSupplementary().catch(() => undefined);
        setNotice(latest.status === "complete"
          ? "Your run ended onchain. The surviving ecosystem and final standings are now settled."
          : "Every selected species was retired onchain.");
        return true;
      }

      const progress = confirmedRetired
        ? `${confirmedRetired} of ${targets.length} species were already retired. `
        : "";
      const timeoutState = /wallet timeout/i.test(cause instanceof Error ? cause.message : String(cause)) && latest
        ? " StudioNet still shows the remaining species alive, so no retirement was finalized and it is safe to retry."
        : "";
      setError(`${progress}${friendlyError(cause)}${timeoutState} You can reopen End My Run to finish the remaining species.`);
      return false;
    } finally {
      setBusy("");
    }
  }

  const archived = planet && ["complete", "cancelled"].includes(planet.status);
  const activeCampaign = planet && ["active", "waiting"].includes(planet.status) ? planet : null;
  const guideView = appView === "guide";
  const homeView = appView === "home";
  const visiblePlanet = appView === "play" ? archived && !showArchive ? null : planet : null;
  const gameplay = visiblePlanet?.status === "active";
  const lobbyView = !guideView && (!visiblePlanet || !["active", "waiting"].includes(visiblePlanet.status));
  const standaloneHeader = guideView || Boolean(homeView && activeCampaign) || visiblePlanet?.status === "waiting";

  return (
    <div className={`app-frame ${gameplay ? "gameplay-frame" : guideView ? "guide-command-frame" : homeView && activeCampaign ? "campaign-home-frame" : lobbyView ? "lobby-command-frame" : ""}`}>
      {standaloneHeader ? <SiteHeader address={address} connected={demo || authenticated && Boolean(wallet)} demo={demo} activePage={guideView ? "guide" : "home"} onHome={() => navigateTo("home")} onHowToPlay={() => navigateTo("guide")} onConnect={onConnect} onDisconnect={onDisconnect} /> : null}

      {demo && appView === "play" && !gameplay && !lobbyView ? (
        <div className="configuration-banner demo-scenarios">
          <span><strong>Interactive v2 preview</strong><small>Inspect every simultaneous phase and the two-parent ancestry graph.</small></span>
          <nav aria-label="Preview phase state">
            <a className={!requestedDemoLobby() && requestedDemoScenario() === "plan" ? "active" : ""} href="?demo=1&phase=plan">Plan</a>
            <a className={!requestedDemoLobby() && requestedDemoScenario() === "sealed" ? "active" : ""} href="?demo=1&phase=sealed">Sealed</a>
            <a className={!requestedDemoLobby() && requestedDemoScenario() === "locked" ? "active" : ""} href="?demo=1&phase=locked">Locked</a>
            <a className={!requestedDemoLobby() && requestedDemoScenario() === "reveal" ? "active" : ""} href="?demo=1&phase=reveal">Reveal</a>
            <a className={!requestedDemoLobby() && requestedDemoScenario() === "expired" ? "active" : ""} href="?demo=1&phase=expired">Expired</a>
            <a className={requestedDemoLobby() ? "active" : ""} href="?demo=1&view=lobby">New world</a>
          </nav>
        </div>
      ) : authenticated && !HAS_CONTRACT_DEPLOYMENT ? (
        <div className="configuration-banner warning"><strong>Wallet ready</strong><span>The v2 Studionet contract is the next deployment step.</span></div>
      ) : null}

      {error ? <div className="toast error" role="alert"><span>!</span><p>{error}{transaction ? <small>{transaction.action} · {shortHash(transaction.hash)}</small> : null}</p><button type="button" aria-label="Dismiss error" onClick={() => setError("")}>×</button></div> : null}
      {notice ? <div className="toast notice" role="status"><span>✓</span><p>{notice}{transaction ? <small>{transaction.action} · {shortHash(transaction.hash)}</small> : null}</p><button type="button" aria-label="Dismiss notice" onClick={() => setNotice("")}>×</button></div> : null}

      {guideView ? (
        <HowToPlay planet={activeCampaign} onHome={() => navigateTo("home")} onResume={() => navigateTo("play")} />
      ) : homeView && activeCampaign ? (
        <CampaignHome planet={activeCampaign} profile={profile} onResume={() => navigateTo("play")} onHowToPlay={() => navigateTo("guide")} />
      ) : visiblePlanet?.status === "active" ? (
        <EvolutionArena
          planet={visiblePlanet}
          address={address}
          secrets={secrets}
          busy={busy}
          demo={demo}
          lastSyncedAt={lastSyncedAt}
          onCommit={commitDraft}
          onLock={() => void transact("lock", () => adapter!.lockActions(visiblePlanet.planetId))}
          onReveal={(slot) => void revealAction(slot)}
          onAdvance={() => void transact("advance", () => adapter!.advancePhase(visiblePlanet.planetId))}
          onCopyBackup={(slot) => void copyBackup(slot)}
          onRestoreBackup={restoreBackup}
          onConcede={(speciesId) => transact("concede", () => adapter!.concedeSpecies(visiblePlanet.planetId, speciesId))}
          onEndRun={endRun}
          onGeneratePortrait={generatePortrait}
          onRefresh={refresh}
          onHome={() => navigateTo("home")}
          onExitSimulation={exitSimulation}
          onHowToPlay={() => navigateTo("guide")}
        />
      ) : visiblePlanet?.status === "waiting" ? (
        <WaitingPlanet
          planet={visiblePlanet}
          address={address}
          busy={busy}
          onStart={() => void transact("start", () => adapter!.startPlanet(visiblePlanet.planetId))}
          onCancel={() => void transact("cancel", () => adapter!.cancelPlanet(visiblePlanet.planetId))}
          onGeneratePortrait={(speciesId) => void generatePortrait(speciesId)}
        />
      ) : (
        <PlanetLobby
          lobby={lobby}
          connected={demo || authenticated && Boolean(wallet)}
          address={address}
          demo={demo}
          profile={profile}
          busy={busy}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onRefresh={() => void refresh()}
          onHowToPlay={() => navigateTo("guide")}
          onCreate={(input: CreatePlanetInput) => transact("create", () => adapter!.createPlanet(input))}
          onJoin={(planetId: string, input: JoinPlanetInput) => transact("join", () => adapter!.joinPlanet(planetId, input))}
        />
      )}

      {appView === "play" && archived && showArchive ? (
        <section className="result-drawer">
          <small>{planet.status === "complete" ? "Planet complete" : "Planet cancelled"}</small>
          <h2>{planet.status === "complete" ? (planet.winner === address.toLowerCase() ? "Your ecosystem survived." : "Another ecosystem endured.") : "This experiment never began."}</h2>
          <p>{planet.lastEvent}</p>
          <button className="primary-action" type="button" onClick={() => setShowArchive(false)}>Seed another planet <i>→</i></button>
        </section>
      ) : null}

      {appView === "play" && !gameplay && !lobbyView ? <footer className="site-footer">
        <div><strong>EvolvingtoSurvive v2</strong><span>Simultaneous natural selection, settled by intelligent consensus.</span></div>
        <div className="profile-strip"><span><small>Planets</small><strong>{profile.planetsPlayed}</strong></span><span><small>Wins</small><strong>{profile.wins}</strong></span><span><small>Evolutions</small><strong>{profile.acceptedMutations}</strong></span><span><small>Best legacy</small><strong>{profile.bestLegacy}</strong></span></div>
        <button type="button" disabled={!adapter || Boolean(busy)} onClick={() => void refresh()}>{busy === "refresh" ? "Refreshing…" : "Refresh chain state"}</button>
      </footer> : null}
    </div>
  );
}
