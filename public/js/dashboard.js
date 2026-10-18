import { renderAppShell, formatUnits, formatDays, formatINR } from './shared.js?v=3.0';
import { api } from './api.js';

let forecastChartInstance = null;
let stockTargetChartInstance = null;
let allForecasts = null;
let allProposals = null;
let productsMap = {};

document.addEventListener("DOMContentLoaded", async () => {
  renderAppShell("dashboard.html", "Inventory Overview Dashboard", "Know your stock. Plan ahead.");


  try {
    // Fetch products catalog
    const products = await api.getProducts();
    products.forEach(p => { productsMap[p.sku] = p; });

    // Fetch replenishment proposals
    const replenishmentData = await api.getReplenishmentProposals();
    allProposals = (replenishmentData && replenishmentData.proposals) ? replenishmentData.proposals : [];

    // Fetch forward forecast
    allForecasts = await api.getForecastAll();

    // Populate dashboard
    updateMetricCards(allProposals, products);
    renderStockTargetChart(allProposals);
    renderTable(allProposals);

    // Populate SKU selector dynamically
    const skuSelect = document.getElementById("select-chart-sku");
    if (skuSelect) {
      if (products.length > 0) {
        skuSelect.innerHTML = products.map(p => `<option value="${p.sku}">${p.sku} - ${p.name}</option>`).join("");
        updateForecastChart(products[0].sku);
      } else {
        skuSelect.innerHTML = `<option value="">No products in catalog</option>`;
      }
      skuSelect.addEventListener("change", (e) => {
        if (e.target.value) updateForecastChart(e.target.value);
      });
    }

  } catch (err) {
    console.error("Failed to load dashboard data:", err);
    document.getElementById("attention-text").innerText = "Could not connect to backend API. Please ensure the backend is running at http://127.0.0.1:8000.";
  }
});

function updateMetricCards(proposals, products) {
  if (proposals.length === 0) {
    document.getElementById("val-sku-count").innerText = "0";
    document.getElementById("val-total-stock").innerText = "0";
    document.getElementById("val-reorder-count").innerText = "0 SKUs";
    document.getElementById("val-reorder-sub").innerText = "No reorders required";
    document.getElementById("val-avg-coverage").innerText = "0.0 days";
    const attentionText = document.getElementById("attention-text");
    if (attentionText) {
      attentionText.innerHTML = `Welcome to StockSense! Your workspace is fresh and clean. <a href="inventory.html" style="font-weight: 600; text-decoration: underline;">Click here to add your products</a> and start tracking inventory forecasts.`;
    }
    return;
  }

  let totalStock = 0;
  let reorderCount = 0;
  let totalOrderUnits = 0;
  let coverageSum = 0;
  let validCoverageCount = 0;

  proposals.forEach(p => {
    totalStock += p.on_hand;
    if (p.suggested_order_units > 0) {
      reorderCount++;
      totalOrderUnits += p.suggested_order_units;
    }
    if (p.coverage_days_current !== null) {
      coverageSum += p.coverage_days_current;
      validCoverageCount++;
    }
  });

  document.getElementById("val-sku-count").innerText = proposals.length;
  document.getElementById("val-total-stock").innerText = formatUnits(totalStock);
  document.getElementById("val-reorder-count").innerText = `${reorderCount} SKUs`;
  document.getElementById("val-reorder-sub").innerText = `${totalOrderUnits} units suggested reorder`;

  const avgCoverage = validCoverageCount > 0 ? (coverageSum / validCoverageCount).toFixed(1) : "0.0";
  document.getElementById("val-avg-coverage").innerText = `${avgCoverage} days`;

  // Update attention text
  const attentionText = document.getElementById("attention-text");
  if (reorderCount > 0) {
    const reorderSkus = proposals.filter(p => p.suggested_order_units > 0).map(p => p.sku).join(", ");
    attentionText.innerHTML = `<strong>${reorderCount} SKUs (${reorderSkus})</strong> have stock positions below the supplier lead-time target. Immediate replenishment order of <strong>${totalOrderUnits} units</strong> is recommended to prevent stockouts before delivery.`;
  } else {
    attentionText.innerText = "All product stock positions currently meet or exceed required lead-time demand. No immediate reorders needed today.";
    document.querySelector(".attention-card").className = "attention-card success";
  }
}

