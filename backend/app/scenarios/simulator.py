from typing import Dict, Any, List
from datetime import datetime, timedelta
from backend.app.schemas.models import (
    ScenarioChangeRequest, ScenarioComparisonResponse, ReplenishmentProposal
)
from backend.app.inventory.engine import ReplenishmentEngine

class ScenarioSimulator:
    @staticmethod
    def run_simulation(
        original_proposal: ReplenishmentProposal,
        request: ScenarioChangeRequest,
        as_of_date: str = "2026-09-12"
    ) -> ScenarioComparisonResponse:
        """
        Runs an isolated scenario simulation without modifying production data or original fixture.
        Returns side-by-side diff: original vs revised, with clear explanations and new risk flags.
        """
        scenario_type = request.scenario_type
        changes_applied = {}
        new_risks = []
        explanation_lines = []

        # Start with original parameters
        lead_days = original_proposal.lead_days
        on_hand = original_proposal.on_hand
        reserved = original_proposal.reserved
        inbound = original_proposal.inbound_due_before_need
        daily_forecast = original_proposal.daily_forecast
        moq = original_proposal.moq
        pack_size = original_proposal.pack_size

        # Apply specific scenario modifications
        if scenario_type == "zero_stock":
            scenario_name = "Zero Usable Stock Shock"
            on_hand = 0
            changes_applied["on_hand"] = f"{original_proposal.on_hand} -> 0"
            new_risks.append("Immediate physical stockout! Warehouse shelf is empty.")
            explanation_lines.append(f"Available inventory was set to 0. Shortfall increased immediately by {original_proposal.on_hand} units.")

        elif scenario_type == "lead_time_shock":
            scenario_name = "Supplier Lead-Time Shock"
            new_lead = request.lead_days_override if request.lead_days_override is not None else 7
            changes_applied["lead_days"] = f"{lead_days} -> {new_lead} days"
            lead_days = new_lead
            new_risks.append(f"Supplier delivery window widened to {new_lead} days. Exposure window is now longer.")
            explanation_lines.append(f"Lead time increased to {new_lead} days, elevating the inventory target required to cover customer demand during the order pipeline.")

        elif scenario_type == "delayed_inbound":
            scenario_name = "Delayed Inbound Delivery (Late ETA)"
            delay_days = request.inbound_delayed_days if request.inbound_delayed_days is not None else 5
            # Delayed inbound arrives AFTER lead time horizon, making it ineligible to cover immediate need
            changes_applied["inbound_status"] = f"Arriving {delay_days} days late (ETA exceeds need date)"
            changes_applied["inbound_due_before_need"] = f"{inbound} -> 0"
            inbound = 0
            new_risks.append("Inbound shipment will arrive too late to prevent stockout during the upcoming lead-time horizon.")
            explanation_lines.append("Because the shipment ETA now exceeds the need date, inbound stock cannot be credited toward the current replenishment position.")

        elif scenario_type == "demand_surge":
            scenario_name = "Demand Spike Shock (+50%)"
            multiplier = request.demand_multiplier if request.demand_multiplier is not None else 1.5
            new_demand = round(daily_forecast * multiplier, 2)
            changes_applied["daily_forecast"] = f"{daily_forecast} -> {new_demand} units/day ({int((multiplier-1)*100):+d}%)"
            daily_forecast = new_demand
            new_risks.append("Demand surge accelerates stock depletion; days of coverage drop significantly.")
            explanation_lines.append(f"Expected daily demand increased by {int((multiplier-1)*100)}%, driving a higher target inventory position.")

        elif scenario_type == "demand_drop":
            scenario_name = "Demand Contraction (-50%)"
            multiplier = request.demand_multiplier if request.demand_multiplier is not None else 0.5
            new_demand = round(daily_forecast * multiplier, 2)
            changes_applied["daily_forecast"] = f"{daily_forecast} -> {new_demand} units/day (-50%)"
            daily_forecast = new_demand
            new_risks.append("Holding excess inventory risks working capital lockup if demand does not rebound.")
            explanation_lines.append("Lower demand reduces replenishment target and delays the projected stockout date.")

        elif scenario_type == "moq_pack_change":
            scenario_name = "Supplier Constraint Shift (Higher MOQ/Pack)"
            new_moq = request.moq_override if request.moq_override is not None else (moq * 2)
            new_pack = request.pack_size_override if request.pack_size_override is not None else (pack_size * 2)
            changes_applied["moq"] = f"{moq} -> {new_moq}"
            changes_applied["pack_size"] = f"{pack_size} -> {new_pack}"
            moq = new_moq
            pack_size = new_pack
            new_risks.append(f"Stricter supplier order minimums force larger batch sizes, increasing inventory holding cost.")
            explanation_lines.append("Order quantity rounded up to satisfy the larger MOQ and carton pack constraints.")

        else:
            scenario_name = "Custom What-If Scenario"
            if request.lead_days_override is not None:
                changes_applied["lead_days"] = f"{lead_days} -> {request.lead_days_override}"
                lead_days = request.lead_days_override
            if request.available_stock_override is not None:
                changes_applied["on_hand"] = f"{on_hand} -> {request.available_stock_override}"
                on_hand = request.available_stock_override
            if request.demand_multiplier is not None:
                new_demand = round(daily_forecast * request.demand_multiplier, 2)
                changes_applied["daily_forecast"] = f"{daily_forecast} -> {new_demand}"
                daily_forecast = new_demand
            if request.moq_override is not None:
                changes_applied["moq"] = f"{moq} -> {request.moq_override}"
                moq = request.moq_override
            if request.pack_size_override is not None:
                changes_applied["pack_size"] = f"{pack_size} -> {request.pack_size_override}"
                pack_size = request.pack_size_override
            explanation_lines.append("Custom operational adjustments applied.")

        # Compute revised replenishment proposal
        revised_proposal = ReplenishmentEngine.calculate_order_proposal(
            sku=original_proposal.sku,
            daily_forecast=daily_forecast,
            lead_days=lead_days,
            on_hand=on_hand,
            inbound_due_before_need=inbound,
            reserved=reserved,
            moq=moq,
            pack_size=pack_size,
            as_of_date=as_of_date
        )

        delta_order = revised_proposal.suggested_order_units - original_proposal.suggested_order_units

        why_it_changed = " ".join(explanation_lines)
        if delta_order > 0:
            why_it_changed += f" Consequently, recommended order increased by +{delta_order} units."
        elif delta_order < 0:
            why_it_changed += f" Consequently, recommended order decreased by {delta_order} units."
        else:
            why_it_changed += " Recommended order quantity remained unchanged due to existing stock coverage or supplier constraints."

        return ScenarioComparisonResponse(
            sku=original_proposal.sku,
            scenario_name=scenario_name,
            original=original_proposal,
            revised=revised_proposal,
            changes_applied=changes_applied,
            delta_order_units=delta_order,
            why_it_changed=why_it_changed,
            new_risks_and_uncertainty=new_risks
        )
