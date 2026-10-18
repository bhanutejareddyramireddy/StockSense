import math
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from backend.app.schemas.models import ReplenishmentProposal, ReplenishmentResponse

class ReplenishmentEngine:
    @staticmethod
    def calculate_order_proposal(
        sku: str,
        daily_forecast: float,
        lead_days: int,
        on_hand: int,
        inbound_due_before_need: int = 0,
        reserved: int = 0,
        moq: int = 5,
        pack_size: int = 1,
        as_of_date: str = "2026-09-12"
    ) -> ReplenishmentProposal:
        """
        Executes the exact C19 replenishment rule:
        Target = daily_forecast * lead_days;
        position = on_hand + inbound_due_before_need - reserved;
        raw = max(0, target - position);
        round positive raw up to MOQ and pack_size multiple.
        """
        target = float(daily_forecast * lead_days)
        position = float(on_hand + inbound_due_before_need - reserved)
        raw_shortfall = max(0.0, target - position)

        suggested_order = 0
        warnings = []

        if raw_shortfall > 0:
            # First satisfy MOQ
            units_needed = max(raw_shortfall, float(moq))
            
            # Apply pack size multiple if specified
            effective_pack = max(1, pack_size)
            suggested_order = int(math.ceil(units_needed / effective_pack) * effective_pack)
            
            # Ensure it is also an integer multiple of MOQ if pack_size < moq
            if moq > 0 and (suggested_order % moq != 0) and (effective_pack == 1):
                suggested_order = int(math.ceil(suggested_order / moq) * moq)
        else:
            suggested_order = 0

        # Calendar day arithmetic for arrival date
        as_of_dt = datetime.strptime(as_of_date, "%Y-%m-%d")
        expected_arrival_dt = as_of_dt + timedelta(days=lead_days)
        expected_arrival_str = expected_arrival_dt.strftime("%Y-%m-%d")

        # Usable stock for coverage calculation
        usable_stock = max(0, on_hand - reserved)
        if daily_forecast > 0:
            coverage_current = round(usable_stock / daily_forecast, 1)
            projected_coverage = round((usable_stock + inbound_due_before_need) / daily_forecast, 1)
            stockout_days = int(math.floor(usable_stock / daily_forecast))
            stockout_dt = as_of_dt + timedelta(days=stockout_days)
            stockout_str = stockout_dt.strftime("%Y-%m-%d")
        else:
            coverage_current = None
            projected_coverage = None
            stockout_str = None
            warnings.append("Daily forecast is zero; coverage is infinite.")

        # Determine risk level
        if on_hand == 0:
            risk_level = "Critical (Stockout)"
        elif coverage_current is not None and coverage_current < lead_days:
            risk_level = "Critical (Stockout Before Delivery)"
        elif coverage_current is not None and coverage_current < (lead_days * 1.5):
            risk_level = "Warning (Low Coverage)"
        elif coverage_current is not None and coverage_current > (lead_days * 5):
            risk_level = "Overstocked"
        else:
            risk_level = "Healthy"

        # Plain language explanation
        if suggested_order > 0:
            explanation = (
                f"We recommend ordering {suggested_order} units. Current stock position is {int(position)} "
                f"units (On Hand: {on_hand}, Inbound: {inbound_due_before_need}, Reserved: {reserved}), "
                f"which is below the {target:.0f}-unit target needed to cover demand during the {lead_days}-day "
                f"supplier lead time. Shortfall was {raw_shortfall:.1f} units, adjusted for supplier MOQ ({moq}) "
                f"and pack size ({pack_size}). Estimated arrival is {expected_arrival_str}."
            )
        else:
            explanation = (
                f"No replenishment order needed today. Current stock position of {int(position)} units is sufficient "
                f"to cover expected demand of {target:.0f} units over the {lead_days}-day lead time "
                f"until at least {stockout_str or 'future dates'}."
            )

        if inbound_due_before_need > 0:
            explanation += f" Inbound order of {inbound_due_before_need} units arriving before need date was included."

        return ReplenishmentProposal(
            sku=sku,
            daily_forecast=round(daily_forecast, 2),
            lead_days=lead_days,
            target_inventory=round(target, 2),
            on_hand=on_hand,
            inbound_due_before_need=inbound_due_before_need,
            reserved=reserved,
            stock_position=round(position, 2),
            raw_shortfall=round(raw_shortfall, 2),
            moq=moq,
            pack_size=pack_size,
            suggested_order_units=suggested_order,
            coverage_days_current=coverage_current,
            coverage_days_projected=projected_coverage,
            projected_stockout_date=stockout_str,
            expected_arrival_date=expected_arrival_str,
            risk_level=risk_level,
            explanation=explanation,
            warnings=warnings
        )

    @classmethod
    def test_five_reference_examples(cls) -> Dict[str, Any]:
        """
        Tests the 5 declared inventory references from fixture.json:
        SKU1: forecast=10, lead=3, on_hand=10, moq=5 -> expected 20
        SKU2: forecast=10, lead=3, on_hand=20, moq=5 -> expected 10
        SKU3: forecast=10, lead=3, on_hand=30, moq=5 -> expected 0
        SKU4: forecast=10, lead=3, on_hand=40, moq=5 -> expected 0
        SKU5: forecast=10, lead=3, on_hand=50, moq=5 -> expected 0
        """
        references = [
            {"sku": "SKU1", "daily_forecast": 10, "lead_days": 3, "on_hand": 10, "inbound": 0, "reserved": 0, "moq": 5, "expected": 20},
            {"sku": "SKU2", "daily_forecast": 10, "lead_days": 3, "on_hand": 20, "inbound": 0, "reserved": 0, "moq": 5, "expected": 10},
            {"sku": "SKU3", "daily_forecast": 10, "lead_days": 3, "on_hand": 30, "inbound": 0, "reserved": 0, "moq": 5, "expected": 0},
            {"sku": "SKU4", "daily_forecast": 10, "lead_days": 3, "on_hand": 40, "inbound": 0, "reserved": 0, "moq": 5, "expected": 0},
            {"sku": "SKU5", "daily_forecast": 10, "lead_days": 3, "on_hand": 50, "inbound": 0, "reserved": 0, "moq": 5, "expected": 0},
        ]

        results = []
        all_passed = True

        for ref in references:
            proposal = cls.calculate_order_proposal(
                sku=ref["sku"],
                daily_forecast=ref["daily_forecast"],
                lead_days=ref["lead_days"],
                on_hand=ref["on_hand"],
                inbound_due_before_need=ref["inbound"],
                reserved=ref["reserved"],
                moq=ref["moq"],
                pack_size=1
            )
            passed = (proposal.suggested_order_units == ref["expected"])
            if not passed:
                all_passed = False
            results.append({
                "sku": ref["sku"],
                "on_hand": ref["on_hand"],
                "lead_days": ref["lead_days"],
                "daily_forecast": ref["daily_forecast"],
                "target": proposal.target_inventory,
                "position": proposal.stock_position,
                "raw_shortfall": proposal.raw_shortfall,
                "moq": proposal.moq,
                "expected_order_units": ref["expected"],
                "actual_order_units": proposal.suggested_order_units,
                "passed": passed
            })

        return {
            "all_passed": all_passed,
            "results": results
        }
