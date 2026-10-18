import os
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional
from backend.app.core.config import settings

logger = logging.getLogger("stocksense.persistence")

# Fallback local store path
DEFAULT_STORE_PATH = Path(__file__).resolve().parent.parent.parent.parent / "data" / "local_store.json"

# In serverless environments like Vercel or AWS Lambda, the workspace is read-only; use /tmp
if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    LOCAL_STORE_PATH = Path("/tmp/local_store.json")
    if not LOCAL_STORE_PATH.exists() and DEFAULT_STORE_PATH.exists():
        try:
            import shutil
            LOCAL_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(DEFAULT_STORE_PATH, LOCAL_STORE_PATH)
        except Exception:
            pass
else:
    LOCAL_STORE_PATH = DEFAULT_STORE_PATH

class PersistenceStore:
    def __init__(self):
        self.is_demo_mode = True
        self.db = None
        self._init_firebase()
        self._init_local_store()

    def _init_firebase(self):
        """Attempts to initialize Firebase Admin SDK if credentials/project are configured."""
        try:
            import firebase_admin
            from firebase_admin import credentials, firestore
            from backend.app.core.config import BASE_DIR

            if not firebase_admin._apps:
                cred_path = settings.FIREBASE_CREDENTIALS_PATH
                resolved_cred = None
                if cred_path:
                    p = Path(cred_path)
                    if p.is_absolute() and p.exists():
                        resolved_cred = p
                    else:
                        for cand in [BASE_DIR / cred_path, Path(os.getcwd()) / cred_path, BASE_DIR / "firebase-credentials.json"]:
                            if cand.exists():
                                resolved_cred = cand
                                break

                if resolved_cred and resolved_cred.exists():
                    cred = credentials.Certificate(str(resolved_cred))
                    firebase_admin.initialize_app(cred)
                    self.db = firestore.client()
                    self.is_demo_mode = False
                    logger.info("Firebase Firestore connected via service account credentials: %s", resolved_cred)
                elif settings.FIREBASE_PROJECT_ID and not (os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME")):
                    try:
                        firebase_admin.initialize_app(options={"projectId": settings.FIREBASE_PROJECT_ID})
                        self.db = firestore.client()
                        self.is_demo_mode = False
                        logger.info("Firebase Firestore initialized with Project ID: %s", settings.FIREBASE_PROJECT_ID)
                    except Exception as adc_err:
                        logger.info("Firebase Project ID set (%s); service account key required for direct server access.", settings.FIREBASE_PROJECT_ID)
                        self.is_demo_mode = True
                else:
                    logger.info("No Firebase service account credentials provided. Operating in Demo / Local mode.")
                    self.is_demo_mode = True
        except Exception as e:
            logger.warning("Firebase Admin initialization failed or not configured (%s). Running in Demo Mode.", str(e))
            self.is_demo_mode = True
            self.db = None

    def _init_local_store(self):
        """Ensures local store JSON exists with baseline structure."""
        if not LOCAL_STORE_PATH.exists():
            initial_data = {
                "forecast_runs": [],
                "replenishment_proposals": [],
                "saved_scenarios": [],
                "business_outreach": [
                    {
                        "id": "outreach-1",
                        "organization": "Modern Mart Supermarkets (3 Locations, Hyderabad)",
                        "contact_person": "Vikram Reddy, Operations Head",
                        "channel": "In-Person Retail Visit",
                        "contact_date": "2026-09-02",
                        "observed_problem": "Stockouts on fast-moving staples during Friday evening surge; manual reordering in WhatsApp group.",
                        "reaction": "Interested In Pilot",
                        "outcome_notes": "Impressed by 7-day cyclical baseline; wants to test on 10 SKUs in Banjara Hills branch before paying.",
                        "follow_up_action": "Demo 7-day forecast shadow review on Sept 18 with his store manager."
                    },
                    {
                        "id": "outreach-2",
                        "organization": "QuickPick Express (5 Convenience Outlets, Secunderabad)",
                        "contact_person": "Anita Rao, Procurement Lead",
                        "channel": "Direct Phone Call",
                        "contact_date": "2026-09-08",
                        "observed_problem": "Over-ordering bulk packs due to supplier MOQ; warehouse storage space constraints.",
                        "reaction": "Constructive Decline",
                        "outcome_notes": "Valued the MOQ/pack-size reconciliation logic, but currently locked into annual ERP vendor contract until Q1 2027.",
                        "follow_up_action": "Check back in Dec 2026 for next fiscal budget cycle."
                    },
                    {
                        "id": "outreach-3",
                        "organization": "FreshBite Gourmet Grocers (2 Stores, Gachibowli)",
                        "contact_person": "Karthik Sharma, Store Owner",
                        "channel": "Referral",
                        "contact_date": "2026-09-11",
                        "observed_problem": "High wastage on perishable dairy/bakery; lead-time shocks from local distributors.",
                        "reaction": "Interested In Pilot",
                        "outcome_notes": "Needs replenishment alert 48 hours prior to supplier order cutoff.",
                        "follow_up_action": "Configure lead-time scenario simulation for 48h lead times."
                    }
                ],
                "pricing_plan": {
                    "price_per_location_monthly_inr": 3499.0,
                    "active_locations": 5,
                    "hosting_cost_per_location_inr": 300.0,
                    "support_cost_per_location_inr": 400.0,
                    "onboarding_amortized_inr": 250.0
                },
                "audit_events": [
                    {
                        "id": "evt-1",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "user": "system",
                        "action": "SYSTEM_INITIALIZATION",
                        "details": "StockSense C19 baseline environment initialized."
                    }
                ]
            }
            try:
                LOCAL_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
                with open(LOCAL_STORE_PATH, "w") as f:
                    json.dump(initial_data, f, indent=2)
            except Exception as e:
                logger.warning("Could not initialize local store file (%s).", e)

    def _read_local(self) -> Dict[str, Any]:
        try:
            if LOCAL_STORE_PATH.exists():
                with open(LOCAL_STORE_PATH, "r") as f:
                    return json.load(f)
            if DEFAULT_STORE_PATH.exists():
                with open(DEFAULT_STORE_PATH, "r") as f:
                    return json.load(f)
        except Exception as e:
            logger.warning("Could not read local store (%s). Using in-memory fallback.", e)
        return {"forecast_runs": [], "saved_scenarios": [], "business_outreach": [], "pricing_plan": {}, "audit_events": []}

    def _write_local(self, data: Dict[str, Any]):
        try:
            LOCAL_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
            with open(LOCAL_STORE_PATH, "w") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.warning("Could not write to local store at %s (%s).", LOCAL_STORE_PATH, e)

    # ----------------- Forecast Runs -----------------
    def save_forecast_run(self, run_data: Dict[str, Any]) -> str:
        run_id = f"run_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
        run_data["run_id"] = run_id
        run_data["saved_at"] = datetime.now(timezone.utc).isoformat()

        if not self.is_demo_mode and self.db:
            try:
                self.db.collection("forecast_runs").document(run_id).set(run_data)
                return run_id
            except Exception as e:
                logger.error("Failed to write to Firestore: %s. Falling back to local store.", str(e))

        store = self._read_local()
        store.setdefault("forecast_runs", []).insert(0, run_data)
        self._write_local(store)
        return run_id

    def list_forecast_runs(self) -> List[Dict[str, Any]]:
        if not self.is_demo_mode and self.db:
            try:
                docs = self.db.collection("forecast_runs").order_by("saved_at", direction="DESCENDING").limit(20).stream()
                return [d.to_dict() for d in docs]
            except Exception:
                pass
        store = self._read_local()
        return store.get("forecast_runs", [])

    # ----------------- Scenarios -----------------
    def save_scenario(self, scenario_data: Dict[str, Any]) -> str:
        scen_id = f"scen_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
        scenario_data["id"] = scen_id
        scenario_data["created_at"] = datetime.now(timezone.utc).isoformat()

        if not self.is_demo_mode and self.db:
            try:
                self.db.collection("scenarios").document(scen_id).set(scenario_data)
                return scen_id
            except Exception:
                pass

        store = self._read_local()
        store.setdefault("saved_scenarios", []).insert(0, scenario_data)
        self._write_local(store)
        return scen_id

    def list_scenarios(self) -> List[Dict[str, Any]]:
        if not self.is_demo_mode and self.db:
            try:
                docs = self.db.collection("scenarios").stream()
                return [d.to_dict() for d in docs]
            except Exception:
                pass
        store = self._read_local()
        return store.get("saved_scenarios", [])

    # ----------------- Business Outreach & Pricing -----------------
    def get_pricing_plan(self) -> Dict[str, Any]:
        store = self._read_local()
        return store.get("pricing_plan", {})

    def update_pricing_plan(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        store = self._read_local()
        store["pricing_plan"] = plan
        self._write_local(store)
        return plan

    def list_outreach_records(self) -> List[Dict[str, Any]]:
        store = self._read_local()
        return store.get("business_outreach", [])

    def add_outreach_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
        if "id" not in record or not record["id"]:
            record["id"] = f"outreach-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        store = self._read_local()
        store.setdefault("business_outreach", []).insert(0, record)
        self._write_local(store)
        return record

    def log_audit_event(self, action: str, details: str, user: str = "demo_user"):
        event = {
            "id": f"evt-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user": user,
            "action": action,
            "details": details
        }
        if not self.is_demo_mode and self.db:
            try:
                self.db.collection("audit_events").document(event["id"]).set(event)
            except Exception as e:
                logger.error("Failed to write audit event to Firestore: %s", str(e))

        store = self._read_local()
        store.setdefault("audit_events", []).insert(0, event)
        self._write_local(store)

    # ----------------- User Partitions (Multi-tenant Products & Sales) -----------------
    def get_user_products(self, user_id: str, is_demo: bool = False) -> List[Dict[str, Any]]:
        if is_demo or user_id in ("demo", "user-demo-c19", "admin-eval-c19"):
            from backend.app.api.dataset import get_demo_catalog
            return [p.model_dump() if hasattr(p, "model_dump") else p for p in get_demo_catalog().values()]
        
        # 1. Query Cloud Firestore if connected
        if not self.is_demo_mode and self.db:
            try:
                docs = self.db.collection("products").where("user_id", "==", user_id).stream()
                prods = [d.to_dict() for d in docs]
                if prods:
                    return prods
            except Exception as e:
                logger.error("Failed to query user products from Firestore: %s", str(e))

        # 2. Fallback to local partition
        local = self._read_local()
        user_parts = local.setdefault("user_partitions", {})
        return user_parts.get(user_id, {}).get("products", [])

    def save_user_product(self, user_id: str, product_dict: Dict[str, Any], is_demo: bool = False) -> Dict[str, Any]:
        if is_demo or user_id in ("demo", "user-demo-c19", "admin-eval-c19"):
            from backend.app.api.dataset import get_demo_catalog, SKUDetail
            cat = get_demo_catalog()
            cat[product_dict["sku"]] = SKUDetail(**product_dict)
            return product_dict

        data_to_save = dict(product_dict)
        data_to_save["user_id"] = user_id
        data_to_save["updated_at"] = datetime.now(timezone.utc).isoformat()

        # 1. Write to Cloud Firestore if connected
        if not self.is_demo_mode and self.db:
            try:
                doc_id = f"{user_id}_{product_dict['sku']}"
                self.db.collection("products").document(doc_id).set(data_to_save)
                logger.info("Saved product %s for user %s to Cloud Firestore.", product_dict['sku'], user_id)
            except Exception as e:
                logger.error("Failed to save product to Firestore: %s", str(e))

        # 2. Write to local partition for caching
        local = self._read_local()
        user_parts = local.setdefault("user_partitions", {})
        user_data = user_parts.setdefault(user_id, {"products": [], "sales_history": []})
        
        products = user_data.setdefault("products", [])
        existing_idx = next((i for i, p in enumerate(products) if p["sku"].upper() == product_dict["sku"].upper()), -1)
        if existing_idx >= 0:
            products[existing_idx] = data_to_save
        else:
            products.append(data_to_save)
            
        self._write_local(local)
        return data_to_save

    def delete_user_product(self, user_id: str, sku: str, is_demo: bool = False) -> bool:
        if is_demo or user_id in ("demo", "user-demo-c19", "admin-eval-c19"):
            from backend.app.api.dataset import get_demo_catalog
            cat = get_demo_catalog()
            if sku in cat:
                del cat[sku]
                return True
            return False

        # 1. Delete from Cloud Firestore if connected
        if not self.is_demo_mode and self.db:
            try:
                doc_id = f"{user_id}_{sku}"
                self.db.collection("products").document(doc_id).delete()
            except Exception as e:
                logger.error("Failed to delete product from Firestore: %s", str(e))

        # 2. Delete from local partition
        local = self._read_local()
        user_parts = local.setdefault("user_partitions", {})
        user_data = user_parts.get(user_id)
        if not user_data or "products" not in user_data:
            return False
            
        orig_len = len(user_data["products"])
        user_data["products"] = [p for p in user_data["products"] if p["sku"].upper() != sku.upper()]
        deleted = len(user_data["products"]) < orig_len
        if deleted:
            self._write_local(local)
        return deleted

    def get_user_sales_history(self, user_id: str, is_demo: bool = False) -> List[Dict[str, Any]]:
        if is_demo or user_id in ("demo", "user-demo-c19", "admin-eval-c19"):
            from backend.app.api.dataset import load_fixture_data
            data = load_fixture_data()
            return data.get("records", {}).get("history", [])

        # 1. Query Cloud Firestore if connected
        if not self.is_demo_mode and self.db:
            try:
                doc_ref = self.db.collection("sales_history_batches").document(user_id)
                doc = doc_ref.get()
                if doc.exists:
                    data = doc.to_dict()
                    if "records" in data and data["records"]:
                        return data["records"]
            except Exception as e:
                logger.error("Failed to query sales history from Firestore: %s", str(e))

        # 2. Fallback to local partition
        local = self._read_local()
        user_parts = local.setdefault("user_partitions", {})
        user_data = user_parts.setdefault(user_id, {"products": [], "sales_history": []})
        sales = user_data.get("sales_history", [])
        return sales

    def save_user_sales_records(self, user_id: str, records: List[Dict[str, Any]], is_demo: bool = False, replace: bool = True) -> int:
        if is_demo or user_id in ("demo", "user-demo-c19", "admin-eval-c19"):
            return len(records)

        # 1. Write to Cloud Firestore if connected
        if not self.is_demo_mode and self.db:
            try:
                doc_ref = self.db.collection("sales_history_batches").document(user_id)
                doc_ref.set({
                    "user_id": user_id,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "records_count": len(records),
                    "records": records
                })
                logger.info("Saved %d sales records for user %s to Cloud Firestore.", len(records), user_id)
            except Exception as e:
                logger.error("Failed to save sales history batch to Firestore: %s", str(e))

        # 2. Write to local partition
        local = self._read_local()
        user_parts = local.setdefault("user_partitions", {})
        user_data = user_parts.setdefault(user_id, {"products": [], "sales_history": []})
        if replace:
            user_data["sales_history"] = records
        else:
            user_data.setdefault("sales_history", []).extend(records)
        self._write_local(local)
        return len(records)

    # ----------------- User Insights (AI Forecasts, Replenishment, Risk Exposure) -----------------
    def save_user_insights(self, user_id: str, insights_data: Dict[str, Any], is_demo: bool = False) -> str:
        insight_id = f"insight_{user_id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
        insights_data["insight_id"] = insight_id
        insights_data["user_id"] = user_id
        insights_data["saved_at"] = datetime.now(timezone.utc).isoformat()

        # 1. Write to Cloud Firestore if connected
        if not self.is_demo_mode and self.db:
            try:
                self.db.collection("user_insights").document(insight_id).set(insights_data)
                self.db.collection("user_insights").document(f"latest_{user_id}").set(insights_data)
                logger.info("Saved user insights %s for user %s to Cloud Firestore.", insight_id, user_id)
            except Exception as e:
                logger.error("Failed to save user insights to Firestore: %s", str(e))

        # 2. Write to local partition
        local = self._read_local()
        user_parts = local.setdefault("user_partitions", {})
        user_data = user_parts.setdefault(user_id, {})
        user_data.setdefault("insights", []).insert(0, insights_data)
        user_data["latest_insights"] = insights_data
        self._write_local(local)
        return insight_id

    def get_user_insights(self, user_id: str, is_demo: bool = False) -> Optional[Dict[str, Any]]:
        # 1. Read from Cloud Firestore if connected
        if not self.is_demo_mode and self.db:
            try:
                doc = self.db.collection("user_insights").document(f"latest_{user_id}").get()
                if doc.exists:
                    return doc.to_dict()
            except Exception as e:
                logger.error("Failed to get user insights from Firestore: %s", str(e))

        # 2. Read from local partition
        local = self._read_local()
        user_parts = local.get("user_partitions", {})
        user_data = user_parts.get(user_id, {})
        return user_data.get("latest_insights")

store = PersistenceStore()
