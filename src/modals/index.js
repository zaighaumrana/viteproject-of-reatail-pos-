import { state, CFG, SESSION, sb, money, can, ADMIN_MODULES, render, setSession } from "../context.js";
import { applyBranding, currentTenant, scoped, pingUsage, verifyAdminPassword } from "../config.js";
import { saveSession, clearSession, applyAdminLogin, applyEmployeeLogin } from "../session.js";
import { pinPromptHTML } from "../auth/pin-prompt.js";
import { fld, modalActions } from "../ui/helpers.js";
import { buildShiftStats, buildReceiptSlip } from "../print/thermal.js";
import { receiptPreview } from "../ui/receipt-preview.js";

/* ═══════════════════════════════════════════════════════════════════
   MODALS
═══════════════════════════════════════════════════════════════════ */
export function modal() {
  if (!state.modal) return "";
  const { type, id } = state.modal;
  const cartItem = state.cart.find(i => i.productId === id);
  const tenant   = currentTenant();

  // Ticket lookup for checkout modal
  const ticket = (state.data.tickets || []).find(t => String(t.id) === String(id));

  const forms = {

    "qitem-pick": (() => {
      const { name, prices } = state.modal;
      if (!prices) return "";
      return `
        <div class="modal" style="max-width:340px">
          <h2>${name}</h2>
          <p class="muted">Select price:</p>
          <div style="display:grid;gap:8px;margin-top:8px">
            ${prices.map((p, i) => `
              <button class="secondary-button" style="font-size:16px;min-height:48px"
                data-pick-price="${i}">
                ${money(p, CFG.currency)}
              </button>`).join("")}
          </div>
          <div class="modal-actions">
            <button class="secondary-button" data-close>Cancel</button>
          </div>
        </div>`;
    })(),

    // ── Repair ticket creation ──────────────────────────────────────
    repair: (() => {
      const comps = CFG.quick_components || [];
      const tags  = ["Repaired","Replaced","New","Cleaned","Checked"];
      const sel   = state.modal?.selectedComponents || [];
      const d     = state.modal?._draft || {};
      const fldV  = (label, name, val="", type="text") =>
        `<label class="field"><span>${label}</span>
          <input name="${name}" type="${type}"
            value="${String(val).replace(/"/g,'&quot;')}"
            placeholder="${label}"
            style="width:100%;border:1px solid var(--border);border-radius:8px;
                   padding:8px 12px;background:var(--surface);color:var(--text)">
        </label>`;
      return `
        <form class="modal" data-form="repair" style="max-width:680px">
          <h2>New Repair Ticket</h2>
          <div class="form-grid">
            ${fldV("Customer Name","customerName", d.customerName)}
            ${fldV("Customer Phone","customerPhone", d.customerPhone, "tel")}
            ${fldV("Device Brand","deviceBrand", d.deviceBrand)}
            ${fldV("Device Model","deviceModel", d.deviceModel)}
            ${fldV("IMEI / Serial","imei", d.imei)}
            ${fldV("Estimated Quote","estimatedQuote", d.estimatedQuote ?? "", "number")}
            ${fldV("Advance Received","advance", d.advance ?? "", "number")}
            <label class="field"><span>Advance Method</span>
              <select name="advanceMethod">
                <option value="">None</option>
                ${["Cash","Raast","JazzCash","EasyPaisa","Bank Transfer"].map(m =>
                  `<option ${d.advanceMethod===m?"selected":""}>${m}</option>`).join("")}
              </select>
            </label>
            <label class="field" style="grid-column:1/-1">
              <span>Technician Note</span>
              <textarea name="technicianNote" style="min-height:56px">${d.technicianNote||""}</textarea>
            </label>
          </div>
          <p class="muted" style="font-size:13px;margin:8px 0 6px">Tap to add issues:</p>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
            ${comps.map(c => {
              const active = sel.find(s => s.name === c);
              return `<button type="button"
                class="${active ? "primary-button" : "secondary-button"}"
                style="font-size:13px;padding:6px 14px"
                data-comp="${c}">${c}${active ? " ✓" : ""}</button>`;
            }).join("")}
          </div>
          ${sel.length ? `<div style="display:grid;gap:6px;margin-bottom:10px">
            ${sel.map((s, i) => `
              <div style="display:flex;align-items:center;gap:8px;padding:8px;
                          background:var(--surface-2);border-radius:8px">
                <strong style="flex:1">${s.name}</strong>
                <select data-comp-tag="${i}"
                  style="border:1px solid var(--border);border-radius:6px;
                         padding:5px 8px;background:var(--surface);color:var(--text)">
                  ${tags.map(t => `<option ${t === s.tag ? "selected" : ""}>${t}</option>`).join("")}
                </select>
                <button type="button" data-remove-comp="${i}"
                  style="color:var(--danger);background:none;border:none;
                         font-size:20px;line-height:1;padding:0 4px">×</button>
              </div>`).join("")}
          </div>` : ""}
          ${modalActions()}
        </form>`;
    })(),

    // ── Ticket Detail — view + update status ────────────────────────
    ticketDetail: (() => {
      if (type !== "ticketDetail") return "";
      const tk = (state.data.tickets || []).find(t => String(t.id) === String(id));
      if (!tk) return `<div class="modal"><p class="muted">Ticket not found.</p>
        <div class="modal-actions"><button class="secondary-button" data-close>Close</button></div></div>`;
      const comps = tk.components_noted || [];
      const statusColors = { "Pending":"warn","In Progress":"warn","Ready":"good","Delivered":"good","Declined":"bad" };
      const statuses = ["Pending","In Progress","Evaluated","Ready","Delivered","Declined"];
      return `
        <div class="modal" style="max-width:600px">
          <h2>${tk.ticket_number}
            <span class="badge ${statusColors[tk.status]||"warn"}" style="margin-left:8px">${tk.status}</span>
          </h2>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;
                      font-size:14px;margin-bottom:14px;padding:12px;
                      background:var(--surface-2);border-radius:8px">
            <div><span class="muted">Customer</span><br><strong>${tk.customer_name}</strong></div>
            <div><span class="muted">Phone</span><br><strong>${tk.customer_phone||"—"}</strong></div>
            <div><span class="muted">Device</span><br><strong>${tk.device_brand} ${tk.device_model}</strong></div>
            <div><span class="muted">IMEI</span><br><strong>${tk.imei||"—"}</strong></div>
            <div><span class="muted">Estimated Quote</span><br><strong>${money(tk.estimated_quote||0, tenant.currency)}</strong></div>
            <div><span class="muted">Advance Paid</span><br><strong>${money(tk.advance_payment||0, tenant.currency)} ${tk.advance_method ? "("+tk.advance_method+")" : ""}</strong></div>
          </div>
          ${tk.technician_note ? `
            <div style="background:color-mix(in srgb,var(--warning) 10%,var(--surface));
                        border-left:3px solid var(--warning);padding:10px 14px;
                        border-radius:0 8px 8px 0;margin-bottom:12px;font-size:14px">
              <strong>Technician Note:</strong> ${tk.technician_note}
            </div>` : ""}
          ${comps.length ? `
            <p class="muted" style="font-size:13px;margin:0 0 6px"><strong>Components:</strong></p>
            <div style="display:grid;gap:6px;margin-bottom:12px">
              ${comps.map(c => `
                <div style="display:flex;justify-content:space-between;align-items:center;
                            padding:8px 12px;background:var(--surface-2);border-radius:8px;font-size:14px">
                  <span><strong>${c.name}</strong> <span class="badge warn" style="font-size:11px">${c.condition||""}</span></span>
                  <span>${c.price > 0 ? money(c.price, tenant.currency) : '<span class="muted">Not priced</span>'}</span>
                </div>`).join("")}
            </div>` : `<p class="muted" style="font-size:13px">No components logged yet.</p>`}
          <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px">
            <p style="font-size:13px;margin:0 0 8px"><strong>Update Status & Actual Quote:</strong></p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <select id="td-status"
                style="border:1px solid var(--border);border-radius:8px;padding:8px 12px;
                       background:var(--surface);color:var(--text);flex:1">
                ${statuses.map(s => `<option ${s===tk.status?"selected":""}>${s}</option>`).join("")}
              </select>
              <input type="number" id="td-actual-quote" placeholder="Actual price (optional)"
                value="${tk.actual_quote||""}"
                style="border:1px solid var(--border);border-radius:8px;padding:8px 12px;
                       background:var(--surface);color:var(--text);width:180px">
            </div>
            <textarea id="td-note" placeholder="Add a note for the customer or next technician…"
              style="width:100%;margin-top:8px;min-height:60px;border:1px solid var(--border);
                     border-radius:8px;padding:8px 12px;background:var(--surface);
                     color:var(--text);box-sizing:border-box">${tk.update_note||""}</textarea>
          </div>
          <div class="modal-actions">
            <button class="secondary-button" data-close>Close</button>
            <button class="primary-button" data-action="save-ticket-detail" data-id="${tk.id}">Save Update</button>
          </div>
        </div>`;
    })(),

    // ── Ticket checkout — fill prices + add components ──────────────
    ticketCheckout: (() => {
      if (!ticket) return `<div class="modal"><p class="muted">Ticket not found.</p>
        <div class="modal-actions"><button class="secondary-button" data-close>Close</button></div></div>`;
      const comps   = ticket.components_noted || [];
      const advance = Number(ticket.advance_payment || 0);
      return `
        <div class="modal" style="max-width:640px">
          <h2>Checkout — ${ticket.ticket_number}</h2>
          <p class="muted">${ticket.customer_name} · ${ticket.device_brand} ${ticket.device_model}</p>
          ${advance > 0 ? `
            <div style="background:color-mix(in srgb,var(--warning) 12%,var(--surface));
                        border:1px solid color-mix(in srgb,var(--warning) 30%,var(--border));
                        border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:8px">
              Advance paid: ${money(advance, tenant.currency)}
              (${ticket.advance_method}) — deducted from total.
            </div>` : ""}
          <div style="display:grid;gap:6px;margin-bottom:10px" id="tc-list">
            ${comps.map((c, i) => `
              <div style="display:flex;align-items:center;gap:8px;padding:9px;
                          background:var(--surface-2);border-radius:8px">
                <span style="flex:1">
                  <strong>${c.name}</strong>
                  <span class="badge warn" style="margin-left:6px">${c.condition || ""}</span>
                </span>
                <input type="number" placeholder="Price" value="${c.price || ""}"
                  data-tc-price="${i}" min="0"
                  style="width:110px;border:1px solid var(--border);border-radius:6px;
                         padding:7px 9px;background:var(--surface);color:var(--text)">
                <button type="button" data-tc-remove="${i}"
                  style="color:var(--danger);background:none;border:none;
                         font-size:20px;line-height:1;padding:0 4px">×</button>
              </div>`).join("")}
          </div>
          <button type="button" class="secondary-button" data-tc-add
            style="font-size:13px;margin-bottom:12px">+ Add Component</button>
          <div style="border-top:1px solid var(--border);padding-top:10px;
                      display:flex;align-items:center;gap:10px">
            <label style="flex:1;font-size:14px">Labour / Technician Cost</label>
            <input type="number" id="tc-labour" value="${state.cartLabour || 0}" min="0"
              style="width:120px;border:1px solid var(--border);border-radius:6px;
                     padding:7px 9px;background:var(--surface);color:var(--text)">
          </div>
          ${advance > 0 ? `
            <div style="display:flex;justify-content:space-between;
                        padding-top:8px;color:var(--success)">
              <span>Advance Deduction</span>
              <strong>− ${money(advance, tenant.currency)}</strong>
            </div>` : ""}
          <div style="display:flex;justify-content:space-between;padding-top:8px;
                      font-size:20px;font-weight:800">
            <span>Total Payable</span>
            <strong id="tc-total">${money(0, tenant.currency)}</strong>
          </div>
          <div class="modal-actions" style="margin-top:12px">
            <button class="secondary-button" data-close>Cancel</button>
            <button class="danger-button" data-tc-decline>Declined by Customer</button>
            <button class="primary-button" data-tc-confirm>Add to Cart</button>
          </div>
        </div>
        <script>
          (function(){
            function recalc(){
              const prices = [...document.querySelectorAll('[data-tc-price]')]
                .map(i => Number(i.value) || 0);
              const labour  = Number(document.getElementById('tc-labour')?.value || 0);
              const advance = ${advance};
              const total   = prices.reduce((s,p) => s+p, 0) + labour - advance;
              const el      = document.getElementById('tc-total');
              if (el) el.textContent = 'Rs. ' + Math.max(0, total).toLocaleString();
            }
            document.querySelectorAll('[data-tc-price], #tc-labour').forEach(el => {
              el.addEventListener('input', recalc);
            });
            recalc();
          })();
        <\/script>`;
    })(),

    // ── Price override ──────────────────────────────────────────────
    override: `
      <form class="modal" data-form="override">
        <h2>Price Override</h2>
        <p class="muted">Original: ${money(cartItem?.originalPrice || 0, tenant.currency)}</p>
        ${fld("Sold Price","soldPrice", cartItem?.soldPrice || 0, "number")}
        <label class="field"><span>Reason for Discount</span>
          <textarea name="reason">${cartItem?.reason || ""}</textarea>
        </label>
        ${modalActions()}
      </form>`,

    // ── Udhar customer info ─────────────────────────────────────────
    udharInfo: `
      <form class="modal" data-form="udharInfo" style="max-width:420px">
        <h2>Credit Sale — Customer Details</h2>
        <p class="muted">Enter customer info before completing the sale.</p>
        <div class="form-grid">
          ${fld("Customer Name","udharName")}
          ${fld("Customer Phone","udharPhone","","tel")}
        </div>
        ${modalActions()}
      </form>`,

    // ── Outstanding credits (Udhar list) ────────────────────────────
    udharList: (() => {
      const outstanding = (state.data.udhar || [])
        .filter(u => u.status !== "Settled");
      return `
        <div class="modal" style="max-width:640px">
          <h2>Outstanding Credits</h2>
          ${outstanding.length === 0
            ? `<div class="empty">No outstanding credits.</div>`
            : `<div style="display:grid;gap:10px">
              ${outstanding.map(u => `
                <div style="padding:12px;background:var(--surface-2);
                            border-radius:8px;display:grid;gap:8px">
                  <div style="display:flex;justify-content:space-between;
                              align-items:flex-start">
                    <div>
                      <strong>${u.customer_name}</strong> · ${u.customer_phone}<br>
                      <small class="muted">INV-${u.sale_id} ·
                        ${new Date(u.created_at).toLocaleDateString()}</small>
                    </div>
                    <span class="badge ${u.status === "Settled" ? "good" : "bad"}">
                      ${u.status}
                    </span>
                  </div>
                  <div style="display:flex;justify-content:space-between">
                    <span>Balance: <strong>${money(u.balance_due, tenant.currency)}</strong></span>
                    <span class="muted">Total: ${money(u.total_amount, tenant.currency)}</span>
                  </div>
                  <div style="display:flex;gap:8px;align-items:center">
                    <input type="number" placeholder="Amount to settle"
                      data-settle-amount="${u.id}" min="1"
                      style="flex:1;border:1px solid var(--border);border-radius:6px;
                             padding:7px 9px;background:var(--surface);color:var(--text)">
                    <select data-settle-method="${u.id}"
                      style="border:1px solid var(--border);border-radius:6px;
                             padding:7px 9px;background:var(--surface);color:var(--text)">
                      <option>Cash</option><option>Raast</option>
                      <option>JazzCash</option><option>EasyPaisa</option>
                      <option>Bank Transfer</option>
                    </select>
                    <button class="primary-button" data-settle-id="${u.id}">Settle</button>
                  </div>
                </div>`).join("")}
            </div>`}
          <div class="modal-actions">
            <button class="secondary-button" data-close>Close</button>
          </div>
        </div>`;
    })(),

    // ── Return flow ─────────────────────────────────────────────────
    returnFlow: (() => {
      const receiptInput = state.modal?.receiptNo || "";
      const saleId       = receiptInput.replace("INV-","");
      const sale         = (state.data.sales || [])
        .find(s => String(s.id) === String(saleId));

      if (!sale) return `
        <form class="modal" data-form="return-lookup" style="max-width:440px">
          <h2>Process Return</h2>
          <p class="muted">Enter the invoice number from the original receipt.</p>
          ${fld("Invoice No. (e.g. INV-42)","receiptNo", receiptInput)}
          ${state.modal?.notFound
            ? `<p style="color:var(--danger);font-size:13px">Invoice not found.</p>`
            : ""}
          <div class="modal-actions">
            <button class="secondary-button" data-close>Cancel</button>
            <button class="primary-button">Look Up</button>
          </div>
        </form>`;

      const items = sale.items_sold || [];
      return `
        <form class="modal" data-form="return-confirm" style="max-width:560px">
          <h2>Return — INV-${sale.id}</h2>
          <p class="muted">${sale.customer_name || "Walk-in"} ·
            ${new Date(sale.created_at).toLocaleDateString()}</p>
          <div style="display:grid;gap:8px;margin:10px 0">
            ${items.map((item, i) => `
              <label style="display:flex;align-items:center;gap:10px;padding:10px;
                            background:var(--surface-2);border-radius:8px">
                <input type="checkbox" name="ret_${i}" value="${i}" checked>
                <span style="flex:1">${item.name} × ${item.qty}</span>
                <strong>${money(item.sold_price * item.qty, tenant.currency)}</strong>
              </label>`).join("")}
          </div>
          <label class="field"><span>Refund Method</span>
            <select name="refundMethod">
              <option>Cash</option><option>Raast</option>
              <option>JazzCash</option><option>EasyPaisa</option>
              <option>Bank Transfer</option>
            </select>
          </label>
          <label class="field"><span>Notes</span>
            <textarea name="notes"></textarea>
          </label>
          <input type="hidden" name="saleId" value="${sale.id}">
          <div class="modal-actions">
            <button class="secondary-button" data-close>Cancel</button>
            <button class="primary-button">Process Return</button>
          </div>
        </form>`;
    })(),

    // ── Receipt ─────────────────────────────────────────────────────
    receipt: (() => {
      if (type !== "receipt") return "";
      return `
      <div class="modal">
        <h2>Receipt</h2>
        ${receiptPreview(state.modal?.sale)}
        <div class="modal-actions">
          <button class="secondary-button" data-close>Close</button>
          <button class="primary-button" data-action="print-receipt">Print / Save PDF</button>
        </div>
      </div>`;
    })(),

    // ── Shift stats ─────────────────────────────────────────────────
    shiftStats: (() => {
      if (type !== "shiftStats") return "";
      return `
      <div class="modal" style="max-width:480px">
        <h2>Shift Stats</h2>
        <div class="shift-print-wrap">${buildShiftStats()}</div>
        <div class="modal-actions">
          <button class="secondary-button" data-close>Close</button>
          <button class="primary-button" data-action="print-shift">Print / Save PDF</button>
        </div>
      </div>`;
    })(),

        // ── Employee add/edit ───────────────────────────────────────────
    employee: (() => {
      if (state.modal?.type === "ticket-editor") {
    const tk = state.data.tickets.find(t => String(t.id) === String(state.modal.id));
    if (!tk) return "";
    const comps = tk.components_noted || [];
    const partsTotal  = comps.reduce((s, c) => s + Number(c.price || 0), 0);
    const labourVal   = state.teLabour ?? Number(tk.estimated_quote - partsTotal) ?? 0;
    const grandTotal  = partsTotal + (isNaN(labourVal) ? 0 : labourVal);
    return `<div class="modal-backdrop" data-close>
      <div class="modal" style="max-width:500px;max-height:85vh;overflow-y:auto"
           onclick="event.stopPropagation()">
        <h2 style="margin-bottom:4px">${tk.customer_name}</h2>
        <p class="muted" style="font-size:13px;margin-bottom:16px">
          ${tk.ticket_number} · ${tk.device_brand} ${tk.device_model}
        </p>
        <div style="display:grid;gap:8px;margin-bottom:14px">
          <strong style="font-size:13px">Components</strong>
          ${comps.map((c, i) => `
            <div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center">
              <span style="font-size:13px">${c.name}
                <small class="muted">(${c.condition})</small></span>
              <input type="number" min="0"
                id="te-price-${i}"
                value="${c.price || 0}"
                style="width:100px;border:1px solid var(--border);border-radius:6px;
                       padding:5px 8px;background:var(--surface);color:var(--text);font-size:13px"
                data-te-price="${i}">
              <button type="button" data-te-remove="${i}"
                style="color:var(--danger);background:none;border:none;
                       font-size:18px;cursor:pointer;padding:0 4px">×</button>
            </div>`).join("")}
          ${comps.length === 0 ? `<p class="muted" style="font-size:13px">No components yet.</p>` : ""}
        </div>
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <input id="te-new-comp" class="search" placeholder="Component name" style="flex:1">
          <select id="te-new-cond"
            style="border:1px solid var(--border);border-radius:6px;padding:7px 9px;
                   background:var(--surface);color:var(--text);font-size:13px">
            ${["Repaired","Replaced","New","Cleaned","Checked"].map(c =>
              `<option>${c}</option>`).join("")}
          </select>
          <button type="button" class="secondary-button" data-action="te-add-comp">+ Add</button>
        </div>
        <label style="display:flex;justify-content:space-between;align-items:center;
                      padding:10px;background:var(--surface-2);border-radius:8px;
                      margin-bottom:8px;gap:12px">
          <span style="font-size:13px;font-weight:500">Labour Charge</span>
          <input type="number" min="0" id="te-labour" value="${labourVal < 0 ? 0 : labourVal}"
            style="width:110px;border:1px solid var(--border);border-radius:6px;
                   padding:5px 8px;background:var(--surface);color:var(--text);font-size:13px"
            data-te-labour>
        </label>
        <div style="display:flex;justify-content:space-between;font-weight:600;
                    padding:10px;background:var(--surface-2);border-radius:8px;margin-bottom:16px">
          <span>Updated Quote</span>
          <span id="te-total">${money(grandTotal, CFG.currency)}</span>
        </div>
        <div class="modal-actions">
          <button class="secondary-button" data-close>Cancel</button>
          <button class="primary-button" data-action="te-save">Save to Ticket</button>
        </div>
      </div>
    </div>`;
  }

      if (state.modal?.type === "edit-employee") {
        const e = state.modal;
        return `<form class="modal" data-form="edit-employee" style="max-width:420px" data-emp-id="${e.id}">
          <h2>Edit Employee</h2>
          <div class="form-grid">
            <label class="field"><span>Name</span>
              <input name="name" value="${e.name}" required></label>
            <label class="field"><span>New PIN (leave blank to keep)</span>
              <input name="pin_code" type="password" autocomplete="off" maxlength="6" placeholder="••••"></label>
            <label class="field"><span>Role</span>
              <select name="role">
                ${["Business Owner","Manager","Cashier","Technician"].map(r =>
                  `<option ${r===e.role?"selected":""}>${r}</option>`).join("")}
              </select></label>
            <label class="field"><span>Status</span>
              <select name="status">
                <option ${e.status==="Active"?"selected":""}>Active</option>
                <option ${e.status==="Inactive"?"selected":""}>Inactive</option>
              </select></label>
          </div>
          <div class="modal-actions">
            <button type="button" class="secondary-button" data-close>Cancel</button>
            <button class="primary-button">Save Changes</button>
          </div>
        </form>`;
      }
      return `
        <form class="modal" data-form="employee" style="max-width:440px">
          <h2>Add Employee</h2>
          <p class="muted" style="font-size:13px">Admin PIN will be required to save.</p>
          <div class="form-grid">
            ${fld("Full Name","name")}
            ${fld("4-digit PIN","pin_code","","number")}
            <label class="field"><span>Role</span>
              <select name="role">
                <option>Cashier</option>
                <option>Technician</option>
                <option>Admin</option>
              </select>
            </label>
          </div>
          ${modalActions()}
        </form>`;
    })(),

    // ── PIN prompt ──────────────────────────────────────────────────
    pinPrompt: pinPromptHTML(state.modal?.purpose),

"inv-add": `
      <form class="modal" data-form="inv-add" style="max-width:500px">
        <h2>Add Inventory Item</h2>
        <div class="form-grid">
          ${fld("Name","name")}
          ${fld("SKU","sku")}
          ${fld("Category","category","General")}
          ${fld("Selling Price","price","0","number")}
          ${fld("Cost Price","cost","0","number")}
          ${fld("Quantity","qty","0","number")}
          ${fld("Min Stock Alert","min_qty","0","number")}
        </div>
        ${modalActions()}
      </form>`,

    "inv-edit": (() => {
      const item = (state.data.inventory || [])
        .find(p => String(p.id) === String(id));
      if (!item) return `<div class="modal"><p>Not found.</p>
        <div class="modal-actions">
          <button class="secondary-button" data-close>Close</button>
        </div></div>`;
      return `
        <form class="modal" data-form="inv-edit" style="max-width:500px">
          <h2>Edit Item</h2>
          <input type="hidden" name="id" value="${item.id}">
          <div class="form-grid">
            ${fld("Name","name",item.name)}
            ${fld("SKU","sku",item.sku)}
            ${fld("Category","category",item.category)}
            ${fld("Selling Price","price",item.price,"number")}
            ${fld("Cost Price","cost",item.cost,"number")}
            ${fld("Quantity","qty",item.qty,"number")}
            ${fld("Min Stock Alert","min_qty",item.min_qty,"number")}
          </div>
          ${modalActions()}
        </form>`;
    })(),
  };

  return `<div class="modal-backdrop">${forms[type] || ""}</div>`;
}
