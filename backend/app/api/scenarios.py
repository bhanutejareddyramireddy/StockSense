from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Header
from backend.app.schemas.models import (
    ScenarioChangeRequest, ScenarioComparisonResponse
)
from backend.app.scenarios.simulator import ScenarioSimulator
from backend.app.api.replenishment import get_sku_replenishment
from backend.app.persistence.store import store

from datetime import datetime
from backend.app.api.dataset import get_user_context, evaluate_product_expiry
from backend.app.inventory.engine import ReplenishmentEngine

router = APIRouter(prefix="/scenarios", tags=["Risk & Scenario Simulator"])

@router.post("/simulate", response_model=ScenarioComparisonResponse)
def simulate_scenario(
    request: ScenarioChangeRequest,
    x_user_id: Optional[str] = Header(None),
    x_is_demo: Optional[str] = Header(None)
):
    user_id, is_demo = get_user_context(x_user_id, x_is_demo)

    base_proposal = None
    # 1. Try full ML replenishment proposal (works if user has sales history or in demo mode)
    try:
        base_proposal = get_sku_replenishment(sku=request.sku, x_user_id=x_user_id, x_is_demo=x_is_demo)
    except Exception:
        pass

    # 2. Fallback to catalog parameters if sales history is not uploaded yet
    if not base_proposal:
        if not is_demo:
            user_prods = store.get_user_products(user_id, is_demo=False)
            sku_upper = request.sku.upper()
            prod = next((p for p in user_prods if p.get("sku", "").upper() == sku_upper), None)
            if prod:
                avail = max(0, int(prod.get("available_stock", 0)))
                lead = max(1, int(prod.get("lead_days", 3)))
                moq = max(1, int(prod.get("moq", 1)))
                pack_size = max(1, int(prod.get("pack_size", 1)))
                if prod.get("daily_demand"):
                    daily_forecast = float(prod["daily_demand"])
                else:
                    daily_forecast = max(1.0, round(float(avail) / max(lead * 3.5, 14.0), 1)) if avail > 0 else max(2.0, round(float(moq) / lead, 1))

                as_of_date = datetime.now().strftime("%Y-%m-%d")
                base_proposal = ReplenishmentEngine.calculate_order_proposal(
                    sku=prod.get("sku", request.sku),
                    daily_forecast=daily_forecast,
                    lead_days=lead,
                    on_hand=avail,
                    inbound_due_before_need=int(prod.get("inbound_stock", 0)),
                    reserved=int(prod.get("reserved_stock", 0)),
                    moq=moq,
                    pack_size=pack_size,
                    as_of_date=as_of_date
                )
                exp_info = evaluate_product_expiry(
                    expiry_date_str=prod.get("expiry_date"),
                    available_stock=avail,
                    daily_demand=daily_forecast,
                    lead_days=lead,
                    as_of_date_str=as_of_date
                )
                base_proposal.expiry_date = prod.get("expiry_date")
                base_proposal.days_to_expiry = exp_info["days_to_expiry"]
                base_proposal.expiry_status = exp_info["expiry_status"]
                base_proposal.expiry_action_recommendation = exp_info["expiry_action_recommendation"]

    if not base_proposal:
        raise HTTPException(
            status_code=404,
            detail=f"SKU '{request.sku}' could not be found in product catalog or replenishment database."
        )

    comparison = ScenarioSimulator.run_simulation(original_proposal=base_proposal, request=request)
    return comparison

@router.post("/save")
def save_scenario(data: Dict[str, Any]):
    scen_id = store.save_scenario(data)
    store.log_audit_event("SCENARIO_SAVED", f"Scenario {scen_id} ({data.get('scenario_name', 'Custom')}) saved.")
    return {"status": "success", "scenario_id": scen_id}

@router.get("/saved")
def list_saved_scenarios():
    return store.list_scenarios()
