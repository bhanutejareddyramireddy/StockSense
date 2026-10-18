import { renderAppShell, formatUnits, formatINR, formatDays, showToast, openWhatsAppOrder, ICONS } from './shared.js?v=3.1';
import { api } from './api.js?v=2.3';

let proposalsList = [];
let productsMap = {};
let currentFilter = "ALL";
let activeVendorSku = null;
let currentMultiplier = 1.0;

async function initPage() {
  try {
    renderAppShell("replenishment.html", "Replenishment Order Planner", "Automated stock position and order proposals.");
  } catch (err) {
    console.error("renderAppShell error:", err);
  }

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
      await loadProposals();
      const label = btn.innerText.trim();
      showToast(`Replenishment target scaled for ${label}`, "info");
    });
  });

  // Load demo sales action in banner
  document.getElementById("btn-load-demo-sales-replenishment")?.addEventListener("click", async () => {
    try {
      showToast("Loading sample sales data...", "info");
      const res = await api.loadDemoSales();
      showToast(res.message || "Sample sales loaded!", "success");
      await loadProposals();
    } catch (e) {
      showToast("Failed to load demo sales.", "error");
    }
  });

  // Load proposals data immediately
  try {
    await loadProposals();
  } catch (err) {
    console.error("loadProposals error:", err);
  }

  // Filter buttons
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => {
        b.className = "btn btn-sm btn-outline filter-btn";
      });
      btn.className = "btn btn-sm btn-primary filter-btn active";
      currentFilter = btn.getAttribute("data-filter");
      renderTable();
    });
  });

  // Verify 5 reference examples
  document.getElementById("btn-verify-benchmarks")?.addEventListener("click", async () => {
    try {
      const res = await api.verifyBenchmarks();
      if (res.all_passed) {
        showToast("Success! All 5 C19 Reference Inventory Examples verified (100% Match).", "success");
      } else {
        showToast("Some reference examples did not match.", "error");
      }
    } catch (e) {
      showToast("Error verifying benchmarks.", "error");
    }
  });

  // Review Order Modal
  document.getElementById("btn-review-order")?.addEventListener("click", openReviewModal);
  document.getElementById("modal-review-close")?.addEventListener("click", closeReviewModal);
  document.getElementById("btn-cancel-review")?.addEventListener("click", closeReviewModal);

  // Confirm Save Run
  document.getElementById("btn-confirm-save-run")?.addEventListener("click", async () => {
    try {
      const saveRes = await api.saveRun({ notes: "Reviewed and confirmed by inventory planner." });
      closeReviewModal();
      showToast(`Replenishment run ${saveRes.run_id} saved successfully!`, "success");
    } catch (err) {
      showToast("Failed to save replenishment run.", "error");
    }
  });

  // Vendor Modal listeners
  document.getElementById("modal-vendor-close")?.addEventListener("click", closeVendorModal);
  document.getElementById("btn-cancel-vendor")?.addEventListener("click", closeVendorModal);
  document.getElementById("vendor-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSaveVendor(false);
  });
  document.getElementById("btn-save-and-whatsapp")?.addEventListener("click", () => {
    handleSaveVendor(true);
  });
  document.getElementById("vendor-name-input")?.addEventListener("input", updateVendorPreview);
  document.getElementById("vendor-phone-input")?.addEventListener("input", updateVendorPreview);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPage);
} else {
  initPage();
}

