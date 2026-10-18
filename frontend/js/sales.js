import { renderAppShell, showToast } from './shared.js?v=3.0';
import { api } from './api.js';

let allHistory = [];
let salesChartInstance = null;
const TRAIN_END = "2026-09-04";

document.addEventListener("DOMContentLoaded", async () => {
  renderAppShell("sales.html", "Sales History & Import Validation", "Transaction logs and dataset verification.");

  await loadHistory();

  // SKU select listener
  document.getElementById("select-history-sku")?.addEventListener("change", (e) => {
    updateSalesChart(e.target.value);
  });

  // Drag and drop listeners
  setupFileUploader();

  // Download sample sales CSV
  document.getElementById("btn-download-sales-csv")?.addEventListener("click", () => {
    try {
      const url = api.getSampleSalesCsvUrl();
      const a = document.createElement('a');
      a.href = url;
      a.download = "sample_sales_history.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("Sample sales CSV downloaded!", "success");
    } catch (e) {
      showToast("Failed to download sample CSV.", "error");
    }
  });

  // Download sample sales JSON
  document.getElementById("btn-download-sales-json")?.addEventListener("click", () => {
    try {
      const url = api.getSampleSalesJsonUrl();
      const a = document.createElement('a');
      a.href = url;
      a.download = "sample_sales_history.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("Sample sales JSON downloaded!", "success");
    } catch (e) {
      showToast("Failed to download sample JSON.", "error");
    }
  });

  // Load demo sales data
  document.getElementById("btn-load-demo-sales")?.addEventListener("click", async () => {
    try {
      showToast("Loading demo sales records...", "info");
      const res = await api.loadDemoSales();
      showToast(res.message || "Loaded demo sales records!", "success");
      await loadHistory();
    } catch (e) {
      showToast("Failed to load demo sales.", "error");
    }
  });
});

async function loadHistory() {
  try {
    const res = await api.getSalesHistory();
    allHistory = res.records || [];

    const products = await api.getProducts();
    const skuSelect = document.getElementById("select-history-sku");
    if (skuSelect) {
      if (products.length > 0) {
        skuSelect.innerHTML = products.map(p => `<option value="${p.sku}">${p.sku} - ${p.name}</option>`).join("");
        updateSalesChart(products[0].sku);
      } else {
        skuSelect.innerHTML = `<option value="">No products in catalog</option>`;
      }
    }

    renderHistoryTable(allHistory);
  } catch (err) {
    console.error("Failed to load sales history:", err);
    showToast("Failed to fetch historical sales data.", "error");
  }
}

function updateSalesChart(selectedSku) {
  const skuRecords = allHistory
    .filter(r => r.sku === selectedSku)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (skuRecords.length === 0) return;

  const labels = skuRecords.map(r => r.date.substring(5)); // MM-DD
  const sales = skuRecords.map(r => r.sales_units);

  const pointColors = skuRecords.map(r => r.date <= TRAIN_END ? '#2563eb' : '#0d9488');
  const pointRadii = skuRecords.map(r => r.date <= TRAIN_END ? 3 : 5);

  const ctx = document.getElementById("salesHistoryChart")?.getContext("2d");
  if (!ctx) return;

  if (salesChartInstance) {
    salesChartInstance.destroy();
  }

  salesChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: `${selectedSku} Daily Sales Units`,
        data: sales,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.08)',
        pointBackgroundColor: pointColors,
        pointRadius: pointRadii,
        tension: 0.15,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `Date: 2026-${items[0].label}`,
            afterLabel: (ctx) => {
              const rec = skuRecords[ctx.dataIndex];
              const phase = rec.date <= TRAIN_END ? "Training Partition" : "Held-Out Evaluation Partition";
              return `Phase: ${phase}\nStockout: ${rec.stockout ? 'YES (Censored)' : 'No'}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Sales Units' },
          grid: { color: '#f1f5f9' }
        },
        x: {
          ticks: { maxTicksLimit: 14 },
          grid: { display: false }
        }
      }
    }
  });
}

function renderHistoryTable(records) {
  const tbody = document.getElementById("history-tbody");
  if (!tbody) return;

  const headerBadge = document.querySelector(".card-header .badge-info");
  if (headerBadge) {
    headerBadge.innerText = `${records ? records.length : 0} Verified Records`;
  }

  if (!records || records.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 3rem 1rem;">
          <div style="font-size: 1.125rem; font-weight: 600; color: var(--color-primary-900); margin-bottom: 0.35rem;">
            No Sales Transactions Uploaded Yet
          </div>
          <div style="font-size: 0.8125rem; color: var(--text-muted); margin-bottom: 1rem; max-width: 480px; margin-left: auto; margin-right: auto;">
            Upload your historical daily sales file (CSV/JSON) above or click below to load sample demo sales data for instant testing.
          </div>
          <button type="button" id="btn-empty-load-demo" class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; gap: 0.5rem;">
            ⚡ Load Demo Sales Data
          </button>
        </td>
      </tr>
    `;
    document.getElementById("btn-empty-load-demo")?.addEventListener("click", async () => {
      try {
        showToast("Loading demo sales records...", "info");
        const res = await api.loadDemoSales();
        showToast(res.message || "Loaded demo sales records!", "success");
        await loadHistory();
      } catch (e) {
        showToast("Failed to load demo sales.", "error");
      }
    });
    return;
  }

  tbody.innerHTML = records.map(r => {
    const isTrain = r.date <= TRAIN_END;
    const phaseBadge = isTrain
      ? `<span class="badge badge-neutral">Training</span>`
      : `<span class="badge badge-info">Held-Out Test</span>`;

    const stockoutBadge = r.stockout
      ? `<span class="badge badge-danger">Censored Stockout</span>`
      : `<span class="badge badge-success">Uncensored</span>`;

    return `
      <tr>
        <td class="table-cell-bold">${r.date}</td>
        <td><strong>${r.sku}</strong></td>
        <td>${r.sales_units} units</td>
        <td>${stockoutBadge}</td>
        <td>${r.available_stock != null ? r.available_stock : '--'}</td>
        <td>${r.lead_days != null ? r.lead_days + ' days' : '--'}</td>
        <td>${r.moq != null ? r.moq : '--'}</td>
        <td>${phaseBadge}</td>
      </tr>
    `;
  }).join("");
}

