import io
import csv
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Response, Header
from backend.app.persistence.store import store
from backend.app.api.forecast import get_all_forecasts
from backend.app.api.replenishment import get_replenishment_proposals
from backend.app.api.evaluation import get_evaluation_summary

router = APIRouter(prefix="/reports", tags=["Reports & Saved Results"])

@router.post("/save-run")
def save_current_run(
    payload: Optional[Dict[str, Any]] = None,
    x_user_id: Optional[str] = Header(None),
    x_is_demo: Optional[str] = Header(None)
):
    # If client passed full snapshot, use it; otherwise generate fresh snapshot
    if payload and "results" in payload:
        run_data = payload
    else:
        forecast_res = get_all_forecasts(x_user_id=x_user_id, x_is_demo=x_is_demo)
        replenishment_res = get_replenishment_proposals(x_user_id=x_user_id, x_is_demo=x_is_demo)
        eval_res = get_evaluation_summary()
        run_data = {
            "forecast": forecast_res.model_dump(),
            "replenishment": replenishment_res.model_dump(),
            "evaluation": eval_res.model_dump(),
            "notes": payload.get("notes", "") if payload else "Generated via automated run."
        }

    run_id = store.save_forecast_run(run_data)
    store.log_audit_event("FORECAST_RUN_SAVED", f"Forecast run {run_id} persisted.")
    return {"status": "success", "run_id": run_id}

@router.get("/runs")
def list_runs():
    return store.list_forecast_runs()

@router.get("/run/{run_id}")
def get_run(run_id: str):
    runs = store.list_forecast_runs()
    for r in runs:
        if r.get("run_id") == run_id:
            return r
    raise HTTPException(status_code=404, detail=f"Run {run_id} not found.")

@router.get("/export/csv")
def export_csv(
    type: str = "replenishment",
    x_user_id: Optional[str] = Header(None),
    x_is_demo: Optional[str] = Header(None)
):
    output = io.StringIO()
    writer = csv.writer(output)

    if type == "replenishment":
        proposals = get_replenishment_proposals(x_user_id=x_user_id, x_is_demo=x_is_demo).proposals
        writer.writerow([
            "SKU", "Daily Forecast", "Lead Days", "Target Inventory", "On Hand",
            "Inbound Due", "Reserved", "Stock Position", "Raw Shortfall", "MOQ",
            "Pack Size", "Suggested Order Units", "Coverage Days", "Risk Level", "Explanation"
        ])
        for p in proposals:
            writer.writerow([
                p.sku, p.daily_forecast, p.lead_days, p.target_inventory, p.on_hand,
                p.inbound_due_before_need, p.reserved, p.stock_position, p.raw_shortfall, p.moq,
                p.pack_size, p.suggested_order_units, p.coverage_days_current or "N/A", p.risk_level, p.explanation
            ])
        filename = f"stocksense_replenishment_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    else:
        forecast = get_all_forecasts(x_user_id=x_user_id, x_is_demo=x_is_demo)
        writer.writerow(["SKU", "Date", "Weekday", "Baseline Predicted", "Alternative Predicted", "Method"])
        for sku, res in forecast.results.items():
            for i, p in enumerate(res.baseline_forecast):
                alt_val = res.alternative_forecast[i].predicted_units if i < len(res.alternative_forecast) else 0.0
                writer.writerow([sku, p.date, p.weekday, p.predicted_units, alt_val, res.recommended_method])
        filename = f"stocksense_forecast_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
