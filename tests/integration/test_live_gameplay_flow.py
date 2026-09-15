r"""Opt-in, resumable two-wallet gameplay proof on GenLayer StudioNet.

Run explicitly with:
  $env:ETS_LIVE_GAMEPLAY_PROOF = "1"
  .venv\Scripts\gltest.exe tests/integration/test_live_gameplay_flow.py -v -s --network studionet

This test creates real transactions. The two test-only private keys and the
resume journal stay in the gitignored .live-gameplay directory; evidence
printed to stdout never includes those keys.
"""

from hashlib import sha256
import json
import os
from pathlib import Path
import secrets
from time import sleep
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import pytest

from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded
from gltest.clients import get_gl_client
from gltest.types import TransactionHashVariant, TransactionStatus
from genlayer_py import create_account
from genlayer_py.exceptions import GenLayerError
from genlayer_py.types import CalldataAddress


CONTRACT_ADDRESS = "0x579B79Ba871FA7a99E747026C5030D6d462C5118"
PORTRAIT_API = "https://evolving-to-survive.leokings588.workers.dev"
PROJECT_ROOT = Path(__file__).resolve().parents[2]
STATE_PATH = PROJECT_ROOT / ".live-gameplay" / "studionet-duel.json"
FINALIZED_WAIT_MS = 4_000
FINALIZED_RETRIES = 120


pytestmark = pytest.mark.skipif(
    os.getenv("ETS_LIVE_GAMEPLAY_PROOF") != "1",
    reason="set ETS_LIVE_GAMEPLAY_PROOF=1 to create real StudioNet transactions",
)


def save_state(state):
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = STATE_PATH.with_suffix(".tmp")
    temporary.write_text(json.dumps(state, indent=2), encoding="utf-8")
    temporary.replace(STATE_PATH)


def load_or_create_state():
    if STATE_PATH.exists():
        state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        assert state["contract_address"].lower() == CONTRACT_ADDRESS.lower()
        return state

    creator = create_account()
    challenger = create_account()
    suffix = creator.address[-6:].lower()
    state = {
        "network": "GenLayer StudioNet",
        "contract_address": CONTRACT_ADDRESS,
        "planet_id": "",
        "planet_name": f"Wallet Duel {suffix}",
        "wallets": {
            "creator": {
                "address": creator.address,
                "private_key": "0x" + creator.key.hex(),
            },
            "challenger": {
                "address": challenger.address,
                "private_key": "0x" + challenger.key.hex(),
            },
        },
        "transactions": {},
        "actions": {},
        "portrait_candidates": {},
    }
    save_state(state)
    print(
        "WALLETS_CREATED "
        f"creator={creator.address} challenger={challenger.address} "
        f"resume_journal={STATE_PATH}",
        flush=True,
    )
    return state


def read_final(read, attempts=20):
    last_error = None
    for attempt in range(attempts):
        try:
            return read(TransactionHashVariant.LATEST_FINAL)
        except GenLayerError as error:
            last_error = error
            if attempt < attempts - 1:
                sleep(min(attempt + 1, 5))
    raise last_error


def wait_for_success(tx_hash):
    client = get_gl_client()
    last_error = None
    for _attempt in range(FINALIZED_RETRIES):
        try:
            receipt = client.wait_for_transaction_receipt(
                transaction_hash=tx_hash,
                status=TransactionStatus.FINALIZED,
                interval=FINALIZED_WAIT_MS,
                retries=1,
            )
            assert receipt.get("status_name") == TransactionStatus.FINALIZED.value
            assert tx_execution_succeeded(receipt), json.dumps(receipt, default=str)
            return receipt
        except (GenLayerError, ValueError) as error:
            last_error = error
            sleep(FINALIZED_WAIT_MS / 1_000)
    raise AssertionError(f"{tx_hash} did not finalize successfully: {last_error}")


