import { state, CFG, SESSION, sb, money, can, ADMIN_MODULES, render, setSession } from "../context.js";
import { applyBranding, currentTenant, scoped, pingUsage, verifyAdminPassword } from "../config.js";
import { saveSession, clearSession, applyAdminLogin, applyEmployeeLogin } from "../session.js";
import { tit, tlb, tbl, statusBadge, stockBadge, productName } from "../ui/helpers.js";

/* ═══════════════════════════════════════════════════════════════════
   ADMIN PAGES
═══════════════════════════════════════════════════════════════════ */
export function dashboard() {
  const tenant  = currentTenant();
  const sales   = state.data.sales   || [];
  const tickets = state.data.tickets || [];
  const udhar   = state.data.udhar   || [];
  const todayStr = new Date().toISOString().slice(0,10);
  const todayS   = sales.filter(s => (s.created_at||"").slice(0,10) === todayStr);
  const total    = sales.reduce((s,x) => s + Number(x.total_bill||0), 0);
  const todayRev = todayS.reduce((s,x) => s + Number(x.total_bill||0), 0);
  const pending  = tickets.filter(t => !["Delivered","Declined"].includes(t.status)).length;
  const udharBal = udhar.filter(u => u.status !== "Settled")
                        .reduce((s,u) => s + Number(u.balance_due||0), 0);
  const kpis = [
    ["Today's Revenue",  todayRev,          "receipts"],
    ["Total Revenue",    total,             "receipts"],
    ["Total Sales",      sales.length,      "receipts"],
    ["Open Tickets",     pending,           "repairs"],
    ["Udhar Balance",    udharBal,          "udharList"],
    ["Employees",        (state.data.employees||[]).length, "employees"],
  ];
  return `
    ${tit("Dashboard","Live overview of sales, tickets, and operations.",
      `<button class="primary-button" data-action="new-sale">Go to POS</button>`)}
    <div class="grid kpi-grid">
      ${kpis.map(([l,v,target]) => `
        <div class="card kpi" style="cursor:pointer" data-kpi-target="${target}">
          <span class="label">${l}</span>
          <span class="value">${typeof v === "number" && l !== "Total Sales" && l !== "Open Tickets" && l !== "Employees"
            ? money(v, tenant.currency) : v}</span>
        </div>`).join("")}
    </div>
    <div class="grid two-col">
      <div class="card">
        <h2>Recent Sales</h2>
        <div class="table-wrap"><table>
          <thead><tr>
            <th>Invoice</th><th>Customer</th><th>Payment</th><th>Total</th>
          </tr></thead>
          <tbody>
            ${sales.slice(0,8).map(s => `<tr>
              <td>INV-${s.id}</td>
              <td>${s.customer_name || "Walk-in"}</td>
              <td>${s.payment_method}</td>
              <td>${money(s.total_bill, tenant.currency)}</td>
            </tr>`).join("")}
          </tbody>
        </table></div>
      </div>
      <div class="card">
        <h2>Operational Alerts</h2>
        <div class="list">
          <div class="list-row">
            <span>Pending Repairs</span><strong>${pending}</strong>
          </div>
          <div class="list-row">
            <span>Outstanding Udhar</span>
            <strong>${udhar.filter(u=>u.status!=="Settled").length}</strong>
          </div>
          <div class="list-row">
            <span>Today's Transactions</span>
            <strong>${todayS.length}</strong>
          </div>
          <div class="list-row">
            <span>Active Employees</span>
            <strong>${(state.data.employees||[]).filter(e=>e.status==="Active").length}</strong>
          </div>
        </div>
      </div>
    </div>`;
}

