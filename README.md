# StockSense — Smart Inventory Forecasting & Replenishment

> **Tagline:** Know Your Stock. Plan Ahead.  
> **Simulation Reference:** Fynd &times; NMIMS Hyderabad &bull; Case C19: *Inventory Forecast and Replenishment Baseline*

---

## 1. Executive Summary & Product Objective

**StockSense** is an inventory planning and demand forecasting decision-support web application designed for regional retail store chains (2–10 stores). It provides inventory planners with short-horizon replenishment proposals under real-world operational constraints (supplier lead times, Minimum Order Quantities [MOQ], master pack sizes, held/reserved stock, and supply-chain shocks).

StockSense answers five essential daily questions:
1. **How much demand should we expect over the next 7 days?**
2. **How much usable inventory do we currently hold?**
3. **How many days of customer demand will available inventory cover?**
4. **How many units should we order, and when will they arrive?**
5. **How confident are we in the recommendation?**

---

## 2. Architecture & Technology Stack

| Component | Technology | Rationale & Responsibility |
| :--- | :--- | :--- |
| **Frontend UI** | HTML5, CSS3, Vanilla JS (ES Modules) | Lightweight, fast-loading SaaS dashboard adhering to design system tokens. Zero heavy bundlers required. |
| **Visualizations** | Chart.js | Minimalist, interactive demand forecasting trajectories with 80% confidence bands and residuals analysis. |
| **Iconography** | Inline Lucide SVG Icons | Sharp vector icons with zero latency or external webfont failure risks. |
| **Backend Engine** | Python 3.13, FastAPI, Pandas, NumPy | Modular mathematical forecasting and deterministic replenishment engine. Pydantic request/response validation. |
| **Database & Auth** | Firebase Auth & Cloud Firestore | Dual-mode persistence: Seamless Google Cloud Firestore when configured, with an offline Local Demo Mode fallback. |
| **Security** | `firestore.rules` | Location-scoped and user-scoped authorization rules preventing cross-tenant leakage. |

---

## 3. Project Directory Structure