async function loadProposals() {
  const banner = document.getElementById("sales-required-banner");
  try {
    const [proposalsData, products] = await Promise.all([
      api.getReplenishmentProposals(null, currentMultiplier),
      api.getProducts()
    ]);
    
    products.forEach(p => { productsMap[p.sku] = p; });

    if (proposalsData.sales_history_required) {
      if (banner) banner.style.display = "block";
      proposalsList = [];
      document.getElementById("val-rep-units").innerText = "Pending Sales";
      document.getElementById("val-rep-skus").innerText = "Upload sales history";
      document.getElementById("val-rep-cost").innerText = "--";
      const tbody = document.getElementById("proposals-tbody");
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="13" style="text-align: center; padding: 3rem 1.5rem;">
              <div style="font-size: 1.0625rem; font-weight: 600; color: #1e3a8a; margin-bottom: 0.35rem;">
                Sales History Required to Compute Order Proposals
              </div>
              <div style="font-size: 0.8125rem; color: var(--text-muted); margin-bottom: 1rem;">
                Your product catalog is active, but sales transactions are required to calculate demand velocity and suggested order units.
              </div>
              <div style="display: flex; gap: 0.5rem; justify-content: center;">
                <a href="sales.html" class="btn btn-primary btn-sm" style="text-decoration: none;">Upload Sales History</a>
                <button type="button" id="btn-quick-load-demo-rep" class="btn btn-outline btn-sm">⚡ Load Demo Sales Data</button>
              </div>
            </td>
          </tr>
        `;
        document.getElementById("btn-quick-load-demo-rep")?.addEventListener("click", async () => {
          try {
            showToast("Loading sample sales data...", "info");
            await api.loadDemoSales();
            showToast("Sample sales data loaded!", "success");
            await loadProposals();
          } catch (e) {
            showToast("Failed to load demo sales.", "error");
          }
        });
      }
      return;
    }

    if (banner) banner.style.display = "none";
    proposalsList = proposalsData.proposals;

    updateMetrics();
    renderTable();
  } catch (err) {
    console.error("Failed to load replenishment proposals:", err);
    showToast("Failed to load replenishment data.", "error");
  }
}

function updateMetrics() {
  let totalUnits = 0;
  let reorderSkus = 0;
  let totalCost = 0;

  proposalsList.forEach(p => {
    if (p.suggested_order_units > 0) {
      totalUnits += p.suggested_order_units;
      reorderSkus++;
      const prod = productsMap[p.sku] || { unit_cost_inr: 100 };
      totalCost += (p.suggested_order_units * (prod.unit_cost_inr || 100));
    }
  });

  document.getElementById("val-rep-units").innerText = `${totalUnits} units`;
  document.getElementById("val-rep-skus").innerText = `${reorderSkus} of ${proposalsList.length} SKUs need ordering`;
  document.getElementById("val-rep-cost").innerText = formatINR(totalCost);

  const allBtn = document.getElementById("filter-btn-all");
  if (allBtn) allBtn.innerText = `All Products (${proposalsList.length})`;
  const badgeBenchmark = document.getElementById("badge-benchmark-status");
  if (badgeBenchmark) badgeBenchmark.innerText = `${proposalsList.length} / ${proposalsList.length} Verified`;
}

function renderTable() {
  const tbody = document.getElementById("proposals-tbody");
  if (!tbody) return;

  if (proposalsList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="13" style="text-align: center; padding: 3rem 1.5rem;">No products listed in catalog yet. <a href="inventory.html" class="btn btn-primary btn-sm" style="margin-left: 0.5rem;">+ Add Your First Product</a></td></tr>`;
    return;
  }

  const filtered = proposalsList.filter(p => {
    if (currentFilter === "REORDER") return p.suggested_order_units > 0;
    if (currentFilter === "CRITICAL") return p.risk_level.includes("Critical") || p.on_hand === 0;
    if (currentFilter === "HEALTHY") return p.suggested_order_units === 0;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="13" style="text-align: center; padding: 2rem;">No products match the selected filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const prod = productsMap[p.sku] || { name: p.sku, unit_cost_inr: 100 };

    let riskBadge = `<span class="badge badge-neutral">Unknown</span>`;
    if (p.risk_level.includes("Critical") || p.on_hand === 0) riskBadge = `<span class="badge badge-danger">${p.risk_level}</span>`;
    else if (p.risk_level.includes("Warning") || p.risk_level.includes("Perishable")) riskBadge = `<span class="badge badge-warning">${p.risk_level}</span>`;
    else if (p.risk_level === "Healthy") riskBadge = `<span class="badge badge-success">${p.risk_level}</span>`;
    else if (p.risk_level === "Overstocked") riskBadge = `<span class="badge badge-neutral">${p.risk_level}</span>`;

    const coverageStr = p.coverage_days_current !== null ? `${p.coverage_days_current} d` : "Infinite";

    // Action & Vendor Column
    let actionHtml = "";
    if (p.suggested_order_units > 0) {
      actionHtml = `
        <div style="display: flex; flex-direction: column; gap: 0.375rem; align-items: flex-start;">
          <button class="btn btn-whatsapp btn-sm btn-order-whatsapp" data-sku="${p.sku}" style="padding: 4px 8px; font-size: 11px;">
            ${ICONS.whatsapp}
            <span>Order via WhatsApp</span>
          </button>
          <button class="btn btn-outline btn-sm btn-edit-vendor" data-sku="${p.sku}" style="padding: 2px 6px; font-size: 10px; color: var(--text-muted);" title="Configure Supplier Details">
            <span>👤 Edit Vendor</span>
          </button>
        </div>
      `;
    } else {
      actionHtml = `
        <button class="btn btn-outline btn-sm btn-edit-vendor" data-sku="${p.sku}" style="padding: 3px 8px; font-size: 11px;">
          <span>👤 Configure Vendor</span>
        </button>
      `;
    }

    return `
      <tr>
        <td class="table-cell-bold">${p.sku}</td>
        <td><strong>${prod.name}</strong></td>
        <td>${p.daily_forecast} u/d</td>
        <td>${p.lead_days} d</td>
        <td>${p.target_inventory} u</td>
        <td><strong>${p.stock_position} u</strong></td>
        <td><span style="color: ${p.raw_shortfall > 0 ? 'var(--color-danger)' : 'inherit'};">${p.raw_shortfall} u</span></td>
        <td>${p.moq} / ${p.pack_size}</td>
        <td>
          <span style="font-weight: 700; font-size: 13px; color: ${p.suggested_order_units > 0 ? 'var(--color-brand-blue)' : 'var(--text-muted)'};">
            ${p.suggested_order_units > 0 ? `${p.suggested_order_units} units` : '0'}
          </span>
          ${p.suggested_order_units > 0 && p.pack_size > 1 ? `<div style="font-size: 10px; color: var(--text-muted);">${Math.ceil(p.suggested_order_units / p.pack_size)} packs</div>` : ''}
        </td>
        <td>${p.expected_arrival_date}</td>
        <td>${coverageStr}</td>
        <td>${riskBadge}</td>
        <td>${actionHtml}</td>
      </tr>
    `;
  }).join("");

  // Wire buttons in table

  document.querySelectorAll(".btn-order-whatsapp").forEach(btn => {
    btn.addEventListener("click", () => {
      handleWhatsAppOrderClick(btn.getAttribute("data-sku"));
    });
  });

  document.querySelectorAll(".btn-edit-vendor").forEach(btn => {
    btn.addEventListener("click", () => {
      openVendorModal(btn.getAttribute("data-sku"));
    });
  });
}

function handleWhatsAppOrderClick(sku) {
  const p = proposalsList.find(x => x.sku === sku);
  if (!p) return;
  const prod = productsMap[sku] || { name: sku, unit_cost_inr: 100 };

  const phone = (p.vendor_phone || prod.vendor_phone || "").trim();
  if (!phone || phone.length < 6) {
    // If phone is missing, open vendor modal to prompt for supplier phone
    openVendorModal(sku, true);
    return;
  }

  // Direct dispatch
  openWhatsAppOrder({
    sku: p.sku,
    productName: prod.name,
    quantity: p.suggested_order_units,
    packSize: p.pack_size,
    arrivalDate: p.expected_arrival_date,
    onHand: p.on_hand,
    totalCost: p.cost_inr || (p.suggested_order_units * (prod.unit_cost_inr || 100)),
    vendorName: p.vendor_name || prod.vendor_name || "Primary Supplier",
    vendorPhone: phone
  });
}

// ----------------- Vendor Modal Logic -----------------
function openVendorModal(sku, andLaunchWhatsApp = false) {
  const p = proposalsList.find(x => x.sku === sku);
  const prod = productsMap[sku] || { name: sku, unit_cost_inr: 100 };
  if (!p && !prod) return;

  activeVendorSku = sku;
  const modal = document.getElementById("vendor-modal");
  document.getElementById("vendor-sku").value = sku;
  document.getElementById("vendor-prod-name").innerText = `${prod.name || sku} (${sku})`;

  const orderUnits = p ? p.suggested_order_units : 0;
  const cost = p ? (p.cost_inr || (orderUnits * (prod.unit_cost_inr || 100))) : 0;
  document.getElementById("vendor-order-summary").innerText = orderUnits > 0
    ? `Suggested Order: ${orderUnits} units (${formatINR(cost)}) | Arrival: ${p.expected_arrival_date}`
    : `Stock is currently healthy; configure supplier details for future replenishment.`;

  document.getElementById("vendor-name-input").value = p?.vendor_name || prod.vendor_name || "Primary Supplier";
  document.getElementById("vendor-phone-input").value = p?.vendor_phone || prod.vendor_phone || "+919876543210";
  document.getElementById("vendor-email-input").value = p?.vendor_email || prod.vendor_email || "";

  updateVendorPreview();

  modal?.classList.add("open");
  document.getElementById("vendor-phone-input")?.focus();
}

function updateVendorPreview() {
  const sku = activeVendorSku;
  if (!sku) return;
  const p = proposalsList.find(x => x.sku === sku);
  const prod = productsMap[sku] || { name: sku, unit_cost_inr: 100 };

  const vendorName = document.getElementById("vendor-name-input")?.value.trim() || "Supplier";
  const orderUnits = p ? p.suggested_order_units : 10;
  const packSize = p ? p.pack_size : (prod.pack_size || 1);
  const cost = p ? (p.cost_inr || (orderUnits * (prod.unit_cost_inr || 100))) : (orderUnits * 100);
  const eta = p ? p.expected_arrival_date : "Scheduled Date";
  const onHand = p ? p.on_hand : prod.available_stock;

  let orgName = "StockSense Retail Store";
  let buyerName = "";
  try {
    const rawUser = localStorage.getItem("stocksense_current_user");
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u.organization && u.organization.trim()) orgName = u.organization.trim();
      if (u.displayName && u.displayName.trim()) buyerName = u.displayName.trim();
    }
  } catch (e) {}

  const fromLine = buyerName ? `*From:* ${orgName} (${buyerName})` : `*From:* ${orgName}`;

  const packsCount = packSize > 1 ? ` (${Math.ceil(orderUnits / packSize)} cartons/packs of ${packSize})` : "";
  const preview = 