export function technicianView() {
  const active = (state.data.tickets || []).filter(t =>
    !["Delivered","Declined"].includes(t.status) &&
    (`${t.customer_name} ${t.ticket_number} ${t.device_brand} ${t.device_model} ${t.status}`)
      .toLowerCase().includes((state.filter||"").toLowerCase())
  );
  const tenant = currentTenant();
  const statusColors = {
    "Pending":"warn","In Progress":"warn","Ready":"good","Delivered":"good","Declined":"bad"
  };
  return `
    <div style="display:grid;gap:16px;padding:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div>
          <h1 style="margin:0;font-size:20px">My Repair Queue</h1>
          <p class="muted" style="font-size:13px;margin:4px 0 0">
            ${active.length} active ticket${active.length!==1?"s":""} · ${new Date().toLocaleDateString()}
          </p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${["Pending","In Progress","Ready"].map(s => {
            const count = (state.data.tickets||[]).filter(t => t.status === s).length;
            return `<span class="badge ${statusColors[s]}" style="font-size:12px;padding:5px 10px">
              ${s}: ${count}
            </span>`;
          }).join("")}
        </div>
      </div>

      <input class="search" placeholder="Search customer, device, ticket…"
        data-filter="repair" value="${state.filter||""}"
        style="font-size:14px;padding:10px 14px">

      ${active.length ? active.map(t => `
        <div class="card" style="display:grid;gap:12px;cursor:pointer"
             data-view-ticket="${t.id}">
          <div style="display:flex;justify-content:space-between;align-items:start;gap:12px">
            <div style="display:grid;gap:3px">
              <strong style="font-size:16px">${t.customer_name}</strong>
              <span class="muted" style="font-size:12px">${t.ticket_number} · ${t.customer_phone||""}</span>
            </div>
            <span class="badge ${statusColors[t.status]||"warn"}"
              style="flex-shrink:0;font-size:12px">${t.status}</span>
          </div>
          <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px">
            <span>📱 <strong>${t.device_brand} ${t.device_model}</strong></span>
            ${t.imei ? `<span class="muted">IMEI: ${t.imei}</span>` : ""}
          </div>
          ${t.issue_noted ? `
            <div style="font-size:13px;padding:8px 12px;background:var(--surface-2);
                        border-radius:8px;color:var(--text)">
              🔧 ${t.issue_noted}
            </div>` : ""}
          ${(t.components_noted||[]).length ? `
            <div style="font-size:12px;color:var(--muted)">
              Parts: ${t.components_noted.map(c => c.name).join(", ")}
            </div>` : ""}
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${["Pending","In Progress","Ready"].map(s =>
              s !== t.status ? `
              <button class="secondary-button" style="font-size:12px;padding:6px 12px"
                data-action="tech-status" data-ticket-id="${t.id}" data-status="${s}">
                → ${s}
              </button>` : ""
            ).join("")}
            ${CFG.technician_module_enabled !== false ? `
            <button class="primary-button" style="font-size:12px;padding:6px 12px"
              data-action="open-ticket-editor" data-ticket-id="${t.id}">
              Edit Components
            </button>` : ""}
            <button class="secondary-button" style="font-size:12px;padding:6px 12px"
              data-action="workshop-collect" data-ticket-id="${t.id}">
              Collect → POS
            </button>
          </div>
        </div>`).join("") : `
        <div class="card" style="text-align:center;padding:40px;color:var(--muted)">
          <div style="font-size:36px;margin-bottom:12px">✅</div>
          <strong>All clear</strong>
          <p style="font-size:13px;margin:6px 0 0">No active repair tickets right now.</p>
        </div>`}
    </div>`;
}

