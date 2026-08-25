from time import sleep

from gltest import create_accounts, get_contract_factory
from gltest.assertions import tx_execution_succeeded
from genlayer_py.exceptions import GenLayerError
from genlayer_py.types import CalldataAddress


def read_with_retry(read, attempts=8):
    """Studionet can briefly lag a finalized write on its read endpoint."""
    last_error = None
    for attempt in range(attempts):
        try:
            return read()
        except GenLayerError as error:
            last_error = error
            if attempt < attempts - 1:
                sleep(attempt + 1)
    raise last_error


def test_v2_lobby_species_and_contract_metadata_on_studionet():
    creator, challenger = create_accounts(2)
    creator_arg = CalldataAddress(creator.address)
    challenger_arg = CalldataAddress(challenger.address)
    factory = get_contract_factory("EvolvingtoSurvive")
    contract = factory.deploy(args=[], account=creator)
    challenger_contract = contract.connect(challenger)
    print(
        f"Studionet EvolvingtoSurvive v2 contract: {contract.address}; "
        f"creator: {creator.address}; challenger: {challenger.address}"
    )

    create_receipt = contract.create_planet(args=[
        "Integration Pyra V2",
        "ember_wastes",
        2,
        4,
        300,
        "Cindermite",
        "quadruped",
        "A low four-legged grazer with dark skin and heat-sensitive whiskers.",
    ]).transact()
    assert tx_execution_succeeded(create_receipt)

    waiting = read_with_retry(
        lambda: contract.get_player_planet(args=[creator_arg]).call()
    )
    assert waiting["status"] == "waiting"
    assert waiting["planet_id"] == "ets2-1"
    assert waiting["phase"] == ""
    assert waiting["max_species_per_wallet"] == 4
    assert waiting["evolution_energy_per_era"] == 2
    assert len(waiting["your_species"]) == 1
    founder = waiting["your_species"][0]
    assert founder["origin_kind"] == "founder"
    assert founder["nodes"][0]["portrait"]["status"] == "pending"
    assert len(founder["genes"]) == 8

    join_receipt = challenger_contract.join_planet(args=[
        waiting["planet_id"],
        "Tideglass",
        "serpentine",
        "A long translucent shore crawler with rhythmic throat sacs and broad fins.",
    ]).transact()
    assert tx_execution_succeeded(join_receipt)

    creator_view = read_with_retry(
        lambda: contract.get_planet(args=[waiting["planet_id"], creator_arg]).call()
    )
    challenger_view = read_with_retry(
        lambda: challenger_contract.get_planet(
            args=[waiting["planet_id"], challenger_arg]
        ).call()
    )
    assert creator_view["status"] == "waiting"
    assert creator_view["player_count"] == 2
    assert len(creator_view["species"]) == 2
    assert len(creator_view["your_species"]) == 1
    assert challenger_view["your_species"][0]["name"] == "Tideglass"
    assert challenger_view["your_species"][0]["body_plan"] == "serpentine"

    lobby = read_with_retry(
        lambda: contract.get_lobby(args=[creator_arg]).call()
    )
    assert len(lobby["planets"]) == 1
    assert lobby["planets"][0]["planet_id"] == "ets2-1"
    assert lobby["planets"][0]["founders_ready"] is False

    state = contract.get_contract_state().call()
    assert state["name"] == "EvolvingtoSurvive"
    assert state["version"] == 2
    assert state["architecture"] == "simultaneous-ecosystems-v2"
    assert state["commit_reveal"] is True
    assert state["max_species_per_wallet"] == 4
    print(
        f"Studionet v2 lobby verified: {contract.address}; "
        f"{creator_view['player_count']} ecosystems, {len(creator_view['species'])} founders"
    )
