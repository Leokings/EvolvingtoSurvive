# EvolvingtoSurvive — More-information response

> **New two-wallet gameplay proof:** The follow-up live run now includes 19 successful StudioNet transactions across world creation, second-wallet join, founder verification, two complete commit/lock/reveal eras, two accepted mutations, and evolved portrait verification. See [`LIVE_GAMEPLAY_EVIDENCE.md`](./LIVE_GAMEPLAY_EVIDENCE.md).

Updated: September 15, 2026

## Paste-ready response

The live portrait-verification failure has been fixed and redeployed. The root cause was a portrait-only transaction adapter that converted already-valid JSON-RPC hex quantities (`nonce`, `gas`, `gasPrice`, and `value`) into JavaScript `bigint` values before handing the transaction to Privy's external-wallet path. Privy then passed those values to the EIP-1193 provider, where JSON serialization failed before `eth_sendTransaction` could be submitted.

Portrait verification now uses the same normal connected-wallet EIP-1193 flow as the rest of the application. A boundary guard recursively converts any unexpected `bigint` to its exact canonical hexadecimal quantity without converting it through `number`, rounding it, or altering the encoded contract calldata. Negative quantities fail explicitly.

The generated portrait lifecycle was also corrected. A candidate is saved before wallet submission and is deleted from the retry cache only after the verification transaction reaches successful contract execution and the updated state is read back. If wallet or RPC submission fails, the next click downloads and submits the same candidate ID, URL, SHA-256 digest, and byte content; it does not generate another image. A validator rejection is handled separately and permits a genuinely new candidate.

Regression coverage now exercises the real GenLayer SDK encoding path for `verify_portrait` with a 65,536-byte candidate, both ancestor byte arrays, and RPC quantities larger than JavaScript's safe-integer range. The test decodes the outer `addTransaction` call and proves the inner application calldata is byte-for-byte equal to the expected `verify_portrait` calldata. A second regression reproduces the prior `Do not know how to serialize a BigInt` submission failure and proves the retry uses the identical cached candidate and pixels while invoking the generator exactly once.

The patch is live at <https://evolving-to-survive.vercel.app>. The Vercel production deployment completed successfully, the fresh-page production smoke test reported no browser errors or error overlay, and the production portrait service returned real image bytes whose SHA-256 digest matched its response.

Finally, a new two-wallet flow was executed against the deployed GenLayer StudioNet contract and production portrait worker—not the training simulation. Both founder `verify_portrait` calls reached `FINALIZED` with successful contract execution. A new, independent `LATEST_FINAL` client read then showed both founders as canonical after the original process had ended, and the generated URLs returned immutable canonical images with matching hashes. The planet was started successfully and read back as `status=active`, `phase=commit`, proving the next evolution action is available.

## Production endpoints

