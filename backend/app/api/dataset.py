import json
import io
import pandas as pd
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Header
from fastapi.responses import PlainTextResponse, FileResponse, Response
from backend.app.core.config import settings, DATA_DIR, BASE_DIR

TEMPLATES_DIR = BASE_DIR / "frontend" / "templates"
from backend.app.schemas.models import (
    SalesRecord, SKUDetail, ImportValidationSummary, ProductImportSummary, SalesImportSummary
)
from backend.app.persistence.store import store

router = APIRouter(prefix="/dataset", tags=["Dataset & Inventory"])

def get_user_context(
    x_user_id: Optional[str] = None,
    x_is_demo: Optional[str] = None
) -> tuple[str, bool]:
    if not isinstance(x_user_id, str):
        x_user_id = None
    if not isinstance(x_is_demo, str):
        x_is_demo = None

    user_id = x_user_id or "demo"
    is_demo_str = (x_is_demo or "").lower()
    
    if is_demo_str in ("false", "0", "no"):
        is_demo = False
    elif is_demo_str in ("true", "1", "yes"):
        is_demo = True
    elif user_id in ("demo", "user-demo-c19", "admin-eval-c19", "admin@stocksense.ai", "planner@stocksense.in"):
        is_demo = True
    else:
        is_demo = False
        
    return user_id, is_demo

def load_fixture_data() -> Dict[str, Any]:
    if not settings.FIXTURE_FILE.exists():
        raise HTTPException(status_code=500, detail="Fixture file not found.")
    with open(settings.FIXTURE_FILE, "r") as f:
        return json.load(f)

# In-memory operational product catalog state initialized from fixture
_product_catalog: Dict[str, SKUDetail] = {}

def get_product_catalog() -> Dict[str, SKUDetail]:
    global _product_catalog
    if not _product_catalog:
        data = load_fixture_data()
        history = data.get("records", {}).get("history", [])
        
        # Product default friendly names and pricing
        friendly_meta = {
            "SKU1": {"name": "Basmati Rice 5kg Pack", "category": "Grains & Staples", "cost": 320.0, "price": 450.0, "pack": 1, "vendor_name": "Bharat Agro Mills", "vendor_phone": "+919876543210", "vendor_email": "orders@bharatagro.com"},
            "SKU2": {"name": "Refined Sunflower Oil 1L", "category": "Cooking Oils", "cost": 110.0, "price": 145.0, "pack": 6, "vendor_name": "Fortune Edible Oils Depot", "vendor_phone": "+919820123456", "vendor_email": "sales@fortunedepot.in"},
            "SKU3": {"name": "Organic Whole Wheat Atta 10kg", "category": "Flours", "cost": 380.0, "price": 490.0, "pack": 1, "vendor_name": "Aashirvaad Grains Hub", "vendor_phone": "+919811223344", "vendor_email": "supply@aashirvaadhub.com"},
            "SKU4": {"name": "Toor Dal Premium 1kg", "category": "Pulses", "cost": 135.0, "price": 180.0, "pack": 10, "vendor_name": "Tata Sampann Distributors", "vendor_phone": "+919833445566", "vendor_email": "orders@tatasampanndist.com"},
            "SKU5": {"name": "Iodized Table Salt 1kg", "category": "Spices & Seasoning", "cost": 22.0, "price": 30.0, "pack": 24, "vendor_name": "Tata Consumer Products", "vendor_phone": "+919844556677", "vendor_email": "orders@tataconsumer.in"}
        }
        
        skus = sorted(list(set(r["sku"] for r in history)))
        for sku in skus:
            # Get latest available stock, lead days, moq from fixture
            sample = [r for r in history if r["sku"] == sku][-1]
            meta = friendly_meta.get(sku, {"name": f"Product {sku}", "category": "General", "cost": 100.0, "price": 150.0, "pack": 1, "vendor_name": "Primary Supplier", "vendor_phone": "+919876543210", "vendor_email": ""})
            _product_catalog[sku] = SKUDetail(
                sku=sku,
                name=meta["name"],
                category=meta["category"],
                available_stock=sample.get("available_stock", 50),
                reserved_stock=0,
                inbound_stock=0,
                inbound_eta=None,
                lead_days=sample.get("lead_days", 3),
                moq=sample.get("moq", 5),
                pack_size=meta["pack"],
                unit_cost_inr=meta["cost"],
                selling_price_inr=meta["price"],
                vendor_name=meta.get("vendor_name", "Primary Supplier"),
                vendor_phone=meta.get("vendor_phone", "+919876543210"),
                vendor_email=meta.get("vendor_email", "")
            )
    return _product_catalog

def get_demo_catalog() -> Dict[str, SKUDetail]:
    return get_product_catalog()

@router.get("/summary")
def get_dataset_summary(
    x_user_id: Optional[str] = Header(None),
    x_is_demo: Optional[str] = Header(None)
):
    user_id, is_demo = get_user_context(x_user_id, x_is_demo)
    if is_demo:
        data = load_fixture_data()
        records = data.get("records", {})
        history = records.get("history", [])
        
        dates = [r["date"] for r in history] if history else []
        skus = sorted(list(set(r["sku"] for r in history))) if history else []

        return {
            "case_id": data.get("case_id"),
            "data_version": data.get("data_version"),
            "currency": data.get("currency"),
            "missing_values_policy": data.get("missing_values"),
            "total_records": len(history),
            "unique_skus": skus,
            "sku_count": len(skus),
            "date_range": {
                "min_date": min(dates) if dates else None,
                "max_date": max(dates) if dates else None,
                "total_days": len(set(dates)) if dates else 0
            },
            "train_end": records.get("train_end"),
            "test_start": records.get("test_start"),
            "inventory_as_of": records.get("inventory_as_of"),
            "declared_baseline": records.get("baseline"),
            "declared_replenishment_rule": records.get("replenishment_rule"),
            "public_checks": data.get("public_checks", []),
            "disclosed_limit": data.get("limit")
        }
    else:
        user_prods = store.get_user_products(user_id, is_demo=False)
        user_sales = store.get_user_sales_history(user_id, is_demo=False)
        dates = [r["date"] for r in user_sales] if user_sales else []
        skus = [p["sku"] for p in user_prods]
        return {
            "case_id": f"User Workspace ({user_id})",
            "data_version": "1.0",
            "currency": "INR",
            "missing_values_policy": "Zero imputation / New SKUs",
            "total_records": len(user_sales),
            "unique_skus": skus,
            "sku_count": len(skus),
            "date_range": {
                "min_date": min(dates) if dates else None,
                "max_date": max(dates) if dates else None,
                "total_days": len(set(dates)) if dates else 0
            },
            "train_end": None,
            "test_start": None,
            "inventory_as_of": datetime.now().strftime("%Y-%m-%d"),
            "declared_baseline": "Same weekday cyclical / Moving average",
            "declared_replenishment_rule": "Deterministic lead-time & pack-size rounding",
            "public_checks": [],
            "disclosed_limit": None
        }

