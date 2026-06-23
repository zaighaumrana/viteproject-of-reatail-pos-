import { state, CFG, SESSION, sb, money, can, ADMIN_MODULES, render, setSession } from "../context.js";
import { applyBranding, currentTenant, scoped, pingUsage, verifyAdminPassword } from "../config.js";
import { saveSession, clearSession, applyAdminLogin, applyEmployeeLogin } from "../session.js";
import { verifyPin } from "../data/tickets-ops.js";

// ── PIN prompt modal (discount / checkout / admin / settle / return) ──
let ppBuffer   = "";
let ppPurpose  = "";
let ppCallback = null;

export function openPinPrompt(purpose, callback) {
  ppBuffer   = "";
  ppPurpose  = purpose;
  ppCallback = callback;
  state.modal = { type: "pinPrompt", purpose };
  render();
}

export function pinPromptHTML(purpose) {
  const label = {
    admin:    "Admin password required",
    settle:   "Admin PIN to settle credit",
    return:   "Admin PIN to process return",
    checkout: "Enter your employee PIN",
    discount: "PIN required to apply discount",
  }[purpose] || "Verify identity";
  return `
    <div class="modal" style="max-width:340px">
      <h2>${label}</h2>
      <div id="pp-display"
        style="text-align:center;font-size:30px;letter-spacing:16px;min-height:48px;
               border-bottom:2px solid var(--border);padding-bottom:8px;margin:10px 0">····</div>
      <div id="pp-error" class="hidden"
        style="color:var(--danger);text-align:center;font-size:13px;margin-bottom:8px">
        Wrong PIN.
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        ${[1,2,3,4,5,6,7,8,9,"⌫",0,"✓"].map(k=>`
          <button class="secondary-button"
            style="font-size:20px;min-height:50px"
            data-pp-key="${k}">${k}</button>`).join("")}
      </div>
      <div class="modal-actions" style="margin-top:10px">
        <button class="secondary-button" data-close>Cancel</button>
      </div>
    </div>`;
}

export function handlePpKey(key) {
  const display = document.getElementById("pp-display");
  const errEl   = document.getElementById("pp-error");
  if (!display) return;
  if (key === "⌫") {
    ppBuffer = ppBuffer.slice(0, -1);
  } else if (key === "✓") {
    submitPp(); return;
  } else {
    if (ppBuffer.length >= 4) return;
    ppBuffer += String(key);
  }
  display.textContent = "●".repeat(ppBuffer.length).padEnd(4, "·");
  if (errEl) errEl.classList.add("hidden");
  if (ppBuffer.length === 4) submitPp();
}

export function resetPinPrompt() {
  ppBuffer = "";
  ppPurpose = "";
  ppCallback = null;
}

export async function submitPp() {
  const pin = ppBuffer;
  ppBuffer  = "";
  let res;
  if (["admin","settle","return"].includes(ppPurpose)) {
    res = (await verifyAdminPassword(sb, pin)) ? { ok: true } : { ok: false };
    if (res.ok) { state.modal = null; ppCallback && ppCallback(pin, null); }
  } else {
    res = await verifyPin(pin);
    if (res.ok) { state.modal = null; ppCallback && ppCallback(pin, res.employee); }
  }
  if (!res.ok) {
    const errEl   = document.getElementById("pp-error");
    const display = document.getElementById("pp-display");
    if (errEl)   errEl.classList.remove("hidden");
    if (display) display.textContent = "····";
  }
}
