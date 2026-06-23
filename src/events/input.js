import { state, CFG, money, render } from "../context.js";

/* ── Input ───────────────────────────────────────────────────────── */
document.addEventListener("input", event => {
  if (event.target.dataset.filter) {
    state.filter = event.target.value; render();
  }
  // Ticket editor live total
  if (event.target.dataset.tePrice !== undefined || event.target.dataset.teLabour !== undefined) {
    const prices = [...document.querySelectorAll("[data-te-price]")]
      .reduce((s, inp) => s + (Number(inp.value) || 0), 0);
    const labour = Number(document.getElementById("te-labour")?.value || 0);
    const totalEl = document.getElementById("te-total");
    if (totalEl) totalEl.textContent = money(prices + labour, CFG.currency);
  }
  // Cash tendered live change calculation
  if (event.target.dataset.cashTendered !== undefined) {
    state.cashTendered = Number(event.target.value) || 0;
    render();
  }
});
