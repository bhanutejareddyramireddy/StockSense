import { renderAppShell, formatUnits, formatINR, showToast } from './shared.js?v=3.0';
import { api } from './api.js';

let productsList = [];
let proposalsMap = {};
let selectedUploadFile = null;
let datasetAnalysis = null;

function getMinExpiryDateString() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yyyy = tomorrow.getFullYear();
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const dd = String(tomorrow.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

document.addEventListener("DOMContentLoaded", async () => {
  renderAppShell("inventory.html", "Products & Inventory", "Real-time stock positions, food/perishable shelf life, and supplier parameters.");

  // Add Product Button
  document.getElementById("btn-add-product")?.addEventListener("click", () => {
    openCreateModal();
  });

  // Modal listeners for Add/Edit
  document.getElementById("modal-close")?.addEventListener("click", closeModal);
  document.getElementById("btn-cancel-modal")?.addEventListener("click", closeModal);
  document.getElementById("product-form")?.addEventListener("submit", handleFormSubmit);

  // Search and filter listeners
  document.getElementById("search-input")?.addEventListener("input", filterAndRender);
  document.getElementById("filter-risk")?.addEventListener("change", filterAndRender);
  document.getElementById("filter-expiry")?.addEventListener("change", filterAndRender);

  // Dataset Intelligence Analysis Modal wiring
  document.getElementById("btn-view-dataset-analysis")?.addEventListener("click", openAnalysisModal);
  document.getElementById("analysis-modal-close")?.addEventListener("click", closeAnalysisModal);
  document.getElementById("btn-close-analysis-modal")?.addEventListener("click", closeAnalysisModal);

  // Perishable checkbox toggle
  document.getElementById("prod-perishable")?.addEventListener("change", (e) => {
    const fieldsGroup = document.getElementById("perishable-fields-group");
    if (fieldsGroup) {
      fieldsGroup.style.display = e.target.checked ? "grid" : "none";
      if (e.target.checked) {
        const expiryInput = document.getElementById("prod-expiry");
        if (expiryInput) {
          expiryInput.min = getMinExpiryDateString();
        }
        setTimeout(() => {
          fieldsGroup.scrollIntoView({ behavior: "smooth", block: "nearest" });
          expiryInput?.focus();
        }, 80);
      }
    }
  });

  // Export CSV
  document.getElementById("btn-export-csv")?.addEventListener("click", () => {
    window.location.href = api.getExportUrl("replenishment");
  });

  // Upload Products Modal Wiring
  initUploadModal();

  // Load data asynchronously without blocking UI listeners
  await loadData();
});

function initUploadModal() {
  const uploadModal = document.getElementById("upload-products-modal");
  const btnOpenUpload = document.getElementById("btn-upload-products");
  const btnCloseUpload = document.getElementById("upload-modal-close");
  const btnCancelUpload = document.getElementById("btn-cancel-upload");
  const dropzone = document.getElementById("product-dropzone");
  const fileInput = document.getElementById("product-file-input");
  const btnBrowse = document.getElementById("btn-browse-file");
  const fileInfo = document.getElementById("selected-file-info");
  const btnSubmit = document.getElementById("btn-submit-upload");
  const btnDownloadSampleExcel = document.getElementById("btn-download-sample-excel");
  const btnDownloadSample = document.getElementById("btn-download-sample-json");
  const btnDownloadSampleCsv = document.getElementById("btn-download-sample-csv");
  const feedbackContainer = document.getElementById("upload-feedback-container");

  const openUploadModal = () => {
    selectedUploadFile = null;
    if (fileInput) fileInput.value = "";
    if (fileInfo) {
      fileInfo.style.display = "none";
      fileInfo.innerText = "";
    }
    if (feedbackContainer) feedbackContainer.innerHTML = "";
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerText = "Import & Analyze Products";
    }
    uploadModal?.classList.add("open");
  };

  const closeUploadModal = () => {
    uploadModal?.classList.remove("open");
  };

  btnOpenUpload?.addEventListener("click", openUploadModal);
  btnCloseUpload?.addEventListener("click", closeUploadModal);
  btnCancelUpload?.addEventListener("click", closeUploadModal);

  btnBrowse?.addEventListener("click", () => fileInput?.click());
  dropzone?.addEventListener("click", (e) => {
    if (e.target !== btnBrowse && !btnBrowse.contains(e.target)) {
      fileInput?.click();
    }
  });

  // Drag and drop events
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone?.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add("dragover");
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone?.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove("dragover");
    }, false);
  });

  dropzone?.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
    }
  });

  fileInput?.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });

  function handleFileSelected(file) {
    selectedUploadFile = file;
    if (fileInfo) {
      const sizeKb = (file.size / 1024).toFixed(1);
      fileInfo.style.display = "block";
      fileInfo.innerHTML = `📄 <strong>${file.name}</strong> (${sizeKb} KB)`;
    }
    if (feedbackContainer) feedbackContainer.innerHTML = "";
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerText = `Import "${file.name}"`;
    }
  }

  // Sample downloads (Excel, JSON, CSV)
  btnDownloadSampleExcel?.addEventListener("click", () => {
    try {
      const a = document.createElement("a");
      a.href = "templates/sample_products_inventory.xlsx";
      a.download = "sample_products_inventory.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("Sample product Excel (.xlsx) template downloaded!", "success");
    } catch (err) {
      showToast("Failed to download Excel template.", "error");
    }
  });

  btnDownloadSample?.addEventListener("click", () => {
    try {
      const a = document.createElement("a");
      a.href = "templates/sample_products_inventory.json";
      a.download = "sample_products_inventory.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("Sample product JSON (.json) template downloaded!", "success");
    } catch (err) {
      showToast("Failed to download JSON template.", "error");
    }
  });

  btnDownloadSampleCsv?.addEventListener("click", () => {
    try {
      const a = document.createElement("a");
      a.href = "templates/sample_products_inventory.csv";
      a.download = "sample_products_inventory.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("Sample product CSV (.csv) template downloaded!", "success");
    } catch (err) {
      showToast("Failed to download CSV template.", "error");
    }
  });

  // Upload Submission
  btnSubmit?.addEventListener("click", async () => {
    if (!selectedUploadFile) return;

    btnSubmit.disabled = true;
    btnSubmit.innerText = "Analyzing file & validating suitability...";
    if (feedbackContainer) {
      feedbackContainer.innerHTML = `
        <div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.875rem;">
          Parsing file, verifying mandatory columns, and checking line-by-line data integrity...
        </div>
      `;
    }

    try {
      const result = await api.uploadProducts(selectedUploadFile);

      if (!result.is_valid) {
        // Line-specific validation error
        btnSubmit.disabled = false;
        btnSubmit.innerText = "Try Another File";

        let errorsHtml = "";
        if (result.detailed_errors && result.detailed_errors.length > 0) {
          errorsHtml = `
            <ul style="margin: 0.5rem 0 0 1.25rem; padding: 0; font-size: 0.8125rem; color: #9f1239;">
              ${result.detailed_errors.map(err => `<li>${err}</li>`).join("")}
            </ul>
          `;
        }

        if (feedbackContainer) {
          feedbackContainer.innerHTML = `
            <div class="unsuitable-alert-box" style="border: 1px solid #f43f5e; background: #fff1f2; padding: 1rem; border-radius: var(--radius-sm); margin-top: 1rem;">
              <div class="unsuitable-alert-title" style="display: flex; align-items: center; gap: 0.5rem; color: #be123c; font-weight: 700; margin-bottom: 0.5rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                <span>Upload Validation Error</span>
              </div>
              <div style="margin: 0; line-height: 1.5; color: #9f1239; font-weight: 600; font-size: 0.875rem;">
                ${result.unsuitable_reason || "The uploaded file does not meet the necessary inventory column structure."}
              </div>
              ${errorsHtml}
              <div style="margin-top: 0.75rem; font-size: 0.75rem; color: #881337; border-top: 1px solid #fecdd3; padding-top: 0.5rem;">
                💡 <strong>How to fix:</strong> Open your file, check the specified row/line number, ensure all mandatory fields (<code>sku</code>, <code>name</code>, <code>available_stock</code>, <code>lead_days</code>, <code>moq</code>, <code>unit_cost_inr</code>) are non-empty, and try re-uploading. You can download the <strong>Sample Products CSV</strong> above to verify formatting.
              </div>
            </div>
          `;
        }
        showToast("Uploaded data has validation errors. Please check the line details.", "error");
      } else if (result.sales_history_required) {
        // Products imported, but sales history required for forecasting & replenishment
        btnSubmit.disabled = false;
        btnSubmit.innerText = "✓ Products Catalog Saved";
        showToast(`Imported ${result.imported_count} products into inventory!`, "success");

        if (feedbackContainer) {
          feedbackContainer.innerHTML = `
            <div style="margin-top: 1rem; border-radius: var(--radius-sm); border: 1px solid #3b82f6; background: #f0f7ff; padding: 1.25rem;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; border-bottom: 1px solid #bfdbfe; padding-bottom: 0.5rem;">
                <div style="font-weight: 700; font-size: 1rem; color: #1d4ed8; display: flex; align-items: center; gap: 0.5rem;">
                  <span>✅ Product Catalog Imported (${result.imported_count} Products)</span>
                </div>
                <span class="badge badge-info">${result.imported_count} SKUs In Catalog</span>
              </div>
              <p style="font-size: 0.8125rem; color: #1e3a8a; line-height: 1.5; margin-bottom: 1rem;">
                Your product catalog is now safely listed in inventory. To calculate demand forecasts, stockout projections, and order replenishment, please upload your sales history file or load demo sales data.
              </p>
              <div style="display: flex; gap: 0.75rem; justify-content: flex-end; flex-wrap: wrap;">
                <button type="button" id="btn-quick-load-demo-sales" class="btn btn-outline btn-sm" style="background: #fff; font-weight: 600;">
                  ⚡ Load Demo Sales Data
                </button>
                <a href="sales.html" class="btn btn-primary btn-sm" style="text-decoration: none;">
                  📈 Upload Sales History &rarr;
                </a>
                <button type="button" id="btn-modal-done-upload" class="btn btn-outline btn-sm">
                  View Inventory &rarr;
                </button>
              </div>
            </div>
          `;

          document.getElementById("btn-modal-done-upload")?.addEventListener("click", () => {
            closeUploadModal();
          });
          document.getElementById("btn-quick-load-demo-sales")?.addEventListener("click", async () => {
            try {
              showToast("Loading sample sales data...", "info");
              await api.loadDemoSales();
              showToast("Sample sales data loaded! Demand forecasting and replenishment are now active.", "success");
              closeUploadModal();
              await loadData();
            } catch (e) {
              showToast("Failed to load demo sales.", "error");
            }
          });
        }
        await loadData();
      } else {
        // Success with Instant Dataset Analysis & AI Recommendations
        const analysis = result.analysis || {};
        const exec = analysis.executive_summary || {};
        const reorderSum = analysis.reorder_action_summary || {};
        const perishSum = analysis.perishable_summary || {};
        const recs = analysis.actionable_recommendations || [];

        datasetAnalysis = analysis;
        btnSubmit.disabled = false;
        btnSubmit.innerText = "✓ Upload & Analysis Complete";
        showToast(`Imported ${result.imported_count} products and completed dataset analysis!`, "success");

        if (feedbackContainer) {
          feedbackContainer.innerHTML = `
            <div style="margin-top: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); padding: 1.25rem;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
                <div style="font-weight: 700; font-size: 1rem; color: var(--color-success-text); display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-size: 1.25rem;">✅</span>
                  <span>Dataset Successfully Ingested &amp; Analyzed</span>
                </div>
                <span class="badge badge-success">${result.imported_count} Products Parsed</span>
              </div>

              <!-- Quick KPI Badges Grid -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem; margin-bottom: 1rem;">
                <div style="background: var(--bg-app); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                  <div style="font-size: 0.6875rem; color: var(--text-muted); font-weight: 600;">INVENTORY VALUE</div>
                  <div style="font-size: 1.0625rem; font-weight: 700; color: var(--color-brand-blue);">${formatINR(exec.total_cost_value_inr || 0)}</div>
                  <div style="font-size: 0.6875rem; color: var(--text-secondary);">${exec.potential_margin_pct || 0}% Gross Margin</div>
                </div>
                <div style="background: var(--bg-app); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                  <div style="font-size: 0.6875rem; color: var(--text-muted); font-weight: 600;">REORDERS NEEDED</div>
                  <div style="font-size: 1.0625rem; font-weight: 700; color: #b45309;">${reorderSum.skus_needing_reorder || 0} SKUs</div>
                  <div style="font-size: 0.6875rem; color: var(--text-secondary);">${reorderSum.total_suggested_order_units || 0} units suggested</div>
                </div>
                <div style="background: var(--bg-app); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                  <div style="font-size: 0.6875rem; color: var(--text-muted); font-weight: 600;">PERISHABLE RISK</div>
                  <div style="font-size: 1.0625rem; font-weight: 700; color: ${perishSum.spoilage_risk_count ? 'var(--color-danger)' : 'var(--color-success)'};">${perishSum.spoilage_risk_count || 0} Items</div>
                  <div style="font-size: 0.6875rem; color: var(--text-secondary);">${perishSum.spoilage_units_at_risk || 0} units at risk</div>
                </div>
                <div style="background: var(--bg-app); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                  <div style="font-size: 0.6875rem; color: var(--text-muted); font-weight: 600;">AVG COVERAGE</div>
                  <div style="font-size: 1.0625rem; font-weight: 700; color: var(--text-primary);">${exec.average_coverage_days || 0} Days</div>
                  <div style="font-size: 0.6875rem; color: var(--text-secondary);">Avg Lead: ${exec.average_lead_days || 3}d</div>
                </div>
              </div>

              <!-- Top AI Suggestions Preview -->
              <div style="margin-bottom: 1.25rem;">
                <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.5rem;">
                  🤖 AI Action Recommendations
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                  ${recs.slice(0, 3).map(r => `
                    <div style="padding: 0.625rem 0.75rem; border-radius: var(--radius-sm); background: var(--bg-app); border-left: 3px solid ${r.priority === 'CRITICAL' ? 'var(--color-danger)' : r.priority === 'HIGH' ? '#d97706' : 'var(--color-brand-blue)'}; font-size: 0.8125rem;">
                      <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.125rem;">${r.icon || '📌'} ${r.title}</div>
                      <div style="color: var(--text-secondary); line-height: 1.35;">${r.action}</div>
                    </div>
                  `).join("")}
                </div>
              </div>

              <!-- Action Buttons -->
              <div style="display: flex; gap: 0.75rem; justify-content: flex-end; flex-wrap: wrap;">
                <button type="button" id="btn-modal-open-full-analysis" class="btn btn-primary" style="background: linear-gradient(135deg, #1e40af, #2563eb); border: none;">
                  📊 View Full Intelligence Report
                </button>
                <button type="button" id="btn-modal-done-upload" class="btn btn-outline">
                  Go to Products Inventory &rarr;
                </button>
              </div>
            </div>
          `;

          document.getElementById("btn-modal-done-upload")?.addEventListener("click", () => {
            closeUploadModal();
          });
          document.getElementById("btn-modal-open-full-analysis")?.addEventListener("click", () => {
            closeUploadModal();
            openAnalysisModal();
          });
        }

        // Reload data
        await loadData();
      }
    } catch (err) {
      btnSubmit.disabled = false;
      btnSubmit.innerText = "Upload & Import Catalog";
      if (feedbackContainer) {
        feedbackContainer.innerHTML = `
          <div class="unsuitable-alert-box">
            <div class="unsuitable-alert-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
              <span>Upload Error</span>
            </div>
            <p style="margin: 0;">${err.message || "Failed to upload and parse file. Please check file formatting."}</p>
          </div>
        `;
      }
      showToast(err.message || "Upload failed.", "error");
    }
  });
}

