import json
from collections import defaultdict
import datetime

with open("data/fixture.json") as f:
    data = json.load(f)

print("Top level keys:", list(data.keys()))
print("case_id:", data.get("case_id"))
print("synthetic:", data.get("synthetic"))
print("data_version:", data.get("data_version"))
print("currency:", data.get("currency"))
print("missing_values:", data.get("missing_values"))

records = data.get("records", {})
print("\nRecords keys:", list(records.keys()))
history = records.get("history", [])
print(f"Total history records: {len(history)}")

# Check fields in history
history_fields = set()
for r in history:
    history_fields.update(r.keys())
print("History record fields:", sorted(list(history_fields)))

# Group by SKU
sku_records = defaultdict(list)
for r in history:
    sku_records[r["sku"]].append(r)

print(f"\nUnique SKUs ({len(sku_records)}):", sorted(list(sku_records.keys())))
for sku in sorted(sku_records.keys()):
    recs = sku_records[sku]
    dates = [r["date"] for r in recs]
    sales = [r["sales_units"] for r in recs]
    stockouts = [r["stockout"] for r in recs]
    avail = [r["available_stock"] for r in recs]
    leads = [r["lead_days"] for r in recs]
    moqs = [r["moq"] for r in recs]
    print(f"\nSKU {sku}: {len(recs)} records")
    print(f"  Date range: {min(dates)} to {max(dates)}")
    print(f"  Sales min/max/sum: {min(sales)} / {max(sales)} / {sum(sales)}")
    print(f"  Any stockouts: {any(stockouts)}")
    print(f"  Available stock values: {set(avail)}")
    print(f"  Lead days values: {set(leads)}")
    print(f"  MOQ values: {set(moqs)}")

print("\nCutoffs:")
print("  train_end:", records.get("train_end"))
print("  test_start:", records.get("test_start"))
print("  inventory_as_of:", records.get("inventory_as_of"))
print("  baseline:", records.get("baseline"))
print("  replenishment_rule:", records.get("replenishment_rule"))
print("  sku_count:", records.get("sku_count"))

print("\nInventory Reference Examples:")
for ex in records.get("inventory_reference", []):
    print(" ", ex)

print("\nPublic checks:")
for pc in data.get("public_checks", []):
    print(" -", pc)

print("\nLimits:", data.get("limit"))
