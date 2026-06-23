import { state, CFG, SESSION, money } from "../context.js";
import { currentTenant } from "../config.js";
import { tit } from "../ui/helpers.js";

/* ═══════════════════════════════════════════════════════════════════
   POS PAGE
═══════════════════════════════════════════════════════════════════ */
export function pos() {
  const tenant   = currentTenant();
  const subtotal = state.cart.reduce((s, i) => s + i.soldPrice * i.qty, 0);
  const disc     = state.cart.reduce((s, i) => s + (i.originalPrice - i.soldPrice) * i.qty, 0);
  const tax      = subtotal * (tenant.taxRate / 100);

  return `
    <div class="page-title">
      <div>
        <h1>Point of Sale</h1>
        <p class="muted">Counter · ${tenant.name}
          ${SESSION.employee ? `· <strong>${SESSION.employee.name}</strong>` : ""}
        </p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="secondary-button" data-action="shift-stats">📋 Shift Stats</button>
        ${tenant.repairModuleEnabled ? `
          <button class="primary-button" data-modal="repair">+ New Ticket</button>
          <button class="secondary-button" data-action="add-ticket-to-cart">Collect Repair</button>
        ` : ""}
        <button class="secondary-button" data-action="open-return">↩ Return</button>
        <button class="secondary-button" data-action="open-udhar">₨ Credits</button>
      </div>
    </div>

    <div class="grid pos-layout">
      <!-- Left: Recent tickets as quick-add if repair module on -->
      <div class="grid" style="align-content:start;gap:12px">
      ${(CFG.quick_items||[]).length ? `
          <div class="card">
            <h2 style="margin-bottom:12px">Quick Items</h2>
            <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px">
              ${(CFG.quick_items||[]).map(item => `
                <button class="secondary-button"
                  style="font-size:15px;padding:11px 18px;border-radius:10px;font-weight:500"
                  data-qitem-name="${item.name}"
                  data-qitem-prices='${JSON.stringify(item.prices)}'>
                  ${item.name}
                </button>`).join("")}
            </div>
            <div style="border-top:1px solid var(--border);padding-top:12px">
              <p style="font-size:12px;font-weight:600;color:var(--muted);
                        text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">
                Custom / One-off Item
              </p>
              <div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:end">
                <label class="field" style="margin:0">
                  <span style="font-size:12px">Item Name</span>
                  <input id="custom-item-name" placeholder="e.g. Screen Guard"
                    style="font-size:13px">
                </label>
                <label class="field" style="margin:0">
                  <span style="font-size:12px">Price</span>
                  <input id="custom-item-price" type="number" min="0"
                    placeholder="0" style="width:90px;font-size:13px">
                </label>
                <button class="primary-button"
                  style="padding:9px 14px;font-size:13px;white-space:nowrap"
                  data-action="add-custom-item">+ Add</button>
              </div>
            </div>
          </div>` : `
          <div class="card">
            <h2 style="margin-bottom:12px">Custom / One-off Item</h2>
            <div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:end">
              <label class="field" style="margin:0">
                <span style="font-size:12px">Item Name</span>
                <input id="custom-item-name" placeholder="e.g. Screen Guard"
                  style="font-size:13px">
              </label>
              <label class="field" style="margin:0">
                <span style="font-size:12px">Price</span>
                <input id="custom-item-price" type="number" min="0"
                  placeholder="0" style="width:90px;font-size:13px">
              </label>
              <button class="primary-button"
                style="padding:9px 14px;font-size:13px;white-space:nowrap"
                data-action="add-custom-item">+ Add</button>
            </div>
          </div>`}  
      ${tenant.repairModuleEnabled ? `
          <div class="card">
            <h2 style="margin-bottom:12px">Open Repair Tickets</h2>
            ${(state.data.tickets || [])
              .filter(t => !["Delivered","Declined"].includes(t.status))
              .slice(0, 8)
              .map(t => `
                <div class="list-row" style="margin-bottom:6px">
                  <div>
                    <strong>${t.customer_name}</strong>
                    <span class="badge warn" style="margin-left:6px">${t.status}</span><br>
                    <small class="muted">${t.ticket_number} · ${t.device_brand} ${t.device_model}</small>
                  </div>
                  <button class="primary-button" style="font-size:12px;padding:6px 10px"
                    data-quick-collect="${t.id}">Collect</button>
                </div>`).join("") ||
              `<div class="empty">No open tickets.</div>`}
          </div>
        ` : `
          <div class="card">
            <h2>Quick Sale</h2>
            <p class="muted" style="font-size:13px">
              Add items to cart using the cart panel.
              Inventory module can be enabled from Platform Admin.
            </p>
          </div>
        `}
      </div>

      <!-- Right: Cart -->
      <aside class="card cart">
        <h2>Cart</h2>
        ${state.cart.length ? state.cart.map(item => `
          <div class="cart-line">
            <div>
              <strong>${item.name}</strong><br>
              <small class="muted">${money(item.soldPrice, tenant.currency)} each
                ${item.reason ? " · " + item.reason : ""}
              </small>
            </div>
            <div class="qty-controls">
              <button data-qty="${item.productId}" data-delta="-1">−</button>
              <strong>${item.qty}</strong>
              <button data-qty="${item.productId}" data-delta="1">+</button>
            </div>
            <button class="secondary-button"
              data-modal="override" data-id="${item.productId}">Price</button>
          </div>`).join("") :
          `<div class="empty">No items in cart.</div>`}

        <div class="totals">
          <div class="total-row">
            <span>Subtotal</span>
            <strong>${money(subtotal, tenant.currency)}</strong>
          </div>
          ${disc > 0 ? `
          <div class="total-row">
            <span>Discounts</span>
            <strong style="color:var(--success)">− ${money(disc, tenant.currency)}</strong>
          </div>` : ""}
          ${tax > 0 ? `
          <div class="total-row">
            <span>Tax ${tenant.taxRate}%</span>
            <strong>${money(tax, tenant.currency)}</strong>
          </div>` : ""}
          <div class="total-row grand">
            <span>Total</span>
            <strong>${money(subtotal + tax, tenant.currency)}</strong>
          </div>
        </div>

        <select class="tenant-switcher" data-action="payment">
          <option ${state.checkoutPayment==="Cash"?"selected":""}>Cash</option>
          <option ${state.checkoutPayment==="Raast"?"selected":""}>Raast</option>
          <option ${state.checkoutPayment==="JazzCash"?"selected":""}>JazzCash</option>
          <option ${state.checkoutPayment==="EasyPaisa"?"selected":""}>EasyPaisa</option>
          <option ${state.checkoutPayment==="Bank Transfer"?"selected":""}>Bank Transfer</option>
          <option ${state.checkoutPayment==="Udhar (Credit)"?"selected":""}>Udhar (Credit)</option>
        </select>

        ${state.checkoutPayment === "Cash" ? (() => {
          const grandTotal = subtotal + tax;
          const tendered   = state.cashTendered || 0;
          const change     = tendered - grandTotal;
          return `
          <div style="display:grid;gap:6px;margin-top:4px">
            <label style="font-size:13px;font-weight:500;color:var(--muted)">Cash Received</label>
            <input type="number" min="0" placeholder="Enter amount received"
              value="${tendered || ""}"
              data-cash-tendered
              style="border:1px solid var(--border);border-radius:8px;padding:9px 12px;
                     background:var(--surface);color:var(--text);font-size:16px;width:100%">
            ${tendered > 0 ? `
            <div style="display:flex;justify-content:space-between;padding:9px 12px;
                        border-radius:8px;font-weight:600;font-size:15px;
                        background:${change >= 0
                          ? "color-mix(in srgb,#22c55e 12%,var(--surface))"
                          : "color-mix(in srgb,#ef4444 12%,var(--surface))"}">
              <span>${change >= 0 ? "Change Due" : "Short by"}</span>
              <span style="color:${change >= 0 ? "#22c55e" : "#ef4444"}">
                ${money(Math.abs(change), tenant.currency)}
              </span>
            </div>` : ""}
          </div>`;
        })() : ""}

        ${state.checkoutPayment === "Udhar (Credit)" ? `
          <div style="display:grid;gap:8px;margin-top:4px">
            <input class="search" placeholder="Customer name *"
              data-udhar="name" value="${state.udharName || ""}">
            <input class="search" placeholder="Customer phone *"
              data-udhar="phone" value="${state.udharPhone || ""}">
          </div>` : ""}

        <button class="primary-button" data-action="checkout"
          ${state.cart.length ? "" : "disabled"}>
          Checkout & Receipt
        </button>
      </aside>
    </div>`;
}

