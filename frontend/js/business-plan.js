import { renderAppShell, formatINR, showToast } from './shared.js?v=3.0';
import { api } from './api.js';

let outreachList = [];

document.addEventListener("DOMContentLoaded", async () => {
  renderAppShell("business-plan.html", "MBA Business Plan & Commercial Model", "Per-location subscription unit economics & experiment plan.");

  await loadBusinessData();

  // Calculator inputs listener
  ["calc-price", "calc-locations", "calc-hosting", "calc-support", "calc-onboard"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", recalculateUnitEconomics);
  });

  // Save pricing
  document.getElementById("btn-save-pricing")?.addEventListener("click", savePricingModel);

  // Outreach Modal
  document.getElementById("btn-log-outreach")?.addEventListener("click", () => {
    document.getElementById("outreach-modal")?.classList.add("open");
  });
  document.getElementById("modal-outreach-close")?.addEventListener("click", closeOutreachModal);
  document.getElementById("btn-cancel-outreach")?.addEventListener("click", closeOutreachModal);
  document.getElementById("outreach-form")?.addEventListener("submit", handleOutreachSubmit);
});

async function loadBusinessData() {
  try {
    const data = await api.getBusinessOverview();
    const econ = data.pricing_and_economics;

    document.getElementById("calc-price").value = econ.price_per_location_monthly_inr;
    document.getElementById("calc-locations").value = econ.active_locations;
    document.getElementById("calc-hosting").value = econ.cost_breakdown.hosting_and_cloud_firestore_inr;
    document.getElementById("calc-support").value = econ.cost_breakdown.support_and_success_inr;
    document.getElementById("calc-onboard").value = econ.cost_breakdown.onboarding_amortization_inr;

    recalculateUnitEconomics();

    outreachList = data.outreach_records || [];
    renderOutreachTable(outreachList);
  } catch (err) {
    console.error("Failed to load business plan data:", err);
  }
}

function recalculateUnitEconomics() {
  const price = parseFloat(document.getElementById("calc-price")?.value) || 0;
  const locations = parseInt(document.getElementById("calc-locations")?.value, 10) || 0;
  const hosting = parseFloat(document.getElementById("calc-hosting")?.value) || 0;
  const support = parseFloat(document.getElementById("calc-support")?.value) || 0;
  const onboard = parseFloat(document.getElementById("calc-onboard")?.value) || 0;

  const costPerLoc = hosting + support + onboard;
  const revenue = price * locations;
  const cogs = costPerLoc * locations;
  const profit = revenue - cogs;
  const marginPct = revenue > 0 ? (profit / revenue * 100) : 0;

  document.getElementById("calc-out-revenue").innerText = formatINR(revenue);
  document.getElementById("calc-out-cogs").innerText = formatINR(cogs);
  document.getElementById("calc-out-profit").innerText = formatINR(profit);
  document.getElementById("calc-out-margin").innerText = `${marginPct.toFixed(1)}%`;
}

async function savePricingModel() {
  const plan = {
    price_per_location_monthly_inr: parseFloat(document.getElementById("calc-price").value),
    active_locations: parseInt(document.getElementById("calc-locations").value, 10),
    hosting_cost_per_location_inr: parseFloat(document.getElementById("calc-hosting").value),
    support_cost_per_location_inr: parseFloat(document.getElementById("calc-support").value),
    onboarding_amortized_inr: parseFloat(document.getElementById("calc-onboard").value)
  };

  try {
    await api.updatePricing(plan);
    showToast("Pricing & unit economics model updated!", "success");
  } catch (err) {
    showToast("Failed to save pricing plan.", "error");
  }
}

function renderOutreachTable(records) {
  const tbody = document.getElementById("outreach-tbody");
  const countBadge = document.getElementById("outreach-count");
  if (!tbody) return;

  countBadge.innerText = `${records.length} Recorded`;

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 1.5rem;">No outreach conversations logged yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(r => {
    let outcomeBadge = `<span class="badge badge-neutral">${r.reaction}</span>`;
    if (r.reaction.includes("Pilot")) outcomeBadge = `<span class="badge badge-success">${r.reaction}</span>`;
    else if (r.reaction.includes("Decline")) outcomeBadge = `<span class="badge badge-warning">${r.reaction}</span>`;
    else if (r.reaction.includes("Price")) outcomeBadge = `<span class="badge badge-danger">${r.reaction}</span>`;

    return `
      <tr>
        <td class="table-cell-bold">${r.contact_date || '2026-09'}</td>
        <td>
          <strong>${r.organization}</strong><br>
          <span style="font-size: 11px; color: var(--text-muted);">${r.contact_person}</span>
        </td>
        <td><span class="badge badge-neutral">${r.channel}</span></td>
        <td style="font-size: 11px; max-width: 240px; color: var(--text-secondary);">${r.observed_problem}</td>
        <td>${outcomeBadge}</td>
        <td style="font-size: 11px; max-width: 220px;"><strong>${r.follow_up_action}</strong></td>
      </tr>
    `;
  }).join("");
}

function closeOutreachModal() {
  document.getElementById("outreach-modal")?.classList.remove("open");
}

async function handleOutreachSubmit(e) {
  e.preventDefault();
  const record = {
    id: `outreach-${Date.now()}`,
    organization: document.getElementById("outreach-org").value.trim(),
    contact_person: document.getElementById("outreach-contact").value.trim(),
    channel: document.getElementById("outreach-channel").value,
    contact_date: new Date().toISOString().substring(0, 10),
    observed_problem: document.getElementById("outreach-problem").value.trim(),
    reaction: document.getElementById("outreach-reaction").value,
    outcome_notes: "Qualitative customer response collected.",
    follow_up_action: document.getElementById("outreach-action").value.trim()
  };

  try {
    await api.addOutreach(record);
    closeOutreachModal();
    showToast(`Outreach conversation for ${record.organization} logged!`, "success");
    outreachList.unshift(record);
    renderOutreachTable(outreachList);
  } catch (err) {
    showToast("Failed to log outreach conversation.", "error");
  }
}