def ensure_transaction(state, step, actor, contract, function_name, args):
    existing = state["transactions"].get(step)
    if existing and existing.get("status") == "FINALIZED" and existing.get("execution_result") == "SUCCESS":
        print(f"REUSED {step} {existing['transaction_hash']} FINALIZED SUCCESS", flush=True)
        return existing

    if existing and existing.get("transaction_hash"):
        tx_hash = existing["transaction_hash"]
        print(f"RESUMING {step} {tx_hash}", flush=True)
    else:
        tx_hash = str(get_gl_client().write_contract(
            address=contract.address,
            function_name=function_name,
            account=contract.account,
            value=0,
            leader_only=False,
            args=args,
        ))
        state["transactions"][step] = {
            "step": step,
            "actor": actor,
            "function": function_name,
            "transaction_hash": tx_hash,
            "status": "SUBMITTED",
            "execution_result": "PENDING",
        }
        save_state(state)
        print(f"SUBMITTED {step} {tx_hash}", flush=True)

    receipt = wait_for_success(tx_hash)
    leader = (receipt.get("consensus_data", {}).get("leader_receipt") or [{}])[0]
    evidence = state["transactions"][step]
    evidence["status"] = receipt.get("status_name")
    evidence["execution_result"] = leader.get("execution_result")
    save_state(state)
    print(f"FINALIZED {step} {tx_hash} SUCCESS", flush=True)
    return evidence


def post_json(url, payload):
    last_error = None
    for attempt in range(5):
        request = Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "content-type": "application/json",
                "origin": "https://evolving-to-survive.vercel.app",
                "user-agent": "Mozilla/5.0 EvolvingtoSurvive-Live-Gameplay/1.0",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=190) as response:
                return response.status, json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError) as error:
            last_error = error
            if attempt < 4:
                sleep(2 * (attempt + 1))
    raise AssertionError(f"Portrait API request failed after retries: {last_error}")


def fetch_bytes(url):
    request = Request(
        url,
        headers={
            "origin": "https://evolving-to-survive.vercel.app",
            "user-agent": "Mozilla/5.0 EvolvingtoSurvive-Live-Gameplay/1.0",
        },
    )
    with urlopen(request, timeout=45) as response:
        body = response.read()
        assert response.status == 200
        assert response.headers.get_content_type() in ("image/jpeg", "image/png", "image/webp")
        return body


def read_planet(contract, planet_id, viewer):
    return read_final(
        lambda variant: contract.get_planet(
            args=[planet_id, CalldataAddress(viewer)]
        ).call(transaction_hash_variant=variant)
    )


def species_by_owner(planet, owner):
    return next(
        species for species in planet["species"]
        if species["owner"].lower() == owner.lower() and species["alive"]
    )


def node_by_id(planet, node_id):
    for species in planet["species"]:
        for node in species["nodes"]:
            if node["node_id"] == node_id:
                return species, node
    raise AssertionError(f"node {node_id} is absent from planet readback")


def candidate_for_node(state, planet, species, node):
    portrait_attempt = int(node["portrait"]["attempts"]) + 1
    saved = state["portrait_candidates"].get(node["node_id"])
    if saved and saved.get("attempt") == portrait_attempt:
        try:
            image_bytes = fetch_bytes(saved["url"])
            assert f"sha256:{sha256(image_bytes).hexdigest()}" == saved["sha256"]
            return saved, image_bytes
        except (HTTPError, URLError, TimeoutError, AssertionError):
            pass

    parent_urls = [
        node_by_id(planet, parent_id)[1]["portrait"]["url"]
        for parent_id in node["parent_node_ids"]
    ]
    status, candidate = post_json(
        f"{PORTRAIT_API}/api/portraits/generate",
        {
            "planetId": planet["planet_id"],
            "nodeId": node["node_id"],
            "nodeKind": node["kind"],
            "speciesOwner": species["owner"],
            "speciesName": species["name"],
            "bodyPlan": species["body_plan"],
            "founderDescription": species["founder_description"],
            "phenotypeSummary": node["phenotype_summary"],
            "visualTraits": node["visual_traits"],
            "ancestorUrls": parent_urls,
            "reuseExisting": portrait_attempt == 1,
        },
    )
    assert status in (200, 201)
    image_bytes = fetch_bytes(candidate["url"])
    assert f"sha256:{sha256(image_bytes).hexdigest()}" == candidate["sha256"]
    candidate["attempt"] = portrait_attempt
    candidate["byte_size"] = len(image_bytes)
    state["portrait_candidates"][node["node_id"]] = candidate
    save_state(state)
    return candidate, image_bytes


