# EvolvingtoSurvive architecture

## Product rule

AI may interpret biology and describe appearance. AI never chooses population damage, stat values, phase order, card draws, winners, or rewards.

## Trust boundary

```text
Privy wallet
    |
    v
React/Vite client ---- portrait request ----> Cloudflare Worker
    |                                         | AI: render only
    | GenLayer transaction                    | R2: candidate bytes
    v                                         v
EvolvingtoSurvive contract <---- actual compressed image bytes + URL/hash
    |   |                                     ^
    |   +-- deterministic engine              |
    |       genes -> stats -> hazards          +-- accepted image becomes canonical
    |
    +-- GenLayer text consensus: adaptation class + phenotype
    +-- GenLayer vision consensus: portrait matches phenotype/ancestry
```

The client is untrusted. Every gameplay precondition is enforced by the contract. The Worker is also untrusted for gameplay: it can propose pixels but cannot approve them. Image bytes are submitted to GenLayer so validators inspect one immutable candidate rather than fetching a mutable URL. The contract stores only the SHA-256 digest and public URL, never the image bytes.

## Contract state

Planet and species documents are canonical JSON stored in `TreeMap[str, str]` for GenVM compatibility. Public views return player-safe projections.

- Planet: lobby state, players, era, commit/reveal phase and deadline, sealed round actions, history, winner, revision.
- Species: owner, body plan, population, fixed stats, gene hand, ancestry nodes, parent-node IDs, accepted phenotype, portrait hash/URL.
- Profile: planets played, wins, extinctions, accepted mutations, best legacy score.

## Deterministic engine

- Starter genes and every later draw come from a fixed catalog and deterministic per-planet sequence.
- Each gene exposes one or more allowed adaptation classes.
- Consensus returns exactly one allowed class or a rejection reason.
- One supporting gene grants `+2`; both selected genes supporting the class grant `+3`.
- The current hazard checks one published stat and threshold. Population loss comes from a fixed deficit table.
- A legal `conserve` action draws one deterministic gene without an LLM call.
- Every wallet has two energy per era and may control at most four living species. Actions resolve in fixed player/slot order before the shared hazard.
- Winner ordering is: living-species count, total legacy, total population, accepted mutation count, then original player order.

## Consensus checks

### Adaptation

The leader classifies the player's untrusted description and proposes bounded creative phenotype text. A validator independently classifies the same evidence. It must agree on acceptance and the gameplay class. If accepted, it also checks that the leader's visual traits follow from the chosen genes and do not smuggle in unsupported mechanics.

### Portrait

The leader and validator each inspect the candidate image. A founder has no ancestor image, an adaptation or fork has one, and a DNA hybrid has two. They independently decide whether the candidate depicts the phenotype, preserves inherited identity, includes required traits, avoids contradictory traits, and is safe to publish. Exact decision booleans must agree.

## Image pipeline

1. Client asks the Worker for a portrait using only contract-derived phenotype fields.
2. Worker rate-limits the request, calls Workers AI, rejects output above the contract byte limit, detects the real image format, stores a temporary candidate in R2, and returns URL/hash.
3. Player submits candidate bytes plus zero, one, or two canonical ancestor images to `verify_portrait`.
4. After the finalized view proves the contract linked that exact URL/hash, the client asks D1 to retain the candidate as canonical. This retention signal is advisory and controls storage/cache lifetime only; it cannot approve a portrait in the game. Rejected candidates can be retried and are expired by a cleanup job.

The first implementation uses Cloudflare's FLUX.2 Klein 4B binding. The provider can be changed without migrating contract state because the contract trusts only validator-approved pixels and hashes.

## Delivery phases

1. Contract + direct tests: simultaneous phases, action energy, multiple species, split/merge ancestry, deterministic survival, portraits.
2. Client: Privy wallet, lobby, full-screen game HUD, ancestry graph, secret backups, transaction reconciliation.
3. Worker: zero/one/two-reference generation, R2 storage, D1 metadata/rate limits, Turnstile hook.
4. Studionet integration, permanent v2 deployment, Vercel and Worker production deployment.
5. Later: mainnet economics, trading, seasons, spectator/replay tools.