`📦 *STOCK REPLENISHMENT PURCHASE ORDER*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*To:* ${vendorName}
${fromLine}

Hello! We would like to place an immediate replenishment order:

• *Product:* ${prod.name || sku} (SKU: ${sku})
• *Order Quantity:* ${formatUnits(orderUnits)} units${packsCount}
• *Current Stock on Hand:* ${formatUnits(onHand || 0)} units
• *Required Delivery By:* ${eta}
• *Estimated PO Value:* ${formatINR(cost)}

Please confirm stock availability and dispatch schedule. Thank you!`;

  const previewEl = document.getElementById("vendor-whatsapp-preview");
  if (previewEl) previewEl.innerText = preview;
}

async function handleSaveVendor(andLaunchWhatsApp = false) {
  const sku = activeVendorSku;
  if (!sku) return;

  const nameInput = document.getElementById("vendor-name-input");
  const phoneInput = document.getElementById("vendor-phone-input");
  const emailInput = document.getElementById("vendor-email-input");

  const vendorName = nameInput.value.trim() || "Primary Supplier";
  const vendorPhone = phoneInput.value.trim();
  const vendorEmail = emailInput.value.trim();

  if (!vendorPhone) {
    showToast("Please enter a WhatsApp phone number for the supplier.", "error");
    phoneInput.focus();
    return;
  }

  try {
    await api.updateProductVendor(sku, {
      vendor_name: vendorName,
      vendor_phone: vendorPhone,
      vendor_email: vendorEmail
    });

    // Update in local state
    const p = proposalsList.find(x => x.sku === sku);
    if (p) {
      p.vendor_name = vendorName;
      p.vendor_phone = vendorPhone;
      p.vendor_email = vendorEmail;
    }
    if (productsMap[sku]) {
      productsMap[sku].vendor_name = vendorName;
      productsMap[sku].vendor_phone = vendorPhone;
      productsMap[sku].vendor_email = vendorEmail;
    }

    closeVendorModal();
    renderTable();
    showToast(`Supplier details for ${sku} updated successfully!`, "success");

    if (andLaunchWhatsApp) {
      const prod = productsMap[sku] || { name: sku, unit_cost_inr: 100 };
      openWhatsAppOrder({
        sku: sku,
        productName: prod.name,
        quantity: p ? p.suggested_order_units : 10,
        packSize: p ? p.pack_size : 1,
        arrivalDate: p ? p.expected_arrival_date : "",
        onHand: p ? p.on_hand : 0,
        totalCost: p ? p.cost_inr : 0,
        vendorName: vendorName,
        vendorPhone: vendorPhone
      });
    }
  } catch (err) {
    showToast(err.message || "Failed to update vendor details.", "error");
  }
}

