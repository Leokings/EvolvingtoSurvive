# EvolvingtoSurvive — Live Two-Wallet Gameplay Evidence

This is submission-ready evidence from the deployed EvolvingtoSurvive v2 contract on GenLayer StudioNet. It is a complete real two-wallet match, not the training simulation. The world was ended through its normal fourth-era resolution rather than cancelled or abandoned.

## Deployment

- Live app: <https://evolving-to-survive.vercel.app>
- GitHub: <https://github.com/Leokings/EvolvingtoSurvive>
- Network: GenLayer StudioNet
- Contract: [`0x579B79Ba871FA7a99E747026C5030D6d462C5118`](https://explorer-studio.genlayer.com/address/0x579B79Ba871FA7a99E747026C5030D6d462C5118)
- World: `Wallet Duel 2d3f82`
- World ID: `ets2-7`
- Creator wallet: `0x81C7583c5Eb4Fe9D72E4F59dB4b1E47a5b2d3f82`
- Challenger wallet: `0xDbFC2e70880eAab71dcc8a429d1F2B5E2E8b2711`

The two test-only wallets are locally recoverable, but their private keys are deliberately excluded from Git and from this evidence.

## Transaction history

Every transaction below reached `FINALIZED` and its leader receipt reported `SUCCESS`. Portrait validation outcomes are reported separately because a successful contract execution can legitimately record a rejected image candidate.

### World setup and founder gate

| Action | Wallet | Transaction |
|---|---|---|
| Create `Wallet Duel 2d3f82` | Creator | [`0x685ee80e…234744b`](https://explorer-studio.genlayer.com/tx/0x685ee80e49c0a19e9afca981f83f802d036e9f72ad864a78db5da1f07234744b) |
| Join world as `Tidecrawler` | Challenger | [`0x5e3afc5b…20a9bd`](https://explorer-studio.genlayer.com/tx/0x5e3afc5bec94ddfbf21d5f77f8e21778c184c1d3d744aba73bb583ac1320a9bd) |
| Verify `Cinderwing` founder portrait | Creator | [`0x1a1c500e…be34189`](https://explorer-studio.genlayer.com/tx/0x1a1c500e7a2905b574d172a5e65f53e1c91cdc595bc37c1ee7c3e9035be34189) |
| Verify `Tidecrawler` founder portrait | Challenger | [`0x0a44df19…dc87ce`](https://explorer-studio.genlayer.com/tx/0x0a44df19be5eee996c61f65388e913de528106ad59405ff1f1eaa6a447dc87ce) |
| Start natural selection | Creator | [`0x05ff4eca…c6b5c`](https://explorer-studio.genlayer.com/tx/0x05ff4eca5131b3f710dad2a2cf351b5dfaadb313e02ddd4dc6614a9cea7c6b5c) |

### Era 1 — Cinder Season

| Action | Wallet | Transaction |
|---|---|---|
| Commit hidden thermal adaptation | Creator | [`0x4f6f0060…e539fd`](https://explorer-studio.genlayer.com/tx/0x4f6f00605bf92522ec37bf88ce4559d370c722d0f0966f1c1a54250d42e539fd) |
| Commit hidden conserve action | Challenger | [`0xa9c3c839…d1c6c1`](https://explorer-studio.genlayer.com/tx/0xa9c3c83920f8ddaf9e049509d4f0d7f1c82a3a26c7fc50a75e3589d59ed1c6c1) |
| Lock action plan | Creator | [`0x82ca6367…87aca`](https://explorer-studio.genlayer.com/tx/0x82ca636784bfe860425412016aa84e2e4c187f2cfeb58d40db05601fa3187aca) |
| Lock action plan | Challenger | [`0xcfbe6ddb…0d811c`](https://explorer-studio.genlayer.com/tx/0xcfbe6ddb7ae10f12c878dc4542faf24f13b8e365e5b1896e37548ccd040d811c) |
| Reveal thermal adaptation | Creator | [`0xcd974ce9…82fe9`](https://explorer-studio.genlayer.com/tx/0xcd974ce94c6f1275069b6b624f025aeaece72909f8cf5dad8986e0d6bbf82fe9) |
| Reveal conserve action and resolve era | Challenger | [`0xc4ba1ae5…41881`](https://explorer-studio.genlayer.com/tx/0xc4ba1ae54dffd4b7d6f24bd1b467822441755e8c2aa31f158b00543957841881) |
| Verify evolved `Cinderwing` portrait | Creator | [`0x0f8fe253…1a0aa`](https://explorer-studio.genlayer.com/tx/0x0f8fe253f2dac784d07192a39ce9eee24d2869b40101fa58e1b963dfcf11a0aa) |

Era 1 readback:

- Validator consensus accepted `Subplate Cooling Vasculature` with reason `ok`.
- The creator combined `keratin_plates` and `antifreeze_blood`.
- `Cinderwing` thermal stat increased from `3` to `6` (`+3`).
- New ancestry node: `ets2-7-n1`; its evolved portrait is `accepted` and canonical.
- The challenger successfully conserved and drew `digestive_vats`.

### Era 2 — Ash Lung

| Action | Wallet | Transaction |
|---|---|---|
| Commit hidden conserve action | Creator | [`0x6aece598…1ff2dd`](https://explorer-studio.genlayer.com/tx/0x6aece598b73c6344d55abaf0b13368ae257f7500b86bd0f93bf7bfd1531ff2dd) |
| Commit hidden respiration adaptation | Challenger | [`0x714fc2b9…52c0d8`](https://explorer-studio.genlayer.com/tx/0x714fc2b96538ea870e6c348b999a9104c76bdfdc89f8b7345dbd477f8652c0d8) |
| Lock action plan | Creator | [`0xe82bda77…f50124`](https://explorer-studio.genlayer.com/tx/0xe82bda773d1ba57ced434049bb7bc1880929acc09f565600191647b884f50124) |
| Lock action plan | Challenger | [`0xedd26a62…a2cf`](https://explorer-studio.genlayer.com/tx/0xedd26a625e4bc5145dc2877f83868de03eb679c3158f11b8a5a033369864a2cf) |
| Reveal conserve action | Creator | [`0x8565f690…1fd30`](https://explorer-studio.genlayer.com/tx/0x8565f690e9116620b5d978fb4e9a5f8437a3d337f19ec0dc228935dd5ad1fd30) |
| Reveal respiration adaptation and resolve era | Challenger | [`0xe4e7e3eb…d8b6a`](https://explorer-studio.genlayer.com/tx/0xe4e7e3eb99d05d7efa746cfbaf10832124379bb7e03285446e639fcb23bd8b6a) |
| Verify evolved `Tidecrawler` portrait | Challenger | [`0x1534f1b2…310736`](https://explorer-studio.genlayer.com/tx/0x1534f1b21342f6d45d23da23e81c56ab27a16a8577fc397c64b857c868310736) |

Era 2 readback:

- The creator successfully conserved and drew `compound_eyes`.
- Validator consensus accepted `Ash-filtering hollow gills` with reason `ok`.
- The challenger combined `hollow_bones` and `filter_gills`.
- `Tidecrawler` respiration stat increased from `3` to `6` (`+3`).
- New ancestry node: `ets2-7-n2`; its evolved portrait is `accepted` and canonical.

### Era 3 — Walking Caldera

| Action | Wallet | Transaction |
|---|---|---|
| Commit hidden conserve action | Creator | [`0x9bd67737…0e8267`](https://explorer-studio.genlayer.com/tx/0x9bd6773777904acec310aaf072fb5b049d99a5941d7a2300b6f474a0b70e8267) |
| Commit hidden conserve action | Challenger | [`0xfb35d7f8…6f53fb`](https://explorer-studio.genlayer.com/tx/0xfb35d7f8105f906aa7ddb1d2bfab146287c12a8809ef52db3a001b26b36f53fb) |
| Lock action plan | Creator | [`0xe0b24f12…c5b46f`](https://explorer-studio.genlayer.com/tx/0xe0b24f12141fe2447ad4272453f6c8f5ff4161dd0df178551103123fe1c5b46f) |
| Lock action plan | Challenger | [`0x919d6fd0…b2d6f1`](https://explorer-studio.genlayer.com/tx/0x919d6fd00faacf03e6abc01b91ef73dcd517a2d8afa6cbae46ef850c29b2d6f1) |
| Reveal conserve action | Creator | [`0x2eb59d6c…81c8db`](https://explorer-studio.genlayer.com/tx/0x2eb59d6c4b4d9761c62911548ebd8c1063969a378d63c996833c797b1881c8db) |
| Reveal conserve action and resolve era | Challenger | [`0xc404d988…13c4a7`](https://explorer-studio.genlayer.com/tx/0xc404d98838dd4744583fc8246fb73432d9f7e82cb19003bf87a6b9f46913c4a7) |

Era 3 readback:

- Both wallets successfully revealed their independent conserve plans.
- The creator drew `symbiotic_algae`; the challenger drew `filter_gills`.
- The `Walking Caldera` mobility hazard resolved against both ecosystems.
- Both ecosystems survived and the contract opened era 4 for parallel planning.

### Era 4 — Black Drought and world ending

| Action | Wallet | Transaction |
|---|---|---|
| Commit hidden water adaptation | Creator | [`0xba763146…e29ad`](https://explorer-studio.genlayer.com/tx/0xba763146cbc2aaf64cc3829411ca77fb52e5220d63ccbecd7befad422efe29ad) |
| Commit hidden conserve action | Challenger | [`0x16b53e73…999a5`](https://explorer-studio.genlayer.com/tx/0x16b53e7364521fb51e87962d412845167cf884106e7a914bd5a9e9262ac999a5) |
| Lock action plan | Creator | [`0x2bbfaab3…4c9a3`](https://explorer-studio.genlayer.com/tx/0x2bbfaab3f53f0ce1e3b0753c5541af57f88d07b5b18b4f456097e2ecaa14c9a3) |
| Lock action plan and open reveal phase | Challenger | [`0x5f9b9d32…3fb8f`](https://explorer-studio.genlayer.com/tx/0x5f9b9d323e2808d60622f66967d046e97a34638b8f21e726e9fb24d8b303fb8f) |
| Reveal water adaptation | Creator | [`0x88f8b47f…bdd14`](https://explorer-studio.genlayer.com/tx/0x88f8b47f6d529b374b7040e02893ec8e8b2e0678d98b77573c5f0967fd9bdd14) |
| Reveal conserve action, resolve Black Drought, and end world | Challenger | [`0x25e3e13d…90e10`](https://explorer-studio.genlayer.com/tx/0x25e3e13d7c8e9b35779ad746791fb8251a40bb8836a5653d0ddb34022ac90e10) |
| Verify evolved portrait candidate 1 (`missing_traits`) | Creator | [`0x94669915…00f20`](https://explorer-studio.genlayer.com/tx/0x946699159d0260648b8c4dc3792cc75d0b498d6258cfb40ed3fe6eb79f900f20) |
| Verify replacement portrait (`accepted`) | Creator | [`0xaff7e835…9c452`](https://explorer-studio.genlayer.com/tx/0xaff7e83560b44b0e69b90c75264ef7ab5fa5e51d1aa9c198844b3aa4f1a9c452) |

Era 4 and ending readback:

- Validator consensus accepted `Algal Filter-Recycling Gills` with reason `ok`.
- The creator combined `filter_gills` and `symbiotic_algae`.
- `Cinderwing` water increased from `3` to `6` (`+3`), allowing its population of `2` to survive `Black Drought`.
- New ancestry node: `ets2-7-n3`; the first image candidate was recorded as `rejected / missing_traits`, then the replacement was `accepted` and canonical with SHA-256 `sha256:2d4367c6f9eb721f58820b194716f6edbf93ed98e72cbc16b847fd3e678fa1a3`.
- The challenger successfully revealed its conserve action, but `Tidecrawler` had water `3` against threshold `6` and became extinct.
- The second wallet's final reveal resolved the era, ended the world, and recorded the creator as winner.

## Final on-chain readback

After the transactions above, a `LATEST_FINAL` contract read returned:

| Field | Value |
|---|---|
| Status | `complete` |
| Era | `4` |
| Phase | empty (no further actions) |
| Winner | Creator — `0x81C7583c5Eb4Fe9D72E4F59dB4b1E47a5b2d3f82` |
| Revision | `41` |
| Revealed action-history records | `8` |
| Cinderwing | alive; population `2`; mutations `2`; thermal `6`; water `6` |
| Tidecrawler | extinct; population `0`; mutations `1`; respiration `6`; water `3` |
| Current portrait status for both species | `accepted` |

This readback proves the second wallet did more than join: both addresses independently committed, locked, and revealed in all four eras. The final reveal ended the world through normal gameplay, persisted the extinction outcome, and recorded an on-chain winner. In total, the run produced `33` transactions with `FINALIZED / SUCCESS` receipts.

## Reproducible verification

The opt-in integration test is `tests/integration/test_live_gameplay_flow.py`. It saves transaction hashes before polling, verifies both `FINALIZED` status and execution success, checks final readback, and can resume using the same local test wallets without exposing their keys.

```powershell
$env:ETS_LIVE_GAMEPLAY_PROOF = "1"
.venv\Scripts\gltest.exe tests/integration/test_live_gameplay_flow.py -v -s --network studionet
```

Proof execution: the first two eras passed in `1204.32s (20:04)`; the resume-safe continuation through era 3 passed in `304.70s (05:04)`; and the normal final-era ending plus canonical portrait retry passed in `474.99s (07:54)`. A fresh completed-world rerun then passed in `60.15s` with the transaction count still exactly `33`, proving earlier writes were reused rather than duplicated.
