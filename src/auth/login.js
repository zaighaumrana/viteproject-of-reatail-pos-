import { CFG, render, sb, SESSION } from "../context.js";
import { verifyAdminPassword } from "../config.js";
import { applyAdminLogin, applyEmployeeLogin } from "../session.js";
import { verifyPin } from "../data/tickets-ops.js";

export function loginScreen() {
  const preview = loginScreen._preview || null;
  return `
    <div style="min-height:100vh;display:grid;place-items:center;background:var(--bg);padding:16px">
      <div class="card" style="width:min(400px,95vw);display:grid;gap:20px;padding:32px">
        <div style="text-align:center;display:grid;gap:8px">
          <div class="logo" style="margin:0 auto 8px;width:72px;height:72px;font-size:20px;overflow:hidden">
            ${CFG.shop_logo
              ? `<img src="${CFG.shop_logo}" alt="${CFG.shop_name}"
                   style="width:100%;height:100%;object-fit:contain;border-radius:inherit">`
              : CFG.shop_name?.slice(0, 2).toUpperCase() || "FP"}
          </div>
          <h2 style="margin:0">${CFG.shop_name || "RetailOS"}</h2>
          <p class="muted" style="font-size:13px;margin:0">Sign in to continue</p>
        </div>

        ${preview ? `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;
                    background:var(--surface-2);border-radius:10px;
                    border:1px solid var(--border)">
          <div class="logo" style="width:38px;height:38px;font-size:13px;flex-shrink:0">
            ${preview.name.slice(0, 2).toUpperCase()}
          </div>
          <div style="display:grid;gap:2px">
            <strong style="font-size:14px">${preview.name}</strong>
            <span class="muted" style="font-size:12px">${preview.role}</span>
          </div>
          <span class="badge good" style="margin-left:auto;font-size:11px">Found</span>
        </div>` : `
        <div style="height:62px;border-radius:10px;border:1px dashed var(--border);
                    display:grid;place-items:center">
          <span class="muted" style="font-size:13px">Enter password to identify</span>
        </div>`}

        <div style="display:grid;gap:10px">
          <label class="field">
            <span>Password</span>
            <input id="login-password" type="password"
              autocomplete="current-password"
              placeholder="Enter your password"
              minlength="6"
              style="font-size:15px;letter-spacing:2px"
              autofocus>
          </label>
          <div id="login-error" class="hidden"
            style="color:var(--danger);font-size:13px;text-align:center;padding:4px 0">
            Incorrect password. Please try again.
          </div>
          <div id="cf-turnstile-wrap" style="display:flex;justify-content:center;margin:4px 0"></div>
          <button id="login-btn" class="primary-button"
            style="width:100%;font-size:15px;padding:12px;margin-top:2px"
            data-action="login-submit">
            Login
          </button>
        </div>

        <p class="muted" style="text-align:center;font-size:12px;margin:0">
          ${CFG.shop_address || ""}
        </p>
      </div>
    </div>`;
}
loginScreen._preview = null;

async function lookupPassword(val) {
  if (!val || val.length < 6) {
    loginScreen._preview = null;
    return;
  }
  if (await verifyAdminPassword(sb, val)) {
    loginScreen._preview = { name: "Admin", role: "Business Owner", isAdmin: true };
    render();
    return;
  }
  const { data } = await sb
    .from("employees")
    .select("name, role, status")
    .eq("pin_code", val)
    .eq("status", "Active")
    .maybeSingle();
  loginScreen._preview = data ? { name: data.name, role: data.role } : null;
  render();
}

let lookupTimer = null;

export function onPasswordInput(val) {
  clearTimeout(lookupTimer);
  loginScreen._preview = null;
  if (val.length >= 6) {
    lookupTimer = setTimeout(() => lookupPassword(val), 400);
  } else {
    render();
  }
}

export async function submitPin() {
  const input = document.getElementById("login-password");
  const errEl = document.getElementById("login-error");
  const btn = document.getElementById("login-btn");
  const entered = input?.value?.trim() || "";

  if (!entered) {
    if (errEl) {
      errEl.textContent = "Please enter your password.";
      errEl.classList.remove("hidden");
    }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Logging in…";
  }
  if (errEl) errEl.classList.add("hidden");

  if (await verifyAdminPassword(sb, entered)) {
    loginScreen._preview = null;
    applyAdminLogin();
    render();
    return;
  }

  const res = await verifyPin(entered);
  if (res.ok) {
    loginScreen._preview = null;
    applyEmployeeLogin(res.employee);
    render();
  } else {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Login";
    }
    if (errEl) {
      errEl.textContent = "Incorrect password. Please try again.";
      errEl.classList.remove("hidden");
    }
    if (input) {
      input.value = "";
      input.focus();
    }
    loginScreen._preview = null;
  }
}

export function isOnLoginScreen() {
  return !SESSION.employee && !SESSION.loginSkipped;
}