def canonicalize_portrait(species, node, candidate):
    status, result = post_json(
        f"{candidate['url']}/canonicalize",
        {
            "speciesOwner": species["owner"],
            "nodeId": node["node_id"],
            "sha256": candidate["sha256"],
        },
    )
    assert status == 200
    assert result == {"ok": True, "status": "canonical"}


def ensure_current_portrait(state, actor, contract, planet_id, species_id):
    for _attempt in range(6):
        planet = read_planet(contract, planet_id, contract.account.address)
        species = next(item for item in planet["species"] if item["species_id"] == species_id)
        node = next(item for item in species["nodes"] if item["node_id"] == species["current_node_id"])
        if node["portrait"]["status"] == "accepted":
            candidate = {
                "candidateId": node["portrait"]["url"].rstrip("/").split("/")[-1],
                "url": node["portrait"]["url"],
                "sha256": node["portrait"]["sha256"],
            }
            canonicalize_portrait(species, node, candidate)
            print(
                f"PORTRAIT_CANONICAL actor={actor} species={species_id} "
                f"node={node['node_id']} sha256={candidate['sha256']}",
                flush=True,
            )
            return node

        candidate, image_bytes = candidate_for_node(state, planet, species, node)
        ancestor_bytes = [
            fetch_bytes(node_by_id(planet, parent_id)[1]["portrait"]["url"])
            for parent_id in node["parent_node_ids"]
        ]
        while len(ancestor_bytes) < 2:
            ancestor_bytes.append(b"")
        tx_step = f"portrait.{node['node_id']}.attempt.{candidate['attempt']}"
        ensure_transaction(
            state,
            tx_step,
            actor,
            contract,
            "verify_portrait",
            [
                planet_id,
                species_id,
                node["node_id"],
                candidate["url"],
                candidate["sha256"],
                image_bytes,
                ancestor_bytes[0],
                ancestor_bytes[1],
            ],
        )
        updated = read_planet(contract, planet_id, contract.account.address)
        _updated_species, updated_node = node_by_id(updated, node["node_id"])
        print(
            f"PORTRAIT_READBACK actor={actor} node={node['node_id']} "
            f"status={updated_node['portrait']['status']} "
            f"reason={updated_node['portrait']['reason_code']}",
            flush=True,
        )

    pytest.fail(f"portrait for {species_id} was not accepted after six real candidates")


def canonical_payload(payload):
    return json.dumps(payload, separators=(",", ":"), sort_keys=True)


def action_commitment(payload):
    return "sha256:" + sha256(canonical_payload(payload).encode("utf-8")).hexdigest()


def prepare_action(state, era, actor, owner, species_id, kind):
    era_actions = state["actions"].setdefault(str(era), {})
    if actor in era_actions:
        return era_actions[actor]

    if kind == "adapt_thermal":
        action_kind = "adapt"
        first_gene = "keratin_plates"
        second_gene = "antifreeze_blood"
        proposal = (
            "Route cooled antifreeze blood beneath overlapping keratin plates "
            "to shield vital tissue from the cinder season."
        )
    elif kind == "adapt_respiration":
        action_kind = "adapt"
        first_gene = "hollow_bones"
        second_gene = "filter_gills"
        proposal = (
            "Link expanded chambers in the hollow bones to layered filter gills "
            "so volcanic glass is trapped before oxygen exchange."
        )
    else:
        action_kind = "conserve"
        first_gene = ""
        second_gene = ""
        proposal = ""

    payload = {
        "planet_id": state["planet_id"].lower(),
        "era": era,
        "owner": owner.lower(),
        "slot": 0,
        "cost": 1,
        "kind": action_kind,
        "species_id": species_id.lower(),
        "secondary_species_id": "",
        "first_gene": first_gene,
        "second_gene": second_gene,
        "proposal": proposal,
        "child_name": "",
        "salt": secrets.token_hex(32),
    }
    era_actions[actor] = payload
    save_state(state)
    return payload


def reveal_args(payload):
    return [
        payload["planet_id"],
        payload["slot"],
        payload["kind"],
        payload["species_id"],
        payload["secondary_species_id"],
        payload["first_gene"],
        payload["second_gene"],
        payload["proposal"],
        payload["child_name"],
        payload["salt"],
    ]


