from typing import Dict, Any, List
from fastapi import APIRouter
from backend.app.schemas.models import PricingPlan, OutreachRecord
from backend.app.persistence.store import store

router = APIRouter(prefix="/business", tags=["MBA Business Plan & Unit Economics"])

@router.get("/overview")
def get_business_plan_overview():
    pricing = store.get_pricing_plan()
    outreach = store.list_outreach_records()

    price_loc = pricing.get("price_per_location_monthly_inr", 3499.0)
    locations = pricing.get("active_locations", 5)
    hosting = pricing.get("hosting_cost_per_location_inr", 300.0)
    support = pricing.get("support_cost_per_location_inr", 400.0)
    onboarding = pricing.get("onboarding_amortized_inr", 250.0)

    cost_per_loc = hosting + support + onboarding
    gross_profit_per_loc = price_loc - cost_per_loc
    gross_margin_pct = (gross_profit_per_loc / price_loc * 100) if price_loc > 0 else 0.0

    monthly_revenue = price_loc * locations
    monthly_cogs = cost_per_loc * locations
    monthly_gross_profit = gross_profit_per_loc * locations

    return {
        "hypothesis": {
            "model_type": "Per-Location B2B SaaS Planning Subscription",
            "target_customer": "Regional small retail grocery & FMCG chains (2–10 stores) in Tier-1/2 Indian cities",
            "payer_persona": "Chain Owner / Operations & Inventory Lead",
            "core_problem": "Stockouts during weekly weekend peak demand due to manual WhatsApp/spreadsheet reordering; costly over-ordering from rigid supplier MOQs",
            "value_proposition": "7-day cyclical demand forecast that prevents weekend stockouts; automated replenishment reconciling MOQ and pack constraints in seconds"
        },
        "pricing_and_economics": {
            "price_per_location_monthly_inr": price_loc,
            "active_locations": locations,
            "monthly_revenue_inr": round(monthly_revenue, 2),
            "cost_to_serve_per_location_inr": round(cost_per_loc, 2),
            "monthly_cogs_inr": round(monthly_cogs, 2),
            "monthly_gross_profit_inr": round(monthly_gross_profit, 2),
            "gross_margin_pct": round(gross_margin_pct, 1),
            "cost_breakdown": {
                "hosting_and_cloud_firestore_inr": hosting,
                "support_and_success_inr": support,
                "onboarding_amortization_inr": onboarding
            }
        },
        "first_customer_experiment": {
            "segment": "Independent supermarket chains in Hyderabad (Kukatpally, Banjara Hills, Gachibowli, Secunderabad)",
            "sample_size": "10 qualified retail chain owners",
            "pilot_format": "14-day shadow replenishment review on 10 fast-moving SKUs",
            "success_metric": ">= 3 retail owners sign up for 14-day shadow pilot; >= 2 convert to paid subscription at ₹3,499/store/month",
            "failure_metric": "< 1 pilot or willingness to pay < ₹1,500/month",
            "day_30_decision": "If 2+ convert: double outreach in Pune/Bangalore; If willingness-to-pay is ₹1,999: unbundle into self-serve tier; If 0 convert: pivot to distributor-sponsored model."
        },
        "outreach_records": outreach
    }

@router.put("/pricing")
def update_pricing_plan(plan: PricingPlan):
    updated = store.update_pricing_plan(plan.model_dump())
    store.log_audit_event("PRICING_UPDATED", f"Pricing updated: ₹{plan.price_per_location_monthly_inr}/location/mo.")
    return updated

@router.get("/outreach", response_model=List[Dict[str, Any]])
def list_outreach():
    return store.list_outreach_records()

@router.post("/outreach")
def create_outreach_record(record: OutreachRecord):
    added = store.add_outreach_record(record.model_dump())
    store.log_audit_event("OUTREACH_LOGGED", f"Outreach record logged for {record.organization}.")
    return added