async function loadData() {
  try {
    const [products, replenishment, analysis] = await Promise.all([
      api.getProducts(),
      api.getReplenishmentProposals(),
      api.getDatasetAnalysis().catch(e => { console.warn("Analysis error:", e); return null; })
    ]);
    productsList = products || [];
    proposalsMap = {};
    if (replenishment && replenishment.proposals) {
      replenishment.proposals.forEach(p => { proposalsMap[p.sku] = p; });
    }
    datasetAnalysis = analysis;
    renderDatasetKPICards(analysis);
    renderExpiryAlertBanner();
    filterAndRender();
  } catch (err) {
    console.error("Failed to load inventory:", err);
    showToast("Failed to load inventory catalogue.", "error");
  }
}

function renderDatasetKPICards(analysis) {
  if (!analysis || !analysis.has_data) {
    const kpiCost = document.getElementById("kpi-val-cost");
    if (kpiCost) kpiCost.innerText = "₹0.00";
    const kpiRetail = document.getElementById("kpi-val-retail-sub");
    if (kpiRetail) kpiRetail.innerText = "Retail: ₹0.00 (0% Margin)";
    const kpiReorders = document.getElementById("kpi-val-reorders");
    if (kpiReorders) kpiReorders.innerText = "0 SKUs";
    const kpiReordersSub = document.getElementById("kpi-val-reorders-sub");
    if (kpiReordersSub) kpiReordersSub.innerText = "0 units suggested order";
    const kpiStockouts = document.getElementById("kpi-val-stockouts");
    if (kpiStockouts) kpiStockouts.innerText = "0 SKUs";
    const kpiStockoutsSub = document.getElementById("kpi-val-stockouts-sub");
    if (kpiStockoutsSub) kpiStockoutsSub.innerText = "Immediate supply attention";
    const kpiPerish = document.getElementById("kpi-val-perishables");
    if (kpiPerish) kpiPerish.innerText = "0 Alerts";
    const kpiPerishSub = document.getElementById("kpi-val-perishables-sub");
    if (kpiPerishSub) kpiPerishSub.innerText = "0 units at spoilage risk";
    const badge = document.getElementById("badge-suggestions-count");
    if (badge) badge.innerText = "0";
    return;
  }

  const exec = analysis.executive_summary || {};
  const reorders = analysis.reorder_action_summary || {};
  const perish = analysis.perishable_summary || {};
  const recs = analysis.actionable_recommendations || [];

  const kpiCost = document.getElementById("kpi-val-cost");
  if (kpiCost) kpiCost.innerText = formatINR(exec.total_cost_value_inr || 0);

  const kpiRetail = document.getElementById("kpi-val-retail-sub");
  if (kpiRetail) kpiRetail.innerText = `Retail: ${formatINR(exec.total_retail_value_inr || 0)} (${exec.potential_margin_pct || 0}% Margin)`;

  const reorderCount = reorders.skus_needing_reorder || 0;
  const kpiReorders = document.getElementById("kpi-val-reorders");
  if (kpiReorders) kpiReorders.innerText = `${reorderCount} SKUs`;

  const kpiReordersSub = document.getElementById("kpi-val-reorders-sub");
  if (kpiReordersSub) kpiReordersSub.innerText = `${reorders.total_suggested_order_units || 0} units suggested (${formatINR(reorders.total_reorder_cost_inr || 0)})`;

  const stockoutCount = (reorders.critical_stockouts?.length || 0) + (reorders.impending_stockouts?.length || 0);
  const kpiStockouts = document.getElementById("kpi-val-stockouts");
  if (kpiStockouts) kpiStockouts.innerText = `${stockoutCount} SKUs`;

  const kpiStockoutsSub = document.getElementById("kpi-val-stockouts-sub");
  if (kpiStockoutsSub) {
    kpiStockoutsSub.innerText = stockoutCount > 0
      ? `${reorders.critical_stockouts?.length || 0} active stockout, ${reorders.impending_stockouts?.length || 0} lead-time shortfall`
      : "Stock levels meeting lead time";
  }

  const perishAlerts = (perish.spoilage_risk_count || 0) + (perish.expired_count || 0) + (perish.expiring_soon_count || 0) + (perish.reorder_batch_count || 0);
  const kpiPerish = document.getElementById("kpi-val-perishables");
  if (kpiPerish) kpiPerish.innerText = `${perishAlerts} Alerts`;

  const kpiPerishSub = document.getElementById("kpi-val-perishables-sub");
  if (kpiPerishSub) kpiPerishSub.innerText = `${perish.spoilage_units_at_risk || 0} units at spoilage risk (${formatINR(perish.spoilage_value_at_risk_inr || 0)})`;

  const badge = document.getElementById("badge-suggestions-count");
  if (badge) {
    badge.innerText = recs.length;
    badge.style.display = recs.length > 0 ? "inline-block" : "none";
  }
}

