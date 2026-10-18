import pytest
from backend.app.inventory.engine import ReplenishmentEngine

def test_five_public_inventory_reference_examples():
    """
    Public check:
    SKU1: forecast=10, lead=3, on_hand=10, inbound=0, reserved=0, moq=5 -> expected 20
    SKU2: forecast=10, lead=3, on_hand=20, inbound=0, reserved=0, moq=5 -> expected 10
    SKU3: forecast=10, lead=3, on_hand=30, inbound=0, reserved=0, moq=5 -> expected 0
    SKU4: forecast=10, lead=3, on_hand=40, inbound=0, reserved=0, moq=5 -> expected 0
    SKU5: forecast=10, lead=3, on_hand=50, inbound=0, reserved=0, moq=5 -> expected 0
    """
    res = ReplenishmentEngine.test_five_reference_examples()
    assert res["all_passed"] is True
    assert len(res["results"]) == 5
    for r in res["results"]:
        assert r["passed"] is True
        assert r["actual_order_units"] == r["expected_order_units"]

def test_order_quantity_never_negative():
    # If on_hand exceeds target, order must be 0, never negative
    proposal = ReplenishmentEngine.calculate_order_proposal(
        sku="TEST_SKU",
        daily_forecast=5,
        lead_days=3,
        on_hand=100,  # Surplus stock
        inbound_due_before_need=0,
        reserved=0,
        moq=5
    )
    assert proposal.raw_shortfall == 0.0
    assert proposal.suggested_order_units == 0

def test_moq_and_pack_size_rounding():
    # Target = 10 * 3 = 30. Position = 18. Shortfall = 12.
    # Case 1: MOQ = 5, pack_size = 1 -> ceil(12/5)*5 = 15
    prop1 = ReplenishmentEngine.calculate_order_proposal(
        sku="SKU1",
        daily_forecast=10,
        lead_days=3,
        on_hand=18,
        inbound_due_before_need=0,
        reserved=0,
        moq=5,
        pack_size=1
    )
    assert prop1.raw_shortfall == 12.0
    assert prop1.suggested_order_units == 15

    # Case 2: MOQ = 5, pack_size = 10 -> ceil(12/10)*10 = 20
    prop2 = ReplenishmentEngine.calculate_order_proposal(
        sku="SKU1",
        daily_forecast=10,
        lead_days=3,
        on_hand=18,
        inbound_due_before_need=0,
        reserved=0,
        moq=5,
        pack_size=10
    )
    assert prop2.suggested_order_units == 20

def test_reserved_stock_reduces_position():
    # Target = 30. on_hand = 30.
    # If reserved = 10, position = 30 - 10 = 20. Shortfall = 10.
    prop = ReplenishmentEngine.calculate_order_proposal(
        sku="SKU1",
        daily_forecast=10,
        lead_days=3,
        on_hand=30,
        inbound_due_before_need=0,
        reserved=10,
        moq=5
    )
    assert prop.stock_position == 20.0
    assert prop.raw_shortfall == 10.0
    assert prop.suggested_order_units == 10

def test_eligible_inbound_prevents_order():
    # Target = 30. on_hand = 10.
    # Inbound arriving on time = 20. Position = 10 + 20 = 30. Shortfall = 0.
    prop = ReplenishmentEngine.calculate_order_proposal(
        sku="SKU1",
        daily_forecast=10,
        lead_days=3,
        on_hand=10,
        inbound_due_before_need=20,
        reserved=0,
        moq=5
    )
    assert prop.stock_position == 30.0
    assert prop.raw_shortfall == 0.0
    assert prop.suggested_order_units == 0

def test_zero_stock_produces_critical_alert_and_order():
    prop = ReplenishmentEngine.calculate_order_proposal(
        sku="SKU1",
        daily_forecast=10,
        lead_days=3,
        on_hand=0,
        inbound_due_before_need=0,
        reserved=0,
        moq=5
    )
    assert prop.target_inventory == 30.0
    assert prop.raw_shortfall == 30.0
    assert prop.suggested_order_units == 30
    assert "Critical" in prop.risk_level

def test_changed_input_lead_time_shock():
    """
    Changed input test required by rubric:
    Start with reference SKU2: forecast=10, lead=3, on_hand=20 -> order=10.
    Change lead_days from 3 to 5.
    Target becomes 10 * 5 = 50.
    Position = 20. Shortfall = 30.
    Expected order becomes 30.
    """
    original = ReplenishmentEngine.calculate_order_proposal(
        sku="SKU2", daily_forecast=10, lead_days=3, on_hand=20, moq=5
    )
    assert original.suggested_order_units == 10

    revised = ReplenishmentEngine.calculate_order_proposal(
        sku="SKU2", daily_forecast=10, lead_days=5, on_hand=20, moq=5
    )
    assert revised.target_inventory == 50.0
    assert revised.raw_shortfall == 30.0
    assert revised.suggested_order_units == 30
    assert revised.suggested_order_units > original.suggested_order_units