```text
StockSense/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI entrypoint, CORS, static frontend mount
│   │   ├── core/
│   │   │   └── config.py            # Settings, paths, environment configuration
│   │   ├── schemas/
│   │   │   └── models.py            # Pydantic schemas for forecasting, replenishment, scenarios, MBA plan
│   │   ├── forecasting/
│   │   │   └── engine.py            # Naive same-weekday baseline, SMA-7, held-out MAE evaluation
│   │   ├── inventory/
│   │   │   └── engine.py            # Replenishment engine, MOQ/pack size rules, 5 reference benchmarks
│   │   ├── scenarios/
│   │   │   └── simulator.py         # What-if simulator: lead-time shock, zero stock, delayed inbound
│   │   ├── persistence/
│   │   │   └── store.py             # Dual-mode store: Cloud Firestore & local JSON store
│   │   └── api/
│   │       ├── health.py            # System status & mode detection
│   │       ├── dataset.py           # Catalog summary & CSV/JSON import validator
│   │       ├── forecast.py          # 7-day demand forecasting routes
│   │       ├── evaluation.py        # Held-out MAE scorecard & daily residuals
│   │       ├── replenishment.py     # Order proposals & 5 reference checks
│   │       ├── scenarios.py         # Stress-test simulation endpoints
│   │       ├── reports.py           # Saved run snapshots & CSV/JSON export
│   │       └── business_plan.py     # Unit economics calculator & outreach log
│   ├── tests/
│   │   ├── test_forecasting.py      # Baseline lag, split separation, MAE tests
│   │   ├── test_inventory.py        # 5 reference benchmarks, MOQ, pack size, changed inputs
│   │   ├── test_scenarios.py        # Zero stock, late inbound, demand surges
│   │   └── test_api.py              # TestClient end-to-end endpoint verification
│   └── requirements.txt             # Python dependencies
├── data/
│   ├── fixture.json                 # Mirror of Case C19 dataset (210 records)
│   └── local_store.json             # Local persistent store for demo mode
├── starter-data/
│   └── c19/
│       ├── fixture.json             # Original teaching fixture preserved unchanged
│       └── case_meta.json           # Mentor & case specification metadata
├── frontend/
│   ├── index.html                   # Login / Register / Instant Demo access portal
│   ├── dashboard.html               # Executive dashboard, attention alerts, primary charts
│   ├── inventory.html               # Product catalogue, stock positions, edit modal
│   ├── sales.html                   # Sales history, CSV/JSON uploader with validation
│   ├── forecasting.html             # 7-day demand projections & model comparison
│   ├── replenishment.html           # Order planner, shortfall calculation, review modal
│   ├── scenarios.html               # Interactive scenario simulator (side-by-side diff)
│   ├── evaluation.html              # Held-out MAE evaluation & residuals breakdown
│   ├── reports.html                 # Printable executive audit report & data export
│   ├── business-plan.html           # MBA subscription model & customer outreach log
│   ├── settings.html                # Firebase configuration & immutable audit trail
│   ├── css/
│   │   ├── styles.css               # Design tokens, CSS variables, typography, layout
│   │   ├── components.css           # Cards, tables, badges, buttons, tooltips, modals
│   │   └── responsive.css           # Tablet and mobile navigation rules
│   └── js/
│       ├── firebase-config.js       # Firebase Web SDK setup
│       ├── auth.js                  # Authentication service (Firebase + Demo Session)
│       ├── api.js                   # Unified API client
│       ├── shared.js                # Shell injection, tooltips, tour, toast alerts
│       ├── dashboard.js             # Dashboard controller & charts
│       ├── inventory.js             # Products catalogue controller
│       ├── sales.js                 # Sales trend & file uploader
│       ├── forecasting.js           # Forecast controller & confidence intervals
│       ├── replenishment.js         # Replenishment proposals controller
│       ├── scenarios.js             # Scenario simulator controller
│       ├── evaluation.js            # Forecast evaluation controller
│       ├── reports.js               # Saved runs & report generator
│       ├── business-plan.js         # Unit economics & outreach tracker
│       └── settings.js              # Settings & audit controller
├── firestore.rules                  # Firestore database security rules
├── DATA_DICTIONARY.md               # Detailed schema, cutoffs, and policy documentation
├── TEST_REPORT.md                   # 23 automated test execution results
├── .env.example                     # Environment template
├── .gitignore                       # Source control ignores
└── README.md                        # Documentation & setup guide
```

---

## 4. Quickstart: Setup & Execution Instructions (Windows)

### Step 1: Environment Preparation
Open PowerShell in the project root directory (`d:\StockSense`):
```powershell
# Verify Python 3.10+ is installed
python --version

# Create Python virtual environment (optional but recommended)
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install required dependencies
pip install -r backend/requirements.txt
```

### Step 2: Configure Environment (Optional)
Copy `.env.example` to `.env`:
```powershell
copy .env.example .env
```
> *Note:* If no Firebase credentials are provided, StockSense will automatically and transparently start in **Local Demo Mode** with complete persistence stored in `data/local_store.json`.