def evaluate_product_expiry(
    expiry_date_str: Optional[str],
    available_stock: int,
    daily_demand: float = 0.0,
    lead_days: int = 3,
    as_of_date_str: Optional[str] = None
) -> Dict[str, Any]:
    if not expiry_date_str or str(expiry_date_str).strip() in ("", "None", "nan", "null"):
        return {
            "days_to_expiry": None,
            "expiry_status": "NON_PERISHABLE",
            "expiry_badge": "Non-Perishable",
            "expiry_action_recommendation": None,
            "units_at_spoilage_risk": 0
        }
    
    try:
        from datetime import datetime, date
        as_of = datetime.strptime(as_of_date_str, "%Y-%m-%d").date() if as_of_date_str else date.today()
        cleaned_str = str(expiry_date_str).split("T")[0].split(" ")[0].strip()
        try:
            exp = datetime.strptime(cleaned_str, "%Y-%m-%d").date()
        except ValueError:
            try:
                exp = datetime.strptime(cleaned_str, "%d-%m-%Y").date()
            except ValueError:
                exp = datetime.strptime(cleaned_str, "%m/%d/%Y").date()
    except Exception:
        return {
            "days_to_expiry": None,
            "expiry_status": "INVALID_DATE",
            "expiry_badge": "Invalid Date",
            "expiry_action_recommendation": "Check expiry date format (YYYY-MM-DD).",
            "units_at_spoilage_risk": 0
        }
    
    days_left = (exp - as_of).days

    if days_left < 0:
        return {
            "days_to_expiry": days_left,
            "expiry_status": "EXPIRED",
            "expiry_badge": f"Expired {abs(days_left)}d ago",
            "expiry_action_recommendation": f"EXPIRED on {exp.strftime('%b %d, %Y')}. Discard {available_stock} units immediately. Do not sell to consumers.",
            "units_at_spoilage_risk": available_stock
        }

    if daily_demand > 0:
        expected_sales = daily_demand * days_left
        spoilage_units = max(0, int(available_stock - expected_sales))
    else:
        spoilage_units = available_stock if days_left <= 30 else 0

    if spoilage_units > 0 and days_left <= 30:
        rec = f"SPOILAGE RISK: {spoilage_units} of {available_stock} units will spoil before {exp.strftime('%b %d')}. Run discount or sell immediately before expiry date."
        status = "CRITICAL_SPOILAGE" if days_left <= 7 else "EXPIRING_SOON"
    elif days_left <= (lead_days + 3):
        rec = f"RESTOCK FRESH BATCH: Current batch expires in {days_left} days (Lead time: {lead_days}d). Reorder a fresh production batch immediately."
        status = "REORDER_BATCH"
    elif days_left <= 14:
        rec = f"Expiring in {days_left} days. Monitor sell-through velocity."
        status = "EXPIRING_SOON"
    else:
        rec = f"Shelf life healthy ({days_left} days remaining until {exp.strftime('%b %d, %Y')})."
        status = "HEALTHY"

    return {
        "days_to_expiry": days_left,
        "expiry_status": status,
        "expiry_badge": f"{days_left}d left",
        "expiry_action_recommendation": rec,
        "units_at_spoilage_risk": spoilage_units
    }

def enrich_product_with_expiry(p_dict: Dict[str, Any]) -> Dict[str, Any]:
    exp_info = evaluate_product_expiry(
        expiry_date_str=p_dict.get("expiry_date"),
        available_stock=p_dict.get("available_stock", 0),
        lead_days=p_dict.get("lead_days", 3)
    )
    p_dict["days_to_expiry"] = exp_info["days_to_expiry"]
    p_dict["expiry_status"] = exp_info["expiry_status"]
    p_dict["expiry_action_recommendation"] = exp_info["expiry_action_recommendation"]
    p_dict["is_perishable"] = bool(p_dict.get("is_perishable") or p_dict.get("expiry_date"))
    return p_dict

@router.get("/products", response_model=List[SKUDetail])
def list_products(
    x_user_id: Optional[str] = Header(None),
    x_is_demo: Optional[str] = Header(None)
):
    user_id, is_demo = get_user_context(x_user_id, x_is_demo)
    if is_demo:
        catalog = get_product_catalog()
        res = []
        for p in catalog.values():
            d = p.model_dump()
            enrich_product_with_expiry(d)
            res.append(SKUDetail(**d))
        return res
    products_data = store.get_user_products(user_id, is_demo=False)
    res = []
    for p in products_data:
        enrich_product_with_expiry(p)
        res.append(SKUDetail(**p))
    return res

@router.post("/products", response_model=SKUDetail)
def upsert_product(
    product: SKUDetail,
    x_user_id: Optional[str] = Header(None),
    x_is_demo: Optional[str] = Header(None)
):
    user_id, is_demo = get_user_context(x_user_id, x_is_demo)
    prod_dict = product.model_dump()
    enrich_product_with_expiry(prod_dict)
    saved_prod = SKUDetail(**prod_dict)
    if is_demo:
        catalog = get_product_catalog()
        catalog[product.sku] = saved_prod
    else:
        store.save_user_product(user_id, prod_dict, is_demo=False)
    store.log_audit_event("PRODUCT_UPDATE", f"Product {product.sku} ({product.name}) saved for {user_id}.")
    return saved_prod

@router.delete("/products/{sku}")
def delete_product(
    sku: str,
    x_user_id: Optional[str] = Header(None),
    x_is_demo: Optional[str] = Header(None)
):
    user_id, is_demo = get_user_context(x_user_id, x_is_demo)
    deleted = True
    if is_demo:
        catalog = get_product_catalog()
        if sku in catalog:
            del catalog[sku]
    else:
        deleted = store.delete_user_product(user_id, sku, is_demo=False)
    store.log_audit_event("PRODUCT_DELETE", f"Product {sku} deleted for {user_id}.")
    return {"sku": sku, "deleted": deleted}

from pydantic import BaseModel
class VendorUpdatePayload(BaseModel):
    vendor_name: str
    vendor_phone: str
    vendor_email: Optional[str] = None

