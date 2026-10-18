import { auth } from './auth.js';
import { api } from './api.js';

// SVG Icons Dictionary (Lucide SVGs)
export const ICONS = {
  box: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
  layoutDashboard: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>`,
  packageSearch: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/><circle cx="18.5" cy="15.5" r="2.5"/><path d="M20.27 17.27 22 19"/></svg>`,
  history: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`,
  trendingUp: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
  shoppingCart: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>`,
  sliders: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="1" x2="7" y1="14" y2="14"/><line x1="9" x2="15" y1="8" y2="8"/><line x1="17" x2="23" y1="16" y2="16"/></svg>`,
  checkCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  fileText: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
  briefcase: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
  settings: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
  alertTriangle: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`,
  helpCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`,
  logIn: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>`,
  logOut: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>`,
  menu: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>`,
  bell: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
  whatsapp: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>`
};

// Formatters
export function formatINR(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return "₹0";
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatUnits(units) {
  if (units === null || units === undefined || isNaN(units)) return "0";
  return new Intl.NumberFormat('en-IN').format(units);
}

export function formatDays(days) {
  if (days === null || days === undefined) return "Infinite (Zero demand)";
  return `${days} days`;
}

// Navigation structure
const NAV_ITEMS = [
  { section: "Core Operations" },
  { title: "Dashboard", href: "dashboard.html", icon: "layoutDashboard" },
  { title: "Products & Inventory", href: "inventory.html", icon: "packageSearch" },
  { title: "Sales History", href: "sales.html", icon: "history" },
  { section: "Planning & Forecasts" },
  { title: "Demand Forecasting", href: "forecasting.html", icon: "trendingUp" },
  { title: "Replenishment Planner", href: "replenishment.html", icon: "shoppingCart" },
  { title: "Risk & Simulator", href: "scenarios.html", icon: "sliders" },
  { section: "Analytics & Reports" },
  { title: "Reports", href: "reports.html", icon: "fileText" },
  { section: "Account" },
  { title: "Settings", href: "settings.html", icon: "settings" },
  { title: "Logout", href: "index.html", icon: "logOut", id: "sidebar-logout-link" }
];

export function renderAppShell(activeHref, pageTitle, pageSubtitle) {
  const currentPath = window.location.pathname.split("/").pop() || "index.html";
  const effectiveActive = activeHref || currentPath;

  const sidebarEl = document.getElementById("app-sidebar");
  const headerEl = document.getElementById("app-header");

  if (sidebarEl) {
    let navHtml = `
      <div class="sidebar-header">
        <div class="brand-icon-wrapper">
          ${ICONS.box}
        </div>
        <div>
          <div class="brand-title">StockSense</div>
          <div class="brand-tagline">Know Your Stock. Plan Ahead.</div>
        </div>
      </div>
      <div class="sidebar-nav">
    `;

    NAV_ITEMS.forEach(item => {
      if (item.section) {
        navHtml += `<div class="nav-section-title">${item.section}</div>`;
      } else {
        const isActive = (effectiveActive === item.href) ? "active" : "";
        const idAttr = item.id ? `id="${item.id}"` : "";
        navHtml += `
          <a href="${item.href}" class="nav-link ${isActive}" ${idAttr}>
            ${ICONS[item.icon] || ""}
            <span>${item.title}</span>
          </a>
        `;
      }
    });

    const rawUser = auth.getUser() || {};
    const displayName = rawUser.displayName || (rawUser.email ? rawUser.email.split('@')[0] : "Planner");
    const role = rawUser.role || "Inventory Planner";
    const avatar = (displayName.length >= 2 ? displayName.substring(0, 2) : (displayName || "PL")).toUpperCase();

    navHtml += `
      </div>
      <div class="sidebar-footer">
        <div class="user-profile-badge">
          <div class="user-avatar">${avatar}</div>
          <div class="user-info">
            <div class="user-name">${displayName}</div>
            <div class="user-role">${role}</div>
          </div>
          <button id="btn-logout" class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 11px;" title="Sign out">Exit</button>
        </div>
      </div>
    `;
    sidebarEl.innerHTML = navHtml;

    document.getElementById("btn-logout")?.addEventListener("click", () => {
      auth.logout();
    });

    document.getElementById("sidebar-logout-link")?.addEventListener("click", (e) => {
      e.preventDefault();
      auth.logout();
    });
  }

  if (headerEl) {
    const isDemo = auth.isDemo;
    headerEl.innerHTML = `
      <div class="header-left">
        <button id="mobile-toggle" class="mobile-nav-toggle" aria-label="Toggle menu">
          ${ICONS.menu}
        </button>
        <div>
          <h1 class="page-title">${pageTitle || "StockSense"}</h1>
        </div>
      </div>
      <div class="header-right">
        <button id="btn-notifications-toggle" class="header-notif-btn" title="Restock & Inventory Notifications">
          ${ICONS.bell}
          <span id="badge-notif-count" class="header-notif-badge" style="display: none;">0</span>
        </button>
      </div>
    `;

    document.getElementById("mobile-toggle")?.addEventListener("click", () => {
      document.querySelector(".app-sidebar")?.classList.toggle("open");
      document.querySelector(".mobile-overlay")?.classList.toggle("open");
    });

    // Initialize global Notification Drawer safely
    try {
      initNotifications();
    } catch (err) {
      console.warn("Notification center initialization error:", err);
    }
  }
}


// Toast Notifications
export function showToast(message, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

// ----------------- WhatsApp Purchase Order Direct Launcher -----------------
export function openWhatsAppOrder({
  sku,
  productName,
  quantity,
  packSize,
  leadDays,
  arrivalDate,
  onHand,
  totalCost,
  vendorName,
  vendorPhone
}) {
  if (!vendorPhone || vendorPhone.trim() === "") {
    showToast(`No WhatsApp phone number configured for ${vendorName || 'this vendor'}. Please configure vendor details first.`, "warning");
    return false;
  }

  // Clean phone number: remove non-digits except initial +
  let cleanPhone = vendorPhone.replace(/[\s\-\(\)]/g, "");
  if (cleanPhone.startsWith("+")) cleanPhone = cleanPhone.substring(1);
  if (/^\d{10}$/.test(cleanPhone)) {
    cleanPhone = "91" + cleanPhone; // Default to India country code
  }

  const packsCount = (packSize && packSize > 1) ? ` (${Math.ceil(quantity / packSize)} cartons/packs of ${packSize})` : "";
  const stockStr = (onHand !== undefined && onHand !== null) ? `\n• *Current Stock on Hand:* ${formatUnits(onHand)} units` : "";
  const etaStr = arrivalDate ? `\n• *Target Delivery ETA:* ${arrivalDate} (${leadDays || 3} days lead time)` : (leadDays ? `\n• *Supplier Lead Time:* ${leadDays} days` : "");
  const costStr = totalCost ? `\n• *Estimated PO Value:* ${formatINR(totalCost)}` : "";
  let orgName = "StockSense Retail Store";
  let buyerName = "";
  let locName = "";
  try {
    const rawUser = localStorage.getItem("stocksense_current_user");
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u.organization && u.organization.trim()) orgName = u.organization.trim();
      if (u.displayName && u.displayName.trim()) buyerName = u.displayName.trim();
      if (u.location && u.location.trim()) locName = u.location.trim();
    }
  } catch (e) {}

  const fromLine = buyerName ? `*From:* ${orgName} (${buyerName})` : `*From:* ${orgName}`;
  const destStr = locName ? `\n• *Delivery Destination:* ${locName}` : "";

  const msg = 
`📦 *STOCK REPLENISHMENT PURCHASE ORDER*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*To:* ${vendorName || 'Supplier'}
${fromLine}

Hello! We would like to place an immediate replenishment order:

• *Product:* ${productName || sku} (SKU: ${sku})
• *Order Quantity:* ${formatUnits(quantity)} units${packsCount}${stockStr}${etaStr}${destStr}${costStr}

Please confirm stock availability and dispatch schedule. Thank you!`;

  const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;
  const win = window.open(url, "_blank");
  if (!win || win.closed || typeof win.closed === "undefined") {
    // Popup was blocked by browser; navigate current tab as fallback
    window.location.href = url;
  }
  showToast(`Opening WhatsApp purchase order for ${sku}...`, "success");
  return true;
}

// ----------------- Global Notification Center -----------------
let globalNotifications = [];
let currentNotificationFilter = "ALL";

export function initNotifications() {
  let drawerBackdrop = document.getElementById("notifications-drawer-backdrop");
  if (!drawerBackdrop) {
    drawerBackdrop = document.createElement("div");
    drawerBackdrop.id = "notifications-drawer-backdrop";
    drawerBackdrop.className = "notifications-drawer-backdrop";
    drawerBackdrop.innerHTML = `
      <div class="notifications-drawer">
        <div class="notif-drawer-header">
          <div class="notif-drawer-title-wrap">
            ${ICONS.bell}
            <div class="notif-drawer-title">Inventory Alerts &amp; Restocks</div>
            <span id="drawer-notif-count" class="badge badge-danger">0</span>
          </div>
          <button id="btn-close-notif-drawer" class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 16px; line-height: 1;" title="Close drawer">&times;</button>
        </div>
        <div class="notif-filter-tabs">
          <button class="notif-tab active" data-tab="ALL">All Alerts</button>
          <button class="notif-tab" data-tab="RESTOCK">Restock Needed</button>
          <button class="notif-tab" data-tab="CRITICAL">Stockouts</button>
          <button class="notif-tab" data-tab="PERISHABLE">Perishables</button>
          <button class="notif-tab" data-tab="OVERSTOCK">Excess Stock</button>
        </div>
        <div class="notif-list-container" id="notif-list-container">
          <div style="padding: 2.5rem 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.8125rem;">
            Analyzing real-time stock positions and restock orders...
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(drawerBackdrop);

    // Event listeners
    document.getElementById("btn-notifications-toggle")?.addEventListener("click", () => {
      openNotificationsDrawer();
    });

    document.getElementById("btn-close-notif-drawer")?.addEventListener("click", () => {
      closeNotificationsDrawer();
    });

    drawerBackdrop.addEventListener("click", (e) => {
      if (e.target === drawerBackdrop) {
        closeNotificationsDrawer();
      }
    });

    drawerBackdrop.querySelectorAll(".notif-tab").forEach(tabBtn => {
      tabBtn.addEventListener("click", () => {
        drawerBackdrop.querySelectorAll(".notif-tab").forEach(b => b.classList.remove("active"));
        tabBtn.classList.add("active");
        currentNotificationFilter = tabBtn.getAttribute("data-tab");
        renderNotifications();
      });
    });
  }

  // Load notifications in background
  loadNotifications();
}

