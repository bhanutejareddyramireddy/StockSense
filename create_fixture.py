import json
import os

# Create starter-data/c19 and data directories
os.makedirs("starter-data/c19", exist_ok=True)
os.makedirs("data", exist_ok=True)

# Generate history records matching fixture.json exactly
history = []
skus = [
    ("SKU1", 1),
    ("SKU2", 2),
    ("SKU3", 3),
    ("SKU4", 4),
    ("SKU5", 5)
]

# Dates from 2026-08-01 to 2026-09-11
# 31 days in Aug + 11 days in Sept = 42 dates
dates = []
for day in range(1, 32):
    dates.append(f"2026-08-{day:02d}")
for day in range(1, 12):
    dates.append(f"2026-09-{day:02d}")

for sku, base in skus:
    for i, date_str in enumerate(dates):
        # 7-day repeating pattern: base + (i % 7)
        sales = base + (i % 7)
        history.append({
            "date": date_str,
            "sku": sku,
            "sales_units": sales,
            "stockout": False,
            "available_stock": 50,
            "lead_days": 3,
            "moq": 5
        })

fixture_data = {
    "case_id": "C19",
    "synthetic": True,
    "data_version": "v3.2",
    "currency": "INR unless explicitly stated",
    "missing_values": "null means unknown, never zero",
    "records": {
        "history": history,
        "train_end": "2026-09-04",
        "test_start": "2026-09-05",
        "baseline": "Use the previous same weekday; score absolute error on the last seven dates only.",
        "inventory_as_of": "2026-09-12",
        "sku_count": 5,
        "replenishment_rule": "Target = daily_forecast * lead_days; position = on_hand + inbound_due_before_need - reserved; raw=max(0,target-position); round positive raw up to MOQ multiple.",
        "inventory_reference": [
            {
                "sku": "SKU1",
                "daily_forecast": 10,
                "lead_days": 3,
                "on_hand": 10,
                "inbound_due_before_need": 0,
                "reserved": 0,
                "moq": 5,
                "expected_order_units": 20
            },
            {
                "sku": "SKU2",
                "daily_forecast": 10,
                "lead_days": 3,
                "on_hand": 20,
                "inbound_due_before_need": 0,
                "reserved": 0,
                "moq": 5,
                "expected_order_units": 10
            },
            {
                "sku": "SKU3",
                "daily_forecast": 10,
                "lead_days": 3,
                "on_hand": 30,
                "inbound_due_before_need": 0,
                "reserved": 0,
                "moq": 5,
                "expected_order_units": 0
            },
            {
                "sku": "SKU4",
                "daily_forecast": 10,
                "lead_days": 3,
                "on_hand": 40,
                "inbound_due_before_need": 0,
                "reserved": 0,
                "moq": 5,
                "expected_order_units": 0
            },
            {
                "sku": "SKU5",
                "daily_forecast": 10,
                "lead_days": 3,
                "on_hand": 50,
                "inbound_due_before_need": 0,
                "reserved": 0,
                "moq": 5,
                "expected_order_units": 0
            }
        ]
    },
    "public_checks": [
        "Report per-SKU and aggregate MAE on a later held-out period versus the declared naive baseline; no future data in training.",
        "Replenishment follows the declared stock-position formula, nonnegative quantities, MOQ/pack and inbound timing in five examples.",
        "Zero sales, missing dates and a lead-time shock produce visible uncertainty and a revised proposal."
    ],
    "limit": "Small teaching fixture for a bounded prototype. Market demand, willingness to pay and production performance remain unproven."
}

with open("starter-data/c19/fixture.json", "w") as f:
    json.dump(fixture_data, f, indent=2)

with open("data/fixture.json", "w") as f:
    json.dump(fixture_data, f, indent=2)

# Also save case metadata
case_meta = {
    "id": "C19",
    "title": "Inventory Forecast and Replenishment Baseline",
    "verdict": "Conditional and advanced",
    "user": "Inventory planner",
    "goal": "Produce a defensible short-horizon replenishment proposal with uncertainty.",
    "engineering": "Forecast seven-day demand for 5 SKUs; compare a naive baseline; estimate coverage and proposed quantities with lead times.",
    "mba": "Choose a narrow customer and payer; inspect the inherited product; quantify value and costs; negotiate the priority product change; create pricing, a first-customer experiment and a 30-day growth plan. Show why the product deserves adoption.",
    "data": "date, SKU, units, available/held stock, inbound quantity/ETA, lead time, MOQ, pack size, stockout marker and evaluation cutoff.",
    "gap": "C01 is city-category data for 28 days, not SKU history. Supply SKU-level history and holdout. Sales during stockouts are not uncensored demand.",
    "checks": [
        "Report per-SKU and aggregate MAE on a later held-out period versus the declared naive baseline; no future data in training.",
        "Replenishment follows the declared stock-position formula, nonnegative quantities, MOQ/pack and inbound timing in five examples.",
        "Zero sales, missing dates and a lead-time shock produce visible uncertainty and a revised proposal."
    ],
    "edge": "New SKU; intermittent demand; inbound late; unavailable stock; forecast below baseline quality.",
    "pilot": "Use planner shadow review. Better forecasting is not guaranteed; earn credit for honest comparison and sensible decision policy, even if the baseline wins.",
    "source_id": "F19",
    "source": "Adapted from the reviewed bank, with a new business-building assignment",
    "payer": "Small chain inventory planner",
    "model": "Per-location planning subscription",
    "growth": "Compare a simple baseline forecast and a constrained order plan",
    "product_change": "Add MOQ and stockout handling before a complex model",
    "mba_skills": "Demand planning, working capital, uncertainty analysis",
    "tech_skills": "UI and state; data validation; tested business rules; CSV or JSON handling; readable evidence and a saved result",
    "difficulty": "Stretch with supplied fallback",
    "qualification": "No prior job experience or paid tools required. Business teams must demonstrate the commercial capabilities below; engineers may learn the stack during the event.",
    "snapshot": "At MBA entry, save a demo or screen recording, current tests, known gaps, backlog and contributor list. Record the business team's joining time and baseline.",
    "fixture": "starter-data/c19/fixture.json",
    "test_scope": "Starter tests are public teaching checks, not a production benchmark. Judges vary inputs within the same published schema and product scope."
}

with open("starter-data/c19/case_meta.json", "w") as f:
    json.dump(case_meta, f, indent=2)

print("Generated fixture.json and case_meta.json successfully.")