function setupFileUploader() {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const validationBox = document.getElementById("validation-box");

  dropZone?.addEventListener("click", () => fileInput.click());

  dropZone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "var(--color-brand-blue)";
    dropZone.style.backgroundColor = "var(--color-brand-blue-subtle)";
  });

  dropZone?.addEventListener("dragleave", () => {
    dropZone.style.borderColor = "var(--border-color)";
    dropZone.style.backgroundColor = "var(--bg-hover)";
  });

  dropZone?.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "var(--border-color)";
    dropZone.style.backgroundColor = "var(--bg-hover)";
    if (e.dataTransfer.files.length > 0) {
      await handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput?.addEventListener("change", async (e) => {
    if (e.target.files.length > 0) {
      await handleFile(e.target.files[0]);
    }
  });

  async function handleFile(file) {
    validationBox.style.display = "block";
    validationBox.innerHTML = `<div>Uploading and validating dataset <strong>${file.name}</strong> line by line...</div>`;
    validationBox.className = "alert attention-card info";
    validationBox.style.background = "";
    validationBox.style.border = "";

    try {
      const summary = await api.uploadSales(file);
      if (summary.is_valid) {
        validationBox.className = "alert attention-card success";
        validationBox.innerHTML = `
          <div>
            <h4 style="color: var(--color-success-text); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
              <span>✅</span> Sales History Imported & Validated Successfully!
            </h4>
            <div style="font-size: 0.8125rem; line-height: 1.6;">
              &bull; <strong>Total Records:</strong> ${summary.imported_count} daily transaction rows saved.<br>
              &bull; <strong>SKUs Identified:</strong> ${(summary.unique_skus || []).join(", ")}<br>
              &bull; <strong>Date Span:</strong> ${summary.date_range?.start || "N/A"} to ${summary.date_range?.end || "N/A"}<br>
              &bull; <strong>Status:</strong> Demand forecasting and replenishment engines are now fully active!
            </div>
            <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <a href="forecasting.html" class="btn btn-primary btn-sm" style="text-decoration: none;">View Demand Forecasts &rarr;</a>
              <a href="replenishment.html" class="btn btn-outline btn-sm" style="text-decoration: none; background: #fff;">Open Replenishment Planner &rarr;</a>
            </div>
          </div>
        `;
        showToast(`Successfully imported ${summary.imported_count} sales records!`, "success");
        await loadHistory();
      } else {
        validationBox.className = "alert attention-card";
        validationBox.style.background = "#fff1f2";
        validationBox.style.border = "1px solid #f43f5e";

        let detailedHtml = "";
        if (summary.detailed_errors && summary.detailed_errors.length > 0) {
          detailedHtml = `
            <ul style="padding-left: 1.25rem; font-size: 0.8125rem; margin-top: 0.5rem; color: #9f1239;">
              ${summary.detailed_errors.map(m => `<li>${m}</li>`).join("")}
            </ul>
          `;
        }

        validationBox.innerHTML = `
          <div>
            <h4 style="color: #be123c; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
              <span>❌</span> Validation Error in Uploaded File
            </h4>
            <div style="color: #9f1239; font-weight: 600; font-size: 0.875rem; line-height: 1.5;">
              ${summary.unsuitable_reason || "Data validation failed."}
            </div>
            ${detailedHtml}
            <div style="margin-top: 0.75rem; font-size: 0.75rem; color: #881337; border-top: 1px solid #fecdd3; padding-top: 0.5rem;">
              💡 <strong>How to fix:</strong> Open your file in Excel or Notepad, check the specific line number above, ensure <code>date</code> (YYYY-MM-DD), <code>sku</code>, and <code>sales_units</code> (0 or higher) are filled without blank cells, and re-upload. You can also download the <strong>Sample Sales CSV</strong> above as a guide.
            </div>
          </div>
        `;
        showToast("Validation issues found on uploaded sales file.", "error");
      }
    } catch (err) {
      validationBox.className = "alert attention-card";
      validationBox.style.background = "#fff1f2";
      validationBox.style.border = "1px solid #f43f5e";
      validationBox.innerHTML = `<div><strong style="color: #be123c;">Upload Error:</strong> <span style="color: #9f1239;">${err.message}</span></div>`;
      showToast(err.message, "error");
    }
  }
}
