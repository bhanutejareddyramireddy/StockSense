from fastapi import APIRouter
from backend.app.schemas.models import EvaluationSummaryResponse
from backend.app.forecasting.engine import ForecastingEngine
from backend.app.api.dataset import load_fixture_data

router = APIRouter(prefix="/evaluation", tags=["Forecast Evaluation & MAE"])

@router.get("/summary", response_model=EvaluationSummaryResponse)
def get_evaluation_summary():
    data = load_fixture_data()
    records = data.get("records", {})
    history = records.get("history", [])
    train_end = records.get("train_end", "2026-09-04")
    test_start = records.get("test_start", "2026-09-05")

    engine = ForecastingEngine(history, train_end, test_start)
    return engine.evaluate_all()