export function repairs() {
  const rows = (state.data.tickets || [])
    .filter(t => (`${t.customer_name} ${t.ticket_number} ${t.device_model} ${t.device_brand} ${t.status} ${t.customer_phone}`)
      .toLowerCase().includes(state.filter.toLowerCase()));
  const tenant = currentTenant();
  const statusColors = {
    "Pending":"warn","In Progress":"warn",
    "Ready":"good","Delivered":"good","Declined":"bad"
  };
  return `
    ${tit("Repair Tickets","Full repair queue with status tracking.",
      `<button class="primary-button" data-modal="repair">New Ticket</button>`)}
    ${tlb("Search by customer name, device, ticket…","repair","")}
    <div class="grid two-col">
      <div class="card">
        <div class="table-wrap"><table>
          <thead><tr>
            <th>Ticket</th><th>Customer</th><th>Device</th>
            <th>Advance</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            ${rows.length ? rows.map(r => `<tr style="cursor:pointer" data-view-ticket="${r.id}">
              <td><strong>${r.customer_name}</strong><br>
              <small class="muted">${r.customer_phone}</small></td>
               <td><span style="color:var(--primary);font-size:12px">${r.ticket_number}</span></td>
              <td>${r.device_brand} ${r.device_model}<br>
                <small class="muted">${r.imei||""}</small></td>
              <td>${Number(r.advance_payment||0) > 0
                ? money(r.advance_payment, tenant.currency) : "—"}</td>
              <td><span class="badge ${statusColors[r.status]||"warn"}">
                ${r.status}</span></td>
              <td style="display:flex;gap:6px;align-items:center">
                ${CFG.technician_module_enabled !== false ? `
                <button class="secondary-button"
                  data-action="open-ticket-editor"
                  data-ticket-id="${r.id}"
                  style="font-size:12px"
                  >Edit</button>` : ""}
                <button class="secondary-button"
                  data-action="add-ticket-to-cart"
                  style="font-size:12px"
                  >Collect</button>
              </td>
            </tr>`).join("") :
            `<tr><td colspan="6" style="text-align:center;color:var(--muted)">
              No tickets found.</td></tr>`}
          </tbody>
        </table></div>
      </div>
      <div class="card">
        <h2>Status Summary</h2>
        <div class="list">
          ${["Pending","In Progress","Ready","Delivered","Declined"].map(s => `
            <div class="list-row">
              <span>${s}</span>
              <strong>${(state.data.tickets||[]).filter(t=>t.status===s).length}</strong>
            </div>`).join("")}
        </div>
      </div>
    </div>`;
}

export function reports() {
  const tenant  = currentTenant();
  const sales   = state.data.sales   || [];
  const tickets = state.data.tickets || [];
  const udhar   = state.data.udhar   || [];
  const total   = sales.reduce((s,x) => s + Number(x.total_bill||0), 0);
  const disc    = sales.reduce((s,x) => s + Number(x.discount||0), 0);
  const labour  = sales.reduce((s,x) => s + Number(x.labour_cost||0), 0);
  const avgOrder= sales.length ? total / sales.length : 0;
  const udharOut= udhar.filter(u=>u.status!=="Settled")
                       .reduce((s,u)=>s+Number(u.balance_due||0),0);
  return `
    ${tit("Reports","Sales analytics, discounts, and outstanding credits.","")}
    <div class="grid kpi-grid">
      ${[
        ["Total Revenue",   total],
        ["Discounts Given", disc],
        ["Labour Income",   labour],
        ["Average Invoice", avgOrder],
        ["Udhar Outstanding", udharOut],
        ["Total Invoices",  sales.length],
      ].map(([l,v]) => `
        <div class="card kpi">
          <span class="label">${l}</span>
          <span class="value">${l === "Total Invoices"
            ? v : money(v, tenant.currency)}</span>
        </div>`).join("")}
    </div>
    <div class="grid two-col">
      <div class="card">
        <h2>Payment Method Breakdown</h2>
        <div class="list">
          ${["Cash","Raast","JazzCash","EasyPaisa","Bank Transfer","Udhar"].map(m => {
            const count = sales.filter(s=>s.payment_method===m).length;
            const rev   = sales.filter(s=>s.payment_method===m)
                               .reduce((s,x)=>s+Number(x.total_bill||0),0);
            return count ? `
              <div class="list-row">
                <span>${m} <small class="muted">(${count})</small></span>
                <strong>${money(rev, tenant.currency)}</strong>
              </div>` : "";
          }).join("")}
        </div>
      </div>
      <div class="card">
        <h2>Repair Summary</h2>
        <div class="list">
          <div class="list-row">
            <span>Total Tickets</span>
            <strong>${tickets.length}</strong>
          </div>
          <div class="list-row">
            <span>Delivered</span>
            <strong>${tickets.filter(t=>t.status==="Delivered").length}</strong>
          </div>
          <div class="list-row">
            <span>Declined</span>
            <strong>${tickets.filter(t=>t.status==="Declined").length}</strong>
          </div>
          <div class="list-row">
            <span>Still Open</span>
            <strong>${tickets.filter(t=>!["Delivered","Declined"].includes(t.status)).length}</strong>
          </div>
        </div>
      </div>
    </div>
    <div class="card">
      <h2>Recent Invoices</h2>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Invoice</th><th>Customer</th><th>Items</th>
          <th>Payment</th><th>Total</th><th>Date</th>
        </tr></thead>
        <tbody>
          ${sales.slice(0,15).map(s => `<tr>
            <td>INV-${s.id}</td>
            <td>${s.customer_name||"Walk-in"}</td>
            <td>${(s.items_sold||[]).length} item(s)</td>
            <td>${s.payment_method}</td>
            <td>${money(s.total_bill, tenant.currency)}</td>
            <td>${new Date(s.created_at).toLocaleDateString()}</td>
          </tr>`).join("")}
        </tbody>
      </table></div>
    </div>`;
}

