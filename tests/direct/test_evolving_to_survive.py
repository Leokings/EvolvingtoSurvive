from datetime import datetime, timezone
import hashlib
import json


CONTRACT = "contracts/evolving_to_survive_v2.py"
EVOLUTION_PROMPT = r"(?s).*EvolvingtoSurvive natural-selection council.*"
PORTRAIT_PROMPT = r"(?s).*EvolvingtoSurvive phenotype image verifier.*"

THERMAL_EVOLUTION = (
    '{"accepted":true,"reason_code":"ok",'
    '"adaptation_class":"thermal","adaptation_name":"Cinder Carapace",'
    '"phenotype_summary":"Overlapping heat-dispersing plates cover the core '
    'while cool capillary channels protect its organs.",'
    '"visual_traits":["overlapping mineral plates",'
    '"cool blue capillary channels"]}'
)

RESPIRATION_EVOLUTION = (
    '{"accepted":true,"reason_code":"ok",'
    '"adaptation_class":"respiration","adaptation_name":"Tidal Lungweave",'
    '"phenotype_summary":"Layered gill fans feed a light branching lung '
    'network inherited from both parent lineages.",'
    '"visual_traits":["layered external gill fans",'
    '"expanded breathing chambers"]}'
)

PORTRAIT_ACCEPTED = (
    '{"accepted":true,"identity_preserved":true,'
    '"required_traits_present":true,"contradictions_absent":true,'
    '"safe":true,"reason_code":"ok"}'
)

PORTRAIT_REJECTED = (
    '{"accepted":false,"identity_preserved":true,'
    '"required_traits_present":false,"contradictions_absent":true,'
    '"safe":true,"reason_code":"missing_traits"}'
)


def address(value):
    from genlayer.py.types import Address

    return Address(value)


def address_text(value):
    return str(address(value)).lower()


def deploy_for(direct_vm, direct_deploy, player):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = player
    return contract


def player_view(contract, player):
    return contract.get_player_planet(address(player))


def species_for(view, player, living_only=False):
    owner = address_text(player)
    result = [item for item in view["species"] if item["owner"] == owner]
    if living_only:
        result = [item for item in result if item["alive"]]
    return result


def founder_for(view, player):
    return species_for(view, player)[0]


def image_for(label):
    return b"\x89PNG\r\n\x1a\n" + (label.encode("ascii") * 30)


def image_digest(image):
    return "sha256:" + hashlib.sha256(image).hexdigest()


def mock_portrait(direct_vm, response=PORTRAIT_ACCEPTED):
    direct_vm.mock_llm(PORTRAIT_PROMPT, response)


def mock_evolution(direct_vm, response):
    direct_vm.mock_llm(EVOLUTION_PROMPT, response)


def create_planet(contract, direct_vm, creator, max_players=2):
    direct_vm.sender = creator
    contract.create_planet(
        "Pyra Prime",
        "ember_wastes",
        max_players,
        4,
        300,
        "Cindermite",
        "quadruped",
        "A low four-legged grazer with dark skin and heat-sensitive whiskers.",
    )
    return player_view(contract, creator)["planet_id"]


def join_planet(contract, direct_vm, planet_id, player):
    direct_vm.sender = player
    contract.join_planet(
        planet_id,
        "Tideglass",
        "amphibious",
        "A translucent shore crawler with broad feet and rhythmic throat sacs.",
    )


def verify_current_portrait(
    contract,
    direct_vm,
    player,
    planet_id,
    species,
    candidate,
    ancestor_a=b"",
    ancestor_b=b"",
    response=PORTRAIT_ACCEPTED,
):
    direct_vm.sender = player
    mock_portrait(direct_vm, response)
    contract.verify_portrait(
        planet_id,
        species["species_id"],
        species["current_node_id"],
        f"https://portraits.example/{species['current_node_id']}.webp",
        image_digest(candidate),
        candidate,
        ancestor_a,
        ancestor_b,
    )
    assert direct_vm.run_validator() is True


