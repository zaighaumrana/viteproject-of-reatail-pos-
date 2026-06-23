import { state, CFG, SESSION, sb, money, can, ADMIN_MODULES, render, setSession } from "../context.js";
import { applyBranding, currentTenant, scoped, pingUsage, verifyAdminPassword } from "../config.js";
import { saveSession, clearSession, applyAdminLogin, applyEmployeeLogin } from "../session.js";
import { buildReturnSlip, printThermal } from "../print/thermal.js";
import { load } from "./load.js";

// ── Settle Udhar ───────────────────────────────────────────────────
export async function settleUdhar(udharId, amount, method) {
  const rec = state.data.udhar.find(u => u.id === udharId);
  if (!rec) return;
  const history  = rec.payment_history || [];
  history.push({ date: new Date().toISOString().slice(0,10), paid: amount, method });
  const newPaid    = Number(rec.amount_paid) + Number(amount);
  const newBalance = Math.max(0, Number(rec.total_amount) - newPaid);
  const newStatus  = newBalance <= 0 ? "Settled" : "Partial";
  const { error } = await sb.from("udhar").update({
    amount_paid:     newPaid,
    balance_due:     newBalance,
    payment_history: history,
    status:          newStatus,
    settled_at:      newBalance <= 0 ? new Date().toISOString() : null,
  }).eq("id", udharId);
  if (error) { alert("Settle error: " + error.message); return; }
  await load();
  state.modal = { type: "udharList" };
  render();
}

// ── Process Return ─────────────────────────────────────────────────
export async function processReturn(saleId, returnedItems, refundAmount, method, notes) {
  const { error } = await sb.from("returns").insert({
    original_sale_id: saleId,
    returned_items:   returnedItems,
    refund_amount:    refundAmount,
    processed_by:     SESSION.employee?.id || null,
    notes,
  });
  if (error) { alert("Return error: " + error.message); return; }
  printThermal(buildReturnSlip({
    saleId, items: returnedItems, refund: refundAmount, method,
  }));
  state.modal = null;
  await load();
}