@router.put("/products/{sku}/vendor")
def update_product_vendor(
    sku: str,
    payload: VendorUpdatePayload,
    x_user_id: Optional[str] = Header(None),
    x_is_demo: Optional[str] = Header(None)
):
    user_id, is_demo = get_user_context(x_user_id, x_is_demo)
    sku_upper = sku.upper()
    prods = store.get_user_products(user_id, is_demo=is_demo)
    target = next((p for p in prods if p["sku"].upper() == sku_upper), None)
    if not target:
        from backend.app.api.dataset import get_demo_catalog
        cat = get_demo_catalog()
        if sku_upper in cat:
            cat[sku_upper].vendor_name = payload.vendor_name
            cat[sku_upper].vendor_phone = payload.vendor_phone
            cat[sku_upper].vendor_email = payload.vendor_email
            store.log_audit_event("VENDOR_UPDATE", f"Updated vendor for {sku} to {payload.vendor_name} ({payload.vendor_phone}).")
            return {"status": "success", "sku": sku, "vendor_name": payload.vendor_name, "vendor_phone": payload.vendor_phone}
        raise HTTPException(status_code=404, detail=f"Product {sku} not found.")

    target["vendor_name"] = payload.vendor_name
    target["vendor_phone"] = payload.vendor_phone
    target["vendor_email"] = payload.vendor_email
    store.save_user_product(user_id, target, is_demo=is_demo)
    store.log_audit_event("VENDOR_UPDATE", f"Updated vendor for {sku} to {payload.vendor_name} ({payload.vendor_phone}).")
    return {"status": "success", "sku": sku, "vendor_name": payload.vendor_name, "vendor_phone": payload.vendor_phone}