def play_era(state, era, creator_contract, challenger_contract, action_kinds):
    contracts = {"creator": creator_contract, "challenger": challenger_contract}
    planet = read_planet(creator_contract, state["planet_id"], creator_contract.account.address)
    if int(planet["era"]) > era or planet["status"] == "complete":
        print(f"ERA_REUSED era={era} current_era={planet['era']} status={planet['status']}", flush=True)
        return planet
    assert int(planet["era"]) == era
    assert planet["phase"] in ("commit", "reveal")

    payloads = {}
    for actor, contract in contracts.items():
        species = species_by_owner(planet, contract.account.address)
        payloads[actor] = prepare_action(
            state,
            era,
            actor,
            species["owner"],
            species["species_id"],
            action_kinds[actor],
        )

    if planet["phase"] == "commit":
        for actor, contract in contracts.items():
            planet = read_planet(contract, state["planet_id"], contract.account.address)
            owner = contract.account.address.lower()
            already_committed = any(
                action["owner"].lower() == owner and int(action["slot"]) == 0
                for action in planet["round_actions"]
            )
            if not already_committed:
                payload = payloads[actor]
                ensure_transaction(
                    state,
                    f"era.{era}.{actor}.commit",
                    actor,
                    contract,
                    "commit_action",
                    [state["planet_id"], action_commitment(payload), payload["cost"]],
                )

        for actor, contract in contracts.items():
            planet = read_planet(contract, state["planet_id"], contract.account.address)
            owner = contract.account.address.lower()
            if planet["phase"] == "commit" and not planet["round_players"][owner]["locked"]:
                ensure_transaction(
                    state,
                    f"era.{era}.{actor}.lock",
                    actor,
                    contract,
                    "lock_actions",
                    [state["planet_id"]],
                )

    for actor, contract in contracts.items():
        planet = read_planet(contract, state["planet_id"], contract.account.address)
        if int(planet["era"]) > era or planet["status"] == "complete":
            break
        assert planet["phase"] == "reveal"
        owner = contract.account.address.lower()
        revealed = any(
            action["owner"].lower() == owner
            and int(action["slot"]) == 0
            and action["revealed"]
            for action in planet["round_actions"]
        )
        if not revealed:
            ensure_transaction(
                state,
                f"era.{era}.{actor}.reveal",
                actor,
                contract,
                "reveal_action",
                reveal_args(payloads[actor]),
            )

    resolved = read_planet(creator_contract, state["planet_id"], creator_contract.account.address)
    assert int(resolved["era"]) > era or resolved["status"] == "complete"
    era_history = resolved["action_history"][-2:]
    assert len(era_history) == 2
    print(
        "ERA_RESOLVED " + json.dumps({
            "era": era,
            "next_era": resolved["era"],
            "status": resolved["status"],
            "phase": resolved["phase"],
            "actions": [
                {
                    "owner": item["owner"],
                    "kind": item["kind"],
                    "decision": item.get("decision"),
                    "result": item.get("result"),
                }
                for item in era_history
            ],
        }, separators=(",", ":")),
        flush=True,
    )
    return resolved


def public_evidence(state, final_state):
    return {
        "network": state["network"],
        "contract_address": state["contract_address"],
        "planet_id": state["planet_id"],
        "planet_name": state["planet_name"],
        "wallets": {
            actor: details["address"] for actor, details in state["wallets"].items()
        },
        "transactions": list(state["transactions"].values()),
        "readback": {
            "status": final_state["status"],
            "era": final_state["era"],
            "phase": final_state["phase"],
            "revision": final_state["revision"],
            "last_event": final_state["last_event"],
            "action_history": [
                {
                    "owner": action["owner"],
                    "kind": action["kind"],
                    "revealed": action["revealed"],
                    "decision": action.get("decision"),
                    "result": action.get("result"),
                }
                for action in final_state["action_history"]
            ],
            "species": [
                {
                    "owner": species["owner"],
                    "species_id": species["species_id"],
                    "name": species["name"],
                    "population": species["population"],
                    "stats": species["stats"],
                    "accepted_mutations": species["accepted_mutations"],
                    "portrait_status": next(
                        node["portrait"]["status"] for node in species["nodes"]
                        if node["node_id"] == species["current_node_id"]
                    ),
                }
                for species in final_state["species"]
            ],
        },
    }


