# EvolvingtoSurvive v2 architecture

## Boundary

- The frontend owns Privy authentication, secret-salt storage, action drafting, ancestry visualization, non-authoritative hazard previews, and transaction progress.
- The Cloudflare Worker owns temporary image generation, canonical-image retention, quotas, and delivery. It never assigns gameplay stats.
- The GenLayer contract owns planet membership, simultaneous phase deadlines, commitment verification, validator judgments of biological proposals and portraits, deterministic action effects, hazards, lineage ancestry, and final settlement.
- GenLayer validators independently classify the gameplay-relevant adaptation class. Creative naming and prose may differ; the accepted/rejected result and class must agree.

## Era state machine

```text
waiting -> commit -> reveal -> deterministic resolution -> next commit -> complete
```

- Each phase lasts `phase_window_seconds`.
- Every wallet has two evolution-energy points per era, regardless of how many species it owns.
- `commit_action` records a SHA-256 commitment and a public cost of one or two energy points.
- `lock_actions` closes that wallet's plan. All wallets locking permits an early transition to reveal; otherwise anyone can advance after the deadline.
- `reveal_action` verifies the wallet-, planet-, and era-bound preimage. Subjective actions run GenLayer consensus immediately but do not mutate ecology until resolution.
- `resolve_era` is permissionless when every commitment is revealed or the reveal deadline expires. It applies all actions in player/slot order, applies the shared hazard to every living species, penalizes unrevealed commitments, and opens the next era.
- Unselected species remain dormant and still face the hazard. They do not receive free genes.

## Commitment payload

The commitment is `sha256:` plus SHA-256 of canonical sorted JSON containing:

```json
{
  "planet_id": "ets2-1",
  "era": 1,
  "owner": "0x...",
  "slot": 0,
  "cost": 1,
  "kind": "adapt",
  "species_id": "ets2-1-s1",
  "secondary_species_id": "",
  "first_gene": "keratin_plates",
  "second_gene": "antifreeze_blood",
  "proposal": "...",
  "child_name": "",
  "salt": "32+ characters of browser-generated entropy"
}
```

The browser stores the payload and salt locally under wallet + planet + era + slot. Losing it makes the commitment unrevealable and incurs the normal missed-reveal penalty.

## Species and action rules

- A wallet starts with one founder species and can own at most four living species.
- A species can participate in at most one revealed action per era.
- `adapt` costs one energy, combines two genes belonging to one species, and can add a fixed stat gain after validator approval.
- `conserve` costs one energy and draws one gene at resolution.
- `split` costs one energy, requires at least eight population and an open projected species slot, divides the parent's population, and creates a child whose origin node has one DNA parent.
- `merge` costs both energy points, consumes two distinct owned species, and creates one hybrid whose origin node has both current parent-node IDs. Hybrid stats begin at the rounded-down parental average with a fixed gain in the validator-approved class.
- No action can change numeric rules through prose. Population, stats, gene draws, caps, and deadlines are deterministic contract code.

## Portrait ancestry

- Every founder receives an onchain founder node with a pending portrait.
- A planet cannot start until every founder portrait is validator-accepted, ensuring the first visual reference exists.
- Adaptation and split nodes require the previous canonical node portrait as one exact hash-checked image ancestor.
- Hybrid nodes require both exact hash-checked parent portraits.
- Candidate image bytes are checked against the committed SHA-256 before vision consensus. The contract stores only the canonical URL and digest.

## Deployment

GenLayer deployments are immutable. The canonical app deployment is a clean version-2 contract with empty initial state; the frontend manifest references only that address.
