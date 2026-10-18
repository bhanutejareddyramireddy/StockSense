from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# ----------------- Base / SKU Models -----------------
class SalesRecord(BaseModel):
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    sku: str = Field(..., description="SKU identifier, e.g. SKU1")
    sales_units: int = Field(..., ge=0, description="Daily sales units sold")
    stockout: bool = Field(default=False, description="Whether product was out of stock")
    available_stock: Optional[int] = Field(default=50, ge=0, description="Available stock on hand")
    lead_days: Optional[int] = Field(default=3, ge=1, description="Supplier lead time in days")
    moq: Optional[int] = Field(default=5, ge=1, description="Minimum order quantity in units")
    pack_size: Optional[int] = Field(default=1, ge=1, description="Pack size multiple in units")

class InboundDelivery(BaseModel):
    delivery_id: str
    sku: str
    quantity: int = Field(..., ge=0)
    eta: str = Field(..., description="Expected Arrival Date YYYY-MM-DD")
    status: str = Field(default="pending", description="pending, in_transit, delivered")

class SKUDetail(BaseModel):
    sku: str
    name: str
    category: str = "General"
    available_stock: int
    reserved_stock: int = 0
    inbound_stock: int = 0
    inbound_eta: Optional[str] = None
    lead_days: int
    moq: int
    pack_size: int = 1
    unit_cost_inr: float = 100.0
    selling_price_inr: float = 150.0
    is_perishable: bool = False
    expiry_date: Optional[str] = None
    batch_number: Optional[str] = None
    days_to_expiry: Optional[int] = None
    expiry_status: Optional[str] = None
    expiry_action_recommendation: Optional[str] = None
    daily_demand: Optional[float] = None
    vendor_name: Optional[str] = "Primary Supplier"
    vendor_phone: Optional[str] = "+919876543210"
    vendor_email: Optional[str] = None

# ----------------- Forecast Models -----------------
class ForecastPoint(BaseModel):
    date: str
    weekday: str
    predicted_units: float
    lower_bound: float
    upper_bound: float
    method: str
    is_held_out: bool = False
    actual_units: Optional[int] = None
    absolute_error: Optional[float] = None

class SKUForecastResult(BaseModel):
    sku: str
    baseline_method: str = "previous_same_weekday"
    alternative_method: str = "sma_7"
    recommended_method: str
    seven_day_total_baseline: float
    seven_day_total_alternative: float
    seven_day_total_recommended: float
    daily_average_demand: float
    baseline_forecast: List[ForecastPoint]
    alternative_forecast: List[ForecastPoint]
    assumptions: List[str]
    warnings: List[str]
    uncertainty_level: str  # Low, Moderate, High
    demand_multiplier: float = 1.0
    multiplier_label: Optional[str] = None

class ForecastRunResponse(BaseModel):
    run_id: str
    timestamp: str
    train_end: Optional[str] = None
    test_start: Optional[str] = None
    forecast_horizon_days: int = 7
    results: Dict[str, SKUForecastResult]
    summary: Dict[str, Any]
    sales_history_required: bool = False
    demand_multiplier: float = 1.0

# ----------------- Evaluation Models -----------------
class SKUEvaluation(BaseModel):
    sku: str
    baseline_mae: float
    alternative_mae: float
    difference_mae: float  # alternative - baseline (positive means baseline was better!)
    baseline_wins: bool
    evaluation_days_count: int
    daily_residuals: List[Dict[str, Any]]
    verdict: str

class EvaluationSummaryResponse(BaseModel):
    evaluation_period: Dict[str, str]
    sku_evaluations: Dict[str, SKUEvaluation]
    aggregate_baseline_mae: float
    aggregate_alternative_mae: float
    best_model_aggregate: str
    key_finding: str
    honesty_declaration: str