function openAnalysisModal() {
  const modal = document.getElementById("dataset-analysis-modal");
  if (!modal) return;
  if (!datasetAnalysis) {
    showToast("Generating comprehensive dataset intelligence...", "info");
    api.getDatasetAnalysis().then(analysis => {
      datasetAnalysis = analysis;
      renderAnalysisModalContent(analysis);
      modal.classList.add("open");
    }).catch(e => {
      showToast("Failed to fetch dataset intelligence.", "error");
    });
  } else {
    renderAnalysisModalContent(datasetAnalysis);
    modal.classList.add("open");
  }
}

function closeAnalysisModal() {
  document.getElementById("dataset-analysis-modal")?.classList.remove("open");
}

function renderAnalysisModalContent(analysis) {
  if (!analysis || !analysis.has_data) {
    document.getElementById("analysis-modal-subtitle").innerText = "No dataset currently available for analysis.";
    return;
  }

  const exec = analysis.executive_summary || {};
  const reorders = analysis.reorder_action_summary || {};
  const overstock = analysis.overstock_summary || {};
  const perish = analysis.perishable_summary || {};
  const abc = analysis.abc_classification || {};
  const recs = analysis.actionable_recommendations || [];

  document.getElementById("analysis-modal-subtitle").innerText = `Diagnosis as of ${analysis.as_of_date || 'Today'} for ${exec.total_skus || 0} products (${exec.total_units_on_hand || 0} units on hand).`;

  // Render KPI Grid
  const kpiGrid = document.getElementById("analysis-kpi-grid");
  if (kpiGrid) {
    kpiGrid.innerHTML = `
      <div class="card metric-card" style="border-left: 4px solid var(--color-brand-blue); padding: 0.875rem 1rem;">
        <div class="metric-label">Total Inventory Valuation</div>
        <div class="metric-value" style="font-size: 1.25rem;">${formatINR(exec.total_cost_value_inr || 0)}</div>
        <div class="metric-subtext">Retail: ${formatINR(exec.total_retail_value_inr || 0)} (${exec.potential_margin_pct || 0}% Margin)</div>
      </div>
      <div class="card metric-card" style="border-left: 4px solid #b45309; padding: 0.875rem 1rem;">
        <div class="metric-label">Immediate Reorders Needed</div>
        <div class="metric-value" style="font-size: 1.25rem; color: #b45309;">${reorders.skus_needing_reorder || 0} SKUs</div>
        <div class="metric-subtext">${reorders.total_suggested_order_units || 0} units (${formatINR(reorders.total_reorder_cost_inr || 0)})</div>
      </div>
      <div class="card metric-card" style="border-left: 4px solid var(--color-danger); padding: 0.875rem 1rem;">
        <div class="metric-label">Stockout / Impending Shortfalls</div>
        <div class="metric-value" style="font-size: 1.25rem; color: var(--color-danger);">${(reorders.critical_stockouts?.length || 0) + (reorders.impending_stockouts?.length || 0)} SKUs</div>
        <div class="metric-subtext">${reorders.critical_stockouts?.length || 0} zero-stock, ${reorders.impending_stockouts?.length || 0} below lead-time</div>
      </div>
      <div class="card metric-card" style="border-left: 4px solid #059669; padding: 0.875rem 1rem;">
        <div class="metric-label">Perishable / Spoilage Exposure</div>
        <div class="metric-value" style="font-size: 1.25rem; color: #047857;">${perish.spoilage_risk_count || 0} SKUs</div>
        <div class="metric-subtext">${perish.spoilage_units_at_risk || 0} units (${formatINR(perish.spoilage_value_at_risk_inr || 0)}) at risk</div>
      </div>
      <div class="card metric-card" style="border-left: 4px solid #6366f1; padding: 0.875rem 1rem;">
        <div class="metric-label">Average Stock Coverage</div>
        <div class="metric-value" style="font-size: 1.25rem;">${exec.average_coverage_days || 0} Days</div>
        <div class="metric-subtext">${overstock.overstocked_skus_count || 0} overstocked items (${formatINR(overstock.capital_tied_up_inr || 0)} tied up)</div>
      </div>
    `;
  }

  // Render AI Recommendations
  const recsList = document.getElementById("analysis-recommendations-list");
  if (recsList) {
    if (recs.length === 0) {
      recsList.innerHTML = `<div style="padding: 1rem; color: var(--text-muted); font-size: 0.875rem;">All inventory positions are healthy and balanced. No emergency actions needed today.</div>`;
    } else {
      recsList.innerHTML = recs.map((r, idx) => {
        let borderColor = 'var(--color-brand-blue)';
        let badgeClass = 'badge-primary';
        if (r.priority === 'CRITICAL') { borderColor = 'var(--color-danger)'; badgeClass = 'badge-danger'; }
        else if (r.priority === 'HIGH') { borderColor = '#d97706'; badgeClass = 'badge-warning'; }
        else if (r.priority === 'MEDIUM') { borderColor = '#2563eb'; badgeClass = 'badge-primary'; }
        else { borderColor = '#64748b'; badgeClass = 'badge-neutral'; }

        return `
          <div style="background: var(--bg-card); border-radius: var(--radius-sm); border: 1px solid var(--border-color); border-left: 4px solid ${borderColor}; padding: 0.875rem 1rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.375rem; flex-wrap: wrap; gap: 0.5rem;">
              <div style="font-weight: 700; font-size: 0.9375rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                <span>${r.icon || '📌'}</span>
                <span>${idx + 1}. ${r.title}</span>
              </div>
              <span class="badge ${badgeClass}" style="font-size: 0.6875rem;">${r.priority}</span>
            </div>
            <div style="font-size: 0.8125rem; color: var(--text-primary); font-weight: 600; margin-bottom: 0.25rem; line-height: 1.4;">${r.action}</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">${r.details}</div>
          </div>
        `;
      }).join("");
    }
  }

  // Render Reorders Table
  const reorderBadge = document.getElementById("analysis-reorder-badge");
  if (reorderBadge) {
    reorderBadge.innerText = `${reorders.skus_needing_reorder || 0} SKUs Need Ordering`;
    reorderBadge.className = (reorders.skus_needing_reorder || 0) > 0 ? "badge badge-warning" : "badge badge-success";
  }

  const reordersTbody = document.getElementById("analysis-reorders-tbody");
  if (reordersTbody) {
    const items = reorders.reorder_items || [];
    if (items.length === 0) {
      reordersTbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 1.5rem; color: var(--color-success-text);">✓ All SKUs currently have sufficient stock to cover supplier lead-time demand. No immediate reorders required.</td></tr>`;
    } else {
      reordersTbody.innerHTML = items.map(r => `
        <tr>
          <td class="table-cell-bold">${r.sku}</td>
          <td><strong>${r.name}</strong></td>
          <td>${r.current_stock} units</td>
          <td>${r.daily_forecast} u/d</td>
          <td>${r.lead_days} days</td>
          <td><strong style="color: var(--color-brand-blue);">${r.suggested_order_units} units</strong> <span style="font-size: 0.6875rem; color: var(--text-muted);">(MOQ ${r.moq})</span></td>
          <td><strong>${formatINR(r.reorder_cost_inr)}</strong></td>
          <td><span class="badge ${r.urgency === 'High' ? 'badge-danger' : 'badge-neutral'}">${r.expected_arrival_date || 'N/A'}</span></td>
        </tr>
      `).join("");
    }
  }

  // Render Perishables Table
  const perishBadge = document.getElementById("analysis-perishable-badge");
  if (perishBadge) {
    perishBadge.innerText = `${perish.perishable_skus_count || 0} Perishable SKUs`;
  }

  const perishTbody = document.getElementById("analysis-perishables-tbody");
  if (perishTbody) {
    const pItems = perish.perishable_items || [];
    if (pItems.length === 0) {
      perishTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 1.5rem;">No perishable products in current inventory.</td></tr>`;
    } else {
      perishTbody.innerHTML = pItems.map(p => {
        let statusBadge = `<span class="badge badge-neutral">${p.expiry_status}</span>`;
        if (p.expiry_status === "EXPIRED") statusBadge = `<span class="badge badge-danger">❌ Expired</span>`;
        else if (p.expiry_status === "CRITICAL_SPOILAGE") statusBadge = `<span class="badge badge-danger">⚡ Spoilage Risk</span>`;
        else if (p.expiry_status === "EXPIRING_SOON") statusBadge = `<span class="badge badge-warning">⏳ Expiring Soon</span>`;
        else if (p.expiry_status === "REORDER_BATCH") statusBadge = `<span class="badge badge-primary">🔄 Reorder Batch</span>`;
        else if (p.expiry_status === "HEALTHY") statusBadge = `<span class="badge badge-success">✓ Healthy</span>`;

        return `
          <tr>
            <td class="table-cell-bold">${p.sku}</td>
            <td><strong>${p.name}</strong></td>
            <td>${p.available_stock} units</td>
            <td>${p.expiry_date || 'N/A'}</td>
            <td><strong>${p.days_to_expiry !== null ? `${p.days_to_expiry}d` : 'N/A'}</strong></td>
            <td>${statusBadge}</td>
            <td style="font-size: 0.75rem; color: var(--text-secondary); max-width: 280px;">${p.recommendation || 'Normal monitoring'}</td>
          </tr>
        `;
      }).join("");
    }
  }
}

