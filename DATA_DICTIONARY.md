# StockSense Data Dictionary & Schema Documentation

## 1. Overview & Dataset Provenance
- **Case Reference**: Fynd × NMIMS Hyderabad Case C19 — *Inventory Forecast and Replenishment Baseline*
- **Fixture Path**: `starter-data/c19/fixture.json` (also mirrored at `data/fixture.json`)
- **Metadata Reference**: `starter-data/c19/case_meta.json`
- **Data Version**: `v3.2`
- **Synthetic**: `true`
- **Currency Convention**: Indian Rupees (`INR`), fields denoted with `_inr`
- **Missing Value Convention**: `null` indicates unknown/missing, strictly **never** silently converted to zero
- **Date Format**: ISO 8601 calendar date (`YYYY-MM-DD`)

---

## 2. Dataset Hierarchy & Top-Level Keys

| Field Name | Type | Description | Observed Example |
| :--- | :--- | :--- | :--- |
| `case_id` | String | Case identifier | `"C19"` |
| `synthetic` | Boolean | Declares whether dataset is simulated | `true` |
| `data_version` | String | Semantic version of data schema | `"v3.2"` |
| `currency` | String | Default currency declaration | `"INR unless explicitly stated"` |
| `missing_values` | String | Policy on missing values | `"null means unknown, never zero"` |
| `records` | Object | Container for operational data and reference benchmarks | See Section 3 |
| `public_checks` | Array[String]| Published teaching validation checks | 3 verification rules |
| `limit` | String | Disclosed scope and boundaries | Prototype boundaries |

---

## 3. History Records Schema (`records.history[]`)

The dataset contains **210 historical records** across 5 distinct SKUs over 42 calendar days:
- **Date Span**: `2026-08-01` to `2026-09-11` (August 1 to September 11, 2026)
- **SKU Count**: 5 SKUs (`SKU1`, `SKU2`, `SKU3`, `SKU4`, `SKU5`), exactly 42 daily records per SKU.

| Field Name | Type | Unit | Nullable | Validation Rules | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `date` | String | Calendar Date | No | `YYYY-MM-DD`, Chronological | Transaction or snapshot calendar date |
| `sku` | String | Identifier | No | Non-empty string | Stock Keeping Unit identifier (`SKU1`..`SKU5`) |
| `sales_units` | Integer | Units | No | `>= 0` | Daily sold quantities. Sales during stockout are censored |
| `stockout` | Boolean | Flag | No | `true` or `false` | Indicates whether stock was exhausted on this date |
| `available_stock` | Integer | Units | No | `>= 0` | Physical stock on hand at close of day |
| `lead_days` | Integer | Calendar Days | No | `>= 1` | Supplier lead time required for replenishment |
| `moq` | Integer | Units | No | `>= 1` | Minimum Order Quantity enforced by supplier |

### Observed History Values per SKU:
- **SKU1**: Daily sales follow a weekly repeating pattern: `[1, 2, 3, 4, 5, 6, 7]`. Total sales = 168 units.
- **SKU2**: Daily sales follow `[2, 3, 4, 5, 6, 7, 8]`. Total sales = 210 units.
- **SKU3**: Daily sales follow `[3, 4, 5, 6, 7, 8, 9]`. Total sales = 252 units.
- **SKU4**: Daily sales follow `[4, 5, 6, 7, 8, 9, 10]`. Total sales = 294 units.
- **SKU5**: Daily sales follow `[5, 6, 7, 8, 9, 10, 11]`. Total sales = 336 units.
- For all records in the baseline fixture: `stockout = false`, `available_stock = 50`, `lead_days = 3`, `moq = 5`.

---

## 4. Partitions, Cutoffs & Forecast Windows

| Parameter | Value | Semantics & Purpose |
| :--- | :--- | :--- |
| `train_end` | `2026-09-04` | Last date included in model training and parameter estimation (35 days) |
| `test_start` | `2026-09-05` | Start of the held-out evaluation period (7 days: 2026-09-05 to 2026-09-11) |
| `inventory_as_of` | `2026-09-12` | Effective snapshot date for current stock and forward planning |
| `forecast_horizon` | 7 days | Forward horizon for operational demand forecasting |

---

## 5. Forecasting Methodology & Declared Baseline