export function employees() {
  const emps = state.data.employees || [];
  return `
    ${tit("Employees","Staff PINs, roles, and access control.",
      `<button class="primary-button" data-modal="employee">Add Employee</button>`)}
    <div class="card">
      ${emps.length ? `
        <div class="table-wrap"><table>
          <thead><tr>
            <th>Name</th><th>Role</th><th>Status</th><th>PIN</th><th></th>
          </tr></thead>
          <tbody>
            ${emps.map(e => `<tr>
              <td><strong>${e.name}</strong></td>
              <td>${e.role}</td>
              <td><span class="badge ${e.status==="Active"?"good":"bad"}">
                ${e.status}</span></td>
              <td><span class="muted">••••</span></td>
              <td style="display:flex;gap:6px">
                <button class="secondary-button" style="font-size:12px"
                  data-action="edit-employee"
                  data-emp-id="${e.id}"
                  data-emp-name="${e.name}"
                  data-emp-role="${e.role}"
                  data-emp-status="${e.status}">Edit</button>
                <button class="secondary-button" style="font-size:12px;color:var(--danger)"
                  data-action="remove-employee"
                  data-emp-id="${e.id}"
                  data-emp-name="${e.name}">Remove</button>
              </td>
            </tr>`).join("")}
          </tbody>
        </table></div>` :
        `<div class="empty">No employees yet. Add one above.</div>`}
    </div>`;
}

