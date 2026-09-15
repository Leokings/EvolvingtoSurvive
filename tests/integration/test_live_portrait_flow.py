r"""Opt-in, stateful StudioNet proof for the complete founder portrait gate.

Run explicitly with:
  $env:ETS_LIVE_PORTRAIT_PROOF = "1"
  .venv\Scripts\gltest.exe tests/integration/test_live_portrait_flow.py -v -s --network studionet

The test deliberately creates real StudioNet transactions. It is skipped during
ordinary test runs so CI does not mutate shared chain state.
"""

from hashlib import sha256
import json
import os
from time import sleep
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import pytest

from gltest import create_accounts, get_contract_factory
from gltest.assertions import tx_execution_succeeded
from gltest.clients import get_gl_client
from gltest.types import TransactionHashVariant, TransactionStatus
from genlayer_py.exceptions import GenLayerError
from genlayer_py.types import CalldataAddress


CONTRACT_ADDRESS = "0x579B79Ba871FA7a99E747026C5030D6d462C5118"
PORTRAIT_API = "https://evolving-to-survive.leokings588.workers.dev"
FINALIZED_WAIT_MS = 4_000
FINALIZED_RETRIES = 90


pytestmark = pytest.mark.skipif(
    os.getenv("ETS_LIVE_PORTRAIT_PROOF") != "1",
    reason="set ETS_LIVE_PORTRAIT_PROOF=1 to create real StudioNet transactions",
)


def read_final(read, attempts=12):
    """Retry LATEST_FINAL reads while the StudioNet read endpoint catches up."""
    last_error = None
    for attempt in range(attempts):
        try:
            return read(TransactionHashVariant.LATEST_FINAL)
        except GenLayerError as error:
            last_error = error
            if attempt < attempts - 1:
                sleep(min(attempt + 1, 4))
    raise last_error


def transact_finalized(contract, function_name, args):
    """Submit once, then survive transient RPC failures while polling its hash."""
    client = get_gl_client()
    tx_hash = client.write_contract(
        address=contract.address,
        function_name=function_name,
        account=contract.account,
        value=0,
        leader_only=False,
        args=args,
    )
    print(f"SUBMITTED {function_name} {tx_hash}", flush=True)

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
            print(f"FINALIZED {function_name} {tx_hash} SUCCESS", flush=True)
            return receipt
        except (GenLayerError, ValueError) as error:
            last_error = error
            sleep(FINALIZED_WAIT_MS / 1_000)
    raise AssertionError(
        f"{function_name} {tx_hash} did not finalize: {last_error}"
    )


def receipt_evidence(action, receipt):
    leader = (receipt.get("consensus_data", {}).get("leader_receipt") or [{}])[0]
    return {
        "action": action,
        "transaction_hash": receipt.get("tx_id") or receipt.get("hash"),
        "status": receipt.get("status_name"),
        "execution_result": leader.get("execution_result"),
    }


def post_json(url, payload):
    last_error = None
    for attempt in range(4):
        request = Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "content-type": "application/json",
                "origin": "https://evolving-to-survive.vercel.app",
                "user-agent": "Mozilla/5.0 EvolvingtoSurvive-Live-Proof/1.0",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=190) as response:
                return response.status, json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError) as error:
            last_error = error
            if attempt < 3:
                sleep(2 * (attempt + 1))
    raise AssertionError(f"Portrait API request failed after retries: {last_error}")


def fetch_bytes(url):
    request = Request(
        url,
        headers={
            "origin": "https://evolving-to-survive.vercel.app",
            "user-agent": "Mozilla/5.0 EvolvingtoSurvive-Live-Proof/1.0",
        },
    )
    with urlopen(request, timeout=30) as response:
        return response.status, response.headers.get_content_type(), response.read()


def generate_founder_candidate(planet_id, species, reuse_existing):
    node = species["nodes"][0]
    status, candidate = post_json(
        f"{PORTRAIT_API}/api/portraits/generate",
        {
            "planetId": planet_id,
            "nodeId": node["node_id"],
            "nodeKind": "founder",
            "speciesOwner": species["owner"],
            "speciesName": species["name"],
            "bodyPlan": species["body_plan"],
            "founderDescription": species["founder_description"],
            "phenotypeSummary": node["phenotype_summary"],
            "visualTraits": node["visual_traits"],
            "ancestorUrls": [],
            "reuseExisting": reuse_existing,
        },
    )
    assert status in (200, 201)
    image_status, mime_type, image_bytes = fetch_bytes(candidate["url"])
    assert image_status == 200
    assert mime_type in ("image/jpeg", "image/png", "image/webp")
    assert f"sha256:{sha256(image_bytes).hexdigest()}" == candidate["sha256"]
    return candidate, image_bytes


def canonicalize(candidate, species):
    node = species["nodes"][0]
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


