from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["case_id"] == "C19"
    assert data["fixture_loaded"] is True

def test_dataset_summary_endpoint():
    res = client.get("/api/dataset/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["case_id"] == "C19"
    assert data["sku_count"] == 5
    assert data["total_records"] == 210

def test_forecast_all_endpoint():
    res = client.get("/api/forecast/all")
    assert res.status_code == 200
    data = res.json()
    assert "results" in data
    assert "SKU1" in data["results"]
    assert len(data["results"]["SKU1"]["baseline_forecast"]) == 7

def test_evaluation_summary_endpoint():
    res = client.get("/api/evaluation/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["aggregate_baseline_mae"] == 0.0
    assert data["aggregate_alternative_mae"] > 0.0
    assert data["best_model_aggregate"] == "Naive Same-Weekday Baseline"

def test_replenishment_verify_benchmarks_endpoint():
    res = client.get("/api/replenishment/verify-benchmarks")
    assert res.status_code == 200
    data = res.json()
    assert data["all_passed"] is True
    assert len(data["results"]) == 5

def test_replenishment_proposals_endpoint():
    res = client.get("/api/replenishment/proposals")
    assert res.status_code == 200
    data = res.json()
    assert "proposals" in data
    assert len(data["proposals"]) == 5
    assert data["reference_checks_passed"] is True

def test_scenario_simulate_endpoint():
    payload = {
        "sku": "SKU1",
        "scenario_type": "lead_time_shock",
        "lead_days_override": 6
    }
    res = client.post("/api/scenarios/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["sku"] == "SKU1"
    assert "lead_days" in data["changes_applied"]
    assert data["revised"]["lead_days"] == 6

def test_business_plan_pricing_endpoint():
    res = client.get("/api/business/overview")
    assert res.status_code == 200
    data = res.json()
    assert "hypothesis" in data
    assert "pricing_and_economics" in data
    assert data["pricing_and_economics"]["gross_margin_pct"] > 50

def test_sample_template_endpoint():
    res = client.get("/api/dataset/sample-template")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    perish = next((p for p in data if p.get("is_perishable")), None)
    assert perish is not None
    assert "expiry_date" in perish

def test_upload_products_unsuitable_data():
    # File without SKU column or valid product fields
    bad_csv = "product_name,color,size\nT-Shirt,Blue,Large\nJeans,Black,32"
    res = client.post(
        "/api/dataset/upload-products",
        files={"file": ("inventory.csv", bad_csv.encode("utf-8"), "text/csv")},
        headers={"X-User-ID": "test-user-1", "X-Is-Demo": "false"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_valid"] is False
    assert "not suitable" in data["unsuitable_reason"].lower()
    assert len(data["detailed_errors"]) > 0

def test_upload_products_perishable_valid():
    import json
    products_payload = [
        {
            "sku": "MILK-FRESH",
            "name": "Fresh Cow Milk 1L",
            "category": "Dairy",
            "available_stock": 40,
            "lead_days": 2,
            "moq": 10,
            "pack_size": 5,
            "is_perishable": True,
            "expiry_date": "2026-09-18",
            "batch_number": "BATCH-SEP-01"
        },
        {
            "sku": "CHEDDAR-200G",
            "name": "Aged Cheddar Cheese",
            "category": "Dairy",
            "available_stock": 25,
            "lead_days": 4,
            "is_perishable": True,
            "expiry_date": "2026-10-15",
            "batch_number": "BATCH-OCT-02"
        }
    ]
    res = client.post(
        "/api/dataset/upload-products",
        files={"file": ("dairy_products.json", json.dumps(products_payload).encode("utf-8"), "application/json")},
        headers={"X-User-ID": "test-user-2", "X-Is-Demo": "false"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_valid"] is True
    assert data["imported_count"] == 2
    assert data["perishable_count"] == 2
    assert "MILK-FRESH" in data["skus_imported"]

