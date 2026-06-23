import { state, render, can } from "../context.js";

/* ── Change ──────────────────────────────────────────────────────── */
document.addEventListener("change", async event => {
  const t = event.target;
  if (!t) return;

  if (t.dataset.action === "admin-module") {
    state.adminModule = t.value; 
    state.filter = ""; 
    render(); 
    return;
  }
  if (t.dataset.action === "role") {
    state.role = t.value;
    state.adminModule = can(state.adminModule) ? state.adminModule : "dashboard";
    render(); return;
  }
  if (t.dataset.action === "payment") {
    state.checkoutPayment = t.value; 
    state.cashTendered = 0; 
    render(); return;
  }
  if (t.dataset.udhar === "name")  { state.udharName  = t.value; return; }
  if (t.dataset.udhar === "phone") { state.udharPhone = t.value; return; }

  // Component tag change inside repair modal
  if (t.dataset.compTag !== undefined) {
    const sel = state.modal?.selectedComponents || [];
    const idx = Number(t.dataset.compTag);
    if (sel[idx]) {
      sel[idx].tag = t.value;
      const form = document.querySelector("[data-form='repair']");
      if (form) {
        const fd = new FormData(form);
        state.modal._draft = Object.fromEntries(fd.entries());
      }
      render();
    }
    return;
  }
});
