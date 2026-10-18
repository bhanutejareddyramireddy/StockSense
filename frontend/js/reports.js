import { renderAppShell, formatUnits, formatINR, showToast, openWhatsAppOrder, ICONS } from './shared.js?v=3.1';
import { api } from './api.js';

let latestProposals = [];
let productsMap = {};
let customerLossAnalysis = [];

document.addEventListener("DOMContentLoaded", async () => {
  renderAppShell("reports.html", "Executive Inventory Reports", "Audited replenishment summaries, customer loss exposure, and export tools.");

  renderPresentDate();
  await loadReportData();

  // Print Report (PDF)
  document.getElementById("btn-print-report")?.addEventListener("click", () => {
    window.print();
  });

  // Export CSV
  document.getElementById("btn-export-csv")?.addEventListener("click", () => {
    exportReportCSV();
  });

  // Export Full JSON
  document.getElementById("btn-export-json")?.addEventListener("click", () => {
    exportReportJSON();
  });
});

/**
 * Render Present Date in header badge and printable report cards
 */
function renderPresentDate() {
  const now = new Date();
  const fullDateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const shortDateStr = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const badgeEl = document.getElementById("report-present-date-badge");
  if (badgeEl) {
    badgeEl.innerHTML = `📅 <strong>Present Date:</strong> ${fullDateStr}`;
  }

  const printDateEl = document.getElementById("printable-present-date");
  if (printDateEl) {
    printDateEl.innerText = `📅 Present Date: ${shortDateStr}`;
  }

  const printTimeEl = document.getElementById("printable-timestamp");
  if (printTimeEl) {
    printTimeEl.innerText = `Generated: ${shortDateStr}, ${timeStr}`;
  }

  return { now, fullDateStr, shortDateStr, timeStr };
}

/**
 * Load replenishment proposals, products, and compute customer loss risk
 */