export function receipts() {
  const sales = (state.data.sales || []);
  const filtered = sales.filter(s =>
    (`${s.customer_name} ${s.payment_method} ${s.employee_name}`)
      .toLowerCase().includes(state.filter.toLowerCase())
  );
  const expanded = state.receiptsExpanded || null;
  return `
    ${tit("Receipts Archive","Full log of all completed sales and invoices.","")}
    ${tlb("Search by customer, payment method…","receipts","")}
    <div class="card" style="display:grid;gap:0">
      ${filtered.length ? filtered.map(s => {
        const isOpen = expanded === s.id;
        const items  = Array.isArray(s.items_sold) ? s.items_sold : [];
        return `
          <div style="border-bottom:1px solid var(--border);padding:12px 4px">
            <div style="display:flex;justify-content:space-between;align-items:center;
                        cursor:pointer;gap:12px" data-action="toggle-receipt" data-receipt-id="${s.id}">
              <div style="display:grid;gap:2px">
                <strong>${s.customer_name || "Walk-in"}</strong>
                <span class="muted" style="font-size:12px">
                  INV-${s.id} · ${s.payment_method} · ${s.employee_name || ""}
                </span>
              </div>
              <div style="text-align:right;flex-shrink:0;display:flex;align-items:center;gap:10px">
                <div>
                  <div><strong>${money(s.total_bill, CFG.currency)}</strong></div>
                  <span class="muted" style="font-size:11px">
                    ${new Date(s.created_at).toLocaleDateString()} ${new Date(s.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                  </span>
                </div>
                <button class="secondary-button" style="font-size:12px;white-space:nowrap"
                  data-action="reprint-receipt" data-sale-id="${s.id}">Reprint</button>
              </div>
            </div>
            ${isOpen ? `
              <div style="margin-top:10px;padding:10px;background:var(--surface-2);
                          border-radius:8px;display:grid;gap:6px">
                ${items.length ? items.map(i => `
                  <div style="display:flex;justify-content:space-between;font-size:13px">
                    <span>${i.name || i.productName || "Item"} × ${i.qty || 1}</span>
                    <span>${money((i.soldPrice || i.price || 0) * (i.qty || 1), CFG.currency)}</span>
                  </div>`).join("") : `<span class="muted" style="font-size:13px">No item breakdown available.</span>`}
                <div style="border-top:1px solid var(--border);margin-top:4px;padding-top:6px;
                            display:flex;justify-content:space-between;font-size:13px">
                  ${s.discount > 0 ? `<span>Discount</span><span>- ${money(s.discount, CFG.currency)}</span>` : ""}
                </div>
                <div style="display:flex;justify-content:space-between;font-weight:600">
                  <span>Total</span><span>${money(s.total_bill, CFG.currency)}</span>
                </div>
              </div>` : ""}
          </div>`;
      }).join("") : `<div class="empty" style="padding:24px;text-align:center;color:var(--muted)">No sales found.</div>`}
    </div>`;
}

export function inventory() {
  const tenant = currentTenant();
  const items  = state.data.inventory || [];
  const filter = (state.filter || "").toLowerCase();
  const filtered = items.filter(i =>
    !filter ||
    (i.name     || "").toLowerCase().includes(filter) ||
    (i.sku      || "").toLowerCase().includes(filter) ||
    (i.category || "").toLowerCase().includes(filter)
  );
  const lowStock = items.filter(i => Number(i.qty || 0) <= Number(i.min_qty || 0) && Number(i.min_qty || 0) > 0);
  return `
    ${tit("Inventory","Stock levels, pricing, and alerts.",
      `<button class="primary-button" data-modal="inv-add">+ Add Item</button>`)}
    ${lowStock.length ? `
      <div style="background:color-mix(in srgb,var(--warning) 12%,var(--surface));border:1px solid color-mix(in srgb,var(--warning) 30%,var(--border));border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:12px">
        ⚠ ${lowStock.length} item${lowStock.length>1?"s":""} low on stock:
        ${lowStock.map(i=>`<strong>${i.name}</strong> (${i.qty} left)`).join(", ")}
      </div>` : ""}
    <div class="card">
      <div style="margin-bottom:10px">
        <input class="search-input" placeholder="Search inventory…" data-filter="inv" value="${state.filter||""}" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:8px 12px;background:var(--surface);color:var(--text)">
      </div>
      ${filtered.length ? `
        <div class="table-wrap"><table>
          <thead><tr><th>Name</th><th>SKU</th><th>Category</th><th>Qty</th><th>Sell Price</th><th>Cost</th><th>Actions</th></tr></thead>
          <tbody>
            ${filtered.map(i => `<tr>
              <td><strong>${i.name}</strong></td>
              <td class="muted">${i.sku||"—"}</td>
              <td>${i.category||"—"}</td>
              <td><span class="badge ${Number(i.qty||0) <= Number(i.min_qty||0) && Number(i.min_qty||0)>0 ? "bad" : "good"}">${i.qty}</span></td>
              <td>${money(i.price, tenant.currency)}</td>
              <td class="muted">${money(i.cost, tenant.currency)}</td>
              <td>
                <button class="secondary-button" style="font-size:12px;padding:4px 10px" data-inv-edit="${i.id}">Edit</button>
                <button class="secondary-button" style="font-size:12px;padding:4px 10px;color:var(--danger)" data-inv-delete="${i.id}">Delete</button>
              </td>
            </tr>`).join("")}
          </tbody>
        </table></div>` :
        `<div class="empty">${filter ? "No items match your search." : "No inventory items yet. Add one above."}</div>`}
    </div>`;
}
export function subscriptions() {
  const tenant = currentTenant();
  return `
    ${tit("Subscriptions","Billing and plan overview.","")}
    <div class="grid plans">${["Basic","Standard","Premium"].map((plan,i)=>`<div class="card plan"><h2>${plan}</h2><strong>${money([29,79,149][i],tenant.currency)}/mo</strong><p class="muted">${["Limited employees and products","Growing shops with reporting","Unlimited usage and white-label"][i]}</p><span class="badge ${tenant.plan===plan?"good":""}">${tenant.plan===plan?"Current Plan":"Available"}</span></div>`).join("")}</div>`;
}