function renderExpiryAlertBanner() {
  const container = document.getElementById("expiry-alert-container");
  if (!container) return;

  const perishables = productsList.filter(p => p.is_perishable || p.expiry_date);
  if (perishables.length === 0) {
    container.innerHTML = "";
    return;
  }

  const expiredItems = perishables.filter(p => p.expiry_status === "EXPIRED");
  const spoilageItems = perishables.filter(p => p.expiry_status === "CRITICAL_SPOILAGE");
  const expiringSoonItems = perishables.filter(p => p.expiry_status === "EXPIRING_SOON");
  const reorderBatchItems = perishables.filter(p => p.expiry_status === "REORDER_BATCH");

  const totalAlerts = expiredItems.length + spoilageItems.length + expiringSoonItems.length + reorderBatchItems.length;

  if (totalAlerts === 0) {
    container.innerHTML = `
      <div style="background-color: var(--color-success-subtle); border: 1px solid var(--color-success-border); border-left: 4px solid var(--color-success); border-radius: var(--radius-sm); padding: 0.75rem 1rem; margin-bottom: 1.25rem; font-size: 0.8125rem; color: var(--color-success-text); display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span>🥗</span>
          <span><strong>Perishable Inventory Monitored:</strong> All ${perishables.length} perishable products have healthy shelf-life and adequate turnover.</span>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="expiry-alert-banner">
      <div style="display: flex; align-items: flex-start; gap: 0.75rem; max-width: 800px;">
        <div style="font-size: 1.5rem; line-height: 1;">⚡</div>
        <div>
          <div style="font-weight: 700; color: #92400e; font-size: 0.9375rem; margin-bottom: 0.25rem;">
            Shelf-Life &amp; Expiry Action Required: ${totalAlerts} Perishable Item${totalAlerts > 1 ? 's' : ''} Need Attention
          </div>
          <div style="font-size: 0.8125rem; color: #78350f; line-height: 1.4;">
            ${spoilageItems.length > 0 ? `<strong>${spoilageItems.length} at critical spoilage risk</strong> (sell or discount immediately before expiry). ` : ''}
            ${expiredItems.length > 0 ? `<strong>${expiredItems.length} expired</strong> (discard immediately). ` : ''}
            ${reorderBatchItems.length > 0 ? `<strong>${reorderBatchItems.length} batch restock needed</strong> before current lot expires. ` : ''}
            ${expiringSoonItems.length > 0 ? `<strong>${expiringSoonItems.length} expiring within 14 days</strong>.` : ''}
          </div>
        </div>
      </div>
      <div>
        <button id="btn-quick-filter-perishables" class="btn btn-sm btn-primary" style="background-color: #d97706; border-color: #b45309; font-size: 0.75rem;">
          View Perishable Alerts
        </button>
      </div>
    </div>
  `;

  document.getElementById("btn-quick-filter-perishables")?.addEventListener("click", () => {
    const filterSelect = document.getElementById("filter-expiry");
    if (filterSelect) {
      filterSelect.value = "EXPIRING_SOON";
      filterAndRender();
    }
  });
}

function filterAndRender() {
  const query = document.getElementById("search-input")?.value.toLowerCase().trim() || "";
  const riskFilter = document.getElementById("filter-risk")?.value || "ALL";
  const expiryFilter = document.getElementById("filter-expiry")?.value || "ALL";

  const filtered = productsList.filter(prod => {
    const prop = proposalsMap[prod.sku] || {};
    const matchesSearch = prod.sku.toLowerCase().includes(query) ||
                          prod.name.toLowerCase().includes(query) ||
                          (prod.category && prod.category.toLowerCase().includes(query)) ||
                          (prod.batch_number && prod.batch_number.toLowerCase().includes(query));

    const matchesRisk = (riskFilter === "ALL") ||
      (riskFilter === "Overstocked"
        ? (Boolean(prop.coverage_days_current && prop.coverage_days_current > 45) || prop.reason_code === "EXCESS")
        : (prop.risk_level && prop.risk_level.includes(riskFilter)));

    let matchesExpiry = true;
    if (expiryFilter === "PERISHABLE") {
      matchesExpiry = !!(prod.is_perishable || prod.expiry_date);
    } else if (expiryFilter === "SPOILAGE_RISK") {
      matchesExpiry = prod.expiry_status === "CRITICAL_SPOILAGE";
    } else if (expiryFilter === "EXPIRING_SOON") {
      matchesExpiry = prod.expiry_status === "EXPIRING_SOON" || prod.expiry_status === "CRITICAL_SPOILAGE" || prod.expiry_status === "REORDER_BATCH";
    } else if (expiryFilter === "REORDER_BATCH") {
      matchesExpiry = prod.expiry_status === "REORDER_BATCH";
    } else if (expiryFilter === "EXPIRED") {
      matchesExpiry = prod.expiry_status === "EXPIRED";
    }

    return matchesSearch && matchesRisk && matchesExpiry;
  });

  renderTable(filtered);
}

function renderTable(products) {
  const tbody = document.getElementById("inventory-tbody");
  if (!tbody) return;

  if (productsList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="14" style="text-align: center; padding: 3rem 1.5rem;">
          <div style="max-width: 460px; margin: 0 auto;">
            <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">📦</div>
            <h3 style="font-size: 1.125rem; font-weight: 700; margin-bottom: 0.5rem;">Your Product Catalog is Empty</h3>
            <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
              Upload your inventory via Excel or JSON to immediately analyze stock levels, lead times, and food expiry dates, or add products manually.
            </p>
            <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
              <button id="btn-empty-upload-prod" class="btn btn-outline" style="border-color: var(--color-brand-blue); color: var(--color-brand-blue);">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                <span>Upload Excel / JSON</span>
              </button>
              <button id="btn-empty-add-prod" class="btn btn-primary">
                <span>+ Add Product Manually</span>
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
    document.getElementById("btn-empty-add-prod")?.addEventListener("click", openCreateModal);
    document.getElementById("btn-empty-upload-prod")?.addEventListener("click", () => {
      document.getElementById("btn-upload-products")?.click();
    });
    return;
  }

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="14" style="text-align: center; padding: 2rem;">No products match your search or filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => {
    const prop = proposalsMap[p.sku] || {};
    let riskBadge = `<span class="badge badge-neutral">Unknown</span>`;
    if (prop.risk_level) {
      if (prop.risk_level.includes("Critical")) riskBadge = `<span class="badge badge-danger">${prop.risk_level}</span>`;
      else if (prop.risk_level.includes("Warning") || prop.risk_level.includes("Perishable")) riskBadge = `<span class="badge badge-warning">${prop.risk_level}</span>`;
      else if (prop.risk_level === "Healthy") riskBadge = `<span class="badge badge-success">${prop.risk_level}</span>`;
      else riskBadge = `<span class="badge badge-neutral">${prop.risk_level}</span>`;
    }

    const coverageStr = prop.coverage_days_current !== null && prop.coverage_days_current !== undefined
      ? `${prop.coverage_days_current} d`
      : "N/A";

    // Expiry Cell Formatting
    let expiryHtml = `<span class="badge badge-neutral" style="font-size: 0.6875rem;">Non-Perishable</span>`;
    if (p.is_perishable || p.expiry_date) {
      let badge = "";
      let isUrgent = false;

      if (p.expiry_status === "EXPIRED") {
        badge = `<span class="badge badge-danger">❌ Expired (${Math.abs(p.days_to_expiry)}d ago)</span>`;
        isUrgent = true;
      } else if (p.expiry_status === "CRITICAL_SPOILAGE") {
        badge = `<span class="badge badge-danger" style="font-weight: 700;">⚡ Spoilage Risk (${p.days_to_expiry}d left)</span>`;
        isUrgent = true;
      } else if (p.expiry_status === "REORDER_BATCH") {
        badge = `<span class="badge badge-primary">🔄 Reorder Batch (${p.days_to_expiry}d left)</span>`;
      } else if (p.expiry_status === "EXPIRING_SOON") {
        badge = `<span class="badge badge-warning">⏳ Expiring (${p.days_to_expiry}d left)</span>`;
      } else {
        badge = `<span class="badge badge-success">✓ Healthy (${p.days_to_expiry}d left)</span>`;
      }

      const recText = p.expiry_action_recommendation
        ? `<div class="expiry-rec-text" style="color: ${isUrgent ? '#b91c1c' : 'var(--text-secondary)'}; font-weight: ${isUrgent ? '600' : '400'}; margin-top: 0.125rem;">${p.expiry_action_recommendation}</div>`
        : "";

      const batchTag = p.batch_number
        ? `<span style="font-size: 0.6875rem; color: var(--text-muted); font-family: var(--font-mono);">${p.batch_number}</span>`
        : "";

      expiryHtml = `
        <div class="expiry-cell">
          <div style="display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap;">
            ${badge}
            ${batchTag}
          </div>
          ${recText}
        </div>
      `;
    }

    // AI Suggestion Formatting
    let suggestionHtml = `<span class="badge badge-success" style="font-size: 0.6875rem;">✓ Stock Balanced</span>`;
    if (p.expiry_status === "EXPIRED") {
      suggestionHtml = `<span class="badge badge-danger" style="font-size: 0.6875rem;">🗑 Discard Expired</span>`;
    } else if (p.expiry_status === "CRITICAL_SPOILAGE") {
      suggestionHtml = `<div style="line-height: 1.25;"><span class="badge badge-danger" style="font-size: 0.6875rem; font-weight: 700;">⚡ Markdown 40%</span><div style="font-size: 0.6875rem; color: #b91c1c; margin-top: 2px;">Prevent Spoilage</div></div>`;
    } else if (p.expiry_status === "REORDER_BATCH" || (prop.suggested_order_units > 0 && prop.reason_code === "PERISHABLE_SPOILAGE")) {
      suggestionHtml = `<div style="line-height: 1.25;"><span class="badge badge-primary" style="font-size: 0.6875rem;">🔄 Restock Fresh</span><div style="font-size: 0.6875rem; color: var(--color-brand-blue); margin-top: 2px;">Order +${prop.suggested_order_units || p.moq}</div></div>`;
    } else if (prop.suggested_order_units > 0) {
      const isCrit = (prop.risk_level && prop.risk_level.includes("Critical")) || p.available_stock === 0;
      suggestionHtml = `
        <div style="line-height: 1.25;">
          <span class="badge ${isCrit ? 'badge-danger' : 'badge-warning'}" style="font-size: 0.6875rem; font-weight: 600;">
            ${isCrit ? '🚨 Reorder' : '📦 Order'} +${prop.suggested_order_units}
          </span>
          <div style="font-size: 0.6875rem; color: var(--text-secondary); margin-top: 2px;">
            ${formatINR(prop.cost_inr || 0)}
          </div>
        </div>
      `;
    } else if (Boolean(prop.coverage_days_current && prop.coverage_days_current > 60) || prop.reason_code === "EXCESS" || (p.available_stock > 50 && prop.coverage_days_current > 45)) {
      suggestionHtml = `
        <div style="line-height: 1.25;">
          <span class="badge badge-neutral" style="font-size: 0.6875rem; color: #475569; background: rgba(100, 116, 139, 0.12); font-weight: 600;">
            📉 Overstock (${Math.round(prop.coverage_days_current || 0)}d)
          </span>
          <div style="font-size: 0.6875rem; color: var(--text-muted); margin-top: 2px;">Pause Reorder</div>
        </div>
      `;
    }

    return `
      <tr>
        <td class="table-cell-bold">${p.sku}</td>
        <td>
          <strong>${p.name}</strong>
          ${p.batch_number ? `<div style="font-size: 0.6875rem; color: var(--text-muted);">Lot: ${p.batch_number}</div>` : ''}
        </td>
        <td><span class="badge badge-neutral">${p.category || 'General'}</span></td>
        <td><strong>${p.available_stock}</strong></td>
        <td>${p.reserved_stock}</td>
        <td>${p.inbound_stock}</td>
        <td>${p.lead_days} d</td>
        <td>${p.moq} / ${p.pack_size}</td>
        <td>${formatINR(p.selling_price_inr)}</td>
        <td><strong>${coverageStr}</strong></td>
        <td>${expiryHtml}</td>
        <td>${riskBadge}</td>
        <td>${suggestionHtml}</td>
        <td>
          <div style="display: flex; gap: 0.375rem;">
            <button class="btn btn-outline btn-sm btn-edit-prod" data-sku="${p.sku}">Edit</button>
            <button class="btn btn-outline btn-sm btn-delete-prod" data-sku="${p.sku}" style="color: var(--color-danger); border-color: rgba(239, 68, 68, 0.3);">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  document.querySelectorAll(".btn-edit-prod").forEach(btn => {
    btn.addEventListener("click", () => {
      openEditModal(btn.getAttribute("data-sku"));
    });
  });

  document.querySelectorAll(".btn-delete-prod").forEach(btn => {
    btn.addEventListener("click", async () => {
      const sku = btn.getAttribute("data-sku");
      if (confirm(`Are you sure you want to delete ${sku} from your inventory?`)) {
        try {
          await api.deleteProduct(sku);
          showToast(`Product ${sku} deleted successfully!`, "info");
          await loadData();
        } catch (err) {
          showToast(err.message || "Failed to delete product.", "error");
        }
      }
    });
  });
}

function openCreateModal() {
  document.getElementById("modal-product-title").innerText = "Add New Product";
  const skuInput = document.getElementById("prod-sku");
  skuInput.value = "";
  skuInput.readOnly = false;
  skuInput.style.background = "";
  skuInput.focus();

  document.getElementById("prod-cat").value = "General";
  document.getElementById("prod-name").value = "";
  document.getElementById("prod-avail").value = 50;
  document.getElementById("prod-reserved").value = 0;
  document.getElementById("prod-inbound").value = 0;
  document.getElementById("prod-lead").value = 3;
  document.getElementById("prod-moq").value = 5;
  document.getElementById("prod-pack").value = 1;
  document.getElementById("prod-cost").value = 100.0;
  document.getElementById("prod-price").value = 150.0;

  // Perishable fields
  const minDateStr = getMinExpiryDateString();
  const perishCheckbox = document.getElementById("prod-perishable");
  const perishGroup = document.getElementById("perishable-fields-group");
  if (perishCheckbox) perishCheckbox.checked = false;
  if (perishGroup) perishGroup.style.display = "none";
  const expiryInput = document.getElementById("prod-expiry");
  if (expiryInput) {
    expiryInput.min = minDateStr;
    expiryInput.value = "";
  }
  document.getElementById("prod-batch").value = "";

  // Vendor / Supplier fields
  const vendorNameEl = document.getElementById("prod-vendor-name");
  const vendorPhoneEl = document.getElementById("prod-vendor-phone");
  const vendorEmailEl = document.getElementById("prod-vendor-email");
  if (vendorNameEl) vendorNameEl.value = "Primary Supplier";
  if (vendorPhoneEl) vendorPhoneEl.value = "+919876543210";
  if (vendorEmailEl) vendorEmailEl.value = "";

  document.getElementById("btn-modal-submit").innerText = "Create Product";
  const modal = document.getElementById("product-modal");
  modal?.classList.add("open");
  modal?.querySelector(".modal-body")?.scrollTo({ top: 0, behavior: "instant" });
}

function openEditModal(sku) {
  const prod = productsList.find(p => p.sku === sku);
  if (!prod) return;

  document.getElementById("modal-product-title").innerText = `Edit ${prod.sku} (${prod.name})`;
  const skuInput = document.getElementById("prod-sku");
  skuInput.value = prod.sku;
  skuInput.readOnly = true;
  skuInput.style.background = "var(--bg-subtle)";

  document.getElementById("prod-cat").value = prod.category || "General";
  document.getElementById("prod-name").value = prod.name;
  document.getElementById("prod-avail").value = prod.available_stock;
  document.getElementById("prod-reserved").value = prod.reserved_stock;
  document.getElementById("prod-inbound").value = prod.inbound_stock;
  document.getElementById("prod-lead").value = prod.lead_days;
  document.getElementById("prod-moq").value = prod.moq;
  document.getElementById("prod-pack").value = prod.pack_size;
  document.getElementById("prod-cost").value = prod.unit_cost_inr;
  document.getElementById("prod-price").value = prod.selling_price_inr;

  // Perishable fields
  const minDateStr = getMinExpiryDateString();
  const isPerish = !!(prod.is_perishable || prod.expiry_date);
  const perishCheckbox = document.getElementById("prod-perishable");
  const perishGroup = document.getElementById("perishable-fields-group");
  if (perishCheckbox) perishCheckbox.checked = isPerish;
  if (perishGroup) perishGroup.style.display = isPerish ? "grid" : "none";

  const expiryInput = document.getElementById("prod-expiry");
  if (expiryInput) {
    expiryInput.min = minDateStr;
    expiryInput.value = prod.expiry_date || "";
  }
  document.getElementById("prod-batch").value = prod.batch_number || "";

  // Vendor / Supplier fields
  const vendorNameEl = document.getElementById("prod-vendor-name");
  const vendorPhoneEl = document.getElementById("prod-vendor-phone");
  const vendorEmailEl = document.getElementById("prod-vendor-email");
  if (vendorNameEl) vendorNameEl.value = prod.vendor_name || "Primary Supplier";
  if (vendorPhoneEl) vendorPhoneEl.value = prod.vendor_phone || "+919876543210";
  if (vendorEmailEl) vendorEmailEl.value = prod.vendor_email || "";

  document.getElementById("btn-modal-submit").innerText = "Save Changes";
  const modal = document.getElementById("product-modal");
  modal?.classList.add("open");
  modal?.querySelector(".modal-body")?.scrollTo({ top: 0, behavior: "instant" });
}

function closeModal() {
  document.getElementById("product-modal")?.classList.remove("open");
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const sku = document.getElementById("prod-sku").value.trim().toUpperCase();
  if (!sku) {
    showToast("Please provide a valid SKU identifier.", "error");
    return;
  }

  const existing = productsList.find(p => p.sku.toUpperCase() === sku) || {};
  const isPerish = document.getElementById("prod-perishable")?.checked || false;
  const expiryDate = isPerish ? (document.getElementById("prod-expiry").value.trim() || null) : null;
  const batchNumber = isPerish ? (document.getElementById("prod-batch").value.trim() || null) : null;

  if (isPerish) {
    if (!expiryDate) {
      showToast("Please provide an expiration date for this perishable product.", "error");
      document.getElementById("prod-expiry")?.focus();
      return;
    }
    const minDateStr = getMinExpiryDateString();
    if (expiryDate < minDateStr) {
      showToast(`Expiration date must be tomorrow (${minDateStr}) or later. An expiration date cannot be in the past or today.`, "error");
      document.getElementById("prod-expiry")?.focus();
      return;
    }
  }

  const updatedProd = {
    sku: sku,
    name: document.getElementById("prod-name").value.trim(),
    category: document.getElementById("prod-cat").value.trim() || "General",
    available_stock: parseInt(document.getElementById("prod-avail").value, 10) || 0,
    reserved_stock: parseInt(document.getElementById("prod-reserved").value, 10) || 0,
    inbound_stock: parseInt(document.getElementById("prod-inbound").value, 10) || 0,
    inbound_eta: existing.inbound_eta || null,
    lead_days: parseInt(document.getElementById("prod-lead").value, 10) || 1,
    moq: parseInt(document.getElementById("prod-moq").value, 10) || 1,
    pack_size: parseInt(document.getElementById("prod-pack").value, 10) || 1,
    unit_cost_inr: parseFloat(document.getElementById("prod-cost").value) || 0,
    selling_price_inr: parseFloat(document.getElementById("prod-price").value) || 0,
    is_perishable: isPerish,
    expiry_date: expiryDate,
    batch_number: batchNumber,
    vendor_name: document.getElementById("prod-vendor-name")?.value.trim() || "Primary Supplier",
    vendor_phone: document.getElementById("prod-vendor-phone")?.value.trim() || "+919876543210",
    vendor_email: document.getElementById("prod-vendor-email")?.value.trim() || null
  };

  try {
    await api.upsertProduct(updatedProd);
    closeModal();
    showToast(`Product ${sku} saved successfully!`, "success");
    await loadData();
  } catch (err) {
    showToast(err.message || "Failed to save product.", "error");
  }
}