@router.post("/upload-products", response_model=ProductImportSummary)
async def upload_products(
    file: UploadFile = File(...),
    x_user_id: Optional[str] = Header(None),
    x_is_demo: Optional[str] = Header(None)
):
    user_id, is_demo = get_user_context(x_user_id, x_is_demo)
    content = await file.read()
    filename = (file.filename or "").lower()

    if not filename.endswith((".json", ".xlsx", ".xls", ".csv")):
        return ProductImportSummary(
            is_valid=False,
            unsuitable_reason="The uploaded file format is not supported. Please upload an Excel spreadsheet (.xlsx, .xls), CSV file (.csv), or JSON dataset (.json).",
            validation_messages=["File format not supported."]
        )

    records = []
    history_records = []

    # 1. Parse JSON
    if filename.endswith(".json"):
        try:
            parsed = json.loads(content.decode("utf-8"))
            if isinstance(parsed, list):
                records = parsed
            elif isinstance(parsed, dict):
                if "products" in parsed and isinstance(parsed["products"], list):
                    records = parsed["products"]
                elif "records" in parsed and "history" in parsed["records"] and isinstance(parsed["records"]["history"], list):
                    history_records = parsed["records"]["history"]
                    sku_map = {}
                    for h in history_records:
                        sku = str(h.get("sku", "")).strip().upper()
                        if sku:
                            sku_map[sku] = h
                    records = list(sku_map.values())
                elif "history" in parsed and isinstance(parsed["history"], list):
                    history_records = parsed["history"]
                    sku_map = {}
                    for h in history_records:
                        sku = str(h.get("sku", "")).strip().upper()
                        if sku:
                            sku_map[sku] = h
                    records = list(sku_map.values())
                else:
                    return ProductImportSummary(
                        is_valid=False,
                        unsuitable_reason="The uploaded JSON structure is not suitable for inventory import. Expected an array of products or an object containing 'products' or 'records.history'.",
                        validation_messages=["Invalid JSON schema structure."]
                    )
            else:
                return ProductImportSummary(
                    is_valid=False,
                    unsuitable_reason="JSON root must be an array of product records or an object containing a product catalog.",
                    validation_messages=["Invalid JSON root."]
                )
        except Exception as e:
            return ProductImportSummary(
                is_valid=False,
                unsuitable_reason=f"Failed to parse JSON file: {str(e)}. Please check for valid JSON syntax.",
                validation_messages=["JSON decode error."]
            )

    # 2. Parse Excel
    elif filename.endswith((".xlsx", ".xls")):
        try:
            df = pd.read_excel(io.BytesIO(content))
            records = df.to_dict(orient="records")
        except Exception as e:
            return ProductImportSummary(
                is_valid=False,
                unsuitable_reason=f"Failed to read Excel spreadsheet: {str(e)}. Please check that the file is not corrupted or password-protected.",
                validation_messages=["Excel read error."]
            )

    # 3. Parse CSV
    elif filename.endswith(".csv"):
        try:
            df = pd.read_csv(io.StringIO(content.decode("utf-8", errors="replace")))
            records = df.to_dict(orient="records")
        except Exception as e:
            return ProductImportSummary(
                is_valid=False,
                unsuitable_reason=f"Failed to parse CSV file: {str(e)}. Please check standard UTF-8 CSV formatting.",
                validation_messages=["CSV read error."]
            )

    if not records:
        return ProductImportSummary(
            is_valid=False,
            unsuitable_reason="The uploaded file contains 0 product records or data rows. Please provide a file with inventory stock data.",
            validation_messages=["File is empty."]
        )

    is_csv = filename.endswith(".csv")

    def is_empty(val):
        if val is None:
            return True
        s = str(val).strip()
        return s == "" or s.lower() in ("nan", "none", "null", "undefined")

    # Column key finder helper
    def find_key(row_dict, candidates):
        row_keys = {str(k).strip().lower().replace(" ", "_").replace("-", "_"): k for k in row_dict.keys()}
        for c in candidates:
            if c in row_keys:
                return row_dict[row_keys[c]]
        return None

    # Verify SKU column exists in header
    has_sku = False
    for r in records[:5]:
        val = find_key(r, ["sku", "product_sku", "item_code", "code", "item_id", "id", "sku_code"])
        if not is_empty(val):
            has_sku = True
            break

    if not has_sku:
        available_cols = list(records[0].keys()) if records else []
        return ProductImportSummary(
            is_valid=False,
            unsuitable_reason=(
                "Data not suitable for inventory import: Missing required product identifier column ('sku' or 'item_code'). "
                f"Columns detected in your file: {', '.join(str(c) for c in available_cols[:8])}."
            ),
            detailed_errors=[
                "Required column 'sku' was not found in the header row.",
                "Please make sure your CSV or JSON has a 'sku' column identifying each item."
            ],
            validation_messages=["Missing required SKU column."]
        )

    imported_products = []
    skus_imported = []
    perishable_count = 0
    expiring_soon_count = 0
    expired_count = 0
    detailed_errors = []
    history_records = []

    for idx, r in enumerate(records):
        line_num = idx + 2 if is_csv else idx + 1
        line_label = f"Line {line_num} (Row {line_num})" if is_csv else f"Item #{line_num}"

        # 1. MANDATORY: SKU
        sku_val = find_key(r, ["sku", "product_sku", "item_code", "code", "item_id", "id", "sku_code"])
        if is_empty(sku_val):
            return ProductImportSummary(
                is_valid=False,
                unsuitable_reason=f"Validation Error on {line_label}: Mandatory column 'sku' is empty. Every product row must have a valid SKU code (e.g. SKU1). Please correct {line_label} of your file and try re-uploading.",
                detailed_errors=[f"{line_label}: Empty cell in mandatory column 'sku'."],
                validation_messages=["Mandatory column 'sku' is empty."]
            )
        sku = str(sku_val).strip().upper()
        if sku in skus_imported:
            return ProductImportSummary(
                is_valid=False,
                unsuitable_reason=f"Validation Error on {line_label}: Duplicate SKU '{sku}' found. SKUs must be unique for each product. Please correct {line_label} and try re-uploading.",
                detailed_errors=[f"{line_label}: Duplicate SKU '{sku}'."],
                validation_messages=["Duplicate SKU found."]
            )

        # 2. MANDATORY: Product Name
        name_val = find_key(r, ["name", "product_name", "title", "item_name", "description"])
        if is_empty(name_val):
            return ProductImportSummary(
                is_valid=False,
                unsuitable_reason=f"Validation Error on {line_label}: Mandatory column 'name' is empty for SKU '{sku}'. Please provide the product name on {line_label} and try re-uploading.",
                detailed_errors=[f"{line_label}: Empty cell in mandatory column 'name'."],
                validation_messages=["Mandatory column 'name' is empty."]
            )
        name = str(name_val).strip()

        # 3. MANDATORY: Available Stock
        avail_val = find_key(r, ["available_stock", "stock", "qty", "quantity", "on_hand", "units", "current_stock"])
        if is_empty(avail_val):
            return ProductImportSummary(
                is_valid=False,
                unsuitable_reason=f"Validation Error on {line_label}: Mandatory column 'available_stock' is empty for SKU '{sku}'. Available stock quantity is required to calculate replenishment. Please correct {line_label} and try re-uploading.",
                detailed_errors=[f"{line_label}: Empty cell in mandatory column 'available_stock'."],
                validation_messages=["Mandatory column 'available_stock' is empty."]
            )
        try:
            avail = int(float(str(avail_val).strip()))
            if avail < 0:
                raise ValueError("Negative stock")
        except Exception:
            return ProductImportSummary(
                is_valid=False,
                unsuitable_reason=f"Validation Error on {line_label}: Invalid value '{avail_val}' for 'available_stock'. Must be a non-negative number (0 or higher). Please correct {line_label} and try re-uploading.",
                detailed_errors=[f"{line_label}: Invalid available_stock '{avail_val}'."],
                validation_messages=["Invalid available_stock value."]
            )

        # 4. MANDATORY: Lead Days
        lead_val = find_key(r, ["lead_days", "lead_time", "lead_time_days", "delivery_days", "lead"])
        if is_empty(lead_val):
            return ProductImportSummary(
                is_valid=False,
                unsuitable_reason=f"Validation Error on {line_label}: Mandatory column 'lead_days' is empty for SKU '{sku}'. Supplier lead time is required to determine reorder points. Please correct {line_label} and try re-uploading.",
                detailed_errors=[f"{line_label}: Empty cell in mandatory column 'lead_days'."],
                validation_messages=["Mandatory column 'lead_days' is empty."]
            )
        try:
            lead = int(float(str(lead_val).strip()))
            if lead < 1:
                raise ValueError("Lead days < 1")
        except Exception:
            return ProductImportSummary(
                is_valid=False,
                unsuitable_reason=f"Validation Error on {line_label}: Invalid value '{lead_val}' for 'lead_days'. Must be an integer >= 1. Please correct {line_label} and try re-uploading.",
                detailed_errors=[f"{line_label}: Invalid lead_days '{lead_val}'."],
                validation_messages=["Invalid lead_days value."]
            )

        # 5. MANDATORY: MOQ
        moq_val = find_key(r, ["moq", "minimum_order", "min_order_qty", "min_order", "moq_units"])
        if is_empty(moq_val):
            return ProductImportSummary(
                is_valid=False,
                unsuitable_reason=f"Validation Error on {line_label}: Mandatory column 'moq' (Minimum Order Quantity) is empty for SKU '{sku}'. Supplier MOQ is required to round purchase orders. Please correct {line_label} and try re-uploading.",
                detailed_errors=[f"{line_label}: Empty cell in mandatory column 'moq'."],
                validation_messages=["Mandatory column 'moq' is empty."]
            )
        try:
            moq = int(float(str(moq_val).strip()))
            if moq < 1:
                raise ValueError("MOQ < 1")
        except Exception:
            return ProductImportSummary(
                is_valid=False,
                unsuitable_reason=f"Validation Error on {line_label}: Invalid value '{moq_val}' for 'moq'. Must be an integer >= 1. Please correct {line_label} and try re-uploading.",
                detailed_errors=[f"{line_label}: Invalid moq '{moq_val}'."],
                validation_messages=["Invalid moq value."]
            )

        # 6. MANDATORY: Unit Cost
        cost_val = find_key(r, ["unit_cost_inr", "unit_cost", "cost", "purchase_price", "cogs", "buy_price"])
        if is_empty(cost_val):
            return ProductImportSummary(
                is_valid=False,
                unsuitable_reason=f"Validation Error on {line_label}: Mandatory column 'unit_cost_inr' is empty for SKU '{sku}'. Unit cost is required for order budgeting and financial valuation. Please correct {line_label} and try re-uploading.",
                detailed_errors=[f"{line_label}: Empty cell in mandatory column 'unit_cost_inr'."],
                validation_messages=["Mandatory column 'unit_cost_inr' is empty."]
            )
        try:
            cost = float(str(cost_val).strip())
            if cost <= 0:
                raise ValueError("Cost <= 0")
        except Exception:
            return ProductImportSummary(
                is_valid=False,
                unsuitable_reason=f"Validation Error on {line_label}: Invalid value '{cost_val}' for 'unit_cost_inr'. Must be a positive number (> 0). Please correct {line_label} and try re-uploading.",
                detailed_errors=[f"{line_label}: Invalid unit_cost_inr '{cost_val}'."],
                validation_messages=["Invalid unit_cost_inr value."]
            )

        # Optional columns
        cat_val = find_key(r, ["category", "dept", "department", "type", "group"])
        category = str(cat_val).strip() if not is_empty(cat_val) else "General"

        def to_int(val, default):
            try:
                if is_empty(val): return default
                return int(float(val))
            except Exception:
                return default

        def to_float(val, default):
            try:
                if is_empty(val): return default
                return float(val)
            except Exception:
                return default

        reserved = to_int(find_key(r, ["reserved_stock", "reserved", "held_stock"]), 0)
        inbound = to_int(find_key(r, ["inbound_stock", "inbound", "due_in", "incoming"]), 0)
        pack = max(1, to_int(find_key(r, ["pack_size", "pack", "case_pack", "carton_pack"]), 1))
        price = max(cost, to_float(find_key(r, ["selling_price_inr", "selling_price", "price", "mrp", "retail_price"]), cost * 1.3))

        # Check for transactional sales in combined file
        row_date = find_key(r, ["date", "transaction_date", "day", "sales_date"])
        row_sales = to_int(find_key(r, ["sales_units", "units_sold", "sold_units", "quantity_sold", "daily_sales_units"]), None)
        if row_date and row_sales is not None:
            history_records.append({
                "date": str(row_date).split("T")[0].split(" ")[0].strip(),
                "sku": sku,
                "sales_units": max(0, row_sales),
                "stockout": bool(find_key(r, ["stockout", "is_stockout"]) in (True, 1, "true", "True")),
                "available_stock": avail,
                "lead_days": lead,
                "moq": moq,
                "pack_size": pack
            })

        # Expiry and Perishable
        expiry_raw = find_key(r, ["expiry_date", "expiration_date", "exp_date", "expiry", "best_before", "shelf_life_date"])
        expiry_str = None
        is_perish = False
        if not is_empty(expiry_raw):
            try:
                if hasattr(expiry_raw, "strftime"):
                    expiry_str = expiry_raw.strftime("%Y-%m-%d")
                else:
                    raw_s = str(expiry_raw).split("T")[0].split(" ")[0].strip()
                    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y"):
                        try:
                            expiry_str = datetime.strptime(raw_s, fmt).strftime("%Y-%m-%d")
                            break
                        except ValueError:
                            pass
                if expiry_str:
                    is_perish = True
            except Exception:
                expiry_str = None

        perish_val = find_key(r, ["is_perishable", "perishable", "food_item", "is_food"])
        if perish_val in (True, 1, "true", "True", "yes", "Yes"):
            is_perish = True

        batch_val = find_key(r, ["batch_number", "batch_no", "batch", "lot", "lot_number"])
        batch_num = str(batch_val).strip() if not is_empty(batch_val) else None

        daily_d = to_float(find_key(r, ["daily_demand", "daily_sales", "avg_daily_sales"]), 0.0)

        exp_info = evaluate_product_expiry(
            expiry_date_str=expiry_str,
            available_stock=avail,
            daily_demand=daily_d,
            lead_days=lead
        )

        if is_perish:
            perishable_count += 1
            if exp_info["expiry_status"] == "EXPIRED":
                expired_count += 1
            elif exp_info["expiry_status"] in ("CRITICAL_SPOILAGE", "EXPIRING_SOON", "REORDER_BATCH"):
                expiring_soon_count += 1

        vendor_name_val = find_key(r, ["vendor_name", "vendor", "supplier", "supplier_name", "distributor"])
        vendor_name_str = str(vendor_name_val).strip() if not is_empty(vendor_name_val) else "Primary Supplier"

        vendor_phone_val = find_key(r, ["vendor_phone", "phone", "whatsapp", "vendor_whatsapp", "supplier_phone", "contact"])
        vendor_phone_str = str(vendor_phone_val).strip() if not is_empty(vendor_phone_val) else "+919876543210"

        vendor_email_val = find_key(r, ["vendor_email", "email", "supplier_email"])
        vendor_email_str = str(vendor_email_val).strip() if not is_empty(vendor_email_val) else None

        prod_dict = {
            "sku": sku,
            "name": name,
            "category": category,
            "available_stock": avail,
            "reserved_stock": reserved,
            "inbound_stock": inbound,
            "inbound_eta": None,
            "lead_days": lead,
            "moq": moq,
            "pack_size": pack,
            "unit_cost_inr": cost,
            "selling_price_inr": price,
            "daily_demand": daily_d,
            "is_perishable": is_perish,
            "expiry_date": expiry_str,
            "batch_number": batch_num,
            "days_to_expiry": exp_info["days_to_expiry"],
            "expiry_status": exp_info["expiry_status"],
            "expiry_action_recommendation": exp_info["expiry_action_recommendation"],
            "vendor_name": vendor_name_str,
            "vendor_phone": vendor_phone_str,
            "vendor_email": vendor_email_str
        }

        store.save_user_product(user_id, prod_dict, is_demo=is_demo)
        imported_products.append(prod_dict)
        skus_imported.append(sku)

    if not imported_products:
        return ProductImportSummary(
            is_valid=False,
            unsuitable_reason="Data not suitable: No valid products could be imported from the file.",
            detailed_errors=detailed_errors,
            validation_messages=["0 valid product records found."]
        )

    if history_records:
        store.save_user_sales_records(user_id, history_records, replace=True, is_demo=is_demo)

    store.log_audit_event("PRODUCT_BULK_IMPORT", f"Imported {len(imported_products)} products from {filename} for {user_id}.")

    # Check if user has sales records already
    user_sales = store.get_user_sales_history(user_id, is_demo=is_demo)
    has_sales = bool(user_sales)

    analysis_res = None
    if has_sales:
        from backend.app.analytics.engine import DatasetAnalyticsEngine
        from backend.app.api.replenishment import get_replenishment_proposals
        proposals_res = get_replenishment_proposals(as_of_date=None, x_user_id=user_id, x_is_demo="false" if not is_demo else "true")
        analysis_res = DatasetAnalyticsEngine.analyze_dataset(
            products=imported_products,
            proposals=proposals_res.proposals,
            as_of_date=proposals_res.as_of_date
        )
        store.save_user_insights(user_id, {
            "type": "DATASET_ANALYSIS",
            "as_of_date": proposals_res.as_of_date,
            "portfolio_summary": analysis_res.get("portfolio_summary"),
            "reorder_action_summary": analysis_res.get("reorder_action_summary"),
            "perishable_summary": analysis_res.get("perishable_summary"),
            "ai_action_recommendations": analysis_res.get("ai_action_recommendations")
        }, is_demo=is_demo)
        reorder_count = analysis_res.get("reorder_action_summary", {}).get("skus_needing_reorder", 0)
        total_order_u = analysis_res.get("reorder_action_summary", {}).get("total_suggested_order_units", 0)
        msg = f"Successfully imported {len(imported_products)} products into inventory! Analysis complete: {reorder_count} SKUs require reordering ({total_order_u} units suggested)."
    else:
        msg = f"Successfully imported {len(imported_products)} products into inventory! Upload your sales history file (or click 'Load Demo Sales') to activate AI demand forecasts and replenishment orders."

    if perishable_count > 0:
        msg += f" Found {perishable_count} perishable items ({expiring_soon_count} expiring soon, {expired_count} expired)."

    return ProductImportSummary(
        is_valid=True,
        imported_count=len(imported_products),
        total_processed=len(records),
        skus_imported=skus_imported,
        perishable_count=perishable_count,
        expiring_soon_count=expiring_soon_count,
        expired_count=expired_count,
        validation_messages=[msg],
        detailed_errors=detailed_errors[:10],
        analysis=analysis_res,
        sales_history_required=not has_sales
    )

