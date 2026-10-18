import { renderAppShell, showToast } from './shared.js?v=3.0';
import { api } from './api.js';

let chartInstance = null;
let currentMultiplier = 1.0;

document.addEventListener("DOMContentLoaded", async () => {
  renderAppShell("forecasting.html", "Seven-Day Demand Forecasting", "Reproducible demand forecasts & uncertainty intervals.");

  const skuSelect = document.getElementById("forecast-sku-select");

  // Demand surge multiplier buttons
  document.querySelectorAll(".btn-multiplier").forEach(btn => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".btn-multiplier").forEach(b => {
        b.classList.remove("active", "btn-primary");
        b.classList.add("btn-outline");
      });
      btn.classList.add("active", "btn-primary");
      btn.classList.remove("btn-outline");
      currentMultiplier = parseFloat(btn.dataset.multiplier || "1.0");
      const sku = skuSelect?.value;
      if (sku) {
        await loadForecast(sku);
        const label = btn.innerText.trim();
        showToast(`Forecast adjusted for ${label}`, "info");
      }
    });
  });

  // Load demo sales action in banner
  document.getElementById("btn-load-demo-sales-forecast")?.addEventListener("click", async () => {
    try {
      showToast("Loading sample sales data...", "info");
      const res = await api.loadDemoSales();
      showToast(res.message || "Sample sales loaded!", "success");
      const sku = skuSelect?.value;
      if (sku) await loadForecast(sku);
    } catch (e) {
      showToast("Failed to load demo sales.", "error");
    }
  });

  try {
    const products = await api.getProducts();
    if (!products || products.length === 0) {
      if (skuSelect) skuSelect.innerHTML = `<option value="">No products in catalog</option>`;
      const tbody = document.getElementById("forecast-breakdown-tbody");
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2.5rem;">No products in catalog yet. <a href="inventory.html" class="btn btn-primary btn-sm">+ Add Your First Product</a></td></tr>`;
      return;
    }

    if (skuSelect) {
      skuSelect.innerHTML = products.map(p => `<option value="${p.sku}">${p.sku} - ${p.name}</option>`).join("");
      await loadForecast(products[0].sku);
      skuSelect.addEventListener("change", (e) => {
        if (e.target.value) loadForecast(e.target.value);
      });
    }

    document.getElementById("btn-reforecast")?.addEventListener("click", () => {
      if (skuSelect && skuSelect.value) {
        loadForecast(skuSelect.value);
        showToast("Forecast refreshed with latest inventory history.", "info");
      }
    });
  } catch (e) {
    console.error("Forecasting init error:", e);
  }
});

async function loadForecast(sku) {
  const banner = document.getElementById("sales-required-banner");
  try {
    const data = await api.getSkuForecast(sku, null, 7, currentMultiplier);
    if (banner) banner.style.display = "none";
    updateMetrics(data);
    renderChart(data);
    renderTable(data);
  } catch (err) {
    console.error("Failed to load forecast for", sku, err);
    if (err.message && err.message.toLowerCase().includes("sales history is required")) {
      if (banner) banner.style.display = "block";
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
      const tbody = document.getElementById("forecast-breakdown-tbody");
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">Upload sales history transactions to view daily projections.</td></tr>`;
      }
      document.getElementById("val-total-demand").innerText = "Pending Sales";
      document.getElementById("val-daily-avg").innerText = "Upload sales history";
      document.getElementById("val-base-vs-alt").innerText = "-- vs --";
    } else {
      showToast(`Failed to load forecast for ${sku}`, "error");
    }
  }
}

function updateMetrics(data) {
  const recEl = document.getElementById("val-rec-model");
  if (recEl) recEl.innerText = data.recommended_method;
  document.getElementById("val-total-demand").innerText = `${data.seven_day_total_recommended} units`;
  document.getElementById("val-daily-avg").innerText = `Avg: ${data.daily_average_demand} units/day`;
  document.getElementById("val-base-vs-alt").innerText = `${data.seven_day_total_baseline} vs ${data.seven_day_total_alternative} units`;

  const badgeUncertainty = document.getElementById("badge-uncertainty");
  badgeUncertainty.innerText = `${data.uncertainty_level} Uncertainty`;
  badgeUncertainty.className = data.uncertainty_level === "High" ? "badge badge-danger" : "badge badge-info";
}

function renderChart(data) {
  const ctx = document.getElementById("forecastDetailChart")?.getContext("2d");
  if (!ctx) return;

  if (chartInstance) {
    chartInstance.destroy();
  }

  const basePoints = data.baseline_forecast;
  const altPoints = data.alternative_forecast;

  const labels = basePoints.map(p => `${p.weekday} (${p.date.substring(5)})`);
  const baseUnits = basePoints.map(p => p.predicted_units);
  const altUnits = altPoints.map(p => p.predicted_units);
  const upper = basePoints.map(p => p.upper_bound);
  const lower = basePoints.map(p => p.lower_bound);

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Naive Baseline (Recommended)',
          data: baseUnits,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          borderWidth: 3,
          tension: 0.2,
          pointBackgroundColor: '#2563eb',
          pointRadius: 5
        },
        {
          label: '7-Day Simple Moving Avg (Alternative)',
          data: altUnits,
          borderColor: '#94a3b8',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 3,
          fill: false
        },
        {
          label: '80% Upper Bound',
          data: upper,
          borderColor: 'rgba(37, 99, 235, 0.2)',
          borderWidth: 1,
          pointRadius: 0,
          fill: '+1',
          backgroundColor: 'rgba(37, 99, 235, 0.05)'
        },
        {
          label: '80% Lower Bound',
          data: lower,
          borderColor: 'rgba(37, 99, 235, 0.2)',
          borderWidth: 1,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 12, font: { size: 12, family: 'Inter' } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw} units`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Forecast Demand (Units/Day)' },
          grid: { color: '#f1f5f9' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

function renderTable(data) {
  const tbody = document.getElementById("forecast-breakdown-tbody");
  if (!tbody) return;

  const basePoints = data.baseline_forecast;
  const altPoints = data.alternative_forecast;

  tbody.innerHTML = basePoints.map((bp, i) => {
    const ap = altPoints[i] || { predicted_units: 0 };
    return `
      <tr>
        <td class="table-cell-bold">${bp.date}</td>
        <td><strong>${bp.weekday}</strong></td>
        <td><span style="font-weight: 700; color: var(--color-brand-blue);">${bp.predicted_units} units</span></td>
        <td>${ap.predicted_units} units</td>
        <td>${bp.lower_bound} &ndash; ${bp.upper_bound} units</td>
        <td><span class="badge badge-success">High Confidence</span></td>
      </tr>
    `;
  }).join("");
}
