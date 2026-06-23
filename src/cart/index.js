import { state, CFG, SESSION, sb, render } from "../context.js";
import { scoped, pingUsage } from "../config.js";
import { updateTicket } from "../data/tickets-ops.js";
import { openPinPrompt } from "../auth/pin-prompt.js";
import { load } from "../data/load.js";

/* ═══════════════════════════════════════════════════════════════════
   CART / CHECKOUT
═══════════════════════════════════════════════════════════════════ */
export function addToCart(productId) {
  const p  = scoped("products").find(x => x.id === productId);
  if (!p) return;
  const ex = state.cart.find(i => i.productId === productId);
  if (ex) ex.qty += 1;
  else state.cart.push({ productId, name: p.name, qty: 1, originalPrice: p.price, soldPrice: p.price, discount: 0, reason: "" });
  render();
}
export function updateQty(productId,delta) {
  const item = state.cart.find(i=>i.productId===productId);
  if (!item) return;
  item.qty += delta;
  state.cart = state.cart.filter(i=>i.qty>0);
  render();
}
/* ── Checkout ─────────────────────────────────────────────────────── */
export async function checkout() {
  const hasDiscount = state.cart.some(i => i.discount > 0);

  // Discount PIN gate
  if (hasDiscount && CFG.discount_pin_required) {
    openPinPrompt("discount", (pin, emp) => {
      if (emp) SESSION.employee = emp;
      doCheckout();
    });
    return;
  }
  // Login-at-checkout gate
  doCheckout();
}

export async function doCheckout() {
  const isUdhar  = state.checkoutPayment === "Udhar (Credit)";
  const tenant   = currentTenant();
  const subtotal = state.cart.reduce((s, i) => s + i.soldPrice * i.qty, 0);
  const discount = state.cart.reduce((s, i) => s + (i.originalPrice - i.soldPrice) * i.qty, 0);
  const labour   = state.cartLabour || 0;
  const tax      = subtotal * (Number(CFG.tax_rate || 0) / 100);
  const advance  = state.cartAdvance || 0;
  const total    = subtotal + labour + tax - advance;

  // Require udhar customer info before proceeding
  if (isUdhar && (!state.udharName?.trim() || !state.udharPhone?.trim())) {
    state.modal = { type: "udharInfo" };
    render();
    return;
  }

  const { data: saleData, error: saleErr } = await sb.from("sales").insert({
    ticket_id:      state.cartTicketId || null,
    customer_name:  state.udharName    || "",
    items_sold:     state.cart.map(i => ({
      name:          i.name,
      qty:           i.qty,
      original_price:i.originalPrice,
      sold_price:    i.soldPrice,
      discount:      i.discount,
      reason:        i.reason || "",
    })),
    labour_cost:    labour,
    discount:       discount,
    tax:            tax,
    total_bill:     Math.max(0, total),
    payment_method: isUdhar ? "Udhar" : state.checkoutPayment,
    employee_id:    SESSION.employee?.id   || null,
    employee_name:  SESSION.employee?.name || "",
    cash_tendered:  state.checkoutPayment === "Cash" ? (state.cashTendered || 0) : 0,
    change_given:   state.checkoutPayment === "Cash" ? Math.max(0, (state.cashTendered || 0) - Math.max(0, total)) : 0,
  }).select().single();

  if (saleErr) { alert("Sale error: " + saleErr.message); return; }

  // If ticket was linked, mark it delivered
  if (state.cartTicketId) {
    await updateTicket(state.cartTicketId, {
      status:    "Delivered",
      settledAt: new Date().toISOString(),
    });
  }

  // If udhar, create credit ledger row
  if (isUdhar) {
    await sb.from("udhar").insert({
      sale_id:        saleData.id,
      customer_name:  state.udharName,
      customer_phone: state.udharPhone,
      total_amount:   Math.max(0, total),
      amount_paid:    0,
      balance_due:    Math.max(0, total),
      payment_history:[],
      status:         "Outstanding",
    });
  }

  // Build receipt object for the modal (uses same shape as before)
  const sale = {
    receiptNo:    `INV-${saleData.id}`,
    date:         saleData.created_at,
    cashier:      SESSION.employee?.name || "Counter",
    customer:     state.udharName || "Walk-in",
    items:        state.cart.map(i => ({...i})),
    subtotal,
    labour,
    tax,
    discount,
    total:        Math.max(0, total),
    payment:      isUdhar ? "Udhar" : state.checkoutPayment,
  };

  // Reset cart state
  state.cart            = [];
  state.cartTicketId    = null;
  state.cartLabour      = 0;
  state.cartAdvance     = 0;
  state.cashTendered    = 0;
  state.udharName       = "";
  state.udharPhone      = "";
  state.checkoutPayment = "Cash";
  state.modal           = { type: "receipt", sale };
  await pingUsage("POS");
  await load();
}
