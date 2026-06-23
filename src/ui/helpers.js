import { state } from "../context.js";

export const tit = (h, sub, action) =>
  `<div class="page-title"><div><h1>${h}</h1><p class="muted">${sub}</p></div><div>${action}</div></div>`;

export const tlb = (ph, fkey, right) =>
  `<div class="toolbar"><div class="toolbar-left"><input class="search" data-filter="${fkey}" value="${state.filter}" placeholder="${ph}"></div><div class="toolbar-right">${right}</div></div>`;

export const tbl = (cap, heads, rows) =>
  `<h2>${cap}</h2><div class="table-wrap"><table><thead><tr>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

export const fld = (label, name, val = "", type = "text") =>
  `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${String(val).replaceAll('"', "&quot;")}"></label>`;

export const statusBadge = (s) => {
  const bad = ["Suspended", "Cancelled"];
  const good = ["Active", "Delivered", "Ready for Pickup", "Received"];
  return `<span class="badge ${bad.includes(s) ? "bad" : good.includes(s) ? "good" : "warn"}">${s}</span>`;
};

export const stockBadge = (p) =>
  `<span class="badge ${p.qty <= p.min ? "bad" : p.qty < p.min * 2 ? "warn" : "good"}">${p.qty <= p.min ? "Low Stock" : "In Stock"}</span>`;

export const productName = (p) =>
  `<div style="display:flex;align-items:center;gap:10px"><span class="product-img">${p.image ? `<img alt="" src="${p.image}">` : `${p.name.slice(0, 1)}`}</span><span><strong>${p.name}</strong><br><small class="muted">${p.brand}</small></span></div>`;

export const modalActions = () =>
  `<div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button class="primary-button">Save</button></div>`;