def verify_founder(contract, planet_id, species, evidence):
    """Generate until accepted; every submitted transaction must execute cleanly."""
    node = species["nodes"][0]
    for attempt in range(1, 7):
        candidate, image_bytes = generate_founder_candidate(
            planet_id,
            species,
            reuse_existing=attempt == 1,
        )
        receipt = transact_finalized(
            contract,
            "verify_portrait",
            [
                planet_id,
                species["species_id"],
                node["node_id"],
                candidate["url"],
                candidate["sha256"],
                image_bytes,
                b"",
                b"",
            ],
        )
        tx = receipt_evidence("verify_portrait", receipt)
        tx.update({
            "candidate_id": candidate["candidateId"],
            "candidate_sha256": candidate["sha256"],
            "candidate_bytes": len(image_bytes),
            "attempt": attempt,
        })
        evidence.append(tx)

        state = read_final(
            lambda variant: contract.get_planet(
                args=[planet_id, CalldataAddress(contract.account.address)]
            ).call(transaction_hash_variant=variant)
        )
        current = next(
            item for item in state["species"]
            if item["species_id"] == species["species_id"]
        )
        portrait = current["nodes"][0]["portrait"]
        print(
            f"PORTRAIT_READBACK {species['species_id']} "
            f"status={portrait['status']} reason={portrait['reason_code']} "
            f"candidate={candidate['candidateId']}",
            flush=True,
        )
        if portrait["status"] == "accepted":
            assert portrait["url"] == candidate["url"]
            assert portrait["sha256"] == candidate["sha256"]
            canonicalize(candidate, current)
            return current, candidate

        species = current

    pytest.fail(f"Founder portrait was not accepted after {attempt} real candidates")


def test_live_founder_portraits_finalize_and_unlock_evolution():
    creator, challenger = create_accounts(2)
    creator_address = CalldataAddress(creator.address)
    factory = get_contract_factory("EvolvingtoSurvive")
    contract = factory.build_contract(CONTRACT_ADDRESS, account=creator)
    challenger_contract = contract.connect(challenger)
    evidence = []

    planet_name = f"Serialization Reef {creator.address[-6:]}"
    evidence.append(receipt_evidence(
        "create_planet",
        transact_finalized(contract, "create_planet", [
            planet_name,
            "ember_wastes",
            2,
            4,
            300,
            "Hexwing",
            "quadruped",
            "A low four-legged alien with crystalline heat-shield scales and two wide cooling fins.",
        ]),
    ))

    creator_state = read_final(
        lambda variant: contract.get_player_planet(args=[creator_address]).call(
            transaction_hash_variant=variant
        )
    )
    planet_id = creator_state["planet_id"]

    evidence.append(receipt_evidence(
        "join_planet",
        transact_finalized(challenger_contract, "join_planet", [
            planet_id,
            "Tidecrawler",
            "quadruped",
            "A low four-legged alien with smooth blue skin and a broad tail.",
        ]),
    ))

    creator_state = read_final(
        lambda variant: contract.get_planet(args=[planet_id, creator_address]).call(
            transaction_hash_variant=variant
        )
    )
    creator_species = next(
        species for species in creator_state["species"]
        if species["owner"].lower() == creator.address.lower()
    )
    challenger_species = next(
        species for species in creator_state["species"]
        if species["owner"].lower() == challenger.address.lower()
    )

    creator_species, creator_candidate = verify_founder(
        contract, planet_id, creator_species, evidence
    )
    challenger_species, challenger_candidate = verify_founder(
        challenger_contract, planet_id, challenger_species, evidence
    )

    evidence.append(receipt_evidence(
        "start_planet",
        transact_finalized(contract, "start_planet", [planet_id]),
    ))

    final_state = read_final(
        lambda variant: contract.get_planet(args=[planet_id, creator_address]).call(
            transaction_hash_variant=variant
        )
    )
    assert final_state["status"] == "active"
    assert final_state["phase"] == "commit"
    assert final_state["revision"] >= 5
    assert all(
        species["nodes"][0]["portrait"]["status"] == "accepted"
        for species in final_state["species"]
    )

    print("LIVE_PORTRAIT_EVIDENCE=" + json.dumps({
        "network": "GenLayer Studionet",
        "contract_address": CONTRACT_ADDRESS,
        "planet_id": planet_id,
        "planet_name": planet_name,
        "creator": creator.address,
        "challenger": challenger.address,
        "transactions": evidence,
        "readback": {
            "status": final_state["status"],
            "phase": final_state["phase"],
            "revision": final_state["revision"],
            "player_count": final_state["player_count"],
            "founder_portraits": [
                {
                    "species_id": species["species_id"],
                    "name": species["name"],
                    "portrait_status": species["nodes"][0]["portrait"]["status"],
                    "portrait_url": species["nodes"][0]["portrait"]["url"],
                    "portrait_sha256": species["nodes"][0]["portrait"]["sha256"],
                }
                for species in final_state["species"]
            ],
            "next_evolution_action_available": final_state["phase"] == "commit",
        },
        "canonical_candidates": [
            creator_candidate["candidateId"],
            challenger_candidate["candidateId"],
        ],
    }, separators=(",", ":")))