export function openNotificationsDrawer() {
  document.getElementById("notifications-drawer-backdrop")?.classList.add("open");
}

export function closeNotificationsDrawer() {
  document.getElementById("notifications-drawer-backdrop")?.classList.remove("open");
}

export async function loadNotifications() {
  try {
    const [propData, prodsData] = await Promise.all([
      api.getReplenishmentProposals().catch(() => ({ proposals: [] })),
      api.getProducts().catch(() => [])
    ]);

    const prodsMap = {};
    (prodsData || []).forEach(p => { prodsMap[p.sku] = p; });

    const proposals = propData.proposals || [];
    const notifs = [];

    proposals.forEach(p => {
      const prod = prodsMap[p.sku] || { name: p.sku };

      // Helper to compute lost customers and revenue exposure
      const sellingPrice = prod.selling_price_inr || (prod.unit_cost_inr ? prod.unit_cost_inr * 1.35 : 150);
      const shortfallUnits = (p.raw_shortfall && p.raw_shortfall > 0) ? p.raw_shortfall : (p.suggested_order_units || 10);
      const projectedRevenueLoss = Math.round(shortfallUnits * sellingPrice);
      const projectedCustomersLost = Math.max(1, Math.round(shortfallUnits / 1.3));
      const leadTimeDays = p.lead_days || prod.lead_days || 3;

      // 1. Restock proposals
      if (p.suggested_order_units > 0) {
        const isCritical = (p.risk_level && p.risk_level.includes("Critical")) || p.on_hand === 0;
        notifs.push({
          id: `restock-${p.sku}`,
          category: "RESTOCK",
          severity: isCritical ? "critical" : "warning",
          badgeText: isCritical ? "Critical Restock" : "Order Needed",
          title: `Restock Order: ${p.sku} — ${prod.name}`,
          description: `Suggested purchase order of <strong>${p.suggested_order_units} units</strong> required. Current stock (${p.on_hand}u) is below target inventory (${p.target_inventory}u). Expected arrival: ${p.expected_arrival_date}.
          <div style="margin-top: 8px; padding: 7px 10px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; color: #9f1239; font-size: 11.5px; line-height: 1.45;">
            <strong>⚠️ Customer &amp; Revenue Risk:</strong> If you don't restock this product today, you risk losing <strong>~${projectedCustomersLost} customers</strong> and <strong>${formatINR(projectedRevenueLoss)}</strong> in revenue loss before new shipment arrives (${leadTimeDays} days lead time).
          </div>`,
          vendor_name: p.vendor_name || prod.vendor_name || "Primary Supplier",
          vendor_phone: p.vendor_phone || prod.vendor_phone || "+919876543210",
          cost_inr: p.cost_inr || (p.suggested_order_units * (prod.unit_cost_inr || 100)),
          has_whatsapp: true,
          sku: p.sku,
          product_name: prod.name,
          order_units: p.suggested_order_units,
          pack_size: p.pack_size,
          expected_arrival_date: p.expected_arrival_date,
          on_hand: p.on_hand
        });
      }

      // 2. Active Stockouts
      if (p.on_hand === 0) {
        notifs.push({
          id: `stockout-${p.sku}`,
          category: "CRITICAL",
          severity: "critical",
          badgeText: "Out of Stock",
          title: `Zero Stock: ${p.sku} — ${prod.name}`,
          description: `Shelf is completely empty! Any customer demand will result in lost revenue until fresh supply arrives on ${p.expected_arrival_date}.
          <div style="margin-top: 8px; padding: 7px 10px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; color: #9f1239; font-size: 11.5px; line-height: 1.45;">
            <strong>🚨 Immediate Stockout Impact:</strong> If you don't restock this product immediately, you risk losing <strong>~${projectedCustomersLost} customers</strong> and <strong>${formatINR(projectedRevenueLoss)}</strong> in lost sales during the supplier delivery window.
          </div>`,
          vendor_name: p.vendor_name || prod.vendor_name || "Primary Supplier",
          vendor_phone: p.vendor_phone || prod.vendor_phone || "+919876543210",
          cost_inr: p.cost_inr,
          has_whatsapp: p.suggested_order_units > 0,
          sku: p.sku,
          product_name: prod.name,
          order_units: p.suggested_order_units || p.moq || 10,
          pack_size: p.pack_size,
          expected_arrival_date: p.expected_arrival_date,
          on_hand: 0
        });
      }

      // 3. Perishable / Expiry Warnings
      if (p.expiry_status && ["EXPIRED", "CRITICAL_SPOILAGE", "EXPIRING_SOON", "REORDER_BATCH"].includes(p.expiry_status)) {
        const isUrgent = p.expiry_status === "EXPIRED" || p.expiry_status === "CRITICAL_SPOILAGE";
        notifs.push({
          id: `perish-${p.sku}`,
          category: "PERISHABLE",
          severity: isUrgent ? "critical" : "warning",
          badgeText: p.expiry_status.replace(/_/g, " "),
          title: `Perishable Alert: ${p.sku} — ${prod.name}`,
          description: `${p.expiry_action_recommendation || 'Perishable inventory requires rotation.'} Days remaining to expiry: <strong>${p.days_to_expiry ?? 'N/A'} days</strong> (Batch: ${prod.batch_number || 'N/A'}).`,
          vendor_name: p.vendor_name || prod.vendor_name || "Primary Supplier",
          vendor_phone: p.vendor_phone || prod.vendor_phone || "+919876543210",
          has_whatsapp: p.suggested_order_units > 0,
          sku: p.sku,
          product_name: prod.name,
          order_units: p.suggested_order_units,
          pack_size: p.pack_size,
          expected_arrival_date: p.expected_arrival_date,
          on_hand: p.on_hand
        });
      }

      // 4. Overstock / Excess Capital
      if ((p.coverage_days_current && p.coverage_days_current > 60) || p.risk_level === "Overstocked") {
        notifs.push({
          id: `overstock-${p.sku}`,
          category: "OVERSTOCK",
          severity: "info",
          badgeText: "Excess Inventory",
          title: `Capital Tied Up: ${p.sku} — ${prod.name}`,
          description: `Holding current inventory coverage of <strong>${Math.round(p.coverage_days_current || 60)} days</strong>. Holding costs accumulating; purchase orders should remain paused.`,
          vendor_name: p.vendor_name || prod.vendor_name || "Primary Supplier",
          vendor_phone: p.vendor_phone || prod.vendor_phone || "+919876543210",
          has_whatsapp: false,
          sku: p.sku
        });
      }
    });

    globalNotifications = notifs;

    // Update badge in header
    const badgeEl = document.getElementById("badge-notif-count");
    if (badgeEl) {
      if (notifs.length > 0) {
        badgeEl.innerText = notifs.length > 99 ? "99+" : notifs.length;
        badgeEl.style.display = "flex";
      } else {
        badgeEl.style.display = "none";
      }
    }

    const drawerCountEl = document.getElementById("drawer-notif-count");
    if (drawerCountEl) {
      drawerCountEl.innerText = `${notifs.length} Alerts`;
    }

    renderNotifications();
  } catch (err) {
    console.error("Failed to load notifications:", err);
  }
}