async function loadReportData() {
  try {
    const [proposalsData, products] = await Promise.all([
      api.getReplenishmentProposals(),
      api.getProducts()
    ]);

    latestProposals = proposalsData.proposals || [];
    productsMap = {};
    (products || []).forEach(p => { productsMap[p.sku] = p; });

    if (proposalsData.sales_history_required) {
      renderSalesHistoryRequiredNotice();
      return;
    }

    // 1. Compute Customer Loss & Financial Risk Exposure
    customerLossAnalysis = [];
    let totalRevenueLost = 0;
    let totalCustomersLost = 0;

    latestProposals.forEach(p => {
      const prod = productsMap[p.sku] || {
        name: p.sku,
        category: "General",
        unit_cost_inr: 100,
        selling_price_inr: 150,
        lead_days: p.lead_days || 3,
        moq: p.moq || 5
      };

      const sellingPrice = prod.selling_price_inr || (prod.unit_cost_inr ? Math.round(prod.unit_cost_inr * 1.35) : 150);
      const dailyDemand = p.daily_forecast || (prod.daily_demand ? parseFloat(prod.daily_demand) : (p.on_hand > 0 ? 5 : 2));
      const leadDays = p.lead_days || prod.lead_days || 3;
      
      const coverageDays = (p.coverage_days_current !== null && p.coverage_days_current !== undefined)
        ? p.coverage_days_current
        : (dailyDemand > 0 ? (p.on_hand / dailyDemand) : 0);
      const daysUntilStockout = p.on_hand <= 0 ? 0 : Math.max(0, parseFloat(coverageDays.toFixed(1)));
      const deliveryGapDays = Math.max(0, Math.round(leadDays - daysUntilStockout));
      
      const shortfallUnits = (p.raw_shortfall && p.raw_shortfall > 0)
        ? p.raw_shortfall
        : (p.suggested_order_units > 0 ? p.suggested_order_units : 0);
      
      const suggestedUnits = p.suggested_order_units > 0
        ? p.suggested_order_units
        : (p.on_hand === 0 ? (p.moq || 10) : 0);

      // Identify SKUs facing stockout or needing replenishment
      const isAtRisk = suggestedUnits > 0 || p.on_hand === 0 || daysUntilStockout <= leadDays || (p.risk_level && (p.risk_level.includes("Critical") || p.risk_level.includes("Warning")));

      if (isAtRisk) {
        const unitsAtRisk = shortfallUnits > 0 ? shortfallUnits : (suggestedUnits > 0 ? suggestedUnits : Math.max(1, Math.round(dailyDemand * leadDays)));
        const projectedRevenueLoss = Math.round(unitsAtRisk * sellingPrice);
        const projectedCustomersLost = Math.max(1, Math.round(unitsAtRisk / 1.3));

        totalRevenueLost += projectedRevenueLoss;
        totalCustomersLost += projectedCustomersLost;

        customerLossAnalysis.push({
          sku: p.sku,
          name: prod.name,
          category: prod.category || "General",
          on_hand: p.on_hand,
          daily_demand: dailyDemand,
          lead_days: leadDays,
          days_until_stockout: daysUntilStockout,
          delivery_gap: deliveryGapDays,
          shortfall_units: unitsAtRisk,
          suggested_order_units: suggestedUnits,
          selling_price: sellingPrice,
          unit_cost: prod.unit_cost_inr || 100,
          projected_revenue_loss: projectedRevenueLoss,
          projected_customers_lost: projectedCustomersLost,
          risk_level: p.risk_level || "Warning",
          expected_arrival_date: p.expected_arrival_date || "3 days",
          pack_size: p.pack_size || 1,
          cost_inr: p.cost_inr || (suggestedUnits * (prod.unit_cost_inr || 100)),
          vendor_name: p.vendor_name || prod.vendor_name || "Primary Supplier",
          vendor_phone: p.vendor_phone || prod.vendor_phone || "+919876543210"
        });
      }
    });

    // Sort customer loss analysis: 0 on hand first, then lowest days until stockout
    customerLossAnalysis.sort((a, b) => {
      if (a.on_hand === 0 && b.on_hand !== 0) return -1;
      if (b.on_hand === 0 && a.on_hand !== 0) return 1;
      return a.days_until_stockout - b.days_until_stockout;
    });

    // Update KPI Summary Cards
    const atRiskCount = customerLossAnalysis.length;
    const revLostEl = document.getElementById("val-total-revenue-lost");
    if (revLostEl) revLostEl.innerText = formatINR(totalRevenueLost);

    const custLostEl = document.getElementById("val-total-customers-lost");
    if (custLostEl) custLostEl.innerText = `${totalCustomersLost.toLocaleString()} customers`;

    const atRiskCountEl = document.getElementById("val-at-risk-skus-count");
    if (atRiskCountEl) atRiskCountEl.innerText = `${atRiskCount} SKUs`;

    const badgeRiskEl = document.getElementById("risk-exposure-badge");
    if (badgeRiskEl) {
      badgeRiskEl.innerText = atRiskCount > 0 ? `${atRiskCount} SKUs Facing Loss` : "0 SKUs at Risk";
      badgeRiskEl.className = atRiskCount > 0 ? "badge badge-danger" : "badge badge-success";
    }

    const fastestEl = document.getElementById("val-fastest-depleting");
    const fastestDaysEl = document.getElementById("val-fastest-days");
    if (fastestEl && fastestDaysEl) {
      if (customerLossAnalysis.length > 0) {
        const top = customerLossAnalysis[0];
        fastestEl.innerText = `${top.name} (${top.sku})`;
        fastestDaysEl.innerText = top.on_hand === 0
          ? "⚠️ 0 days (Completely Depleted)"
          : `${top.days_until_stockout} days coverage remaining`;
        fastestDaysEl.style.color = top.on_hand === 0 ? "#e11d48" : "#ea580c";
      } else {
        fastestEl.innerText = "All Inventory Healthy";
        fastestDaysEl.innerText = "Sufficient buffer stock";
        fastestDaysEl.style.color = "var(--color-success)";
      }
    }

    // Render Section 1: Customer Loss Breakdown Table
    renderCustomerLossTable();

    // Render Section 2: Full Replenishment Table
    renderProposalsTable();

  } catch (err) {
    console.error("Failed to load report data:", err);
    showToast("Failed to load report data from server.", "error");
  }
}

