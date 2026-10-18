// StockSense Frontend API Client

// Determine base API endpoint: uses current origin if served over HTTP/HTTPS, else default to 127.0.0.1:8000
const API_BASE = (typeof window !== 'undefined' && window.location.protocol && window.location.protocol.startsWith("http"))
  ? `${window.location.origin}/api`
  : "http://127.0.0.1:8000/api";

class ApiClient {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const defaultHeaders = {
      'Accept': 'application/json'
    };

    if (!(options.body instanceof FormData)) {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    try {
      let storedUser = null;
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('stocksense_current_user');
        if (stored) storedUser = JSON.parse(stored);
      }
      if (storedUser) {
        const isDemo = (storedUser.isDemo === true || storedUser.email === "admin@stocksense.ai" || storedUser.email === "planner@stocksense.in");
        defaultHeaders['X-User-ID'] = storedUser.uid || storedUser.email || "demo";
        defaultHeaders['X-Is-Demo'] = isDemo ? "true" : "false";
      } else {
        defaultHeaders['X-User-ID'] = "demo";
        defaultHeaders['X-Is-Demo'] = "true";
      }
    } catch (e) {
      defaultHeaders['X-User-ID'] = "demo";
      defaultHeaders['X-Is-Demo'] = "true";
    }

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        let errMessage = `HTTP Error ${response.status}`;
        try {
          const errData = await response.json();
          errMessage = errData.detail || errData.message || errMessage;
        } catch (e) {
          errMessage = await response.text() || errMessage;
        }
        throw new Error(errMessage);
      }
      return await response.json();
    } catch (error) {
      console.error(`API Request Failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Health
  getHealth() {
    return this.request("/health");
  }

  // Dataset & Inventory
  getDatasetSummary() {
    return this.request("/dataset/summary");
  }

  getProducts() {
    return this.request("/dataset/products");
  }

  upsertProduct(productData) {
    return this.request("/dataset/products", {
      method: "POST",
      body: JSON.stringify(productData)
    });
  }

  deleteProduct(sku) {
    return this.request(`/dataset/products/${encodeURIComponent(sku)}`, {
      method: "DELETE"
    });
  }

  getSalesHistory(sku = null, startDate = null, endDate = null) {
    const params = new URLSearchParams();
    if (sku) params.append("sku", sku);
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/dataset/history${qs}`);
  }

  uploadProducts(file) {
    const formData = new FormData();
    formData.append("file", file);
    return this.request("/dataset/upload-products", {
      method: "POST",
      body: formData
    });
  }

  uploadSales(file) {
    const formData = new FormData();
    formData.append("file", file);
    return this.request("/dataset/upload-sales", {
      method: "POST",
      body: formData
    });
  }

  loadDemoSales() {
    return this.request("/dataset/load-demo-sales", {
      method: "POST"
    });
  }

  getSampleTemplate() {
    return this.request("/dataset/sample-template");
  }

  getSampleProductsExcelUrl() {
    return `${API_BASE}/dataset/templates/products-excel`;
  }

  getSampleProductsCsvUrl() {
    return `${API_BASE}/dataset/templates/products-csv`;
  }

  getSampleProductsJsonUrl() {
    return `${API_BASE}/dataset/templates/products-json`;
  }

  getSampleSalesCsvUrl() {
    return `${API_BASE}/dataset/templates/sales-csv`;
  }

  getSampleSalesJsonUrl() {
    return `${API_BASE}/dataset/templates/sales-json`;
  }

  validateImport(file) {
    const formData = new FormData();
    formData.append("file", file);
    return this.request("/dataset/validate-import", {
      method: "POST",
      body: formData
    });
  }

  getDatasetAnalysis(asOfDate = null) {
    const qs = asOfDate ? `?as_of_date=${asOfDate}` : "";
    return this.request(`/dataset/analysis${qs}`);
  }

  updateProductVendor(sku, vendorData) {
    return this.request(`/dataset/products/${sku}/vendor`, {
      method: "PUT",
      body: JSON.stringify(vendorData)
    });
  }

  getSampleTemplateCsvUrl() {
    return `${API_BASE}/dataset/sample-template-csv`;
  }

  // Demand Forecasting
  getForecastAll(asOfDate = null, horizonDays = 7, demandMultiplier = 1.0) {
    const params = new URLSearchParams();
    if (asOfDate) params.append("as_of_date", asOfDate);
    params.append("horizon_days", horizonDays);
    if (demandMultiplier && demandMultiplier !== 1.0) params.append("demand_multiplier", demandMultiplier);
    return this.request(`/forecast/all?${params.toString()}`);
  }

  getSkuForecast(sku, asOfDate = null, horizonDays = 7, demandMultiplier = 1.0) {
    const params = new URLSearchParams();
    if (asOfDate) params.append("as_of_date", asOfDate);
    params.append("horizon_days", horizonDays);
    if (demandMultiplier && demandMultiplier !== 1.0) params.append("demand_multiplier", demandMultiplier);
    return this.request(`/forecast/sku/${encodeURIComponent(sku)}?${params.toString()}`);
  }

  // Evaluation & MAE
  getEvaluationSummary() {
    return this.request("/evaluation/summary");
  }

  // Replenishment Engine
  getReplenishmentProposals(asOfDate = null, demandMultiplier = 1.0) {
    const params = new URLSearchParams();
    if (asOfDate) params.append("as_of_date", asOfDate);
    if (demandMultiplier && demandMultiplier !== 1.0) params.append("demand_multiplier", demandMultiplier);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/replenishment/proposals${qs}`);
  }

  verifyBenchmarks() {
    return this.request("/replenishment/verify-benchmarks");
  }

  // Scenarios
  simulateScenario(payload) {
    return this.request("/scenarios/simulate", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  saveScenario(payload) {
    return this.request("/scenarios/save", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  listSavedScenarios() {
    return this.request("/scenarios/saved");
  }

  // Reports
  saveRun(payload = {}) {
    return this.request("/reports/save-run", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  listRuns() {
    return this.request("/reports/runs");
  }

  getRun(runId) {
    return this.request(`/reports/run/${runId}`);
  }

  getExportUrl(type = "replenishment") {
    return `${API_BASE}/reports/export/csv?type=${type}`;
  }

  // MBA Business Plan
  getBusinessOverview() {
    return this.request("/business/overview");
  }

  updatePricing(payload) {
    return this.request("/business/pricing", {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  }

  listOutreach() {
    return this.request("/business/outreach");
  }

  addOutreach(payload) {
    return this.request("/business/outreach", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
}

export const api = new ApiClient();