function renderNotifications() {
  const container = document.getElementById("notif-list-container");
  if (!container) return;

  const filtered = globalNotifications.filter(n => {
    if (currentNotificationFilter === "ALL") return true;
    return n.category === currentNotificationFilter;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 3rem 1.5rem; text-align: center; color: var(--text-muted);">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎉</div>
        <div style="font-size: 0.875rem; font-weight: 600; color: var(--color-primary-900);">All Clear!</div>
        <p style="font-size: 0.75rem; margin-top: 0.25rem;">No alerts found for this filter tab.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(n => {
    let whatsappBtn = "";
    if (n.has_whatsapp && n.order_units > 0) {
      whatsappBtn = `
        <button class="btn btn-whatsapp btn-sm btn-drawer-whatsapp"
          data-sku="${n.sku}"
          data-name="${n.product_name || n.sku}"
          data-units="${n.order_units}"
          data-pack="${n.pack_size || 1}"
          data-eta="${n.expected_arrival_date || ''}"
          data-stock="${n.on_hand || 0}"
          data-cost="${n.cost_inr || 0}"
          data-vendor-name="${n.vendor_name || ''}"
          data-vendor-phone="${n.vendor_phone || ''}"
          style="padding: 4px 10px; font-size: 11px;">
          ${ICONS.whatsapp}
          <span>Order via WhatsApp</span>
        </button>
      `;
    }

    return `
      <div class="notif-card ${n.severity}">
        <div class="notif-card-header">
          <div class="notif-card-title">${n.title}</div>
          <span class="badge ${n.severity === 'critical' ? 'badge-danger' : (n.severity === 'warning' ? 'badge-warning' : 'badge-info')} notif-card-badge">
            ${n.badgeText}
          </span>
        </div>
        <div class="notif-card-body">${n.description}</div>
        <div class="notif-card-footer">
          <div class="notif-vendor-tag">
            <span>👤 ${n.vendor_name || 'Vendor'}</span>
            ${n.vendor_phone ? `<span style="color: var(--text-muted); font-size: 10px;">(${n.vendor_phone})</span>` : ''}
          </div>
          ${whatsappBtn}
        </div>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".btn-drawer-whatsapp").forEach(btn => {
    btn.addEventListener("click", () => {
      openWhatsAppOrder({
        sku: btn.getAttribute("data-sku"),
        productName: btn.getAttribute("data-name"),
        quantity: parseInt(btn.getAttribute("data-units"), 10),
        packSize: parseInt(btn.getAttribute("data-pack"), 10),
        arrivalDate: btn.getAttribute("data-eta"),
        onHand: parseInt(btn.getAttribute("data-stock"), 10),
        totalCost: parseFloat(btn.getAttribute("data-cost")),
        vendorName: btn.getAttribute("data-vendor-name"),
        vendorPhone: btn.getAttribute("data-vendor-phone")
      });
    });
  });
}
