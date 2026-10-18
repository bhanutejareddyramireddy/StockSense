import pytest
from backend.app.schemas.models import ScenarioChangeRequest
from backend.app.inventory.engine import ReplenishmentEngine
from backend.app.scenarios.simulator import ScenarioSimulator

def test_zero_stock_scenario():
    base = ReplenishmentEngine.calculate_order_proposal(
        sku="SKU3", daily_forecast=10, lead_days=3, on_hand=30, moq=5
    )
    assert base.suggested_order_units == 0  # Covered

    req = ScenarioChangeRequest(sku="SKU3", scenario_type="zero_stock")
    sim = ScenarioSimulator.run_simulation(original_proposal=base, request=req)

    assert sim.revised.on_hand == 0
    assert sim.revised.suggested_order_units == 30
    assert sim.delta_order_units == 30
    assert len(sim.new_risks_and_uncertainty) > 0

def test_delayed_inbound_scenario():
    # Base: target 30, on_hand 10, inbound 20 -> position 30 -> order 0
    base = ReplenishmentEngine.calculate_order_proposal(
        sku="SKU1", daily_forecast=10, lead_days=3, on_hand=10, inbound_due_before_need=20, moq=5
    )
    assert base.suggested_order_units == 0

    # Delay inbound: ineligibility forces order of 20
    req = ScenarioChangeRequest(sku="SKU1", scenario_type="delayed_inbound", inbound_delayed_days=4)
    sim = ScenarioSimulator.run_simulation(original_proposal=base, request=req)

    assert sim.revised.inbound_due_before_need == 0
    assert sim.revised.suggested_order_units == 20
    assert sim.delta_order_units == 20
    assert "Inbound shipment will arrive too late" in sim.new_risks_and_uncertainty[0]

def test_demand_surge_scenario():
    base = ReplenishmentEngine.calculate_order_proposal(
        sku="SKU2", daily_forecast=10, lead_days=3, on_hand=20, moq=5
    )
    # Original: target 30, on_hand 20 -> shortfall 10 -> order 10
    assert base.suggested_order_units == 10

    req = ScenarioChangeRequest(sku="SKU2", scenario_type="demand_surge", demand_multiplier=1.5)
    sim = ScenarioSimulator.run_simulation(original_proposal=base, request=req)

    # Surge demand to 15: target 45, on_hand 20 -> shortfall 25 -> order 25
    assert sim.revised.daily_forecast == 15.0
    assert sim.revised.target_inventory == 45.0
    assert sim.revised.suggested_order_units == 25
    assert sim.delta_order_units == 15
