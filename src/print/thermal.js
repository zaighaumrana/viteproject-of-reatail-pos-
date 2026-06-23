import { CFG, money, SESSION, state } from "../context.js";
import { currentTenant } from "../config.js";

/* ── Print helper ───────────────────────────────────────────────── */
export function printThermal(contentHtml) {
  const old = document.getElementById("thermal-frame");
  if (old) old.remove();
  const iframe = document.createElement("iframe");
  iframe.id    = "thermal-frame";
  Object.assign(iframe.style, {
    position:"fixed", top:"-9999px", left:"-9999px",
    width:"80mm", height:"1px", border:"none",
  });
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      *    { box-sizing:border-box; margin:0; padding:0; }
      body { font-family:'Courier New',Courier,monospace; font-size:12px;
             color:#000; background:#fff; width:80mm; padding:4mm; line-height:1.6; }
      .c   { text-align:center; }
      .b   { font-weight:bold; }
      .r   { text-align:right; }
      .lg  { font-size:15px; font-weight:bold; }
      .sm  { font-size:10px; color:#555; }
      .row { display:flex; justify-content:space-between; }
      .ln  { border-top:1px dashed #000; margin:5px 0; }
      .bw  { text-align:center; margin:6px 0; }
      @page { margin:0; size:80mm auto; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
  </head><body>
    ${contentHtml}
    <script>
      window.addEventListener('load', function() {
        if (typeof JsBarcode !== 'undefined') {
          document.querySelectorAll('.bc').forEach(function(el) {
            try {
              JsBarcode(el, el.dataset.val,
                { format:'CODE128', width:1.4, height:38, displayValue:false });
            } catch(e) {}
          });
        }
        setTimeout(function(){ window.print(); }, 400);
      });
    <\/script>
  </body></html>`);
  doc.close();
}

export function buildTicketSlip(ticket) {
  const comps = ticket.components_noted || [];
  return `
    ${CFG.shop_logo
  ? `<div class="c" style="margin-bottom:4px">
       <img src="${CFG.shop_logo}"
         style="max-width:140px;max-height:50px;object-fit:contain">
     </div>`
  : ""}
<div class="c b lg">${CFG.shop_name || "Repair Shop"}</div>
    <div class="c sm">${CFG.shop_address || ""}</div>
    <div class="c sm">${CFG.shop_phone   || ""}</div>
    <div class="ln"></div>
    <div class="c b">REPAIR TICKET</div>
    <div class="c lg">${ticket.ticket_number}</div>
    <div class="bw"><svg class="bc" data-val="${ticket.ticket_number}"></svg></div>
    <div class="ln"></div>
    <div class="row"><span>Customer</span><span>${ticket.customer_name}</span></div>
    <div class="row"><span>Phone</span><span>${ticket.customer_phone}</span></div>
    <div class="row"><span>Device</span>
      <span>${ticket.device_brand} ${ticket.device_model}</span></div>
    ${ticket.imei
      ? `<div class="row"><span>IMEI</span><span class="sm">${ticket.imei}</span></div>`
      : ""}
    <div class="row"><span>Date</span>
      <span>${new Date(ticket.created_at).toLocaleDateString()}</span></div>
    <div class="ln"></div>
    <div class="b">Issues Noted:</div>
    ${comps.length
      ? comps.map(c =>
          `<div class="row">
            <span>· ${c.name}</span>
            <span class="sm">${c.condition || ""}</span>
          </div>`).join("")
      : `<div class="sm">No components noted yet.</div>`}
    <div class="ln"></div>
    <div class="row">
      <span>Estimated Quote</span>
      <span>${money(ticket.estimated_quote, CFG.currency)}</span>
    </div>
    ${Number(ticket.advance_payment) > 0 ? `
    <div class="row">
      <span>Advance Paid</span>
      <span>${money(ticket.advance_payment, CFG.currency)}
        (${ticket.advance_method})</span>
    </div>` : ""}
    <div class="ln"></div>
    ${ticket.technician_note
      ? `<div class="sm">Note: ${ticket.technician_note}</div><div class="ln"></div>`
      : ""}
    ${CFG.terms_text
      ? `<div class="c sm">${CFG.terms_text}</div><div class="ln"></div>`
      : ""}
    <div class="c sm">Thank you for your trust.</div>`;
}

export function buildReceiptSlip(sale) {
  const items = sale.items || [];
  return `
    ${CFG.shop_logo
  ? `<div class="c" style="margin-bottom:4px">
       <img src="${CFG.shop_logo}"
         style="max-width:140px;max-height:50px;object-fit:contain">
     </div>`
  : ""}
<div class="c b lg">${CFG.shop_name || "Repair Shop"}</div>
    <div class="c sm">${CFG.shop_address || ""}</div>
    <div class="c sm">${CFG.shop_phone   || ""}</div>
    <div class="ln"></div>
    <div class="c b">RECEIPT</div>
    <div class="c">${sale.receiptNo}</div>
    <div class="bw"><svg class="bc" data-val="${sale.receiptNo}"></svg></div>
    <div class="ln"></div>
    <div class="row"><span>Date</span>
      <span>${new Date(sale.date || sale.created_at || Date.now())
        .toLocaleDateString()}</span></div>
    ${sale.customer
      ? `<div class="row"><span>Customer</span><span>${sale.customer}</span></div>`
      : ""}
    ${sale.cashier
      ? `<div class="row"><span>Cashier</span><span>${sale.cashier}</span></div>`
      : ""}
    <div class="ln"></div>
    ${items.map(i => `
      <div class="row">
        <span>${i.name}</span>
        <span>${money(i.soldPrice * i.qty, CFG.currency)}</span>
      </div>
      <div class="sm row">
        <span>  ${i.qty} × ${money(i.soldPrice, CFG.currency)}
          ${i.discount > 0 ? ` (disc ${money(i.discount, CFG.currency)})` : ""}
        </span>
      </div>`).join("")}
    <div class="ln"></div>
    ${Number(sale.discount) > 0
      ? `<div class="row"><span>Discount</span>
           <span>${money(sale.discount, CFG.currency)}</span></div>` : ""}
    ${Number(sale.labour) > 0
      ? `<div class="row"><span>Labour</span>
           <span>${money(sale.labour, CFG.currency)}</span></div>` : ""}
    ${Number(sale.tax) > 0
      ? `<div class="row"><span>Tax</span>
           <span>${money(sale.tax, CFG.currency)}</span></div>` : ""}
    <div class="row b lg">
      <span>TOTAL</span>
      <span>${money(sale.total, CFG.currency)}</span>
    </div>
    <div class="row"><span>Payment</span><span>${sale.payment}</span></div>
    <div class="ln"></div>
    <div class="c sm">${CFG.terms_text || "Thank you for your business."}</div>`;
}

export function buildReturnSlip(data) {
  return `
    <div class="c b lg">${CFG.shop_name || "Retail Shop"}</div>
    <div class="c sm">${CFG.shop_address || ""}</div>
    <div class="ln"></div>
    <div class="c b">RETURN / REFUND</div>
    <div class="ln"></div>
    <div class="row"><span>Original Invoice</span><span>INV-${data.saleId}</span></div>
    <div class="row"><span>Date</span>
      <span>${new Date().toLocaleDateString()}</span></div>
    <div class="ln"></div>
    ${data.items.map(i =>
      `<div class="row">
        <span>${i.name} × ${i.qty}</span>
        <span>${money(i.sold_price * i.qty, CFG.currency)}</span>
      </div>`).join("")}
    <div class="ln"></div>
    <div class="row b lg">
      <span>REFUND</span>
      <span>${money(data.refund, CFG.currency)}</span>
    </div>
    <div class="row"><span>Method</span><span>${data.method}</span></div>
    <div class="ln"></div>
    <div class="c sm">Please retain this slip for your records.</div>`;
}

export function buildShiftStats() {
  const tenant = currentTenant();
  const todayStr = new Date().toISOString().slice(0, 10);
  const empName = SESSION.employee?.name || "";
  const allSales = state.data.sales || [];
  const allTickets = state.data.tickets || [];

  const shiftSales = allSales.filter(
    (s) =>
      (s.created_at || "").slice(0, 10) === todayStr &&
      (!empName || s.employee_name === empName),
  );

  const itemsSold = shiftSales.reduce(
    (s, sale) => s + (sale.items_sold || []).reduce((x, i) => x + (i.qty || 1), 0),
    0,
  );
  const cashEarned = shiftSales.reduce((s, sale) => s + Number(sale.total_bill || 0), 0);
  const cashOnly = shiftSales
    .filter((s) => s.payment_method === "Cash")
    .reduce((s, sale) => s + Number(sale.total_bill || 0), 0);
  const discounts = shiftSales.reduce((s, sale) => s + Number(sale.discount || 0), 0);
  const custCount = new Set(shiftSales.map((s) => s.customer_name).filter(Boolean)).size;

  const shiftTkts = allTickets.filter(
    (t) =>
      (t.created_at || "").slice(0, 10) === todayStr &&
      (!empName || t.created_by === empName),
  );
  const pendingAll = allTickets.filter((t) => !["Delivered", "Declined"].includes(t.status));
  const processed = shiftTkts.filter((t) => t.status === "Delivered");
  const stillPend = shiftTkts.filter((t) => !["Delivered", "Declined"].includes(t.status));

  return `
    <div class="shift-print">
      <center>
        <strong style="font-size:15px">${tenant.name}</strong><br>
        Shift Summary — ${todayStr}<br>
        ${empName || "All Staff"}
      </center>
      <hr style="border:none;border-top:1px dashed #bbb;margin:8px 0">
      <div class="section-head">Sales</div>
      <div class="stat-row"><span class="stat-label">Products sold</span><span class="stat-val">${itemsSold}</span></div>
      <div class="stat-row"><span class="stat-label">Total revenue</span><span class="stat-val">${money(cashEarned, tenant.currency)}</span></div>
      <div class="stat-row"><span class="stat-label">Cash collected</span><span class="stat-val">${money(cashOnly, tenant.currency)}</span></div>
      <div class="stat-row"><span class="stat-label">Discounts given</span><span class="stat-val">${money(discounts, tenant.currency)}</span></div>
      <div class="stat-row"><span class="stat-label">Customers served</span><span class="stat-val">${custCount}</span></div>
      ${tenant.repairModuleEnabled ? `
        <hr style="border:none;border-top:1px dashed #bbb;margin:8px 0">
        <div class="section-head">Repair Tickets</div>
        <div class="stat-row"><span class="stat-label">Created this shift</span><span class="stat-val">${shiftTkts.length}</span></div>
        <div class="stat-row"><span class="stat-label">Delivered this shift</span><span class="stat-val">${processed.length}</span></div>
        <div class="stat-row"><span class="stat-label">Pending from this shift</span><span class="stat-val">${stillPend.length}</span></div>
        <div class="stat-row"><span class="stat-label">All pending (shop-wide)</span><span class="stat-val">${pendingAll.length}</span></div>
      ` : ""}
      <hr style="border:none;border-top:1px dashed #bbb;margin:8px 0">
      <center style="color:#888;font-size:11px">Printed ${new Date().toLocaleString()}</center>
    </div>`;
}
