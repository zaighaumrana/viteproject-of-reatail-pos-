import { state, CFG, SESSION, sb, render } from "../context.js";
import { pingUsage, verifyAdminPassword } from "../config.js";
import { load } from "../data/load.js";
import { createTicket, updateTicket } from "../data/tickets-ops.js";
import { openPinPrompt } from "../auth/pin-prompt.js";
import { processReturn } from "../data/udhar.js";
import { printThermal, buildTicketSlip } from "../print/thermal.js";
import { checkout } from "../cart/index.js";

/* ── Submit ──────────────────────────────────────────────────────── */
document.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form).entries());
  const type = form.dataset.form;

  // ── Repair ticket creation ──────────────────────────────────────
  if (type === "repair") {
    const sel = state.modal?.selectedComponents || [];
    const res = await createTicket({
      customerName:   data.customerName,
      customerPhone:  data.customerPhone,
      deviceBrand:    data.deviceBrand,
      deviceModel:    data.deviceModel,
      imei:           data.imei,
      components:     sel.map(s => ({ name: s.name, condition: s.tag, price: 0 })),
      estimatedQuote: Number(data.estimatedQuote || 0),
      advance:        Number(data.advance        || 0),
      advanceMethod:  data.advanceMethod || "",
      technicianNote: data.technicianNote || "",
    });
    if (!res.ok) { alert("Error saving ticket: " + res.error); return; }
    state.modal = null;
    await pingUsage("REPAIR_TICKET");
    printThermal(buildTicketSlip(res.data));
    await load(); return;
  }

  // ── Udhar customer info (called from checkout flow) ──────────────
  if (type === "udharInfo") {
    state.udharName  = data.udharName;
    state.udharPhone = data.udharPhone;
    state.modal      = null;
    await doCheckout(); return;
  }

  // ── Return: receipt lookup ────────────────────────────────────────
  if (type === "return-lookup") {
    const raw    = data.receiptNo.trim().toUpperCase().replace("INV-", "");
    const sale   = state.data.sales.find(s => String(s.id) === raw);
    if (!sale) {
      state.modal = { type: "returnFlow", notFound: true, receiptNo: data.receiptNo };
      render(); return;
    }
    state.modal = { type: "returnFlow", receiptNo: `INV-${sale.id}` };
    render(); return;
  }

  // ── Return: confirm + admin PIN ───────────────────────────────────
  if (type === "return-confirm") {
    const saleId   = Number(data.saleId);
    const sale     = state.data.sales.find(s => s.id === saleId);
    const items    = sale?.items_sold || [];
    const returned = items.filter((_, i) => data[`ret_${i}`] !== undefined);
    const refund   = returned.reduce((s, it) => s + it.sold_price * it.qty, 0);
    openPinPrompt("return", async () => {
      await processReturn(saleId, returned, refund, data.refundMethod, data.notes || "");
    });
    return;
  }

  // ── Employee save (requires admin PIN) ───────────────────────────
  if (type === "edit-employee") {
    const empId = form.dataset.empId;
    const updates = { name: data.name, role: data.role, status: data.status };
    if (data.pin_code?.trim()) updates.pin_code = String(data.pin_code.trim());
    const { error } = await sb.from("employees").update(updates).eq("id", empId);
    if (error) { alert("Error updating employee: " + error.message); return; }
    state.modal = null;
    await load(); return;
  }

  if (type === "change-admin-password") {
    const currentOk = await verifyAdminPassword(sb, data.current);
    if (!currentOk) {
      alert("Current password is incorrect.");
      return;
    }
    if (!data.newpass?.trim()) { alert("New password cannot be empty."); return; }
    const { error } = await sb.from("shop_config").update({ admin_password: data.newpass }).eq("id", 1);
    if (error) { alert("Error updating password: " + error.message); return; }
    CFG.admin_password = data.newpass;
    alert("Admin password updated successfully.");
    return;
  }

  if (type === "employee") {
    openPinPrompt("admin", async () => {
      const { error } = await sb.from("employees").insert({
        name:     data.name,
        pin_code: String(data.pin_code),
        role:     data.role || "Cashier",
        status:   "Active",
      });
      if (error) { alert("Error saving employee: " + error.message); return; }
      state.modal = null;
      await load();
    });
    return;
  }

  // ── Business settings ─────────────────────────────────────────────
  if (type === "settings") {
    const updates = {};
    // Logo upload — convert to base64 and store in shop_config
const logoFile = form.querySelector('[name="logo"]')?.files?.[0];
if (logoFile) {
  const base64 = await new Promise(res => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(logoFile);
  });
  updates.shop_logo = base64;
}
    if (data.name)          updates.shop_name    = data.name;
    if (data.address)       updates.shop_address = data.address;
    if (data.phone)         updates.shop_phone   = data.phone;
    if (data.primaryColor)  updates.primary_color   = data.primaryColor;
    if (data.secondaryColor)updates.secondary_color = data.secondaryColor;
    if (data.currency)      updates.currency     = data.currency;
    if (data.taxRate)       updates.tax_rate     = Number(data.taxRate);
    if (data.receiptFooter) updates.terms_text   = data.receiptFooter;
    const { error } = await sb.from("shop_config").update(updates).eq("id", 1);
    if (error) { alert("Settings error: " + error.message); return; }
    state.modal = null;
    await load(); return;
  }

  // ── Price override ────────────────────────────────────────────────
  if (type === "override") {
    const item = state.cart.find(i => i.productId === state.modal?.id);
    if (item) {
      item.soldPrice = Number(data.soldPrice);
      item.discount  = Math.max(0, item.originalPrice - item.soldPrice);
      item.reason    = data.reason;
    }
    state.modal = null; render(); return;
  }
if (type === "inv-add") {
    const { error } = await sb.from("inventory").insert({
      name:     data.name,
      sku:      data.sku      || "",
      category: data.category || "General",
      price:    Number(data.price  || 0),
      cost:     Number(data.cost   || 0),
      qty:      Number(data.qty    || 0),
      min_qty:  Number(data.min_qty|| 0),
    });
    if (error) { alert("Error: " + error.message); return; }
    await pingUsage("INVENTORY");
    state.modal = null;
    await load(); return;
  }

  if (type === "inv-edit") {
    const { error } = await sb.from("inventory").update({
      name:     data.name,
      sku:      data.sku,
      category: data.category,
      price:    Number(data.price),
      cost:     Number(data.cost),
      qty:      Number(data.qty),
      min_qty:  Number(data.min_qty),
    }).eq("id", Number(data.id));
    if (error) { alert("Error: " + error.message); return; }
    state.modal = null;
    await load(); return;
  }
  state.modal = null;
  await load();
});
