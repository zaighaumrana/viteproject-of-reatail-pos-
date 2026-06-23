import { money } from "../context.js";
import { currentTenant } from "../config.js";

export function receiptPreview(sale) {
  if (!sale) return "";
  const t     = currentTenant();
  const items = sale.items || [];
  return `
    <div class="receipt-preview">
      <center>
        ${t.logo ? `<img src="${t.logo}" style="max-width:120px;max-height:44px;object-fit:contain;margin-bottom:6px"><br>` : ""}
        <strong>${t.name}</strong><br>${t.address || ""}<br>${t.phone || ""}
      </center>
      <hr>
      Receipt: ${sale.receiptNo || "—"}<br>
      Date: ${sale.date ? new Date(sale.date).toLocaleString() : new Date().toLocaleString()}<br>
      Cashier: ${sale.cashier || "Counter"}<br>
      Customer: ${sale.customer || "Walk-in"}
      <hr>
      ${items.map(i => `${i.name}<br><small>${i.qty} × ${money(i.soldPrice, t.currency)}${i.discount > 0 ? ` (disc ${money(i.discount, t.currency)})` : ""}</small>`).join("<br>")}
      <hr>
      ${sale.discount > 0 ? `Discount: ${money(sale.discount, t.currency)}<br>` : ""}
      ${sale.tax > 0 ? `Tax: ${money(sale.tax, t.currency)}<br>` : ""}
      <strong>Total: ${money(sale.total, t.currency)}</strong><br>
      Payment: ${sale.payment || "—"}
      <hr>
      <center>${t.receiptFooter || ""}</center>
    </div>`;
}

export async function fileToDataUrl(file) {
  if (!file) return "";
  return new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(file); });
}