@router.get("/templates/products-excel")
def download_products_sample_excel():
    """Returns downloadable sample product catalog Excel template (.xlsx)."""
    excel_path = TEMPLATES_DIR / "sample_products_inventory.xlsx"
    if not excel_path.exists():
        excel_path = TEMPLATES_DIR / "comprehensive_products_inventory.xlsx"
    if excel_path.exists():
        return FileResponse(
            path=str(excel_path),
            filename="sample_products_inventory.xlsx",
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    raise HTTPException(status_code=404, detail="Sample Excel template not found.")

@router.get("/templates/products-csv")
def download_products_sample_csv():
    """Returns downloadable sample product catalog CSV template."""
    csv_path = TEMPLATES_DIR / "sample_products_inventory.csv"
    if not csv_path.exists():
        csv_path = TEMPLATES_DIR / "comprehensive_products_inventory.csv"
    if not csv_path.exists():
        csv_path = TEMPLATES_DIR / "sample_products_catalog.csv"
    if csv_path.exists():
        return FileResponse(
            path=str(csv_path),
            filename="sample_products_inventory.csv",
            media_type="text/csv"
        )
    content = "sku,name,category,available_stock,reserved_stock,inbound_stock,lead_days,moq,pack_size,unit_cost_inr,selling_price_inr\nSKU1,Basmati Rice 5kg,Grains,45,0,0,3,5,1,350,450\n"
    return PlainTextResponse(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sample_products_inventory.csv"}
    )

@router.get("/templates/products-json")
def download_products_sample_json():
    """Returns downloadable sample product catalog JSON template."""
    json_path = TEMPLATES_DIR / "sample_products_inventory.json"
    if not json_path.exists():
        json_path = TEMPLATES_DIR / "comprehensive_products_inventory.json"
    if not json_path.exists():
        json_path = TEMPLATES_DIR / "sample_products_catalog.json"
    if json_path.exists():
        return FileResponse(
            path=str(json_path),
            filename="sample_products_inventory.json",
            media_type="application/json"
        )
    return Response(
        content="[]",
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=sample_products_inventory.json"}
    )

@router.get("/templates/sales-csv")
def download_sales_sample_csv():
    """Returns downloadable sample sales history CSV template."""
    csv_path = TEMPLATES_DIR / "comprehensive_sales_history.csv"
    if not csv_path.exists():
        csv_path = TEMPLATES_DIR / "sample_sales_history.csv"
    if csv_path.exists():
        with open(csv_path, "r", encoding="utf-8") as f:
            content = f.read()
    else:
        content = "date,sku,sales_units\n2026-09-01,SKU1,12\n"
    return PlainTextResponse(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=comprehensive_sales_history.csv"}
    )

@router.get("/templates/sales-json")
def download_sales_sample_json():
    """Returns downloadable sample sales history JSON template."""
    json_path = TEMPLATES_DIR / "comprehensive_sales_history.json"
    if not json_path.exists():
        json_path = TEMPLATES_DIR / "sample_sales_history.json"
    if json_path.exists():
        with open(json_path, "r", encoding="utf-8") as f:
            content = f.read()
    else:
        content = "[]"
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=comprehensive_sales_history.json"}
    )