def create_join_and_start(contract, direct_vm, alice, bob):
    planet_id = create_planet(contract, direct_vm, alice)
    join_planet(contract, direct_vm, planet_id, bob)
    alice_founder = founder_for(player_view(contract, alice), alice)
    bob_founder = founder_for(player_view(contract, bob), bob)
    alice_image = image_for("alice-founder")
    bob_image = image_for("bob-founder")
    verify_current_portrait(
        contract, direct_vm, alice, planet_id, alice_founder, alice_image
    )
    verify_current_portrait(
        contract, direct_vm, bob, planet_id, bob_founder, bob_image
    )
    direct_vm.sender = alice
    contract.start_planet(planet_id)
    return planet_id, alice_image, bob_image


def action_payload(
    planet_id,
    era,
    owner,
    slot,
    kind,
    species_id,
    *,
    cost=1,
    secondary_species_id="",
    first_gene="",
    second_gene="",
    proposal="",
    child_name="",
    salt_suffix="default",
):
    return {
        "planet_id": planet_id,
        "era": era,
        "owner": address_text(owner),
        "slot": slot,
        "cost": cost,
        "kind": kind,
        "species_id": species_id,
        "secondary_species_id": secondary_species_id,
        "first_gene": first_gene,
        "second_gene": second_gene,
        "proposal": proposal,
        "child_name": child_name,
        "salt": (f"ets-v2-test-{salt_suffix}-" + ("x" * 80))[:64],
    }


def commitment(payload):
    encoded = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    return "sha256:" + hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def commit_payload(contract, direct_vm, player, payload):
    direct_vm.sender = player
    contract.commit_action(payload["planet_id"], commitment(payload), payload["cost"])


def reveal_payload(contract, direct_vm, player, payload):
    direct_vm.sender = player
    contract.reveal_action(
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
    )


def lock_players(contract, direct_vm, planet_id, *players):
    for player in players:
        direct_vm.sender = player
        contract.lock_actions(planet_id)


def conserve_payload(view, player, salt_suffix):
    species = species_for(view, player, living_only=True)[0]
    return action_payload(
        view["planet_id"],
        view["era"],
        player,
        0,
        "conserve",
        species["species_id"],
        salt_suffix=salt_suffix,
    )


