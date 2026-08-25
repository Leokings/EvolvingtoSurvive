# Security notes

## Authority boundaries

- GenLayer is authoritative for planet state, accepted mutations, portrait approval, stats, survival, turns, and winners.
- Workers AI proposes pixels only. It cannot change gameplay state or approve its own output.
- The browser and Cloudflare Worker are untrusted from the contract's perspective. Every write rechecks ownership, lifecycle, turn, gene, size, hash, and ancestry constraints.
- D1's canonical-retention flag is not game authority. A forged retention request could keep an otherwise unused image in storage, but cannot make the contract or UI accept it as a species portrait.

## Secrets

- No private key, Cloudflare token, Turnstile secret, or Privy server secret belongs in a `VITE_` variable.
- Wallet signing stays inside the user's Privy-connected wallet.
- Unlock the GenLayer CLI account interactively and never copy its password into chat, source, or environment templates.

## Abuse controls

- Portrait inputs are bounded and normalized before entering the image prompt.
- The Worker allows eight generations per hashed source IP per UTC day.
- Candidate IDs are random UUIDs; noncanonical candidates expire after 24 hours.
- Candidate bytes are SHA-256 checked in the browser and contract before vision consensus.
- Portrait ancestry must match the previous canonical portrait hash.
- Turnstile server verification is implemented but should not be enabled until a client challenge is added for public beta.

## Dependency advisory

As of August 24, 2026, `npm audit --omit=dev` reports 10 moderate findings in transitive `uuid` versions pulled through Privy → x402 → wagmi → wallet connectors. The affected API concerns caller-supplied buffers in UUID v3/v5/v6; this application does not invoke those UUID modes. npm's automated remediation downgrades Privy from 3.37.1 to 3.6.1, so it was not applied. Track the upstream Privy/wagmi/MetaMask updates and remove this note once their lockfile resolves `uuid >= 11.1.1` without a breaking downgrade.