function updateForecastChart(selectedSku) {
  if (!allForecasts || !allForecasts.results[selectedSku]) return;

  const skuData = allForecasts.results[selectedSku];
  const baselinePoints = skuData.baseline_forecast;
  const altPoints = skuData.alternative_forecast;

  const labels = baselinePoints.map(p => `${p.weekday.substring(0, 3)} (${p.date.substring(5)})`);
  const baselineValues = baselinePoints.map(p => p.predicted_units);
  const altValues = altPoints.map(p => p.predicted_units);
  const upperBounds = baselinePoints.map(p => p.upper_bound);
  const lowerBounds = baselinePoints.map(p => p.lower_bound);

  const ctx = document.getElementById("forecastChart")?.getContext("2d");
  if (!ctx) return;

  if (forecastChartInstance) {
    forecastChartInstance.destroy();
  }

  forecastChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Naive Baseline (Recommended)',
          data: baselineValues,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          borderWidth: 2.5,
          tension: 0.2,
          pointBackgroundColor: '#2563eb',
          pointRadius: 4
        },
        {
          label: '7-Day Moving Avg (Alternative)',
          data: altValues,
          borderColor: '#94a3b8',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 2,
          fill: false
        },
        {
          label: 'Upper Bound (80% CI)',
          data: upperBounds,
          borderColor: 'rgba(37, 99, 235, 0.2)',
          borderWidth: 1,
          pointRadius: 0,
          fill: '+1',
          backgroundColor: 'rgba(37, 99, 235, 0.05)'
        },
        {
          label: 'Lower Bound (80% CI)',
          data: lowerBounds,
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
          labels: { boxWidth: 12, font: { size: 11, family: 'Inter' } }
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
          title: { display: true, text: 'Units / Day', font: { size: 11 } },
          grid: { color: '#f1f5f9' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

function renderStockTargetChart(proposals) {
  const ctx = document.getElementById("stockTargetChart")?.getContext("2d");
  if (!ctx) return;

  if (stockTargetChartInstance) {
    stockTargetChartInstance.destroy();
  }

  const labels = proposals.map(p => p.sku);
  const stockPositions = proposals.map(p => p.stock_position);
  const targetInventories = proposals.map(p => p.target_inventory);

  stockTargetChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Stock Position',
          data: stockPositions,
          backgroundColor: stockPositions.map((pos, i) => pos < targetInventories[i] ? '#ef4444' : '#10b981'),
          borderRadius: 4
        },
        {
          label: 'Lead-Time Target',
          data: targetInventories,
          backgroundColor: '#94a3b8',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 12, font: { size: 11, family: 'Inter' } }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Inventory Units', font: { size: 11 } },
          grid: { color: '#f1f5f9' }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderTable(proposals) {
  const tbody = document.getElementById("dashboard-proposals-tbody");
  if (!tbody) return;

  if (proposals.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 2.5rem 1rem;">No products listed yet. <a href="inventory.html" class="btn btn-primary btn-sm" style="margin-left: 0.5rem;">+ Add Your First Product</a></td></tr>`;
    return;
  }

  tbody.innerHTML = proposals.map(p => {
    const prod = productsMap[p.sku] || { name: p.sku };
    let riskBadgeClass = "badge-neutral";
    if (p.risk_level.includes("Critical")) riskBadgeClass = "badge-danger";
    else if (p.risk_level.includes("Warning")) riskBadgeClass = "badge-warning";
    else if (p.risk_level === "Healthy") riskBadgeClass = "badge-success";

    const coverageText = p.coverage_days_current !== null ? `${p.coverage_days_current} days` : "Infinite";

    return `
      <tr>
        <td class="table-cell-bold">${p.sku}</td>
        <td>${prod.name}</td>
        <td>${p.on_hand}</td>
        <td><strong>${p.stock_position}</strong></td>
        <td>${p.daily_forecast} units/day</td>
        <td>
          <span style="font-weight: 600; color: ${p.coverage_days_current !== null && p.coverage_days_current < p.lead_days ? 'var(--color-danger)' : 'inherit'};">
            ${coverageText}
          </span>
        </td>
        <td>${p.lead_days} days</td>
        <td><span class="badge ${riskBadgeClass}">${p.risk_level}</span></td>
        <td>
          <span style="font-weight: 700; color: ${p.suggested_order_units > 0 ? 'var(--color-brand-blue)' : 'var(--text-muted)'};">
            ${p.suggested_order_units > 0 ? `${p.suggested_order_units} units` : '0 (No Order)'}
          </span>
        </td>
        <td>
          <a href="replenishment.html" class="btn btn-outline btn-sm">Plan Order</a>
        </td>
      </tr>
    `;
  }).join("");
}