@router.post("/upload-sales", response_model=SalesImportSummary)
async def upload_sales(
    file: UploadFile = File(...),
    x_user_id: Optional[str] = Header(None),
    x_is_demo: Optional[str] = Header(None)
):
    """
    Uploads historical daily sales records for products.
    Mandatory columns: date (YYYY-MM-DD), sku, sales_units (>= 0).
    Performs strict line-by-line validation and returns row-specific errors if cells are missing.
    """
    content = await file.read()
    filename = file.filename.lower()
    user_id, is_demo = get_user_context(x_user_id, x_is_demo)

    records = []
    is_csv = filename.endswith(".csv")

    def is_empty(val):
        if val is None:
            return True
        s = str(val).strip()
        return s == "" or s.lower() in ("nan", "none", "null", "undefined")

    def find_key(row_dict, candidates):
        row_keys = {str(k).strip().lower().replace(" ", "_").replace("-", "_"): k for k in row_dict.keys()}
        for c in candidates:
            if c in row_keys:
                return row_dict[row_keys[c]]
        return None

    if filename.endswith(".json"):
        try:
            parsed = json.loads(content.decode("utf-8"))
            if isinstance(parsed, list):
                records = parsed
            elif isinstance(parsed, dict) and "records" in parsed and "history" in parsed["records"]:
                records = parsed["records"]["history"]
            elif isinstance(parsed, dict) and "history" in parsed:
                records = parsed["history"]
            elif isinstance(parsed, dict) and "sales" in parsed:
                records = parsed["sales"]
            else:
                raise ValueError("JSON must be a list of records or contain a 'history' or 'sales' array.")
        except Exception as e:
            return SalesImportSummary(
                is_valid=False,
                unsuitable_reason=f"Failed to parse JSON file: {str(e)}. Please check standard JSON formatting.",
                validation_messages=["JSON parse error."]
            )
    elif filename.endswith(".csv"):
        try:
            df = pd.read_csv(io.StringIO(content.decode("utf-8", errors="replace")), dtype=str, keep_default_na=False)
            records = df.to_dict(orient="records")
        except Exception as e:
            return SalesImportSummary(
                is_valid=False,
                unsuitable_reason=f"Failed to parse CSV file: {str(e)}. Please check standard UTF-8 CSV formatting.",
                validation_messages=["CSV read error."]
            )
    elif filename.endswith(".xlsx") or filename.endswith(".xls"):
        try:
            df = pd.read_excel(io.BytesIO(content), dtype=str)
            records = df.to_dict(orient="records")
        except Exception as e:
            return SalesImportSummary(
                is_valid=False,
                unsuitable_reason=f"Failed to parse Excel file: {str(e)}.",
                validation_messages=["Excel read error."]
            )
    else:
        return SalesImportSummary(
            is_valid=False,
            unsuitable_reason="Unsupported file format. Please upload a .csv, .json, or .xlsx file.",
            validation_messages=["Unsupported file format."]
        )

    if not records:
        return SalesImportSummary(
            is_valid=False,
            unsuitable_reason="The uploaded file contains 0 records or data rows.",
            validation_messages=["File is empty."]
        )

    validated_records = []
    unique_skus = set()
    dates = []

    for idx, r in enumerate(records):
        line_num = idx + 2 if is_csv else idx + 1
        line_label = f"Line {line_num} (Row {line_num})" if is_csv else f"Item #{line_num}"

        # 1. MANDATORY: Date
        date_raw = find_key(r, ["date", "transaction_date", "day", "sales_date", "timestamp"])
        if is_empty(date_raw):
            return SalesImportSummary(
                is_valid=False,
                unsuitable_reason=f"Validation Error on {line_label}: Mandatory column 'date' is empty. Expected date format YYYY-MM-DD (e.g. 2026-09-01). Please correct {line_label} in your file and try re-uploading.",
                detailed_errors=[f"{line_label}: Empty cell in mandatory column 'date'."],
                validation_messages=["Mandatory column 'date' is empty."]
            )
        date_str = str(date_raw).split("T")[0].split(" ")[0].strip()
        parsed_dt = None
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y", "%Y/%m/%d"):
            try:
                parsed_dt = datetime.strptime(date_str, fmt)
                break
            except ValueError:
                pass
        if not parsed_dt:
            return SalesImportSummary(
                is_valid=False,
                unsuitable_reason=f"Validation Error on {line_label}: Invalid date format '{date_raw}' in column 'date'. Please use YYYY-MM-DD (e.g. 2026-09-01). Please correct {line_label} and try re-uploading.",
                detailed_errors=[f"{line_label}: Invalid date format '{date_raw}'."],
                validation_messages=["Invalid date format."]
            )
        clean_date = parsed_dt.strftime("%Y-%m-%d")

        # 2. MANDATORY: SKU
        sku_val = find_key(r, ["sku", "product_sku", "item_code", "code", "item_id", "id", "sku_code"])
        if is_empty(sku_val):
            return SalesImportSummary(
                is_valid=False,
                unsuitable_reason=f"Validation Error on {line_label}: Mandatory column 'sku' is empty. Every sales record must reference a product SKU. Please correct {line_label} and try re-uploading.",
                detailed_errors=[f"{line_label}: Empty cell in mandatory column 'sku'."],
                validation_messages=["Mandatory column 'sku' is empty."]
            )
        clean_sku = str(sku_val).strip().upper()

        # 3. MANDATORY: Sales Units
        units_val = find_key(r, ["sales_units", "units_sold", "sold_units", "quantity_sold", "daily_sales_units", "units", "quantity", "qty"])
        if is_empty(units_val):
            return SalesImportSummary(
                is_valid=False,
                unsuitable_reason=f"Validation Error on {line_label}: Mandatory column 'sales_units' is empty for SKU '{clean_sku}'. Every sales row must state units sold (0 or higher). Please correct {line_label} and try re-uploading.",
                detailed_errors=[f"{line_label}: Empty cell in mandatory column 'sales_units'."],
                validation_messages=["Mandatory column 'sales_units' is empty."]
            )
        try:
            sales_u = int(float(str(units_val).strip()))
            if sales_u < 0:
                raise ValueError("Negative units")
        except Exception:
            return SalesImportSummary(
                is_valid=False,
                unsuitable_reason=f"Validation Error on {line_label}: Invalid value '{units_val}' in column 'sales_units'. Units sold must be a non-negative number (0 or higher). Please correct {line_label} and try re-uploading.",
                detailed_errors=[f"{line_label}: Invalid sales_units '{units_val}'."],
                validation_messages=["Invalid sales_units value."]
            )

        stockout_val = find_key(r, ["stockout", "is_stockout"])
        is_stockout = bool(stockout_val in (True, 1, "true", "True", "yes", "Yes"))

        validated_records.append({
            "date": clean_date,
            "sku": clean_sku,
            "sales_units": sales_u,
            "stockout": is_stockout
        })
        unique_skus.add(clean_sku)
        dates.append(clean_date)

    # Save to user store
    store.save_user_sales_records(user_id, validated_records, replace=True, is_demo=is_demo)
    store.log_audit_event("SALES_BULK_IMPORT", f"Imported {len(validated_records)} sales records from {filename} for {user_id}.")

    min_date = min(dates) if dates else ""
    max_date = max(dates) if dates else ""
    sku_list = sorted(list(unique_skus))

    return SalesImportSummary(
        is_valid=True,
        imported_count=len(validated_records),
        total_processed=len(records),
        unique_skus=sku_list,
        date_range={"start": min_date, "end": max_date},
        validation_messages=[
            f"Successfully imported {len(validated_records)} sales records for {len(sku_list)} SKUs ({min_date} to {max_date})! Demand forecasting and replenishment engines are now fully active."
        ]
    )

