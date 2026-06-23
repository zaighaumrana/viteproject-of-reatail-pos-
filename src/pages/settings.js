import { state, CFG, SESSION, sb, money, can, ADMIN_MODULES, render, setSession } from "../context.js";
import { applyBranding, currentTenant, scoped, pingUsage, verifyAdminPassword } from "../config.js";
import { saveSession, clearSession, applyAdminLogin, applyEmployeeLogin } from "../session.js";
import { tit, fld } from "../ui/helpers.js";

/* ═══════════════════════════════════════════════════════════════════
   SETTINGS PAGE  — accessible from Admin nav (Business Owner / Manager)
═══════════════════════════════════════════════════════════════════ */
export function settings() {
  return `
    ${tit("Business Settings","White-label branding, contact info, tax, currency, and receipt configuration.","")}
    <div class="settings-tabs">
      <button class="settings-tab ${state.settingsTab==="branding"?"active":""}" data-settings-tab="branding">Branding & Colors</button>
      <button class="settings-tab ${state.settingsTab==="contact"?"active":""}" data-settings-tab="contact">Contact & Business</button>
      <button class="settings-tab ${state.settingsTab==="receipt"?"active":""}" data-settings-tab="receipt">Receipt & Tax</button>
      <button class="settings-tab ${state.settingsTab==="components"?"active":""}" data-settings-tab="components">Repair Components</button>
      <button class="settings-tab ${state.settingsTab==="quickitems"?"active":""}" data-settings-tab="quickitems">Quick Items</button>
      <button class="settings-tab ${state.settingsTab==="staff"?"active":""}" data-settings-tab="staff">Staff & Security</button>
    </div>
    ${settingsTabContent()}
  `;
}