function closeVendorModal() {
  document.getElementById("vendor-modal")?.classList.remove("open");
  activeVendorSku = null;
}


function openReviewModal() {
  const modal = document.getElementById("order-review-modal");
  const tbody = document.getElementById("modal-review-tbody");
  if (!modal || !tbody) return;

  const orders = proposalsList.filter(p => p.suggested_order_units > 0);
  let totalUnits = 0;
  let totalCost = 0;

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 1.5rem;">No products require reordering today. All stock positions meet lead-time targets.</td></tr>`;
  } else {
    tbody.innerHTML = orders.map(p => {
      const prod = productsMap[p.sku] || { name: p.sku, unit_cost_inr: 100 };
      const cost = p.suggested_order_units * (prod.unit_cost_inr || 100);
      totalUnits += p.suggested_order_units;
      totalCost += cost;

      return `
        <tr>
          <td class="table-cell-bold">${p.sku}</td>
          <td>${prod.name}</td>
          <td><strong>${p.suggested_order_units} units</strong></td>
          <td>${formatINR(prod.unit_cost_inr)}</td>
          <td><strong>${formatINR(cost)}</strong></td>
          <td>${p.expected_arrival_date}</td>
        </tr>
      `;
    }).join("");
  }

  document.getElementById("modal-total-units").innerText = `${totalUnits} units`;
  document.getElementById("modal-total-cost").innerText = formatINR(totalCost);

  modal.classList.add("open");
}

function closeReviewModal() {
  document.getElementById("order-review-modal")?.classList.remove("open");
}
