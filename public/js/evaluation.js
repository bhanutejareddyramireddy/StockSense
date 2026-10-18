import { renderAppShell, showToast } from './shared.js?v=3.0';
import { api } from './api.js';

let evalData = null;
let residualsChartInstance = null;

document.addEventListener("DOMContentLoaded", async () => {
  renderAppShell("evaluation.html", "Forecast Evaluation & MAE", "Assessment of baseline vs alternative on held-out test data.");

  await loadEvaluationData();

  document.getElementById("select-eval-sku")?.addEventListener("change", (e) => {
    renderSkuResiduals(e.target.value);
  });
});

async function loadEvaluationData() {
  try {
    evalData = await api.getEvaluationSummary();
    updateMetrics(evalData);
    renderScorecard(evalData.sku_evaluations);
    renderSkuResiduals("SKU1");
  } catch (err) {
    console.error("Failed to load evaluation summary:", err);
    showToast("Failed to load evaluation data.", "error");
  }
}

function updateMetrics(data) {
  document.getElementById("val-agg-base-mae").innerText = data.aggregate_baseline_mae.toFixed(3);
  document.getElementById("val-agg-alt-mae").innerText = data.aggregate_alternative_mae.toFixed(3);
  document.getElementById("eval-honesty-text").innerHTML = `
    <strong>${data.key_finding}</strong><br>
    <span style="font-size: 11px; color: var(--color-success-text);">${data.honesty_declaration}</span>
  `;
}

function renderScorecard(evals) {
  const tbody = document.getElementById("eval-scorecard-tbody");
  if (!tbody) return;

  tbody.innerHTML = Object.values(evals).map(ev => {
    const winnerBadge = ev.baseline_wins
      ? `<span class="badge badge-success">Baseline</span>`
      : `<span class="badge badge-info">Alternative</span>`;

    return `
      <tr>
        <td class="table-cell-bold">${ev.sku}</td>
        <td><strong style="color: var(--color-success); font-size: 13px;">${ev.baseline_mae.toFixed(3)}</strong></td>
        <td>${ev.alternative_mae.toFixed(3)}</td>
        <td>+${ev.difference_mae.toFixed(3)} error in Alt</td>
        <td>${winnerBadge}</td>
        <td style="font-size: 11px; color: var(--text-secondary);">${ev.verdict}</td>
      </tr>
    `;
  }).join("");
}

function renderSkuResiduals(sku) {
  if (!evalData || !evalData.sku_evaluations[sku]) return;

  const skuEval = evalData.sku_evaluations[sku];
  const residuals = skuEval.daily_residuals;

  // Render chart
  const ctx = document.getElementById("residualsChart")?.getContext("2d");
  if (ctx) {
    if (residualsChartInstance) {
      residualsChartInstance.destroy();
    }

    const labels = residuals.map(r => `${r.weekday.substring(0, 3)} (${r.date.substring(5)})`);
    const baseErrors = residuals.map(r => r.baseline_abs_error);
    const altErrors = residuals.map(r => r.alternative_abs_error);

    residualsChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Baseline Absolute Error',
            data: baseErrors,
            backgroundColor: '#10b981',
            borderRadius: 4
          },
          {
            label: 'Alternative (SMA-7) Absolute Error',
            data: altErrors,
            backgroundColor: '#ef4444',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              afterLabel: (ctx) => {
                const item = residuals[ctx.dataIndex];
                return `Actual Sales: ${item.actual_units} units\nPredicted: ${ctx.datasetIndex === 0 ? item.baseline_pred : item.alternative_pred}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Absolute Error (|Actual - Pred|)' },
            grid: { color: '#f1f5f9' }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // Render table
  const tbody = document.getElementById("residuals-tbody");
  if (!tbody) return;

  tbody.innerHTML = residuals.map(r => {
    return `
      <tr>
        <td class="table-cell-bold">${r.date}</td>
        <td>${r.weekday}</td>
        <td><strong>${r.actual_units} units</strong></td>
        <td>${r.baseline_pred} units</td>
        <td><span style="font-weight: 700; color: var(--color-success);">${r.baseline_abs_error}</span></td>
        <td>${r.alternative_pred} units</td>
        <td><span style="font-weight: 700; color: var(--color-danger);">${r.alternative_abs_error}</span></td>
        <td><span class="badge badge-success">Baseline (0 error)</span></td>
      </tr>
    `;
  }).join("");
}
