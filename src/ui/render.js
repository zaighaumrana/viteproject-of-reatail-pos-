import { ADMIN_MODULES, CFG, SESSION, can, state } from "../context.js";
import { applyBranding, currentTenant } from "../config.js";
import { loginScreen } from "../auth/login.js";
import { modal } from "../modals/index.js";
import { pos } from "../pages/pos.js";
import {
  dashboard,
  technicianView,
  repairs,
  inventory,
  reports,
  employees,
  receipts,
} from "../pages/admin.js";
import { settings } from "../pages/settings.js";

export function renderApp() {
  if (!SESSION.employee && !SESSION.loginSkipped) {
    document.getElementById("app").innerHTML = loginScreen();
    const wrap = document.getElementById("cf-turnstile-wrap");
    if (wrap && window.turnstile && !wrap.dataset.mounted) {
      wrap.dataset.mounted = "1";
      window.turnstile.render(wrap, {
        sitekey: "0x4AAAAAADpSVgyGVwxG0uDf",
        theme: state.theme === "dark" ? "dark" : "light",
        callback: () => {
          const btn = document.getElementById("login-btn");
          if (btn) btn.disabled = false;
        },
        "error-callback": () => {
          const btn = document.getElementById("login-btn");
          if (btn) btn.disabled = true;
        },
      });
      const btn = document.getElementById("login-btn");
      if (btn) btn.disabled = true;
    }
    return;
  }

  if (CFG.suspended === true) {
    document.getElementById("app").innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;
                  justify-content:center;height:100vh;gap:16px;text-align:center;padding:24px">
        <div style="font-size:48px">🔒</div>
        <h2 style="color:var(--danger)">Account Suspended</h2>
        <p class="muted" style="max-width:360px;line-height:1.6">
          This RetailOS account has been suspended. Please contact your service provider to restore access.
        </p>
      </div>`;
    return;
  }

  if (SESSION.employee?.role) state.role = SESSION.employee.role;
  if (SESSION.isAdmin) {
    state.role = "Business Owner";
    if (state.route !== "pos" && state.route !== "workshop") {
      state.route = "admin";
      state.adminModule = state.adminModule || "dashboard";
    }
  }

  const active = document.activeElement;
  const focusInfo = active?.dataset?.filter
    ? { filter: active.dataset.filter, start: active.selectionStart, end: active.selectionEnd }
    : null;
  const app = document.getElementById("app");
  const tenant = currentTenant();

  if (state.role === "Cashier" || state.role === "Inventory Staff") {
    if (state.route !== "pos") state.route = "pos";
  } else if (state.role === "Technician") {
    state.route = "workshop";
  } else if (state.role === "Business Owner" || state.role === "Manager" || SESSION.isAdmin) {
    if (!["pos", "admin", "workshop"].includes(state.route)) {
      state.route = "admin";
    }
    if (state.route === "admin") {
      if (!state.adminModule || !can(state.adminModule)) {
        state.adminModule = "dashboard";
      }
    }
  }

  if (!can(state.adminModule)) state.adminModule = "dashboard";

  app.innerHTML = `
    <div class="app-shell client-shell">
      <main class="main">
        <header class="topbar">
          <div class="brand top-brand">
            <div class="logo">${tenant.logo ? `<img alt="" src="${tenant.logo}">` : `${tenant.name.slice(0, 2).toUpperCase()}`}</div>
            <div>
              <strong>${tenant.name}</strong>
              <span class="muted" style="font-size:12px">${state.role} · ${state.route === "pos" ? "POS Counter" : state.route === "workshop" ? "Workshop" : "Back Office"}</span>
            </div>
          </div>
          <div class="top-actions">
            ${state.route === "admin" ? `<select class="tenant-switcher compact-select" data-action="admin-module">${ADMIN_MODULES.filter(([k]) => can(k)).map(([k, , l]) => `<option value="${k}" ${k === state.adminModule ? "selected" : ""}>${l}</option>`).join("")}</select>` : ""}
            ${SESSION.employee ? `
  <span class="chip" style="gap:6px">
    <strong style="font-size:12px">${SESSION.employee.name}</strong>
    <span class="muted" style="font-size:11px">· ${SESSION.employee.role}</span>
  </span>` : ""}
<span class="chip"><i class="dot ${state.online ? (state.syncing ? "syncing" : "") : "offline"}"></i>${state.online ? (state.syncing ? "Syncing" : "Online") : "Offline"}</span>

            ${SESSION.isAdmin || state.role === "Business Owner" ? `
              <button class="${state.route === "pos" ? "primary-button" : "secondary-button"}" data-route="pos">POS</button>
              ${CFG.technician_module_enabled !== false ? `<button class="${state.route === "workshop" ? "primary-button" : "secondary-button"}" data-route="workshop">Workshop</button>` : ""}
              <button class="${state.route === "admin" ? "primary-button" : "secondary-button"}" data-route="admin">Admin</button>
            ` : ""}
            ${state.role === "Manager" ? `
              <button class="${state.route === "admin" ? "primary-button" : "secondary-button"}" data-route="admin">Admin</button>
            ` : ""}
            ${state.role === "Cashier" ? `
              <button class="primary-button" data-route="pos">POS</button>
            ` : ""}
            ${state.role === "Technician" ? `
              <button class="primary-button" data-route="workshop">Workshop</button>
            ` : ""}

            ${state.installPrompt ? `<button class="icon-button" data-action="install">Install</button>` : ""}
            <button class="icon-button" data-action="theme">${state.theme === "dark" ? "Light" : "Dark"}</button>
            <button class="icon-button" data-action="logout" style="color:var(--danger)">Logout</button>
          </div>
        </header>
        <section class="content">${pageContent()}</section>
      </main>
    </div>
    ${modal()}
  `;

  if (focusInfo) {
    const n = document.querySelector(`[data-filter="${focusInfo.filter}"]`);
    n?.focus();
    n?.setSelectionRange?.(focusInfo.start, focusInfo.end);
  }
}

function pageContent() {
  if (state.route === "admin") {
    if (!state.adminModule || !can(state.adminModule)) {
      state.adminModule = "dashboard";
    }
  }
  if (state.route === "pos") return pos();
  if (state.route === "workshop") return technicianView();
  const pages = { dashboard, repairs, inventory, reports, employees, receipts, settings };
  if (!can(state.adminModule)) state.adminModule = "dashboard";
  return adminShell((pages[state.adminModule] || dashboard)());
}

function adminShell(content) {
  const tenant = currentTenant();
  const modLabel = ADMIN_MODULES.find(([k]) => k === state.adminModule)?.[2] || "";
  return `
    <div class="admin-header">
      <div>
        <h1>${modLabel}</h1>
        <p class="muted">${tenant.name}</p>
      </div>
    </div>
    ${content}
  `;
}

export { applyBranding };