export function settingsTabContent() {
  const t = currentTenant();
  if (state.settingsTab==="branding") return `
    <form class="card form-grid" data-form="settings">
      ${fld("Business Name","name",t.name)}
      ${fld("Business Description","businessDescription",t.businessDescription||"")}
      ${fld("Primary Color","primaryColor",t.primaryColor,"color")}
      ${fld("Secondary Color","secondaryColor",t.secondaryColor,"color")}
      <label class="field"><span>Logo Upload</span><input name="logo" type="file" accept="image/*"></label>
      <div class="field"><span>Current Palette</span><div class="swatches"><span class="swatch" style="background:${t.primaryColor}"></span><span class="swatch" style="background:${t.secondaryColor}"></span></div></div>
      <div class="modal-actions" style="grid-column:1/-1"><button class="primary-button">Save Branding</button></div>
    </form>`;
  if (state.settingsTab==="contact") return `
    <form class="card form-grid" data-form="settings">
      ${fld("Business Name","name",t.name)}
      ${fld("Address","address",t.address)}
      ${fld("Phone","phone",t.phone)}
      ${fld("WhatsApp","whatsapp",t.whatsapp)}
      ${fld("Email","email",t.email)}
      <div class="modal-actions" style="grid-column:1/-1"><button class="primary-button">Save Contact Info</button></div>
    </form>`;
  if (state.settingsTab==="receipt") return `
    <form class="card form-grid" data-form="settings">
      ${fld("Currency Symbol","currency",t.currency)}
      ${fld("Tax Rate %","taxRate",t.taxRate,"number")}
      <label class="field" style="grid-column:1/-1"><span>Receipt Footer</span><textarea name="receiptFooter">${t.receiptFooter}</textarea></label>
      <div class="modal-actions" style="grid-column:1/-1"><button class="primary-button">Save Receipt Settings</button></div>
    </form>`;
    if (state.settingsTab === "components") {
  const comps = CFG.quick_components || [];
  return `
    <div class="card" style="display:grid;gap:14px">
      <div>
        <h2>Quick-Tap Components</h2>
        <p class="muted" style="font-size:13px">
          These appear as buttons when creating a repair ticket.
        </p>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px" id="comp-list">
        ${comps.map((c, i) => `
          <div style="display:flex;align-items:center;gap:6px;
                      background:var(--surface-2);border:1px solid var(--border);
                      border-radius:8px;padding:6px 10px">
            <span style="font-size:13px">${c}</span>
            <button type="button" data-remove-quick="${i}"
              style="color:var(--danger);background:none;border:none;
                     font-size:16px;line-height:1;padding:0 2px;cursor:pointer">×</button>
          </div>`).join("")}
      </div>
      <div style="display:flex;gap:8px">
        <input id="new-comp-input" class="search" placeholder="New component name"
          style="flex:1">
        <button class="primary-button" data-action="add-quick-comp">Add</button>
      </div>
      <button class="primary-button" data-action="save-quick-comps">
        Save Components List
      </button>
    </div>`;
}
  if (state.settingsTab === "quickitems") {
    const items = CFG.quick_items || [];
    return `
      <div class="card" style="display:grid;gap:16px">
        <div>
          <h2>Quick Sale Items</h2>
          <p class="muted" style="font-size:13px">
            These appear as tap buttons in the POS cart.
            Each item has preset price options the cashier picks from.
          </p>
        </div>
        ${items.map((item, i) => `
          <div style="padding:12px;background:var(--surface-2);
                      border-radius:8px;display:grid;gap:8px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <strong>${item.name}</strong>
              <button type="button" data-remove-qitem="${i}"
                style="color:var(--danger);background:none;border:none;
                       font-size:18px;cursor:pointer">×</button>
            </div>
            <div style="font-size:13px;color:var(--muted)">
              Price options: ${item.prices.map((p,pi) => `
                <span style="display:inline-flex;align-items:center;gap:4px;
                             margin-right:6px">
                  ${money(p, CFG.currency)}
                  <button type="button" data-remove-qprice="${i}-${pi}"
                    style="color:var(--danger);background:none;border:none;
                           font-size:14px;cursor:pointer;padding:0">×</button>
                </span>`).join("")}
            </div>
            <div style="display:flex;gap:8px">
              <input type="number" placeholder="Add price option"
                id="qprice-input-${i}" min="1"
                style="flex:1;border:1px solid var(--border);border-radius:6px;
                       padding:7px 9px;background:var(--surface);color:var(--text)">
              <button type="button" class="secondary-button"
                data-add-qprice="${i}">+ Price</button>
            </div>
          </div>`).join("")}
        <div style="display:flex;gap:8px">
          <input id="qitem-name" class="search" placeholder="Item name (e.g. Handsfree)"
            style="flex:1">
          <button class="primary-button" data-action="add-qitem">Add Item</button>
        </div>
        <button class="primary-button" data-action="save-qitems">
          Save Quick Items
        </button>
      </div>`;
  }
  if (state.settingsTab === "staff") {
    const emps = state.data.employees || [];
    return `
      <div style="display:grid;gap:16px">
        <div class="card" style="display:grid;gap:14px">
          <h2>Employees</h2>
          ${emps.length ? `
            <div class="table-wrap"><table>
              <thead><tr>
                <th>Name</th><th>Role</th><th>Status</th><th>PIN</th><th></th>
              </tr></thead>
              <tbody>
                ${emps.map(e => `<tr>
                  <td><strong>${e.name}</strong></td>
                  <td>${e.role}</td>
                  <td><span class="badge ${e.status==="Active"?"good":"bad"}">${e.status}</span></td>
                  <td><span class="muted">••••</span></td>
                  <td>
                    <button class="secondary-button" style="font-size:12px"
                      data-action="edit-employee" data-emp-id="${e.id}"
                      data-emp-name="${e.name}" data-emp-role="${e.role}"
                      data-emp-status="${e.status}">Edit</button>
                  </td>
                </tr>`).join("")}
              </tbody>
            </table></div>` : `<p class="muted">No employees yet.</p>`}
          <button class="primary-button" style="width:fit-content" data-modal="employee">+ Add Employee</button>
        </div>
        <div class="card" style="display:grid;gap:14px">
          <h2>Change Admin Password</h2>
          <p class="muted" style="font-size:13px">Used to access Admin panel and settings.</p>
          <form class="form-grid" data-form="change-admin-password">
            <label class="field"><span>Current Password</span>
              <input name="current" type="password" autocomplete="off" required></label>
            <label class="field"><span>New Password</span>
              <input name="newpass" type="password" autocomplete="off" required></label>
            <div class="modal-actions" style="grid-column:1/-1">
              <button class="primary-button">Update Password</button>
            </div>
          </form>
        </div>
      </div>`;
  }
  return "";
}

/* ── Branding modal (quick access from topbar — removed, now in settings page only) ── */
// Settings are now ONLY in the Admin → Business Settings page.
// The old floating "Branding" button in the topbar is gone for cleanliness.
