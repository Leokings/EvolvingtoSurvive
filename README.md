# EvolvingtoSurvive

An onchain evolution game where players combine inherited genes and describe an adaptation to survive the next environmental crisis. GenLayer consensus decides whether the biological idea is coherent and supported by the selected genes; fixed contract rules decide every numeric effect. A separate image service renders the accepted phenotype, and GenLayer vision consensus verifies the actual pixels before the portrait becomes canonical.

Version 2 is built, deployed, and verified on GenLayer Studionet.

- Contract: `0x579B79Ba871FA7a99E747026C5030D6d462C5118`
- Network: GenLayer Studionet, chain ID `61999`
- Architecture: simultaneous commit/reveal, two evolution energy per wallet per era, up to four living species per wallet
- Verified flow: deploy → create → join → founder ancestry → commit/reveal rules → split/merge ancestry → finalized reads
- No credentials required for the interactive local preview

## Game loop

1. Connect a wallet with Privy and create or join a planet.
2. Found a species with a name, body plan, and description.
3. During planning, spend two energy across one or two species. Adapt, conserve, fork a species, or spend both energy to fuse two species' DNA.
4. The browser stores a private salt and submits only the action hash. Lock the plan, then reveal the exact action in the reveal phase.
5. GenLayer validators classify subjective biology. The contract applies every accepted action together, then deterministically resolves the shared hazard.
6. Generate a portrait from zero parent images for founders, one canonical parent for adaptations/forks, or two canonical parents for DNA hybrids. GenLayer inspects the immutable pixels before accepting them.
7. Continue until the era limit or only one ecosystem survives. Winner selection is deterministic across all species owned by each wallet.

## Run the preview

Prerequisites are Node.js 24 and npm.

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. Without a Privy App ID, the app intentionally starts in a credential-free interactive demo.

## Enable the live Privy wallet

