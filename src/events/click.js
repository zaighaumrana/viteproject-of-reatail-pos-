import { state, CFG, SESSION, sb, money, can, ADMIN_MODULES, render, setSession } from "../context.js";
import { applyBranding, currentTenant, scoped, pingUsage, verifyAdminPassword } from "../config.js";
import { clearSession, saveSession } from "../session.js";
import { submitPin } from "../auth/login.js";
import { handlePpKey, openPinPrompt } from "../auth/pin-prompt.js";
import { load } from "../data/load.js";
import { createTicket, updateTicket } from "../data/tickets-ops.js";
import { checkout, addToCart, updateQty } from "../cart/index.js";
import { printThermal, buildShiftStats, buildReceiptSlip } from "../print/thermal.js";
import { settleUdhar } from "../data/udhar.js";

/* ═══════════════════════════════════════════════════════════════════
   EVENT DELEGATION
═══════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════
   EVENT DELEGATION
═══════════════════════════════════════════════════════════════════ */
document.addEventListener("click", async event => {
  const el = event.target.closest(
    "button,[data-route],[data-add-cart],[data-category]," +
    "[data-modal],[data-close],[data-settings-tab]," +
    "[data-pin-key],[data-pp-key],[data-comp],[data-remove-comp]," +
    "[data-tc-add],[data-tc-remove],[data-tc-decline],[data-tc-confirm]," +
    "[data-settle-id],[data-action],[data-remove-quick],[data-quick-collect]," +
    "[data-inv-edit],[data-inv-delete],[data-remove-qitem],[data-add-qprice]," +
    "[data-remove-qprice],[data-qitem-name],[data-pick-price],[data-view-ticket]," +
    "[data-kpi-target]"
  );
  if (!el) return;

  // ── KPI tile drill-down ──────────────────────────────────────────
  if (el.dataset.kpiTarget) {
    const target = el.dataset.kpiTarget;
    if (target === "udharList") { state.modal = { type: "udharList" }; render(); return; }
    if (["dashboard","repairs","inventory","reports","receipts","employees","settings"].includes(target)) {
      state.route = "admin"; state.adminModule = target; render(); return;
    }
    if (target === "pos") { state.route = "pos"; render(); return; }
    return;
  }

    // ── Quick collect from ticket list on POS ────────────────────────
  if (el.dataset.quickCollect) {
    const found = state.data.tickets.find(t => String(t.id) === String(el.dataset.quickCollect));
    if (!found) return;
    state.cartTicketId = found.id;
    state.cartAdvance  = Number(found.advance_payment || 0);
    state.modal        = { type: "ticketCheckout", id: String(found.id) };
    render(); return;
  }
if (el.dataset.removeQuick !== undefined) {
  const comps = [...(CFG.quick_components || [])];
  comps.splice(Number(el.dataset.removeQuick), 1);
  CFG.quick_components = comps;
  render(); return;
}

if (el.dataset.action === "add-quick-comp") {
  const input = document.getElementById("new-comp-input");
  const val   = input?.value?.trim();
  if (!val) return;
  CFG.quick_components = [...(CFG.quick_components || []), val];
  render(); return;
}

if (el.dataset.action === "save-quick-comps") {
  const { error } = await sb.from("shop_config")
    .update({ quick_components: CFG.quick_components })
    .eq("id", 1);
  if (error) { alert("Save failed: " + error.message); return; }
  alert("Components saved.");
  await load(); return;
}
  // ── Navigation ──────────────────────────────────────────────────
  // ── Workshop: Collect → POS (loads ticket checkout modal, switches to POS) ──
  if (el.dataset.action === "workshop-collect") {
    const ticketId = el.dataset.ticketId;
    const found = state.data.tickets.find(t => String(t.id) === String(ticketId));
    if (!found) return;
    state.cartTicketId = found.id;
    state.cartAdvance  = Number(found.advance_payment || 0);
    state.modal        = { type: "ticketCheckout", id: String(found.id) };
    state.route        = "pos";
    render(); return;
  }

  if (el.dataset.route) {
    state.route = el.dataset.route; state.filter = ""; render(); return;
  }
  if (el.dataset.settingsTab) {
    state.settingsTab = el.dataset.settingsTab; render(); return;
  }

  // ── Theme ────────────────────────────────────────────────────────
  if (el.dataset.action === "theme") {
    state.theme = state.theme === "dark" ? "light" : "dark";
    localStorage.setItem("retailos-theme", state.theme);
    applyBranding(); render(); return;
  }

  // ── PWA install ──────────────────────────────────────────────────
  if (el.dataset.action === "install" && state.installPrompt) {
    state.installPrompt.prompt();
    state.installPrompt = null; render(); return;
  }

  // ── Login screen PIN pad ─────────────────────────────────────────
  if (el.dataset.action === "login-submit") {
    submitPin(); return;
  }
  if (el.dataset.action === "skip-login") {
    return; // disabled — login is now mandatory
  }
  if (el.dataset.action === "edit-employee") {
    state.modal = {
      type:   "edit-employee",
      id:     el.dataset.empId,
      name:   el.dataset.empName,
      role:   el.dataset.empRole,
      status: el.dataset.empStatus,
    };
    render(); return;
  }

  if (el.dataset.action === "remove-employee") {
    const name = el.dataset.empName || "this employee";
    if (!confirm(`Remove ${name}? This cannot be undone.`)) return;
    const empId = el.dataset.empId;
    const { error } = await sb.from("employees").delete().eq("id", empId);
    if (error) { alert("Error removing employee: " + error.message); return; }
    await sb.from("active_sessions").delete().eq("employee_id", String(empId));
    await load(); return;
  }


  if (el.dataset.action === "open-ticket-editor") {
    const ticketId = el.dataset.ticketId;
    const tk = state.data.tickets.find(t => String(t.id) === String(ticketId));
    if (!tk) return;
    const partsTotal = (tk.components_noted || []).reduce((s,c) => s + Number(c.price||0), 0);
    state.teLabour = Math.max(0, Number(tk.estimated_quote || 0) - partsTotal);
    state.modal = { type: "ticket-editor", id: ticketId };
    render(); return;
  }
  // ── Ticket Editor: add component ─────────────────────────────────
  if (el.dataset.action === "te-add-comp") {
    const name = document.getElementById("te-new-comp")?.value?.trim();
    const cond = document.getElementById("te-new-cond")?.value || "New";
    if (!name) return;
    const tk = state.data.tickets.find(t => String(t.id) === String(state.modal?.id));
    if (!tk) return;
    // snapshot current prices before re-render
    document.querySelectorAll("[data-te-price]").forEach((inp, i) => {
      if (tk.components_noted[i]) tk.components_noted[i].price = Number(inp.value) || 0;
    });
    state.teLabour = Number(document.getElementById("te-labour")?.value || 0);
    tk.components_noted = [...tk.components_noted, { name, condition: cond, price: 0 }];
    render(); return;
  }

  // ── Ticket Editor: remove component ──────────────────────────────
  if (el.dataset.teRemove !== undefined) {
    const tk = state.data.tickets.find(t => String(t.id) === String(state.modal?.id));
    if (!tk) return;
    document.querySelectorAll("[data-te-price]").forEach((inp, i) => {
      if (tk.components_noted[i]) tk.components_noted[i].price = Number(inp.value) || 0;
    });
    state.teLabour = Number(document.getElementById("te-labour")?.value || 0);
    tk.components_noted.splice(Number(el.dataset.teRemove), 1);
    render(); return;
  }

  // ── Ticket Editor: save to Supabase ──────────────────────────────
  if (el.dataset.action === "te-save") {
    const tk = state.data.tickets.find(t => String(t.id) === String(state.modal?.id));
    if (!tk) return;
    document.querySelectorAll("[data-te-price]").forEach((inp, i) => {
      if (tk.components_noted[i]) tk.components_noted[i].price = Number(inp.value) || 0;
    });
    const labour     = Number(document.getElementById("te-labour")?.value || 0);
    const partsTotal = tk.components_noted.reduce((s, c) => s + Number(c.price || 0), 0);
    const newQuote   = partsTotal + labour;
    const { error }  = await sb.from("tickets").update({
      components_noted: tk.components_noted,
      estimated_quote:  newQuote,
    }).eq("id", tk.id);
    if (error) { alert("Save failed: " + error.message); return; }
    tk.estimated_quote = newQuote;
    state.teLabour = null;
    state.modal    = null;
    await load(); return;
  }
  if (el.dataset.action === "add-custom-item") {
    const name  = document.getElementById("custom-item-name")?.value?.trim();
    const price = parseFloat(document.getElementById("custom-item-price")?.value || "0");
    if (!name)    { alert("Enter an item name."); return; }
    if (price <= 0) { alert("Enter a valid price."); return; }
    state.cart.push({
      id:            `custom-${Date.now()}`,
      name:          name,
      productName:   name,
      soldPrice:     price,
      originalPrice: price,
      qty:           1,
      isCustom:      true,
    });
    // Clear inputs
    const ni = document.getElementById("custom-item-name");
    const pi = document.getElementById("custom-item-price");
    if (ni) ni.value = "";
    if (pi) pi.value = "";
    render(); return;
  }
  if (el.dataset.action === "tech-status") {
    const { error } = await sb.from("tickets")
      .update({ status: el.dataset.status })
      .eq("id", el.dataset.ticketId);
    if (error) { alert(error.message); return; }
    const tk = state.data.tickets.find(t => String(t.id) === String(el.dataset.ticketId));
    if (tk) tk.status = el.dataset.status;
    render(); return;
  }
  if (el.dataset.action === "toggle-receipt") {
    const id = Number(el.dataset.receiptId);
    state.receiptsExpanded = state.receiptsExpanded === id ? null : id;
    render(); return;
  }

  if (el.dataset.action === "logout") {
    if (!confirm("Log out of RetailOS?")) return;
    clearSession();
    setSession({ employee: null, isAdmin: false, loginSkipped: false });
    state.role = "Business Owner";
    state.route = "pos";
    render(); return;
  }

  // ── PIN prompt pad ───────────────────────────────────────────────
  if (el.dataset.ppKey !== undefined) {
    handlePpKey(el.dataset.ppKey); return;
  }

  // ── Modal open / close ───────────────────────────────────────────
  if (el.dataset.modal) {
    state.modal = { type: el.dataset.modal, id: el.dataset.id };
    render(); return;
  }
  if (el.dataset.close !== undefined) {
    state.modal = null; render(); return;
  }

  // ── Cart ─────────────────────────────────────────────────────────
  if (el.dataset.category) {
    state.category = el.dataset.category; render(); return;
  }
  if (el.dataset.addCart) {
    addToCart(el.dataset.addCart); return;
  }
  if (el.dataset.qty) {
    updateQty(el.dataset.qty, Number(el.dataset.delta)); return;
  }

  // ── Checkout ─────────────────────────────────────────────────────
  if (el.dataset.action === "checkout") {
    await checkout(); return;
  }

  // ── Add ticket to cart by ID lookup ─────────────────────────────
  if (el.dataset.action === "add-ticket-to-cart") {
    const raw = prompt("Enter Ticket Number (e.g. FP-2026-1234):");
    if (!raw) return;
    const found = state.data.tickets.find(
      t => t.ticket_number.toUpperCase() === raw.trim().toUpperCase()
    );
    if (!found) { alert("Ticket not found."); return; }
    if (["Delivered","Declined"].includes(found.status)) {
      alert(`Ticket is already marked as ${found.status}.`); return;
    }
    state.cartTicketId  = found.id;
    state.cartAdvance   = Number(found.advance_payment || 0);
    state.modal         = { type: "ticketCheckout", id: String(found.id) };
    render(); return;
  }

  // ── Shift stats ──────────────────────────────────────────────────
  if (el.dataset.action === "shift-stats") {
    state.modal = { type: "shiftStats" }; render(); return;
  }
  if (el.dataset.action === "print-shift") {
    printThermal(buildShiftStats()); return;
  }
  if (el.dataset.action === "print-receipt") {
    if (state.modal?.sale) printThermal(buildReceiptSlip(state.modal.sale));
    return;
  }

  // ── Reprint from receipts archive ───────────────────────────────
  if (el.dataset.action === "reprint-receipt") {
    const saleId = Number(el.dataset.saleId);
    const sale   = state.data.sales.find(s => s.id === saleId);
    if (!sale) { alert("Sale not found."); return; }
    let parts = [];
    if (sale.ticket_id) {
      const tk = state.data.tickets.find(t => t.id === sale.ticket_id);
      if (tk) parts = (tk.components_noted || []).filter(c => c.name);
    }
    const reprSale = {
      receiptNo: `INV-${sale.id}`,
      date:      sale.created_at,
      cashier:   sale.employee_name || "Counter",
      customer:  sale.customer_name || "Walk-in",
      items:     (sale.items_sold || []).map(i => ({
        name:          i.name,
        qty:           i.qty || 1,
        soldPrice:     i.sold_price || i.soldPrice || 0,
        originalPrice: i.original_price || i.originalPrice || 0,
        discount:      i.discount || 0,
        reason:        i.reason || "",
      })),
      parts,
      labour:  sale.labour_cost || 0,
      discount: sale.discount   || 0,
      tax:      sale.tax        || 0,
      total:    sale.total_bill || 0,
      payment:  sale.payment_method || "—",
    };
    printThermal(buildReceiptSlip(reprSale, true));
    return;
  }


  if (el.dataset.action === "new-sale") {
    state.route = "pos"; render(); return;
  }

  // ── View ticket detail ───────────────────────────────────────────
  const viewTicketEl = el.closest("[data-view-ticket]");
  if (viewTicketEl && el.tagName !== "BUTTON" && !el.closest("button")) {
    state.modal = { type: "ticketDetail", id: String(viewTicketEl.dataset.viewTicket) };
    render(); return;
  }

  // ── Save ticket detail update ─────────────────────────────────────
  if (el.dataset.action === "save-ticket-detail") {
    const ticketId   = el.dataset.id;
    const newStatus  = document.getElementById("td-status")?.value;
    const actualQuote = Number(document.getElementById("td-actual-quote")?.value || 0);
    const note       = document.getElementById("td-note")?.value || "";
    const updates = { status: newStatus, update_note: note };
    if (actualQuote > 0) updates.actual_quote = actualQuote;
    const { error } = await sb.from("tickets")
      .update(updates).eq("id", ticketId);
    if (error) { alert("Update failed: " + error.message); return; }
    state.modal = null;
    await load(); return;
  }

  // ── Repair component tap buttons ─────────────────────────────────
  if (el.dataset.comp !== undefined) {
    const name = el.dataset.comp;
    const sel  = state.modal.selectedComponents || [];
    const idx  = sel.findIndex(s => s.name === name);
    if (idx >= 0) sel.splice(idx, 1);
    else sel.push({ name, tag: "Repaired", price: 0 });
    state.modal.selectedComponents = sel;
    // Save typed field values so render() doesn't wipe them
    const form = document.querySelector("[data-form='repair']");
    if (form) {
      const fd = new FormData(form);
      state.modal._draft = Object.fromEntries(fd.entries());
    }
    render(); return;
  }
  if (el.dataset.removeComp !== undefined) {
    const sel = state.modal.selectedComponents || [];
    sel.splice(Number(el.dataset.removeComp), 1);
    state.modal.selectedComponents = sel;
    const form = document.querySelector("[data-form='repair']");
    if (form) {
      const fd = new FormData(form);
      state.modal._draft = Object.fromEntries(fd.entries());
    }
    render(); return;
  }

  // ── Ticket checkout: add component inline ────────────────────────
  if (el.dataset.tcAdd !== undefined) {
    const name = prompt("Component name:");
    if (!name) return;
    const ticket = state.data.tickets.find(t => String(t.id) === String(state.modal?.id));
    if (ticket) {
      // Read current prices from DOM inputs and write them back FIRST
      document.querySelectorAll("[data-tc-price]").forEach((inp, i) => {
        if (ticket.components_noted[i]) ticket.components_noted[i].price = Number(inp.value) || 0;
      });
      // Also save labour so it survives re-render
      const labourEl = document.getElementById("tc-labour");
      if (labourEl) state.cartLabour = Number(labourEl.value) || 0;
      ticket.components_noted = [...ticket.components_noted, { name, condition: "New", price: 0 }];
    }
    render(); return;
  }
  if (el.dataset.tcRemove !== undefined) {
    const ticket = state.data.tickets.find(t => String(t.id) === String(state.modal?.id));
    if (ticket) {
      // Save current prices before removing
      document.querySelectorAll("[data-tc-price]").forEach((inp, i) => {
        if (ticket.components_noted[i]) ticket.components_noted[i].price = Number(inp.value) || 0;
      });
      const labourEl = document.getElementById("tc-labour");
      if (labourEl) state.cartLabour = Number(labourEl.value) || 0;
      ticket.components_noted.splice(Number(el.dataset.tcRemove), 1);
    }
    render(); return;
  }

  // ── Ticket checkout: declined ────────────────────────────────────
  if (el.dataset.tcDecline !== undefined) {
    const reason = prompt("Reason customer declined repair:");
    if (reason === null) return;
    await updateTicket(state.modal.id, { status: "Declined", declineReason: reason });
    state.modal = null;
    await load(); return;
  }

  // ── Ticket checkout: confirm → add to cart ───────────────────────
  if (el.dataset.tcConfirm !== undefined) {
    const ticket  = state.data.tickets.find(t => String(t.id) === String(state.modal?.id));
    if (!ticket) return;
    const comps   = ticket.components_noted || [];
    const priceEls = document.querySelectorAll("[data-tc-price]");
    priceEls.forEach((inp, i) => {
      if (comps[i]) comps[i].price = Number(inp.value) || 0;
    });
    const labour  = Number(document.getElementById("tc-labour")?.value || 0);
    const advance = Number(ticket.advance_payment || 0);
    const parts   = comps.reduce((s, c) => s + Number(c.price || 0), 0);
    const total   = Math.max(0, parts + labour - advance);

    // Save updated components back to Supabase
    await updateTicket(ticket.id, { components: comps });

    state.cartLabour   = labour;
    state.cartAdvance  = advance;
    state.cartTicketId = ticket.id;

    // Add as single line item in cart
    state.cart.push({
      productId:     `ticket-${ticket.id}`,
      name:          `Repair: ${ticket.device_brand} ${ticket.device_model} (${ticket.ticket_number})`,
      qty:           1,
      originalPrice: total,
      soldPrice:     total,
      discount:      0,
      reason:        "",
      isTicket:      true,
    });
    state.modal = null;
    render(); return;
  }

  // ── Settle Udhar ─────────────────────────────────────────────────
  if (el.dataset.settleId) {
    const udharId = Number(el.dataset.settleId);
    const amount  = Number(
      document.querySelector(`[data-settle-amount="${udharId}"]`)?.value
    );
    const method  = document.querySelector(
      `[data-settle-method="${udharId}"]`
    )?.value || "Cash";
    if (!amount || amount <= 0) { alert("Enter a valid amount."); return; }
    openPinPrompt("settle", async () => {
      await settleUdhar(udharId, amount, method);
    });
    return;
  }

  // ── Open udhar list / return flow ────────────────────────────────
  if (el.dataset.action === "open-udhar") {
    state.modal = { type: "udharList" }; render(); return;
  }
  if (el.dataset.action === "open-return") {
    state.modal = { type: "returnFlow" }; render(); return;
  }

  // ── Quick items ──────────────────────────────────────────────────
  if (el.dataset.qitemName) {
    const prices = JSON.parse(el.dataset.qitemPrices || "[]");
    const name   = el.dataset.qitemName;
    if (prices.length === 1) {
      // only one price — add directly
      state.cart.push({
        productId:     `qi-${name}-${Date.now()}`,
        name,
        qty:           1,
        originalPrice: prices[0],
        soldPrice:     prices[0],
        discount:      0,
        reason:        "",
      });
      render();
    } else {
      // show price picker
      state.modal = { type: "qitem-pick", name, prices };
      render();
    }
    return;
  }

  if (el.dataset.action === "add-qitem") {
    const input = document.getElementById("qitem-name");
    const val   = input?.value?.trim();
    if (!val) return;
    CFG.quick_items = [...(CFG.quick_items||[]), { name: val, prices: [] }];
    render(); return;
  }
  if (el.dataset.action === "save-qitems") {
    const { error } = await sb.from("shop_config")
      .update({ quick_items: CFG.quick_items }).eq("id", 1);
    if (error) { alert("Save failed: " + error.message); return; }
    alert("Quick items saved.");
    await load(); return;
  }
  if (el.dataset.removeQitem !== undefined) {
    const items = [...(CFG.quick_items||[])];
    items.splice(Number(el.dataset.removeQitem), 1);
    CFG.quick_items = items;
    render(); return;
  }
  if (el.dataset.addQprice !== undefined) {
    const idx   = Number(el.dataset.addQprice);
    const input = document.getElementById(`qprice-input-${idx}`);
    const val   = Number(input?.value);
    if (!val || val <= 0) return;
    CFG.quick_items[idx].prices.push(val);
    render(); return;
  }
  if (el.dataset.removeQprice !== undefined) {
    const [i, pi] = el.dataset.removeQprice.split("-").map(Number);
    CFG.quick_items[i].prices.splice(pi, 1);
    render(); return;
  }

  // ── Quick item price picker (when multiple prices) ───────────────
  if (el.dataset.pickPrice !== undefined) {
    const { name, prices } = state.modal;
    const price = prices[Number(el.dataset.pickPrice)];
    state.cart.push({
      productId:     `qi-${name}-${Date.now()}`,
      name,
      qty:           1,
      originalPrice: price,
      soldPrice:     price,
      discount:      0,
      reason:        "",
    });
    state.modal = null;
    render(); return;
  }

  // ── Inventory ────────────────────────────────────────────────────
  if (el.dataset.invEdit) {
    state.modal = { type: "inv-edit", id: el.dataset.invEdit };
    render(); return;
  }
  if (el.dataset.invDelete) {
    if (!confirm("Delete this item?")) return;
    const { error } = await sb.from("inventory")
      .delete().eq("id", Number(el.dataset.invDelete));
    if (error) { alert("Error: " + error.message); return; }
    await load(); return;
  }
});
