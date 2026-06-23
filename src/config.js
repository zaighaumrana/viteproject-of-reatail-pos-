import { createClient } from "@supabase/supabase-js";
import { CFG, configState, state } from "./context.js";

let _pbReporter = null;

export function getPlatformReporter() {
  if (_pbReporter) return _pbReporter;
  if (CFG.platform_url && CFG.platform_anon) {
    _pbReporter = createClient(CFG.platform_url, CFG.platform_anon);
  }
  return _pbReporter;
}

export async function pingUsage(moduleType) {
  if (!CFG.platform_client_id) return;
  const rateMap = {
    POS: CFG.per_receipt_rate || 0,
    REPAIR_TICKET: CFG.per_ticket_rate || 0,
    INVENTORY: CFG.per_item_rate || 0,
  };
  try {
    const reporter = getPlatformReporter();
    if (!reporter) return;
    await reporter.from("usage_logs").insert({
      client_id: CFG.platform_client_id,
      module_type: moduleType,
      token_count: 1,
      rate_at_log: rateMap[moduleType] ?? 0,
    });
  } catch (e) {
    console.warn("Usage ping failed:", e.message);
  }
}

export function applyBranding() {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.style.setProperty("--primary", CFG.primary_color || "#126c5b");
  document.documentElement.style.setProperty("--secondary", CFG.secondary_color || "#e9b949");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", CFG.primary_color || "#126c5b");

  if (CFG.shop_logo) {
    const favicon = document.getElementById("dynamic-favicon");
    if (favicon) {
      favicon.href = CFG.shop_logo;
      favicon.type = "image/png";
    }
  }
}

export function currentTenant() {
  return {
    name: CFG.shop_name || "My Shop",
    address: CFG.shop_address || "",
    phone: CFG.shop_phone || "",
    whatsapp: CFG.shop_phone || "",
    primaryColor: CFG.primary_color || "#126c5b",
    secondaryColor: CFG.secondary_color || "#e9b949",
    currency: CFG.currency || "Rs.",
    taxRate: Number(CFG.tax_rate || 0),
    receiptFooter: CFG.terms_text || "",
    repairModuleEnabled: CFG.repair_module_enabled !== false,
    logo: CFG.shop_logo || "",
    businessDescription: CFG.shop_description || "",
    plan: "Premium",
    status: "Active",
  };
}

export function scoped(store) {
  if (store === "repairs") return state.data.tickets || [];
  if (store === "sales") return state.data.sales || [];
  if (store === "employees") return state.data.employees || [];
  if (store === "udhar") return state.data.udhar || [];
  if (store === "returns") return state.data.returns || [];
  return [];
}

export async function loadConfig(sb) {
  const { data, error } = await sb.from("shop_config").select("*").single();
  if (error) {
    console.warn("Config load failed.", error.message);
    return false;
  }

  Object.assign(CFG, data);

  if (CFG.admin_password == null || CFG.admin_password === "") {
    console.warn("shop_config.admin_password is not set in Supabase.");
  }

  if (typeof CFG.quick_components === "string") {
    try {
      CFG.quick_components = JSON.parse(CFG.quick_components);
    } catch {
      /* keep as-is */
    }
  }
  if (typeof CFG.quick_items === "string") {
    try {
      CFG.quick_items = JSON.parse(CFG.quick_items);
    } catch {
      CFG.quick_items = [];
    }
  }
  if (!Array.isArray(CFG.quick_items)) CFG.quick_items = [];

  applyBranding();
  return true;
}

export async function ensureConfigLoaded(sb) {
  if (configState.loaded) return true;
  const ok = await loadConfig(sb);
  if (ok) configState.loaded = true;
  return ok;
}

/** Verify admin password against Supabase (source of truth). */
export async function verifyAdminPassword(sb, pin) {
  await ensureConfigLoaded(sb);
  if (CFG.admin_password != null && CFG.admin_password !== "") {
    return String(pin) === String(CFG.admin_password);
  }
  const { data, error } = await sb.from("shop_config").select("admin_password").single();
  if (error || !data?.admin_password) return false;
  CFG.admin_password = data.admin_password;
  return String(pin) === String(data.admin_password);
}