@router.post("/load-demo-sales")
def load_demo_sales(
    x_user_id: Optional[str] = Header(None),
    x_is_demo: Optional[str] = Header(None)
):
    """
    Loads sample historical sales data from the template fixture into the user partition.
    Enables instant testing of forecasting and replenishment engines.
    """
    user_id, is_demo = get_user_context(x_user_id, x_is_demo)
    csv_path = TEMPLATES_DIR / "comprehensive_sales_history.csv"
    if not csv_path.exists():
        csv_path = TEMPLATES_DIR / "sample_sales_history.csv"
    demo_records = []
    if csv_path.exists():
        df = pd.read_csv(csv_path)
        demo_records = df.to_dict(orient="records")
    else:
        data = load_fixture_data()
        demo_records = data.get("records", {}).get("history", [])

    formatted = []
    for r in demo_records:
        formatted.append({
            "date": str(r.get("date", "")).split("T")[0].split(" ")[0].strip(),
            "sku": str(r.get("sku", "")).strip().upper(),
            "sales_units": max(0, int(float(r.get("sales_units", 0)))),
            "stockout": bool(r.get("stockout", False))
        })

    store.save_user_sales_records(user_id, formatted, replace=True, is_demo=is_demo)
    store.log_audit_event("LOAD_DEMO_SALES", f"Loaded {len(formatted)} sample sales records for {user_id}.")

    dates = [r["date"] for r in formatted if r.get("date")]
    skus = sorted(list(set(r["sku"] for r in formatted)))
    return {
        "status": "success",
        "message": f"Successfully loaded {len(formatted)} sample sales records for {len(skus)} SKUs ({min(dates)} to {max(dates)}). Forecasting & replenishment are now fully operational!",
        "records_count": len(formatted),
        "skus": skus,
        "date_range": {"start": min(dates) if dates else "", "end": max(dates) if dates else ""}
    }

