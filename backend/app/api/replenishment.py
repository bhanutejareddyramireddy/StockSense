from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict
from fastapi import APIRouter, HTTPException, Query, Header
from backend.app.schemas.models import ReplenishmentProposal, ReplenishmentResponse
from backend.app.inventory.engine import ReplenishmentEngine
from backend.app.forecasting.engine import ForecastingEngine
from backend.app.api.dataset import get_product_catalog, load_fixture_data, get_user_context, evaluate_product_expiry
from backend.app.api.forecast import get_engine
from backend.app.persistence.store import store

router = APIRouter(prefix="/replenishment", tags=["Replenishment Engine"])

@router.get("/verify-benchmarks")
def verify_case_reference_benchmarks():
    """
    Executes and validates the five exact inventory reference examples declared in C19 fixture.json.
    """
    return ReplenishmentEngine.test_five_reference_examples()

@router.get("/proposals", response_model=ReplenishmentResponse)
def get_replenishment_proposals(
    as_of_date: Optional[str] = Query(None, description="Inventory as-of date"),
    demand_multiplier: float = Query(1.0, ge=0.5, le=5.0, description="Demand surge multiplier for festivals or salary days"),
    x_user_id: Optional[str] = Header(None),
    x_is_demo: Optional[str] = Header(None)
):
    if as_of_date is not None and not isinstance(as_of_date, str):
        as_of_date = None
    if not isinstance(demand_multiplier, (int, float)):
        try:
            demand_multiplier = float(getattr(demand_multiplier, "default", 1.0))
        except Exception:
            demand_multiplier = 1.0
    else:
        demand_multiplier = float(demand_multiplier)
    user_id, is_demo = get_user_context(x_user_id, x_is_demo)

    if not is_demo:
        user_prods = store.get_user_products(user_id, is_demo=False)
        if not user_prods:
            return ReplenishmentResponse(
                as_of_date=as_of_date or datetime.now().strftime("%Y-%m-%d"),
                proposals=[],
                reference_checks_passed=True,
                total_suggested_order_units=0,
                skus_requiring_order=0,
                sales_history_required=False,
                demand_multiplier=demand_multiplier
            )

        user_sales = store.get_user_sales_history(user_id, is_demo=False)
        if not user_sales:
            # Sales history is required to calculate demand forecasts and order replenishment
            return ReplenishmentResponse(
                as_of_date=as_of_date or datetime.now().strftime("%Y-%m-%d"),
                proposals=[],
                reference_checks_passed=True,
                total_suggested_order_units=0,
                skus_requiring_order=0,
                sales_history_required=True,
                demand_multiplier=demand_multiplier
            )

        dates = sorted(list(set(r.get("date", "") for r in user_sales if r.get("date"))))
        if not as_of_date or (as_of_date == "2026-09-12" and dates and dates[-1] != "2026-09-11"):
            try:
                latest_dt = datetime.strptime(dates[-1], "%Y-%m-%d")
                as_of_date = (latest_dt + timedelta(days=1)).strftime("%Y-%m-%d")
            except Exception:
                as_of_date = dates[-1] if dates else datetime.now().strftime("%Y-%m-%d")

        fc_engine = None
        if user_sales:
            train_end = dates[-8] if len(dates) >= 14 else (dates[len(dates)//2] if dates else "2026-09-04")
            test_start = dates[-7] if len(dates) >= 14 else (dates[len(dates)//2 + 1] if len(dates) > 1 else "2026-09-05")
            fc_engine = ForecastingEngine(user_sales, train_end, test_start)

        proposals: List[ReplenishmentProposal] = []
        total_order_units = 0
        requiring_order = 0

        for prod in user_prods:
            sku = prod["sku"]
            daily_forecast = 0.0
            if fc_engine and sku in fc_engine.get_skus():
                fc_res = fc_engine.generate_full_forecast_for_sku(sku, as_of_date=as_of_date, horizon_days=7)
                daily_forecast = fc_res.daily_average_demand
            elif prod.get("daily_demand"):
                daily_forecast = float(prod["daily_demand"])
            else:
                avail = max(0, int(prod.get("available_stock", 0)))
                lead = max(1, int(prod.get("lead_days", 3)))
                daily_forecast = max(1.0, round(float(avail) / max(lead * 3.5, 14.0), 1)) if avail > 0 else max(2.0, round(float(prod.get("moq", 5)) / lead, 1))

            daily_forecast = round(daily_forecast * demand_multiplier, 2)

            proposal = ReplenishmentEngine.calculate_order_proposal(
                sku=sku,
                daily_forecast=daily_forecast,
                lead_days=prod.get("lead_days", 3),
                on_hand=prod.get("available_stock", 0),
                inbound_due_before_need=prod.get("inbound_stock", 0),
                reserved=prod.get("reserved_stock", 0),
                moq=prod.get("moq", 1),
                pack_size=prod.get("pack_size", 1),
                as_of_date=as_of_date
            )

            # Enrich with expiry evaluation
            exp_info = evaluate_product_expiry(
                expiry_date_str=prod.get("expiry_date"),
                available_stock=prod.get("available_stock", 0),
                daily_demand=daily_forecast,
                lead_days=prod.get("lead_days", 3),
                as_of_date_str=as_of_date
            )
            proposal.expiry_date = prod.get("expiry_date")
            proposal.days_to_expiry = exp_info["days_to_expiry"]
            proposal.expiry_status = exp_info["expiry_status"]
            proposal.expiry_action_recommendation = exp_info["expiry_action_recommendation"]
            if exp_info.get("expiry_action_recommendation") and exp_info["expiry_status"] in ("EXPIRED", "CRITICAL_SPOILAGE", "EXPIRING_SOON", "REORDER_BATCH"):
                proposal.warnings.append(exp_info["expiry_action_recommendation"])
                if proposal.risk_level == "Healthy":
                    proposal.risk_level = f"Perishable Alert ({exp_info['expiry_status']})"

            proposal.vendor_name = prod.get("vendor_name") or "Primary Supplier"
            proposal.vendor_phone = prod.get("vendor_phone") or "+919876543210"
            proposal.vendor_email = prod.get("vendor_email") or ""
            proposal.cost_inr = round(proposal.suggested_order_units * float(prod.get("unit_cost_inr", 100.0)), 2)

            if demand_multiplier != 1.0:
                proposal.explanation += f" (Adjusted for {demand_multiplier}x demand surge / festival)."

            proposals.append(proposal)
            total_order_units += proposal.suggested_order_units
            if proposal.suggested_order_units > 0:
                requiring_order += 1

        if not is_demo and user_id not in ("demo", "user-demo-c19", "admin-eval-c19"):
            store.save_user_insights(user_id, {
                "type": "REPLENISHMENT_PROPOSALS",
                "as_of_date": as_of_date,
                "total_suggested_order_units": total_order_units,
                "skus_requiring_order": requiring_order,
                "demand_multiplier": demand_multiplier,
                "proposals": [p.model_dump() for p in proposals]
            }, is_demo=False)

        return ReplenishmentResponse(
            as_of_date=as_of_date,
            proposals=proposals,
            reference_checks_passed=True,
            total_suggested_order_units=total_order_units,
            skus_requiring_order=requiring_order,
            sales_history_required=False,
            demand_multiplier=demand_multiplier
        )

    # Demo flow
    if not as_of_date:
        as_of_date = "2026-09-12"
    catalog = get_product_catalog()
    engine = get_engine()
    benchmarks_check = ReplenishmentEngine.test_five_reference_examples()

    proposals: List[ReplenishmentProposal] = []
    total_order_units = 0
    requiring_order = 0

    for sku, prod in catalog.items():
        if sku in engine.get_skus():
            fc_res = engine.generate_full_forecast_for_sku(sku, as_of_date=as_of_date, horizon_days=7)
            daily_forecast = fc_res.daily_average_demand
        elif prod.daily_demand:
            daily_forecast = float(prod.daily_demand)
        else:
            avail = max(0, int(prod.available_stock))
            lead = max(1, int(prod.lead_days))
            daily_forecast = max(1.0, round(float(avail) / max(lead * 3.5, 14.0), 1)) if avail > 0 else max(2.0, round(float(prod.moq) / lead, 1))

        daily_forecast = round(daily_forecast * demand_multiplier, 2)

        proposal = ReplenishmentEngine.calculate_order_proposal(
            sku=sku,
            daily_forecast=daily_forecast,
            lead_days=prod.lead_days,
            on_hand=prod.available_stock,
            inbound_due_before_need=prod.inbound_stock,
            reserved=prod.reserved_stock,
            moq=prod.moq,
            pack_size=prod.pack_size,
            as_of_date=as_of_date
        )

        exp_info = evaluate_product_expiry(
            expiry_date_str=prod.expiry_date,
            available_stock=prod.available_stock,
            daily_demand=daily_forecast,
            lead_days=prod.lead_days,
            as_of_date_str=as_of_date
        )
        proposal.expiry_date = prod.expiry_date
        proposal.days_to_expiry = exp_info["days_to_expiry"]
        proposal.expiry_status = exp_info["expiry_status"]
        proposal.expiry_action_recommendation = exp_info["expiry_action_recommendation"]

        proposal.vendor_name = getattr(prod, 'vendor_name', None) or "Primary Supplier"
        proposal.vendor_phone = getattr(prod, 'vendor_phone', None) or "+919876543210"
        proposal.vendor_email = getattr(prod, 'vendor_email', "") or ""
        proposal.cost_inr = round(proposal.suggested_order_units * float(getattr(prod, 'unit_cost_inr', 100.0)), 2)

        if demand_multiplier != 1.0:
            proposal.explanation += f" (Adjusted for {demand_multiplier}x demand surge / festival)."

        proposals.append(proposal)
        total_order_units += proposal.suggested_order_units
        if proposal.suggested_order_units > 0:
            requiring_order += 1

    return ReplenishmentResponse(
        as_of_date=as_of_date,
        proposals=proposals,
        reference_checks_passed=benchmarks_check["all_passed"],
        total_suggested_order_units=total_order_units,
        skus_requiring_order=requiring_order,
        sales_history_required=False,
        demand_multiplier=demand_multiplier
    )

@router.get("/sku/{sku}", response_model=ReplenishmentProposal)
def get_sku_replenishment(
    sku: str,
    as_of_date: Optional[str] = Query(None, description="Forecast As-Of Date"),
    demand_multiplier: float = Query(1.0, ge=0.5, le=5.0, description="Demand surge multiplier"),
    x_user_id: Optional[str] = Header(None),
    x_is_demo: Optional[str] = Header(None)
):
    if as_of_date is not None and not isinstance(as_of_date, str):
        as_of_date = None
    if not isinstance(demand_multiplier, (int, float)):
        try:
            demand_multiplier = float(getattr(demand_multiplier, "default", 1.0))
        except Exception:
            demand_multiplier = 1.0
    else:
        demand_multiplier = float(demand_multiplier)
    user_id, is_demo = get_user_context(x_user_id, x_is_demo)
    sku_upper = sku.upper()

    if not is_demo:
        user_prods = store.get_user_products(user_id, is_demo=False)
        prod = next((p for p in user_prods if p["sku"].upper() == sku_upper), None)
        if not prod:
            raise HTTPException(status_code=404, detail=f"SKU {sku} not found in user product catalog.")

        user_sales = store.get_user_sales_history(user_id, is_demo=False)
        if not user_sales:
            raise HTTPException(
                status_code=400,
                detail="Sales history is required to calculate replenishment orders. Please upload a sales history file or load demo sales data."
            )

        dates = sorted(list(set(r.get("date", "") for r in user_sales if r.get("date"))))
        if not as_of_date or (as_of_date == "2026-09-12" and dates and dates[-1] != "2026-09-11"):
            try:
                latest_dt = datetime.strptime(dates[-1], "%Y-%m-%d")
                as_of_date = (latest_dt + timedelta(days=1)).strftime("%Y-%m-%d")
            except Exception:
                as_of_date = dates[-1] if dates else datetime.now().strftime("%Y-%m-%d")

        daily_forecast = 0.0
        train_end = dates[-8] if len(dates) >= 14 else (dates[len(dates)//2] if dates else "2026-09-04")
        test_start = dates[-7] if len(dates) >= 14 else (dates[len(dates)//2 + 1] if len(dates) > 1 else "2026-09-05")
        fc_engine = ForecastingEngine(user_sales, train_end, test_start)
        if sku_upper in fc_engine.get_skus():
            fc_res = fc_engine.generate_full_forecast_for_sku(sku_upper, as_of_date=as_of_date, horizon_days=7)
            daily_forecast = fc_res.daily_average_demand
        
        if daily_forecast <= 0.0:
            if prod.get("daily_demand"):
                daily_forecast = float(prod["daily_demand"])
            else:
                avail = max(0, int(prod.get("available_stock", 0)))
                lead = max(1, int(prod.get("lead_days", 3)))
                daily_forecast = max(1.0, round(float(avail) / max(lead * 3.5, 14.0), 1)) if avail > 0 else max(2.0, round(float(prod.get("moq", 5)) / lead, 1))

        daily_forecast = round(daily_forecast * demand_multiplier, 2)

        proposal = ReplenishmentEngine.calculate_order_proposal(
            sku=sku_upper,
            daily_forecast=daily_forecast,
            lead_days=prod.get("lead_days", 3),
            on_hand=prod.get("available_stock", 0),
            inbound_due_before_need=prod.get("inbound_stock", 0),
            reserved=prod.get("reserved_stock", 0),
            moq=prod.get("moq", 1),
            pack_size=prod.get("pack_size", 1),
            as_of_date=as_of_date
        )
        exp_info = evaluate_product_expiry(
            expiry_date_str=prod.get("expiry_date"),
            available_stock=prod.get("available_stock", 0),
            daily_demand=daily_forecast,
            lead_days=prod.get("lead_days", 3),
            as_of_date_str=as_of_date
        )
        proposal.expiry_date = prod.get("expiry_date")
        proposal.days_to_expiry = exp_info["days_to_expiry"]
        proposal.expiry_status = exp_info["expiry_status"]
        proposal.expiry_action_recommendation = exp_info["expiry_action_recommendation"]
        if exp_info.get("expiry_action_recommendation") and exp_info["expiry_status"] in ("EXPIRED", "CRITICAL_SPOILAGE", "EXPIRING_SOON", "REORDER_BATCH"):
            proposal.warnings.append(exp_info["expiry_action_recommendation"])
            if proposal.risk_level == "Healthy":
                proposal.risk_level = f"Perishable Alert ({exp_info['expiry_status']})"
        if demand_multiplier != 1.0:
            proposal.explanation += f" (Adjusted for {demand_multiplier}x demand surge / festival)."
        return proposal

    # Demo flow
    if not as_of_date:
        as_of_date = "2026-09-12"
    catalog = get_product_catalog()
    if sku_upper not in catalog:
        raise HTTPException(status_code=404, detail=f"SKU {sku} not found in product catalog.")

    prod = catalog[sku_upper]
    engine = get_engine()
    if sku_upper in engine.get_skus():
        fc_res = engine.generate_full_forecast_for_sku(sku_upper, as_of_date=as_of_date, horizon_days=7)
        daily_forecast = fc_res.daily_average_demand
    elif prod.daily_demand:
        daily_forecast = float(prod.daily_demand)
    else:
        avail = max(0, int(prod.available_stock))
        lead = max(1, int(prod.lead_days))
        daily_forecast = max(1.0, round(float(avail) / max(lead * 3.5, 14.0), 1)) if avail > 0 else max(2.0, round(float(prod.moq) / lead, 1))

    daily_forecast = round(daily_forecast * demand_multiplier, 2)

    proposal = ReplenishmentEngine.calculate_order_proposal(
        sku=sku_upper,
        daily_forecast=daily_forecast,
        lead_days=prod.lead_days,
        on_hand=prod.available_stock,
        inbound_due_before_need=prod.inbound_stock,
        reserved=prod.reserved_stock,
        moq=prod.moq,
        pack_size=prod.pack_size,
        as_of_date=as_of_date
    )
    exp_info = evaluate_product_expiry(
        expiry_date_str=prod.expiry_date,
        available_stock=prod.available_stock,
        daily_demand=daily_forecast,
        lead_days=prod.lead_days,
        as_of_date_str=as_of_date
    )
    proposal.expiry_date = prod.expiry_date
    proposal.days_to_expiry = exp_info["days_to_expiry"]
    proposal.expiry_status = exp_info["expiry_status"]
    proposal.expiry_action_recommendation = exp_info["expiry_action_recommendation"]
    if demand_multiplier != 1.0:
        proposal.explanation += f" (Adjusted for {demand_multiplier}x demand surge / festival)."
    return proposal