def test_lobby_requires_founder_portraits_and_can_be_cancelled(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_for(direct_vm, direct_deploy, direct_alice)
    planet_id = create_planet(contract, direct_vm, direct_alice, max_players=3)
    join_planet(contract, direct_vm, planet_id, direct_bob)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("[EXPECTED] founder_portraits_not_ready"):
        contract.start_planet(planet_id)

    view = player_view(contract, direct_alice)
    lobby = contract.get_lobby(address(direct_bob))["planets"]
    assert planet_id == "ets2-1"
    assert view["status"] == "waiting"
    assert view["phase"] == ""
    assert len(view["your_species"]) == 1
    assert lobby[0]["founders_ready"] is False
    assert view["species"][0]["nodes"][0]["kind"] == "founder"

    contract.cancel_planet(planet_id)
    assert player_view(contract, direct_alice)["status"] == "cancelled"
    assert contract.get_lobby(address(direct_bob))["planets"] == []


def test_commitments_hide_actions_and_resolve_together(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_for(direct_vm, direct_deploy, direct_alice)
    planet_id, _alice_image, _bob_image = create_join_and_start(
        contract, direct_vm, direct_alice, direct_bob
    )
    view = player_view(contract, direct_alice)
    alice_action = conserve_payload(view, direct_alice, "alice-hidden")
    bob_action = conserve_payload(view, direct_bob, "bob-hidden")
    commit_payload(contract, direct_vm, direct_alice, alice_action)
    commit_payload(contract, direct_vm, direct_bob, bob_action)
    sealed = player_view(contract, direct_bob)
    assert len(sealed["round_actions"]) == 2
    assert "kind" not in sealed["round_actions"][0]

    lock_players(contract, direct_vm, planet_id, direct_alice, direct_bob)
    assert player_view(contract, direct_alice)["phase"] == "reveal"
    reveal_payload(contract, direct_vm, direct_alice, alice_action)
    halfway = player_view(contract, direct_alice)
    assert halfway["round_actions"][0]["kind"] == "conserve"
    assert halfway["round_actions"][1]["revealed"] is False
    reveal_payload(contract, direct_vm, direct_bob, bob_action)

    resolved = player_view(contract, direct_alice)
    alice_species = species_for(resolved, direct_alice, living_only=True)[0]
    assert resolved["era"] == 2
    assert resolved["phase"] == "commit"
    assert alice_species["population"] == 8
    assert len(alice_species["genes"]) == 9


def test_wrong_reveal_is_atomic(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_for(direct_vm, direct_deploy, direct_alice)
    planet_id, _alice_image, _bob_image = create_join_and_start(
        contract, direct_vm, direct_alice, direct_bob
    )
    view = player_view(contract, direct_alice)
    action = conserve_payload(view, direct_alice, "atomic")
    commit_payload(contract, direct_vm, direct_alice, action)
    lock_players(contract, direct_vm, planet_id, direct_alice, direct_bob)
    before = player_view(contract, direct_alice)
    wrong = dict(action)
    wrong["salt"] = "wrong-reveal-salt-" + ("z" * 48)
    with direct_vm.expect_revert("[EXPECTED] action_commitment_mismatch"):
        reveal_payload(contract, direct_vm, direct_alice, wrong)
    assert player_view(contract, direct_alice) == before


def test_adaptation_builds_a_one_parent_ancestry_node(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_for(direct_vm, direct_deploy, direct_alice)
    planet_id, alice_image, _bob_image = create_join_and_start(
        contract, direct_vm, direct_alice, direct_bob
    )
    view = player_view(contract, direct_alice)
    founder = founder_for(view, direct_alice)
    adapt = action_payload(
        planet_id,
        1,
        direct_alice,
        0,
        "adapt",
        founder["species_id"],
        first_gene="keratin_plates",
        second_gene="antifreeze_blood",
        proposal="Route cooled blood beneath overlapping keratin plates to shed volcanic heat.",
        salt_suffix="adapt",
    )
    conserve = conserve_payload(view, direct_bob, "bob-adapt")
    commit_payload(contract, direct_vm, direct_alice, adapt)
    commit_payload(contract, direct_vm, direct_bob, conserve)
    lock_players(contract, direct_vm, planet_id, direct_alice, direct_bob)
    mock_evolution(direct_vm, THERMAL_EVOLUTION)
    reveal_payload(contract, direct_vm, direct_alice, adapt)
    assert direct_vm.run_validator() is True
    reveal_payload(contract, direct_vm, direct_bob, conserve)

    evolved = species_for(
        player_view(contract, direct_alice), direct_alice, living_only=True
    )[0]
    assert evolved["stats"]["thermal"] == 6
    assert evolved["population"] == 12
    assert evolved["nodes"][-1]["parent_node_ids"] == [
        evolved["nodes"][0]["node_id"]
    ]
    assert evolved["nodes"][-1]["portrait"]["status"] == "pending"

    direct_vm.clear_mocks()
    candidate = image_for("alice-cinder-carapace")
    verify_current_portrait(
        contract,
        direct_vm,
        direct_alice,
        planet_id,
        evolved,
        candidate,
        alice_image,
    )
    canonical = species_for(player_view(contract, direct_alice), direct_alice)[0]
    assert canonical["portrait_sha256"] == image_digest(candidate)


def test_split_then_merge_creates_a_two_parent_dna_node(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_for(direct_vm, direct_deploy, direct_alice)
    planet_id, alice_image, _bob_image = create_join_and_start(
        contract, direct_vm, direct_alice, direct_bob
    )
    era_one = player_view(contract, direct_alice)
    founder = founder_for(era_one, direct_alice)
    split = action_payload(
        planet_id,
        1,
        direct_alice,
        0,
        "split",
        founder["species_id"],
        first_gene="keratin_plates",
        second_gene="antifreeze_blood",
        proposal="A highland branch grows heat-shedding plates and a cooler vascular core.",
        child_name="Cindercrest",
        salt_suffix="split",
    )
    bob_one = conserve_payload(era_one, direct_bob, "bob-split")
    commit_payload(contract, direct_vm, direct_alice, split)
    commit_payload(contract, direct_vm, direct_bob, bob_one)
    lock_players(contract, direct_vm, planet_id, direct_alice, direct_bob)
    mock_evolution(direct_vm, THERMAL_EVOLUTION)
    reveal_payload(contract, direct_vm, direct_alice, split)
    assert direct_vm.run_validator() is True
    reveal_payload(contract, direct_vm, direct_bob, bob_one)

    era_two = player_view(contract, direct_alice)
    living = species_for(era_two, direct_alice, living_only=True)
    parent = next(item for item in living if item["origin_kind"] == "founder")
    branch = next(item for item in living if item["origin_kind"] == "split")
    assert branch["nodes"][0]["parent_node_ids"] == [parent["current_node_id"]]
    branch_image = image_for("alice-cindercrest")
    direct_vm.clear_mocks()
    verify_current_portrait(
        contract,
        direct_vm,
        direct_alice,
        planet_id,
        branch,
        branch_image,
        alice_image,
    )

    merge = action_payload(
        planet_id,
        2,
        direct_alice,
        0,
        "merge",
        parent["species_id"],
        cost=2,
        secondary_species_id=branch["species_id"],
        first_gene="hollow_bones",
        second_gene="filter_gills",
        proposal="Fuse the light lung chambers with layered gills into one viable tidal hybrid.",
        child_name="Tidecinder",
        salt_suffix="merge",
    )
    bob_two = conserve_payload(era_two, direct_bob, "bob-merge")
    commit_payload(contract, direct_vm, direct_alice, merge)
    commit_payload(contract, direct_vm, direct_bob, bob_two)
    lock_players(contract, direct_vm, planet_id, direct_alice, direct_bob)
    mock_evolution(direct_vm, RESPIRATION_EVOLUTION)
    reveal_payload(contract, direct_vm, direct_alice, merge)
    assert direct_vm.run_validator() is True
    reveal_payload(contract, direct_vm, direct_bob, bob_two)

    resolved = player_view(contract, direct_alice)
    all_alice = species_for(resolved, direct_alice)
    hybrid = next(item for item in all_alice if item["origin_kind"] == "merge")
    retired = [item for item in all_alice if item["retired_reason"] == "merged"]
    assert len(retired) == 2
    assert hybrid["alive"] is True
    assert hybrid["stats"]["respiration"] == 5
    assert hybrid["nodes"][0]["parent_node_ids"] == [
        parent["current_node_id"],
        branch["current_node_id"],
    ]
    assert contract.get_contract_state()["total_merges"] == 1

    direct_vm.clear_mocks()
    verify_current_portrait(
        contract,
        direct_vm,
        direct_alice,
        planet_id,
        hybrid,
        image_for("tidecinder-hybrid"),
        alice_image,
        branch_image,
    )


def test_expired_unrevealed_commitment_is_penalized(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_for(direct_vm, direct_deploy, direct_alice)
    planet_id, _alice_image, _bob_image = create_join_and_start(
        contract, direct_vm, direct_alice, direct_bob
    )
    view = player_view(contract, direct_alice)
    alice_action = conserve_payload(view, direct_alice, "missed")
    bob_action = conserve_payload(view, direct_bob, "revealed")
    commit_payload(contract, direct_vm, direct_alice, alice_action)
    commit_payload(contract, direct_vm, direct_bob, bob_action)
    lock_players(contract, direct_vm, planet_id, direct_alice, direct_bob)
    reveal_payload(contract, direct_vm, direct_bob, bob_action)
    deadline = player_view(contract, direct_bob)["phase_deadline"]
    direct_vm.warp(datetime.fromtimestamp(deadline + 1, timezone.utc).isoformat())
    direct_vm.sender = direct_bob
    contract.advance_phase(planet_id)

    resolved = player_view(contract, direct_alice)
    alice_species = species_for(resolved, direct_alice, living_only=True)[0]
    assert alice_species["population"] == 6
    assert resolved["action_history"][0]["result"]["reason_code"] == (
        "commitment_not_revealed"
    )
    assert resolved["era"] == 2


def test_any_wallet_can_advance_an_expired_unlocked_commit_phase(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_for(direct_vm, direct_deploy, direct_alice)
    planet_id, _alice_image, _bob_image = create_join_and_start(
        contract, direct_vm, direct_alice, direct_bob
    )
    view = player_view(contract, direct_alice)
    commit_payload(
        contract,
        direct_vm,
        direct_alice,
        conserve_payload(view, direct_alice, "alice-unlocked"),
    )
    commit_payload(
        contract,
        direct_vm,
        direct_bob,
        conserve_payload(view, direct_bob, "bob-unlocked"),
    )
    committed = player_view(contract, direct_alice)
    assert committed["all_locked"] is False
    assert all(not state["locked"] for state in committed["round_players"].values())

    deadline = committed["phase_deadline"]
    direct_vm.warp(datetime.fromtimestamp(deadline, timezone.utc).isoformat())
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("[EXPECTED] commit_phase_not_ready"):
        contract.advance_phase(planet_id)

    direct_vm.warp(datetime.fromtimestamp(deadline + 1, timezone.utc).isoformat())
    contract.advance_phase(planet_id)
    reveal = player_view(contract, direct_bob)
    assert reveal["phase"] == "reveal"
    assert len(reveal["round_actions"]) == 2


def test_portrait_rejection_is_retryable_and_hash_precedes_ai(
    direct_vm, direct_deploy, direct_alice
):
    contract = deploy_for(direct_vm, direct_deploy, direct_alice)
    planet_id = create_planet(contract, direct_vm, direct_alice)
    species = founder_for(player_view(contract, direct_alice), direct_alice)
    candidate = image_for("retry-founder")
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("[EXPECTED] image_hash_mismatch"):
        contract.verify_portrait(
            planet_id,
            species["species_id"],
            species["current_node_id"],
            "https://portraits.example/wrong.webp",
            "sha256:" + ("0" * 64),
            candidate,
            b"",
            b"",
        )

    verify_current_portrait(
        contract,
        direct_vm,
        direct_alice,
        planet_id,
        species,
        candidate,
        response=PORTRAIT_REJECTED,
    )
    rejected = founder_for(player_view(contract, direct_alice), direct_alice)
    assert rejected["nodes"][0]["portrait"]["status"] == "rejected"
    assert rejected["nodes"][0]["portrait"]["attempts"] == 1

    direct_vm.clear_mocks()
    verify_current_portrait(
        contract, direct_vm, direct_alice, planet_id, rejected, candidate
    )
    accepted = founder_for(player_view(contract, direct_alice), direct_alice)
    assert accepted["nodes"][0]["portrait"]["status"] == "accepted"
    assert accepted["nodes"][0]["portrait"]["attempts"] == 2


def test_concession_settles_and_v2_identity_is_explicit(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_for(direct_vm, direct_deploy, direct_alice)
    state = contract.get_contract_state()
    assert state["version"] == 2
    assert state["architecture"] == "simultaneous-ecosystems-v2"
    assert state["commit_reveal"] is True
    assert state["max_species_per_wallet"] == 4
    assert state["evolution_energy_per_era"] == 2

    planet_id, _alice_image, _bob_image = create_join_and_start(
        contract, direct_vm, direct_alice, direct_bob
    )
    bob_species = founder_for(player_view(contract, direct_bob), direct_bob)
    direct_vm.sender = direct_bob
    contract.concede_species(planet_id, bob_species["species_id"])
    settled = player_view(contract, direct_alice)
    assert settled["status"] == "complete"
    assert settled["winner"] == address_text(direct_alice)
    assert contract.get_profile(address(direct_alice))["wins"] == 1
    assert contract.get_profile(address(direct_bob))["extinctions"] == 1