@router.get("/sample-template")
def get_sample_template():
    """Returns comprehensive master warehouse & product sample dataset for analysis."""
    json_path = DATA_DIR / "master_retail_warehouse_dataset.json"
    if json_path.exists():
        with open(json_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

@router.get("/sample-template-csv")
def get_sample_template_csv():
    """Returns comprehensive master warehouse & product sample dataset in CSV format."""
    csv_path = DATA_DIR / "master_retail_warehouse_dataset.csv"
    if csv_path.exists():
        with open(csv_path, "r", encoding="utf-8") as f:
            content = f.read()
    else:
        content = "sku,name,category,available_stock,reserved_stock,inbound_stock,lead_days,moq,pack_size,unit_cost_inr,selling_price_inr,is_perishable,expiry_date,batch_number,daily_demand\n"
    return PlainTextResponse(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=master_retail_warehouse_dataset.csv"}
    )

@router.get("/history")
def get_sales_history(
    sku: Optional[str] = Query(None, description="Filter by SKU"),
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    x_user_id: Optional[str] = Header(None),
    x_is_demo: Optional[str] = Header(None)
):
    user_id, is_demo = get_user_context(x_user_id, x_is_demo)
    if is_demo:
        data = load_fixture_data()
        history = data.get("records", {}).get("history", [])
    else:
        history = store.get_user_sales_history(user_id, is_demo=False)

    filtered = history
    if sku:
        filtered = [r for r in filtered if r.get("sku", "").upper() == sku.upper()]
    if start_date:
        filtered = [r for r in filtered if r.get("date", "") >= start_date]
    if end_date:
        filtered = [r for r in filtered if r.get("date", "") <= end_date]

    return {
        "count": len(filtered),
        "records": filtered
    }

@router.post("/validate-import", response_model=ImportValidationSummary)
async def validate_import(
    file: UploadFile = File(...),
    x_user_id: Optional[str] = Header(None),
    x_is_demo: Optional[str] = Header(None)
):
    """
    Validates uploaded sales history files (CSV or JSON) against the C19 schema.
    Detects missing dates, duplicate dates, invalid numeric values, and stockouts.
    """
    content = await file.read()
    filename = file.filename.lower()

    records = []
    if filename.endswith(".json"):
        try:
            parsed = json.loads(content.decode("utf-8"))
            if isinstance(parsed, list):
                records = parsed
            elif isinstance(parsed, dict) and "records" in parsed and "history" in parsed["records"]:
                records = parsed["records"]["history"]
            elif isinstance(parsed, dict) and "history" in parsed:
                records = parsed["history"]
            else:
                raise ValueError("JSON must be a list of records or contain a 'history' array.")
        except Exception as e:
            return ImportValidationSummary(
                is_valid=False,
                total_records=0,
                unique_skus=[],
                date_range={},
                duplicate_dates=[],
                missing_dates=[],
                invalid_numbers=[],
                stockout_count=0,
                validation_messages=[f"Invalid JSON format: {str(e)}"]
            )
    elif filename.endswith(".csv"):
        try:
            df = pd.read_csv(io.StringIO(content.decode("utf-8")))
            records = df.to_dict(orient="records")
        except Exception as e:
            return ImportValidationSummary(
                is_valid=False,
                total_records=0,
                unique_skus=[],
                date_range={},
                duplicate_dates=[],
                missing_dates=[],
                invalid_numbers=[],
                stockout_count=0,
                validation_messages=[f"Invalid CSV format: {str(e)}"]
            )
    else:
        raise HTTPException(status_code=400, detail="Only .csv and .json files are supported.")

    # Validate parsed records
    duplicate_dates = []
    invalid_numbers = []
    stockout_count = 0
    skus = set()
    dates = []
    seen_sku_dates = set()

    for idx, r in enumerate(records):
        sku = str(r.get("sku", "")).strip()
        date_str = str(r.get("date", "")).strip()
        
        if not sku or not date_str:
            invalid_numbers.append(f"Row {idx+1}: Missing required SKU or Date")
            continue

        skus.add(sku)
        dates.append(date_str)

        key = (sku, date_str)
        if key in seen_sku_dates:
            duplicate_dates.append(f"Duplicate entry for {sku} on {date_str}")
        seen_sku_dates.add(key)

        # Validate sales_units
        try:
            sales = float(r.get("sales_units", 0))
            if sales < 0:
                invalid_numbers.append(f"Row {idx+1} ({sku}, {date_str}): sales_units cannot be negative ({sales})")
        except (ValueError, TypeError):
            invalid_numbers.append(f"Row {idx+1} ({sku}, {date_str}): invalid numeric sales_units")

        if r.get("stockout") in (True, "true", "True", 1):
            stockout_count += 1

    # Check date continuity per SKU
    missing_dates = []
    if dates:
        try:
            dates_dt = pd.to_datetime(dates)
            full_range = pd.date_range(dates_dt.min(), dates_dt.max())
            for s in skus:
                sku_dates = set([r.get("date") for r in records if r.get("sku") == s])
                for expected_d in full_range:
                    d_str = expected_d.strftime("%Y-%m-%d")
                    if d_str not in sku_dates:
                        missing_dates.append(f"Missing date {d_str} for {s}")
        except Exception:
            pass

    messages = []
    if duplicate_dates:
        messages.append(f"Found {len(duplicate_dates)} duplicate SKU-date records.")
    if missing_dates:
        messages.append(f"Found {len(missing_dates)} missing calendar dates across SKUs.")
    if invalid_numbers:
        messages.append(f"Found {len(invalid_numbers)} invalid numerical or required fields.")
    if stockout_count > 0:
        messages.append(f"Identified {stockout_count} stockout observations; sales are supply-censored.")

    is_valid = len(invalid_numbers) == 0 and len(records) > 0

    user_id, is_demo = get_user_context(x_user_id, x_is_demo)
    if is_valid and not is_demo:
        store.save_user_sales_records(user_id, records, is_demo=False)
        store.log_audit_event("SALES_IMPORT", f"Imported {len(records)} sales records for user {user_id}.")

    return ImportValidationSummary(
        is_valid=is_valid,
        total_records=len(records),
        unique_skus=sorted(list(skus)),
        date_range={"min_date": min(dates) if dates else "", "max_date": max(dates) if dates else ""},
        duplicate_dates=duplicate_dates[:10],
        missing_dates=missing_dates[:10],
        invalid_numbers=invalid_numbers[:10],
        stockout_count=stockout_count,
        validation_messages=messages if messages else ["All records successfully validated against C19 schema."]
    )

@router.get("/analysis")
def get_dataset_analysis(
    as_of_date: Optional[str] = Query(None, description="Inventory as-of date"),
    x_user_id: Optional[str] = Header(None),
    x_is_demo: Optional[str] = Header(None)
):
    """
    Returns an executive dataset analysis with inventory valuation, stockout alerts,
    perishable spoilage risk, ABC classification, and prioritized AI recommendations.
    """
    from backend.app.analytics.engine import DatasetAnalyticsEngine
    from backend.app.api.replenishment import get_replenishment_proposals

    if as_of_date is not None and not isinstance(as_of_date, str):
        as_of_date = None
    user_id, is_demo = get_user_context(x_user_id, x_is_demo)
    prods = list_products(x_user_id=x_user_id, x_is_demo=x_is_demo)
    prods_dicts = [p.model_dump() if hasattr(p, "model_dump") else p for p in prods]

    if not prods_dicts:
        return {
            "has_data": False,
            "total_skus": 0,
            "message": "No products currently available in inventory catalog."
        }

    proposals_res = get_replenishment_proposals(as_of_date=as_of_date, x_user_id=x_user_id, x_is_demo=x_is_demo)
    analysis = DatasetAnalyticsEngine.analyze_dataset(
        products=prods_dicts,
        proposals=proposals_res.proposals,
        as_of_date=proposals_res.as_of_date
    )
    return analysis
