# EvolvingtoSurvive — Live Two-Wallet Gameplay Evidence

This is submission-ready evidence from the deployed EvolvingtoSurvive v2 contract on GenLayer StudioNet. It is a real two-wallet match, not the training simulation.

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

Every transaction below reached `FINALIZED` and its leader receipt reported `SUCCESS`.

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

## Final on-chain readback

After the transactions above, a `LATEST_FINAL` contract read returned:

| Field | Value |
|---|---|
| Status | `active` |
| Era | `4` |
| Phase | `commit` |
| Revision | `31` |
| Revealed action-history records | `6` |
| Cinderwing population / mutation / key stat | `2` / `1` / thermal `6` |
| Tidecrawler population / mutation / key stat | `2` / `1` / respiration `6` |
| Current portrait status for both species | `accepted` |

This readback proves the second wallet did more than join: both addresses independently committed, locked, and revealed in three complete eras, and the contract advanced from era 1 to era 4 with the resulting state preserved.

## Reproducible verification

The opt-in integration test is `tests/integration/test_live_gameplay_flow.py`. It saves transaction hashes before polling, verifies both `FINALIZED` status and execution success, checks final readback, and can resume using the same local test wallets without exposing their keys.

```powershell
$env:ETS_LIVE_GAMEPLAY_PROOF = "1"
.venv\Scripts\gltest.exe tests/integration/test_live_gameplay_flow.py -v -s --network studionet
```

Proof execution: the first two eras passed in `1204.32s (20:04)`; the resume-safe same-wallet continuation through era 3 passed in `304.70s (05:04)` without duplicating earlier transactions.