/**
 * Render Customer Loss & Financial Exposure Table (Section 1)
 */
function renderCustomerLossTable() {
  const tbody = document.getElementById("customer-loss-tbody");
  if (!tbody) return;

  if (customerLossAnalysis.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2.5rem; color: var(--color-success);">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🎉</div>
          <div style="font-weight: 700; font-size: 1rem;">All Inventory Fully Covered</div>
          <p style="font-size: 0.8125rem; color: var(--text-secondary); margin-top: 0.25rem;">
            No immediate stockout or customer loss risk detected across active SKUs.
          </p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = customerLossAnalysis.map(item => {
    const stockBadge = item.on_hand === 0
      ? `<span class="badge badge-danger">0 Out of Stock</span>`
      : `<span style="font-weight: 600;">${item.on_hand} units</span>`;

    let stockoutBadge = "";
    if (item.days_until_stockout === 0) {
      stockoutBadge = `<span class="badge badge-danger">0 days (Stockout Now)</span>`;
    } else if (item.days_until_stockout <= item.lead_days) {
      stockoutBadge = `<span class="badge badge-warning">${item.days_until_stockout} days left</span>`;
    } else {
      stockoutBadge = `<span class="badge badge-info">${item.days_until_stockout} days</span>`;
    }

    const gapText = item.delivery_gap > 0
      ? `<span style="font-weight: 700; color: #b91c1c;">${item.delivery_gap} days gap</span>`
      : `<span style="color: var(--color-success); font-weight: 500;">Covered</span>`;

    return `
      <tr>
        <td class="table-cell-bold">
          ${item.sku}
          <div style="font-size: 11px; color: var(--text-muted); font-weight: normal;">${item.category}</div>
        </td>
        <td>
          <div style="font-weight: 600; color: var(--color-primary-900); font-size: 13px;">${item.name}</div>
          <div style="font-size: 11.5px; color: #9f1239; margin-top: 5px; background: #fff1f2; border: 1px solid #fecdd3; padding: 4px 8px; border-radius: 6px; line-height: 1.4;">
            <strong>⚠️ Impact Warning:</strong> If you don't restock this product, you might lose <strong>~${item.projected_customers_lost} customers</strong> and suffer <strong>${formatINR(item.projected_revenue_loss)}</strong> in revenue loss!
          </div>
        </td>
        <td>${stockBadge}</td>
        <td>${stockoutBadge}</td>
        <td>
          <div>${item.lead_days}d supplier lead</div>
          <div style="font-size: 11px;">${gapText}</div>
        </td>
        <td>
          <strong style="color: #ea580c; font-size: 13.5px;">~${item.projected_customers_lost} customers</strong>
          <div style="font-size: 11px; color: var(--text-secondary);">unserved basket demand</div>
        </td>
        <td>
          <strong style="color: #e11d48; font-size: 13.5px;">${formatINR(item.projected_revenue_loss)}</strong>
          <div style="font-size: 11px; color: var(--text-secondary);">direct lost sales</div>
        </td>
        <td>
          <strong style="color: var(--color-brand-blue); font-size: 13px;">${item.suggested_order_units} units</strong>
          <div style="font-size: 11px; color: var(--text-muted);">ETA: ${item.expected_arrival_date}</div>
        </td>
        <td>
          <button class="btn btn-whatsapp btn-sm btn-table-whatsapp"
            data-sku="${item.sku}"
            data-name="${item.name}"
            data-units="${item.suggested_order_units}"
            data-pack="${item.pack_size}"
            data-eta="${item.expected_arrival_date}"
            data-stock="${item.on_hand}"
            data-cost="${item.cost_inr}"
            data-lead="${item.lead_days}"
            data-vendor-name="${item.vendor_name}"
            data-vendor-phone="${item.vendor_phone}"
            style="white-space: nowrap; padding: 5px 10px; font-size: 11px;">
            ${ICONS.whatsapp}
            <span>Order WhatsApp</span>
          </button>
        </td>
      </tr>
    `;
  }).join("");

  // Attach WhatsApp Order click handlers
  tbody.querySelectorAll(".btn-table-whatsapp").forEach(btn => {
    btn.addEventListener("click", () => {
      openWhatsAppOrder({
        sku: btn.getAttribute("data-sku"),
        productName: btn.getAttribute("data-name"),
        quantity: parseInt(btn.getAttribute("data-units"), 10),
        packSize: parseInt(btn.getAttribute("data-pack"), 10),
        arrivalDate: btn.getAttribute("data-eta"),
        onHand: parseInt(btn.getAttribute("data-stock"), 10),
        totalCost: parseFloat(btn.getAttribute("data-cost")),
        leadDays: parseInt(btn.getAttribute("data-lead"), 10),
        vendorName: btn.getAttribute("data-vendor-name"),
        vendorPhone: btn.getAttribute("data-vendor-phone")
      });
    });
  });
}

/**
 * Render Full Replenishment Table (Section 2)
 */
function renderProposalsTable() {
  const tbody = document.getElementById("report-proposals-tbody");
  if (!tbody) return;

  let totalUnits = 0;
  let totalCost = 0;

  tbody.innerHTML = latestProposals.map(p => {
    const prod = productsMap[p.sku] || { name: p.sku, unit_cost_inr: 100 };
    if (p.suggested_order_units > 0) {
      totalUnits += p.suggested_order_units;
      totalCost += (p.suggested_order_units * (prod.unit_cost_inr || 100));
    }

    let riskBadge = `<span class="badge badge-success">${p.risk_level}</span>`;
    if (p.risk_level.includes("Critical") || p.on_hand === 0) {
      riskBadge = `<span class="badge badge-danger">${p.risk_level}</span>`;
    } else if (p.risk_level.includes("Warning")) {
      riskBadge = `<span class="badge badge-warning">${p.risk_level}</span>`;
    } else if (p.risk_level.includes("Overstocked")) {
      riskBadge = `<span class="badge badge-info">${p.risk_level}</span>`;
    }

    return `
      <tr>
        <td class="table-cell-bold">${p.sku}</td>
        <td>${prod.name}</td>
        <td>${p.on_hand === 0 ? '<span class="badge badge-danger">0</span>' : p.on_hand}</td>
        <td><strong>${p.stock_position}</strong></td>
        <td>${p.target_inventory}</td>
        <td>${p.raw_shortfall}</td>
        <td><strong style="color: ${p.suggested_order_units > 0 ? 'var(--color-brand-blue)' : 'inherit'};">${p.suggested_order_units} units</strong></td>
        <td>${p.expected_arrival_date}</td>
        <td>${riskBadge}</td>
      </tr>
    `;
  }).join("");

  const unitsEl = document.getElementById("report-total-units");
  if (unitsEl) unitsEl.innerText = `${totalUnits} units`;
  const costEl = document.getElementById("report-total-cost");
  if (costEl) costEl.innerText = formatINR(totalCost);
}

/**
 * Display notice when sales history has not been uploaded yet
 */
function renderSalesHistoryRequiredNotice() {
  const tbody = document.getElementById("customer-loss-tbody");
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2.5rem; background: #fffbf7; border: 1px dashed #fed7aa; border-radius: 8px;">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">📊</div>
          <div style="font-weight: 700; font-size: 1rem; color: #9a3412;">Sales History Required for Customer Loss Projections</div>
          <p style="font-size: 0.8125rem; color: var(--text-secondary); margin-top: 0.35rem; max-width: 500px; margin-left: auto; margin-right: auto;">
            To calculate customer demand walkouts and accurate revenue loss exposure, please upload your past sales history on the Upload &amp; Datasets page.
          </p>
          <a href="datasets.html" class="btn btn-primary btn-sm" style="margin-top: 0.75rem; display: inline-flex;">
            Upload Sales History CSV
          </a>
        </td>
      </tr>
    `;
  }

  const pTbody = document.getElementById("report-proposals-tbody");
  if (pTbody) {
    pTbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          Sales history required to calculate replenishment orders.
        </td>
      </tr>
    `;
  }
}