### Step 3: Launch the Application
Start the unified FastAPI backend server:
```powershell
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Step 4: Open in Web Browser
Open your browser and navigate to:
```text
http://127.0.0.1:8000
```
- Click **"Instant Demo Access &rarr;"** to bypass login and immediately enter the **Executive Dashboard**.
- Alternatively, you can serve the frontend with any static HTTP server (e.g., `python -m http.server 5500 --directory frontend`), as the frontend is fully decoupled and CORS-enabled.

---

## 5. Automated Testing & Case Verification

Run the complete test suite verifying all 23 public case checks:
```powershell
python -m pytest backend/tests -v
```

### Verified Case Benchmarks:
1. **The 5 Inventory Reference Examples (`fixture.json`):**
   - SKU1 (Target 30, Position 10, MOQ 5) &rarr; **20 units** (100% Match)
   - SKU2 (Target 30, Position 20, MOQ 5) &rarr; **10 units** (100% Match)
   - SKU3 (Target 30, Position 30, MOQ 5) &rarr; **0 units** (100% Match)
   - SKU4 (Target 30, Position 40, MOQ 5) &rarr; **0 units** (100% Match)
   - SKU5 (Target 30, Position 50, MOQ 5) &rarr; **0 units** (100% Match)
2. **MAE Evaluation on Held-Out Period (2026-09-05 to 2026-09-11):**
   - **Naive Baseline:** MAE = **0.000**
   - **7-Day Moving Average:** MAE = **1.714**
   - **Finding:** Naive baseline outperforms moving average by capturing weekly cyclical patterns without flattening peaks.
3. **Changed-Input Verification:**
   - SKU2 lead time changed from $3 \to 5$ days &rarr; Order quantity adjusted from $10 \to 30$ units.

---

## 6. Demonstration Script for Mentors & Judges

| Step | Action | What to Observe |
| :--- | :--- | :--- |
| **1. Welcome & Guided Tour** | On `index.html`, click **"Instant Demo Access &rarr;"**. On the Dashboard, click **"Launch Guided Tour &rarr;"**. | A 5-step interactive walkthrough explains the C19 problem, the naive same-weekday baseline, and the replenishment formula in plain language. |
| **2. Executive Attention** | Review the **"What Needs Your Attention Today"** alert banner on the Dashboard. | The system flags that SKU1 & SKU2 require reorders, while SKU3, SKU4, and SKU5 hold sufficient stock. |
| **3. Demand Forecasting** | Navigate to **Demand Forecasting** (`forecasting.html`). Inspect SKU1. | Observe the 7-day predicted trajectory. Notice the 80% prediction intervals. Read the model explanation explaining why the baseline beats the moving average. |
| **4. Replenishment Planner** | Navigate to **Replenishment Planner** (`replenishment.html`). Click **"Verify 5 Reference Examples"**. | A success toast confirms that all 5 C19 reference examples match with 100% precision. Click **"Review Proposed Order"** to view the MOQ-adjusted carton totals and INR capital requirement. |
| **5. Supply-Chain Shock Simulator** | Navigate to **Risk & Simulator** (`scenarios.html`). Select **"Supplier Lead-Time Shock"** and click **"Run Scenario Simulation &rarr;"**. | Side-by-side diff displays the original 20-unit order jumping to 60 units because lead time lengthened from 3 to 7 days. Click **"Save Scenario"** to record the experiment. |
| **6. MAE Evaluation & Residuals** | Navigate to **Forecast Evaluation** (`evaluation.html`). | Review the Per-SKU MAE scorecard. Baseline MAE is 0.000 vs. Alternative MAE 1.714. Transparently demonstrates the rubric's core lesson: more complex models are not automatically better. |
| **7. MBA Business Plan** | Navigate to **MBA Business Plan** (`business-plan.html`). Change Price / Location to **₹3,999**. | Dynamic financial model recalculates monthly revenue, COGS, and gross margin in real-time. View the Customer Discovery log recording constructive declines. |
| **8. Audit & Print Report** | Navigate to **Reports** (`reports.html`). Click **"Print Executive Report"**. | Clean, print-friendly audit report suitable for management review. |

---

## 7. Known Limitations & Disclosures

1. **Synthetic Nature of Fixture**: Dataset C19 is an educational synthetic teaching fixture (`synthetic: true`). Demand follows a regular weekly cycle without irregular holiday or weather disruptions.
2. **Catalog Scale**: The prototype focuses on 5 key benchmark SKUs. High-volume enterprise catalogs (>10,000 SKUs) would require distributed batch computation (e.g. Celery / Redis).
3. **Decision Support Boundary**: StockSense is an inventory planning system. It computes recommended quantities; it does not issue purchase orders to external vendor ERPs without human authorization.