1. Create a free app in the [Privy dashboard](https://dashboard.privy.io/).
2. Add `http://localhost:5173` and `https://evolving-to-survive.vercel.app` as allowed origins.
3. Copy the environment template and add the public App ID:

```powershell
Copy-Item .env.example .env.local
```

```dotenv
VITE_PRIVY_APP_ID=your_public_privy_app_id
```

Restart Vite. The verified Studionet contract address is already built in. `VITE_GENLAYER_CONTRACT_ADDRESS` is only needed to override it after a Studionet reset or a new deployment. Never put Privy app secrets, Cloudflare API tokens, or signing keys in a `VITE_` variable; Vite values are public browser code.

## Deploy the frontend to Vercel

The production frontend is deployed at [evolving-to-survive.vercel.app](https://evolving-to-survive.vercel.app). To link or redeploy it from this directory:

```powershell
vercel link --yes --project evolving-to-survive
vercel deploy --prod --yes
```

Add `VITE_PRIVY_APP_ID` in Vercel Project Settings for Production, Preview, and Development. It is a public client identifier, not a secret. The Worker URL described below belongs in `VITE_EVOLUTION_API_URL`; redeploy Vercel after changing either build variable.

## Enable live AI portraits

This part needs a Cloudflare account. If the normal browser callback fails, use Wrangler's device authorization flow:

```powershell
npx wrangler login --device
npx wrangler d1 create evolving-to-survive
npx wrangler r2 bucket create evolving-to-survive-portraits
npx wrangler r2 bucket create evolving-to-survive-portraits-preview
```

Copy the D1 `database_id` from the first command into `wrangler.jsonc`, replacing `REPLACE_AFTER_D1_CREATE`. R2 requires completing Cloudflare's R2 subscription checkout even when usage remains inside its free allowance.

Apply the database schema and deploy the portrait API Worker:

```powershell
npx wrangler d1 migrations apply evolving-to-survive --remote
npm run build
npm run deploy:worker
```

Copy the resulting `https://evolving-to-survive.<subdomain>.workers.dev` URL into the Vercel `VITE_EVOLUTION_API_URL` variable and deploy the frontend again. `FRONTEND_ORIGINS` in `wrangler.jsonc` restricts browser API access to the production Vercel origin.

The current production portrait API is [evolving-to-survive.leokings588.workers.dev](https://evolving-to-survive.leokings588.workers.dev/api/health), and that URL is configured in all three Vercel environments.

For local Worker testing:

```powershell
npx wrangler d1 migrations apply evolving-to-survive --local
npm run build
npm run dev:worker
```

Then set `VITE_EVOLUTION_API_URL=http://localhost:8787` in `.env.local` while Vite runs on port 5173. The Worker accepts eight portrait requests per source IP per UTC day, stores candidates for 24 hours, and retains portraits that the client observes as accepted onchain. That retention signal affects storage only; the GenLayer contract remains the authority for whether a portrait is valid.

The Worker contains an optional Turnstile verification hook. Leave `TURNSTILE_SECRET_KEY` unset for the private MVP. Before a public beta, add a client Turnstile widget and then configure the secret with `npx wrangler secret put TURNSTILE_SECRET_KEY`.

## Deploy a fresh Studionet contract

Studionet is a development environment and can reset. A fresh canonical deployment requires your local GenLayer account to be unlocked; never send the account password to anyone.

```powershell
npx genlayer account unlock
npm run deploy:contract
```

Update `deployments/studionet.json` with the resulting address and contract version. `VITE_GENLAYER_CONTRACT_ADDRESS` is an optional emergency override. If the wallet has no test GEN, use the faucet in GenLayer Studio.

## Verify everything

Python 3.12 is required for contract checks.

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
npm run verify
npm run test:integration
npx wrangler deploy --dry-run
```

`npm run verify` runs the GenVM linter and type checker, eight direct contract scenarios, client/Worker unit tests, and a production build. `test:integration` deploys a temporary v2 contract and exercises its two-wallet lobby and species state on Studionet.

## Free versus paid boundaries

Current provider limits as of August 24, 2026:

| Service | Free MVP allowance | Payment becomes necessary |
| --- | --- | --- |
| Privy | 0–499 monthly active users, 50,000 monthly signatures, and $1M monthly transaction volume | 500–2,499 MAU is currently $299/month; higher tiers increase from there |
| GenLayer | Studionet is a hosted development network with a faucet | Production/mainnet economics are a launch decision; do not promise free production transactions |
| Cloudflare Workers | 100,000 dynamic requests/day; static assets are free and unlimited | Workers Paid starts at $5/month when free limits or CPU constraints are insufficient |
| Workers AI | 10,000 neurons/day; portraits are rendered at 480×480 so they remain valid ancestry inputs | More generations than the daily neuron allowance requires Workers Paid; free accounts fail closed instead of charging overage |
| D1 | 5M rows read/day, 100K rows written/day, 5 GB total storage | Paid Workers removes daily free-plan cutoffs and bills beyond its included monthly usage |
| R2 Standard | 10 GB-month storage, 1M Class A operations, 10M Class B operations/month, free egress | R2 subscription checkout/payment setup may be required immediately; actual usage is $0 while inside the allowance |
| Hosting/domain | The `workers.dev` URL is enough for the MVP | A custom domain is optional and normally paid through a registrar |

There is no service that must incur usage charges for the private MVP. The practical account blockers are a free Privy App ID and Cloudflare login/R2 checkout. Spending becomes unavoidable only after the limits above, when choosing a paid custom domain, or when moving from Studionet to a production network with transaction costs.

Provider references: [Privy pricing](https://www.privy.io/pricing), [GenLayer networks](https://docs.genlayer.com/developers/networks), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), [FLUX.2 Klein pricing](https://developers.cloudflare.com/workers-ai/models/flux-2-klein-4b/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), and [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

See `ARCHITECTURE.md` for trust boundaries and `SECURITY.md` for the security posture and known dependency advisory.