/**
 * Export CSV including Present Date and Customer Loss analysis
 */
function exportReportCSV() {
  const { fullDateStr, now } = renderPresentDate();
  const dateIso = now.toISOString().substring(0, 10);

  let csvContent = "";
  // Header metadata block with Present Date prominently at the top
  csvContent += `"StockSense Executive Replenishment & Customer Loss Audit Report"\n`;
  csvContent += `"Present Date:","${fullDateStr}"\n`;
  csvContent += `"Generated Timestamp:","${now.toISOString()}"\n`;
  csvContent += `"Total Projected Revenue at Risk:","${formatINR(customerLossAnalysis.reduce((acc, i) => acc + i.projected_revenue_loss, 0))}"\n`;
  csvContent += `"Total Potential Customers Lost:","${customerLossAnalysis.reduce((acc, i) => acc + i.projected_customers_lost, 0)}"\n`;
  csvContent += `"Products Facing Stockout / Loss:","${customerLossAnalysis.length}"\n`;
  csvContent += `\n`;

  // Section 1: Customer Loss Risk Exposure
  csvContent += `"SECTION 1: CUSTOMER LOSS & PROJECTED REVENUE EXPOSURE IF UNRESTOCKED"\n`;
  csvContent += `"SKU","Product Name","Category","Current Stock On Hand","Days Until Stockout","Supplier Lead Days","Delivery Gap Days","Shortfall Units","Suggested Order Units","Potential Customers Lost","Projected Revenue Loss (INR)","Expected Arrival Date","Risk Level","Supplier Name","Supplier WhatsApp","Executive Warning"\n`;

  customerLossAnalysis.forEach(item => {
    const warning = `If you don't restock this product you might lose ~${item.projected_customers_lost} customers and get ${item.projected_revenue_loss} INR revenue loss`;
    csvContent += `"${item.sku}","${item.name.replace(/"/g, '""')}","${item.category}","${item.on_hand}","${item.days_until_stockout}","${item.lead_days}","${item.delivery_gap}","${item.shortfall_units}","${item.suggested_order_units}","${item.projected_customers_lost}","${item.projected_revenue_loss}","${item.expected_arrival_date}","${item.risk_level}","${item.vendor_name}","${item.vendor_phone}","${warning}"\n`;
  });

  csvContent += `\n`;
  csvContent += `"SECTION 2: ALL PRODUCTS REPLENISHMENT & AUDIT BREAKDOWN"\n`;
  csvContent += `"SKU","Product Name","Current On Hand","Stock Position","Target Inventory","Raw Shortfall","Suggested Order Units","Expected Arrival Date","Risk Assessment"\n`;

  latestProposals.forEach(p => {
    const prod = productsMap[p.sku] || { name: p.sku };
    csvContent += `"${p.sku}","${(prod.name || p.sku).replace(/"/g, '""')}","${p.on_hand}","${p.stock_position}","${p.target_inventory}","${p.raw_shortfall}","${p.suggested_order_units}","${p.expected_arrival_date}","${p.risk_level}"\n`;
  });

  // Download trigger
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `stocksense_audit_report_${dateIso}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`CSV Report downloaded with present date (${dateIso})!`, "success");
}

/**
 * Export Full JSON with Present Date
 */
function exportReportJSON() {
  const { fullDateStr, now } = renderPresentDate();
  const dateIso = now.toISOString().substring(0, 10);

  const exportBlob = {
    report_title: "StockSense Executive Replenishment & Customer Loss Audit Report",
    present_date: fullDateStr,
    generated_at: now.toISOString(),
    executive_loss_summary: {
      total_projected_revenue_lost_inr: customerLossAnalysis.reduce((acc, i) => acc + i.projected_revenue_loss, 0),
      total_potential_customers_lost: customerLossAnalysis.reduce((acc, i) => acc + i.projected_customers_lost, 0),
      skus_at_risk_count: customerLossAnalysis.length
    },
    customer_loss_analysis: customerLossAnalysis,
    full_proposals: latestProposals
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportBlob, null, 2));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", `stocksense_audit_export_${dateIso}.json`);
  document.body.appendChild(dlAnchorElem);
  dlAnchorElem.click();
  document.body.removeChild(dlAnchorElem);

  showToast("Full JSON report exported with present date!", "success");
}