### 5.1 Declared Naive Baseline
- **Rule**: *"Use the previous same weekday; score absolute error on the last seven dates only."*
- **Mathematical Definition**:
  $$\hat{y}_{t}^{\text{baseline}} = y_{t - 7}$$
  Where $t \in [\text{2026-09-05}, \text{2026-09-11}]$.
- **Evaluation Metric**: Mean Absolute Error (MAE):
  $$\text{MAE}_{\text{sku}} = \frac{1}{7} \sum_{t=1}^{7} |y_t - \hat{y}_t|$$
  $$\text{MAE}_{\text{aggregate}} = \frac{1}{5} \sum_{s=1}^{5} \text{MAE}_{s}$$

### 5.2 Alternative Forecasting Method
- **Method**: 7-Day Simple Moving Average (SMA-7) & Simple Exponential Smoothing (SES, $\alpha=0.3$).
- **Honest Model Comparison**:
  Because the synthetic teaching fixture possesses a pure 7-day periodicity, the Naive Same-Weekday Baseline achieves an MAE of **0.000**. The moving average predicts the 7-day mean ($\approx 4.0$ for SKU1), resulting in an MAE of **1.714**.
- **System Behavior**: The system explicitly detects when the alternative method underperforms the baseline, flags this transparently, and recommends the superior baseline for operational replenishment.

---

## 6. Stock Position & Replenishment Rules

### 6.1 Replenishment Formula (`records.replenishment_rule`)
$$\text{Target} = \text{daily\_forecast} \times \text{lead\_days}$$
$$\text{Position} = \text{on\_hand} + \text{inbound\_due\_before\_need} - \text{reserved}$$
$$\text{Shortfall}_{\text{raw}} = \max(0, \text{Target} - \text{Position})$$
$$\text{Order Quantity} = \begin{cases} 0 & \text{if } \text{Shortfall}_{\text{raw}} = 0 \\ \left\lceil \frac{\text{Shortfall}_{\text{raw}}}{\text{MOQ}} \right\rceil \times \text{MOQ} & \text{if } \text{Shortfall}_{\text{raw}} > 0 \end{cases}$$

### 6.2 Pack Size Extension
Where `pack_size_units` is specified, the final order quantity is reconciled to satisfy both MOQ and integer pack multiples:
$$\text{Order Quantity} = \max\left(\text{MOQ}, \left\lceil \frac{\max(\text{Shortfall}_{\text{raw}}, \text{MOQ})}{\text{pack\_size}} \right\rceil \times \text{pack\_size}\right)$$

### 6.3 Five Verified Inventory Reference Benchmarks

| SKU | daily_forecast | lead_days | on_hand | inbound_due_before_need | reserved | moq | Target | Position | Raw | expected_order_units |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **SKU1** | 10 | 3 | 10 | 0 | 0 | 5 | 30 | 10 | 20 | **20** |
| **SKU2** | 10 | 3 | 20 | 0 | 0 | 5 | 30 | 20 | 10 | **10** |
| **SKU3** | 10 | 3 | 30 | 0 | 0 | 5 | 30 | 30 | 0 | **0** |
| **SKU4** | 10 | 3 | 40 | 0 | 0 | 5 | 30 | 40 | 0 | **0** |
| **SKU5** | 10 | 3 | 50 | 0 | 0 | 5 | 30 | 50 | 0 | **0** |

---

## 7. Edge Case, Uncertainty & Stockout Policies

1. **Zero Sales**: True zero sales ($0$) are retained as observed points. Missing dates are flagged with an *Uncertainty Warning* and are never imputed silently as zero.
2. **Stockout-Censored Demand**: When `stockout == true`, the recorded sales figure represents capped supply, not uncensored customer demand. Observations are flagged with `stockout_censored = true`.
3. **Lead Time Shock**: User can simulate an increase in `lead_days` (e.g. from 3 to 7 days). Target increases proportionally, recalculating stock coverage and replenishment shortfall.
4. **Late Inbound Delivery**: If an inbound shipment's ETA exceeds the need date (`as_of_date + lead_days`), `inbound_due_before_need` drops to `0`, requiring an immediate replenishment order.
5. **New SKU / Insufficient History**: Any SKU with fewer than 14 historical observations is assigned an *Insufficient History* badge with wide prediction intervals.
