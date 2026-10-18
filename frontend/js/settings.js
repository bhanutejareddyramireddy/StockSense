import { renderAppShell, showToast } from './shared.js?v=3.0';
import { auth } from './auth.js';

const USER_STORAGE_KEY = 'stocksense_current_user';
const ACTIVITY_STORAGE_KEY = 'stocksense_recent_activity';

document.addEventListener("DOMContentLoaded", () => {
  renderAppShell("settings.html", "Settings", "Manage your profile, organization details, and purchase order messaging.");

  loadProfileSettings();
  loadActivityLogs();

  // Live preview bindings
  const liveInputs = [
    "setting-org-name",
    "setting-warehouse",
    "setting-biz-phone",
    "setting-user-name"
  ];
  liveInputs.forEach(id => {
    document.getElementById(id)?.addEventListener("input", updateWhatsAppPreview);
  });

  // Save handler
  document.getElementById("btn-save-settings")?.addEventListener("click", handleSaveSettings);
  document.getElementById("settings-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSaveSettings();
  });

  // Refresh logs button
  document.getElementById("btn-refresh-audit")?.addEventListener("click", () => {
    loadActivityLogs();
    showToast("Activity logs refreshed.", "info");
  });
});

function getCurrentUser() {
  let user = {
    uid: "user-demo-c19",
    email: "planner@stocksense.in",
    displayName: "Rohan Verma",
    organization: "StockSense Retail Hub",
    location: "Central Warehouse, Mumbai",
    phone: "+91 98765 43210",
    businessEmail: "procurement@stocksense.in",
    role: "Regional Inventory Planner"
  };

  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      user = { ...user, ...parsed };
    }
  } catch (e) {
    console.warn("Failed to parse current user:", e);
  }

  return user;
}

function loadProfileSettings() {
  const user = getCurrentUser();

  const orgInput = document.getElementById("setting-org-name");
  const warehouseInput = document.getElementById("setting-warehouse");
  const bizPhoneInput = document.getElementById("setting-biz-phone");
  const bizEmailInput = document.getElementById("setting-biz-email");
  const userNameInput = document.getElementById("setting-user-name");
  const userEmailInput = document.getElementById("setting-user-email");
  const userRoleInput = document.getElementById("setting-user-role");
  const userStatusText = document.getElementById("user-status-text");

  if (orgInput) orgInput.value = user.organization || "StockSense Retail Hub";
  if (warehouseInput) warehouseInput.value = user.location || "Central Warehouse, Mumbai";
  if (bizPhoneInput) bizPhoneInput.value = user.phone || "+91 98765 43210";
  if (bizEmailInput) bizEmailInput.value = user.businessEmail || user.email || "procurement@stocksense.in";
  if (userNameInput) userNameInput.value = user.displayName || "Rohan Verma";
  if (userEmailInput) userEmailInput.value = user.email || "planner@stocksense.in";
  if (userRoleInput) userRoleInput.value = user.role || "Regional Inventory Planner";
  if (userStatusText) userStatusText.innerText = `Verified Workspace: ${user.organization || "StockSense"}`;

  updateWhatsAppPreview();
}

function updateWhatsAppPreview() {
  const org = document.getElementById("setting-org-name")?.value.trim() || "Your Organization";
  const user = document.getElementById("setting-user-name")?.value.trim() || "Buyer Name";
  const loc = document.getElementById("setting-warehouse")?.value.trim() || "Central Warehouse";
  const destStr = loc ? `\n• *Delivery Destination:* ${loc}` : "";

  const preview = 
`📦 *STOCK REPLENISHMENT PURCHASE ORDER*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*To:* Amul Dairy Depot (Primary Supplier)
*From:* ${org} (${user})

Hello! We would like to place an immediate replenishment order:

• *Product:* Fresh Milk 1L (SKU: SKU-PERISH-01)
• *Order Quantity:* 80 units (8 master cartons of 10)
• *Current Stock on Hand:* 12 units
• *Required Delivery By:* Scheduled Date${destStr}
• *Estimated PO Value:* ₹4,800

Please confirm stock availability and dispatch schedule. Thank you!`;

  const el = document.getElementById("settings-whatsapp-preview");
  if (el) el.innerText = preview;
}

function handleSaveSettings() {
  const org = document.getElementById("setting-org-name")?.value.trim();
  const userName = document.getElementById("setting-user-name")?.value.trim();
  const userEmail = document.getElementById("setting-user-email")?.value.trim();
  const warehouse = document.getElementById("setting-warehouse")?.value.trim();
  const bizPhone = document.getElementById("setting-biz-phone")?.value.trim();
  const bizEmail = document.getElementById("setting-biz-email")?.value.trim();
  const role = document.getElementById("setting-user-role")?.value.trim();

  if (!org) {
    showToast("Please enter an Organization / Company Name.", "warning");
    document.getElementById("setting-org-name")?.focus();
    return;
  }

  if (!userName) {
    showToast("Please enter your Full Name.", "warning");
    document.getElementById("setting-user-name")?.focus();
    return;
  }

  const existing = getCurrentUser();
  const updatedUser = {
    ...existing,
    organization: org,
    displayName: userName,
    email: userEmail || existing.email,
    location: warehouse,
    phone: bizPhone,
    businessEmail: bizEmail,
    role: role || existing.role
  };

  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
  if (auth && typeof auth.updateProfile === 'function') {
    auth.updateProfile(updatedUser);
  }

  // Record activity
  recordActivity("SETTINGS_UPDATE", userName, `Updated organization to "${org}" and location to "${warehouse || 'Primary'}".`);

  showToast(`Settings saved! Outgoing WhatsApp orders will now show "${org}".`, "success");

  const userStatusText = document.getElementById("user-status-text");
  if (userStatusText) userStatusText.innerText = `Verified Workspace: ${org}`;

  updateWhatsAppPreview();
  loadActivityLogs();
}

function recordActivity(action, user, details) {
  try {
    let logs = [];
    const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (raw) logs = JSON.parse(raw);

    logs.unshift({
      timestamp: new Date().toLocaleString(),
      action,
      user,
      details
    });

    // Keep up to 20 logs
    if (logs.length > 20) logs = logs.slice(0, 20);
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {
    console.warn("Could not save activity log:", e);
  }
}

function loadActivityLogs() {
  const tbody = document.getElementById("audit-tbody");
  if (!tbody) return;

  let logs = [];
  try {
    const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (raw) logs = JSON.parse(raw);
  } catch (e) {}

  if (!logs || logs.length === 0) {
    const user = getCurrentUser();
    logs = [
      {
        timestamp: new Date().toLocaleString(),
        action: "WORKSPACE_READY",
        user: user.displayName || "Admin",
        details: `Workspace active for ${user.organization || 'StockSense Retail Hub'}. Ready for automated replenishment.`
      },
      {
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toLocaleString(),
        action: "CATALOGUE_SYNC",
        user: "System",
        details: "Inventory position and vendor contacts synchronized."
      }
    ];
  }

  tbody.innerHTML = logs.map(e => `
    <tr>
      <td class="table-cell-bold">${e.timestamp}</td>
      <td><span class="badge badge-neutral">${e.action}</span></td>
      <td><strong>${e.user}</strong></td>
      <td>${e.details}</td>
    </tr>
  `).join("");
}