# ----------------- Replenishment Models -----------------
class ReplenishmentProposal(BaseModel):
    sku: str
    daily_forecast: float
    lead_days: int
    target_inventory: float  # daily_forecast * lead_days
    on_hand: int
    inbound_due_before_need: int
    reserved: int
    stock_position: float  # on_hand + inbound_due_before_need - reserved
    raw_shortfall: float  # max(0, target - position)
    moq: int
    pack_size: int = 1
    suggested_order_units: int  # rounded up to MOQ/pack multiple
    coverage_days_current: Optional[float]
    coverage_days_projected: Optional[float]
    projected_stockout_date: Optional[str]
    expected_arrival_date: str
    risk_level: str  # Critical, Warning, Healthy, Overstocked
    explanation: str
    warnings: List[str]
    expiry_date: Optional[str] = None
    days_to_expiry: Optional[int] = None
    expiry_status: Optional[str] = None
    expiry_action_recommendation: Optional[str] = None
    vendor_name: Optional[str] = "Primary Supplier"
    vendor_phone: Optional[str] = "+919876543210"
    vendor_email: Optional[str] = None
    cost_inr: Optional[float] = 0.0

class ReplenishmentResponse(BaseModel):
    as_of_date: str
    proposals: List[ReplenishmentProposal]
    reference_checks_passed: bool
    total_suggested_order_units: int
    skus_requiring_order: int
    sales_history_required: bool = False
    demand_multiplier: float = 1.0

# ----------------- Scenario Simulator Models -----------------
class ScenarioChangeRequest(BaseModel):
    sku: str
    scenario_type: str  # 'zero_stock', 'lead_time_shock', 'delayed_inbound', 'demand_shock', 'missing_dates', 'custom'
    lead_days_override: Optional[int] = None
    available_stock_override: Optional[int] = None
    reserved_override: Optional[int] = None
    inbound_override: Optional[int] = None
    inbound_delayed_days: Optional[int] = None
    demand_multiplier: Optional[float] = None
    moq_override: Optional[int] = None
    pack_size_override: Optional[int] = None

class ScenarioComparisonResponse(BaseModel):
    sku: str
    scenario_name: str
    original: ReplenishmentProposal
    revised: ReplenishmentProposal
    changes_applied: Dict[str, Any]
    delta_order_units: int
    why_it_changed: str
    new_risks_and_uncertainty: List[str]

# ----------------- Business Plan Models -----------------
class PricingPlan(BaseModel):
    price_per_location_monthly_inr: float = 3499.0
    active_locations: int = 5
    hosting_cost_per_location_inr: float = 300.0
    support_cost_per_location_inr: float = 400.0
    onboarding_amortized_inr: float = 250.0

class OutreachRecord(BaseModel):
    id: str
    organization: str
    contact_person: str
    channel: str  # LinkedIn, In-Person Retail Visit, Cold Call, Referral
    contact_date: str
    observed_problem: str
    reaction: str  # Constructive Decline, Interested In Pilot, Price Sensitive, No Reply
    outcome_notes: str
    follow_up_action: str

# ----------------- Data Import / Validation -----------------
class ImportValidationSummary(BaseModel):
    is_valid: bool
    total_records: int
    unique_skus: List[str]
    date_range: Dict[str, str]
    duplicate_dates: List[str]
    missing_dates: List[str]
    invalid_numbers: List[str]
    stockout_count: int
    validation_messages: List[str]

class ProductImportSummary(BaseModel):
    is_valid: bool
    imported_count: int = 0
    total_processed: int = 0
    skus_imported: List[str] = []
    perishable_count: int = 0
    expiring_soon_count: int = 0
    expired_count: int = 0
    validation_messages: List[str] = []
    unsuitable_reason: Optional[str] = None
    detailed_errors: List[str] = []
    analysis: Optional[Dict[str, Any]] = None
    sales_history_required: bool = True

class SalesImportSummary(BaseModel):
    is_valid: bool
    imported_count: int = 0
    total_processed: int = 0
    unique_skus: List[str] = []
    date_range: Dict[str, str] = {}
    validation_messages: List[str] = []
    unsuitable_reason: Optional[str] = None
    detailed_errors: List[str] = []