def test_two_wallets_complete_two_live_eras():
    state = load_or_create_state()
    creator = create_account(state["wallets"]["creator"]["private_key"])
    challenger = create_account(state["wallets"]["challenger"]["private_key"])
    assert creator.address.lower() == state["wallets"]["creator"]["address"].lower()
    assert challenger.address.lower() == state["wallets"]["challenger"]["address"].lower()

    factory = get_contract_factory("EvolvingtoSurvive")
    creator_contract = factory.build_contract(CONTRACT_ADDRESS, account=creator)
    challenger_contract = creator_contract.connect(challenger)

    if not state["planet_id"]:
        player_state = read_final(
            lambda variant: creator_contract.get_player_planet(
                args=[CalldataAddress(creator.address)]
            ).call(transaction_hash_variant=variant)
        )
        if player_state.get("exists"):
            state["planet_id"] = player_state["planet_id"]
            state["planet_name"] = player_state["name"]
            save_state(state)
        else:
            ensure_transaction(
                state,
                "setup.create",
                "creator",
                creator_contract,
                "create_planet",
                [
                    state["planet_name"],
                    "ember_wastes",
                    2,
                    4,
                    86_400,
                    "Cinderwing",
                    "quadruped",
                    "A low four-legged alien with dark heat-shield plates and wide cooling fins.",
                ],
            )
            player_state = read_final(
                lambda variant: creator_contract.get_player_planet(
                    args=[CalldataAddress(creator.address)]
                ).call(transaction_hash_variant=variant)
            )
            state["planet_id"] = player_state["planet_id"]
            save_state(state)

    planet = read_planet(creator_contract, state["planet_id"], creator.address)
    if challenger.address.lower() not in [player.lower() for player in planet["players"]]:
        ensure_transaction(
            state,
            "setup.join",
            "challenger",
            challenger_contract,
            "join_planet",
            [
                state["planet_id"],
                "Tidecrawler",
                "amphibious",
                "A blue amphibious alien with layered gills, a broad tail, and protected eyes.",
            ],
        )

    planet = read_planet(creator_contract, state["planet_id"], creator.address)
    creator_species = species_by_owner(planet, creator.address)
    challenger_species = species_by_owner(planet, challenger.address)
    ensure_current_portrait(
        state, "creator", creator_contract, state["planet_id"], creator_species["species_id"]
    )
    ensure_current_portrait(
        state, "challenger", challenger_contract, state["planet_id"], challenger_species["species_id"]
    )

    planet = read_planet(creator_contract, state["planet_id"], creator.address)
    if planet["status"] == "waiting":
        ensure_transaction(
            state,
            "setup.start",
            "creator",
            creator_contract,
            "start_planet",
            [state["planet_id"]],
        )

    play_era(
        state,
        1,
        creator_contract,
        challenger_contract,
        {"creator": "adapt_thermal", "challenger": "conserve"},
    )

    planet = read_planet(creator_contract, state["planet_id"], creator.address)
    for actor, contract in (("creator", creator_contract), ("challenger", challenger_contract)):
        species = species_by_owner(planet, contract.account.address)
        ensure_current_portrait(
            state, actor, contract, state["planet_id"], species["species_id"]
        )

    play_era(
        state,
        2,
        creator_contract,
        challenger_contract,
        {"creator": "conserve", "challenger": "adapt_respiration"},
    )

    final_state = read_planet(creator_contract, state["planet_id"], creator.address)
    for actor, contract in (("creator", creator_contract), ("challenger", challenger_contract)):
        species = species_by_owner(final_state, contract.account.address)
        ensure_current_portrait(
            state, actor, contract, state["planet_id"], species["species_id"]
        )
    final_state = read_planet(creator_contract, state["planet_id"], creator.address)

    assert final_state["status"] == "active"
    assert final_state["era"] == 3
    assert final_state["phase"] == "commit"
    assert len(final_state["action_history"]) == 4
    assert all(action["revealed"] for action in final_state["action_history"])
    assert all(
        transaction["status"] == "FINALIZED"
        and transaction["execution_result"] == "SUCCESS"
        for transaction in state["transactions"].values()
    )

    evidence = public_evidence(state, final_state)
    print("LIVE_GAMEPLAY_EVIDENCE=" + json.dumps(evidence, separators=(",", ":")), flush=True)
