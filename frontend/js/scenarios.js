import { renderAppShell, showToast } from './shared.js?v=3.0';
import { api } from './api.js';

let selectedScenarioType = "lead_time_shock";
let lastSimulationResult = null;

document.addEventListener("DOMContentLoaded", async () => {
  renderAppShell("scenarios.html", "Risk & Scenario Simulator", "Stress-test replenishment rules under supply-chain shocks.");

  // Scenario preset buttons - auto-re-run on click!
  document.querySelectorAll(".scenario-preset-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".scenario-preset-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedScenarioType = btn.getAttribute("data-type");
      await executeSimulation();
    });
  });

  // SKU dropdown change - auto-re-run!
  document.getElementById("sim-sku")?.addEventListener("change", async () => {
    await executeSimulation();
  });

  // Custom overrides change - auto-re-run!
  document.getElementById("override-lead")?.addEventListener("input", debounce(executeSimulation, 400));
  document.getElementById("override-moq")?.addEventListener("input", debounce(executeSimulation, 400));

  // Run simulation button
  document.getElementById("btn-run-simulation")?.addEventListener("click", executeSimulation);

  // Save scenario
  document.getElementById("btn-save-scenario")?.addEventListener("click", saveCurrentScenario);

  // Demo Sales Loader
  document.getElementById("btn-load-demo-sales-sim")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-load-demo-sales-sim");
    if (btn) btn.disabled = true;
    try {
      showToast("Loading verified sample sales data...", "info");
      const res = await api.loadDemoSales();
      showToast(res.message || "Demo sales data loaded!", "success");
      const banner = document.getElementById("sim-sales-notice");
      if (banner) banner.style.display = "none";
      await executeSimulation();
    } catch (err) {
      showToast(`Failed to load demo sales: ${err.message}`, "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  // Check sales history presence
  try {
    const sales = await api.getSalesHistory();
    const banner = document.getElementById("sim-sales-notice");
    if (banner && (!sales || sales.length === 0)) {
      banner.style.display = "block";
    }
  } catch (err) {
    console.warn("Could not check sales history status:", err);
  }

  // Populate SKUs
  try {
    const skuSelect = document.getElementById("sim-sku");
    const products = await api.getProducts();
    if (products && products.length > 0 && skuSelect) {
      skuSelect.innerHTML = products.map(p => `<option value="${p.sku}">${p.sku} — ${p.name}</option>`).join("");
    }
  } catch (err) {
    console.warn("Could not load products for scenario simulator:", err);
  }

  await executeSimulation();
  await loadSavedScenarios();
});

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

async function executeSimulation() {
  const skuSelect = document.getElementById("sim-sku");
  const sku = skuSelect?.value;
  if (!sku) {
    document.getElementById("sim-result-title").innerText = "No SKU Available";
    document.getElementById("sim-result-subtitle").innerText = "Please upload or add products to your inventory catalog first.";
    return;
  }
  const overrideLead = document.getElementById("override-lead")?.value;
  const overrideMoq = document.getElementById("override-moq")?.value;

  const payload = {
    sku: sku,
    scenario_type: selectedScenarioType,
    lead_days_override: overrideLead ? parseInt(overrideLead, 10) : null,
    moq_override: overrideMoq ? parseInt(overrideMoq, 10) : null
  };

  const runBtn = document.getElementById("btn-run-simulation");
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.innerText = "Simulating Shock...";
  }

  try {
    const res = await api.simulateScenario(payload);
    lastSimulationResult = res;
    renderDiff(res);
    document.getElementById("btn-save-scenario").disabled = false;
  } catch (err) {
    console.error("Simulation failed:", err);
    showToast(`Simulation notice: ${err.message}`, "warning");
    document.getElementById("sim-result-subtitle").innerText = `Notice: ${err.message}`;
  } finally {
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.innerText = "Run Scenario Simulation →";
    }
  }
}