- Website: <https://evolving-to-survive.vercel.app>
- Immutable Vercel deployment: <https://evolving-to-survive-p859lrj9m-leokings588-5902s-projects.vercel.app>
- Deployment details: <https://vercel.com/leokings588-5902s-projects/evolving-to-survive/9JERyYurCb2PMDyqNyzUst7qXtU7>
- GitHub repository: <https://github.com/Leokings/EvolvingtoSurvive>
- StudioNet contract: [`0x579B79Ba871FA7a99E747026C5030D6d462C5118`](https://explorer-studio.genlayer.com/address/0x579B79Ba871FA7a99E747026C5030D6d462C5118)
- Production portrait service: <https://evolving-to-survive.leokings588.workers.dev/api/health>

## Live transaction evidence

All receipts below were checked for both lifecycle status and GenVM execution result. `FINALIZED` alone was not treated as proof of successful execution.

| Action | StudioNet transaction | Status | GenVM execution |
| --- | --- | --- | --- |
| Create `Serialization Reef C9ac64` | [`0xde67fc88…0246d5`](https://explorer-studio.genlayer.com/tx/0xde67fc88ff912d1e346b83f3c17210d6a78392b5ddfce0508f47cbf75a0246d5) | `FINALIZED` | `SUCCESS` |
| Join with the second wallet | [`0xc03b4d1e…232e78`](https://explorer-studio.genlayer.com/tx/0xc03b4d1e44cd192ac9079bd596f31809193c6be753d522d42a5d104389232e78) | `FINALIZED` | `SUCCESS` |
| Verify Hexwing founder portrait | [`0xaf7917a3…dc29d7`](https://explorer-studio.genlayer.com/tx/0xaf7917a322f85ebdb7a2fd7db64566b57e8f63e348a90d6ddbde4a5b7ddc29d7) | `FINALIZED` | `SUCCESS` |
| Verify Tidecrawler founder portrait | [`0x4705a4ca…35d52d`](https://explorer-studio.genlayer.com/tx/0x4705a4ca5e3e43e91fe134a0ec0eb88602c5aa3449edb4c44e0ef2a77035d52d) | `FINALIZED` | `SUCCESS` |
| Start planet / unlock evolution | [`0xc4752c3b…5b1ff2`](https://explorer-studio.genlayer.com/tx/0xc4752c3b49d4c28736a086b9c4a8944323edcb9cdc508199e4b7b5c2ac5b1ff2) | `FINALIZED` | `SUCCESS` |

Live flow identifiers:

- Planet: `ets2-6` (`Serialization Reef C9ac64`)
- Creator: `0x991C3F284e85C2F4c766a8805e1DaCf02dC9ac64`
- Challenger: `0xfB0ea5D43190e2e79D1E5356810bd97b22c5676C`
- Final state: `active`, phase `commit`, revision `5`, two ecosystems

## Canonical portrait readback

### Hexwing (`ets2-6-s1`)

- Contract status: `accepted`
- Candidate ID: `5149bc35-45d3-4e67-875d-872f2a8abd41`
- Canonical image: <https://evolving-to-survive.leokings588.workers.dev/api/portraits/5149bc35-45d3-4e67-875d-872f2a8abd41>
- Submitted bytes: `40,302`
- Contract SHA-256: `sha256:0b349fb66d0200043d8954f878072bc018f1fefa1fff349f4fe3cfe1dd155ad7`
- Fresh-download digest matched: `true`
- Storage response: `public, max-age=31536000, immutable`

### Tidecrawler (`ets2-6-s2`)

- Contract status: `accepted`
- Candidate ID: `b1f2e0fb-0929-4c3c-b913-ca2df2fc5909`
- Canonical image: <https://evolving-to-survive.leokings588.workers.dev/api/portraits/b1f2e0fb-0929-4c3c-b913-ca2df2fc5909>
- Submitted bytes: `35,400`
- Contract SHA-256: `sha256:38ba9f4c322e0195770ba6c23cbf8db1e4795144b8a9fe9484de713edc20eb96`
- Fresh-download digest matched: `true`
- Storage response: `public, max-age=31536000, immutable`

The fresh-process readback returned:

```json
{
  "transactionHashVariant": "LATEST_FINAL",
  "planet_id": "ets2-6",
  "status": "active",
  "phase": "commit",
  "revision": 5,
  "player_count": 2,
  "founder_portraits": ["accepted", "accepted"],
  "next_evolution_action_available": true
}
```

## Verification results

- GenVM lint: passed (`3` lint passes; contract schema: `17` methods, `7` view, `10` write)
- GenVM typecheck: passed with `0` errors and `0` warnings
- Direct contract tests: `9 passed`
- Frontend unit/regression tests: `41 passed` across `11` files
- TypeScript typecheck: passed
- Production Vite build: passed
- Contextual desktop/mobile UI checks: passed
- Readability checks: passed; no text below `9px` and no horizontal overflow
- Containment checks: `94` scenarios clean, `0` failures
- Baseline StudioNet integration: passed with two wallets and two founders
- Opt-in live portrait lifecycle: `1 passed` with real `FINALIZED / SUCCESS` transactions and `LATEST_FINAL` readback
- Fresh production smoke: website loaded without browser errors; portrait API returned `201`; downloaded image digest matched

## Reproduction commands

The standard non-mutating verification is:

```powershell
npm ci
py -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
npm run verify
npm run test:visual
npm run test:readability
npm run test:containment
```

The stateful proof is opt-in because it creates real StudioNet transactions:

```powershell
$env:ETS_LIVE_PORTRAIT_PROOF = "1"
.venv\Scripts\gltest.exe tests/integration/test_live_portrait_flow.py -v -s --network studionet
```

The proof runner submits each write once, retains its hash, tolerates transient StudioNet RPC polling failures, waits for `FINALIZED`, asserts GenVM `SUCCESS`, and then verifies state through `LATEST_FINAL` reads.