function renderDiff(res) {
  const orig = res.original;
  const rev = res.revised;

  document.getElementById("sim-result-title").innerText = `Simulation Output: ${res.scenario_name}`;
  document.getElementById("sim-result-subtitle").innerText = `SKU: ${res.sku} &bull; Changes: ${JSON.stringify(res.changes_applied)}`;

  // Original
  document.getElementById("orig-sku").innerText = res.sku;
  document.getElementById("orig-lead").innerText = `${orig.lead_days} days`;
  document.getElementById("orig-onhand").innerText = `${orig.on_hand} units`;
  document.getElementById("orig-target").innerText = `${orig.target_inventory} units`;
  document.getElementById("orig-pos").innerText = `${orig.stock_position} units`;
  document.getElementById("orig-shortfall").innerText = `${orig.raw_shortfall} units`;
  document.getElementById("orig-order").innerText = `${orig.suggested_order_units} units`;
  document.getElementById("orig-coverage").innerText = orig.coverage_days_current !== null ? `${orig.coverage_days_current} days` : 'Infinite';

  // Revised
  document.getElementById("rev-scenario-name").innerText = res.scenario_name;
  document.getElementById("rev-lead").innerText = `${rev.lead_days} days`;
  document.getElementById("rev-onhand").innerText = `${rev.on_hand} units`;
  document.getElementById("rev-target").innerText = `${rev.target_inventory} units`;
  document.getElementById("rev-pos").innerText = `${rev.stock_position} units`;
  document.getElementById("rev-shortfall").innerText = `${rev.raw_shortfall} units`;
  document.getElementById("rev-order").innerText = `${rev.suggested_order_units} units`;

  const deltaStr = res.delta_order_units >= 0 ? `+${res.delta_order_units}` : `${res.delta_order_units}`;
  const deltaEl = document.getElementById("rev-delta");
  deltaEl.innerText = `${deltaStr} units`;
  deltaEl.style.color = res.delta_order_units > 0 ? "var(--color-danger)" : "var(--color-brand-blue)";

  // Explanation
  document.getElementById("sim-explanation").innerText = res.why_it_changed;

  // Risks banner
  const risksBox = document.getElementById("sim-risks-box");
  const risksContent = document.getElementById("sim-risks-content");
  if (res.new_risks_and_uncertainty && res.new_risks_and_uncertainty.length > 0) {
    risksBox.style.display = "flex";
    risksContent.innerHTML = `
      <div style="font-weight: 600; color: var(--color-warning-text); margin-bottom: 0.25rem;">Identified Risk Flags:</div>
      <ul style="padding-left: 1.25rem; font-size: 0.8125rem;">
        ${res.new_risks_and_uncertainty.map(r => `<li>${r}</li>`).join("")}
      </ul>
    `;
  } else {
    risksBox.style.display = "none";
  }
}

async function saveCurrentScenario() {
  if (!lastSimulationResult) return;
  try {
    const savePayload = {
      sku: lastSimulationResult.sku,
      scenario_name: lastSimulationResult.scenario_name,
      original_order: lastSimulationResult.original.suggested_order_units,
      revised_order: lastSimulationResult.revised.suggested_order_units,
      delta_units: lastSimulationResult.delta_order_units,
      key_risk: lastSimulationResult.new_risks_and_uncertainty[0] || "Operational constraint",
      why_it_changed: lastSimulationResult.why_it_changed
    };
    await api.saveScenario(savePayload);
    showToast(`Scenario '${lastSimulationResult.scenario_name}' saved to records!`, "success");
    await loadSavedScenarios();
  } catch (err) {
    showToast("Failed to save scenario.", "error");
  }
}

async function loadSavedScenarios() {
  try {
    const list = await api.listSavedScenarios();
    const tbody = document.getElementById("saved-scenarios-tbody");
    const countBadge = document.getElementById("saved-scenarios-count");
    if (!tbody) return;

    countBadge.innerText = `${list.length} Saved`;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 1.5rem;">No scenarios saved yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(item => {
      const dateStr = item.created_at ? item.created_at.substring(0, 10) : "Recent";
      const deltaStr = item.delta_units >= 0 ? `+${item.delta_units}` : `${item.delta_units}`;
      return `
        <tr>
          <td>${dateStr}</td>
          <td><strong>${item.scenario_name}</strong></td>
          <td class="table-cell-bold">${item.sku}</td>
          <td>${item.original_order} units</td>
          <td><strong>${item.revised_order} units</strong></td>
          <td><span style="color: ${item.delta_units > 0 ? 'var(--color-danger)' : 'var(--color-brand-blue)'}; font-weight: 700;">${deltaStr} u</span></td>
          <td style="font-size: 11px; color: var(--text-secondary); max-width: 240px;">${item.key_risk}</td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    console.error("Failed to load saved scenarios:", err);
  }
}
