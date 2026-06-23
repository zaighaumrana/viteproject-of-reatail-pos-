import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://kxmovywgshyltwusghhj.supabase.co";
export const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bW92eXdnc2h5bHR3dXNnaGhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExODM2OTIsImV4cCI6MjA5Njc1OTY5Mn0.JGDedCaow_Vg5Pk5RC6XprzKmRsaCCUNGWg1TaWAGLg";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

export const params = new URLSearchParams(location.search);

export const state = {
  route: params.get("route") || "pos",
  adminModule: "dashboard",
  role: "Business Owner",
  theme: localStorage.getItem("retailos-theme") || "light",
  online: navigator.onLine,
  filter: "",
  category: "All",
  cart: [],
  data: { tickets: [], sales: [], employees: [], udhar: [], returns: [], config: {} },
  modal: null,
  installPrompt: null,
  settingsTab: "branding",
  checkoutPayment: "Cash",
  cashTendered: 0,
  cartTicketId: null,
  cartAdvance: 0,
  cartLabour: 0,
  udharName: "",
  udharPhone: "",
};

/** Shop config from Supabase — no hardcoded admin_password fallback. */
export let CFG = {
  admin_password: null,
  strict_login_mode: false,
  discount_pin_required: true,
  partial_udhar_allowed: true,
  quick_components: [
    "Screen", "Battery", "Body", "Board", "Camera", "Mic", "Speaker",
    "Charging Port", "Back Glass", "SIM Tray", "Power Button", "Volume Button",
  ],
  terms_text: "Warranty: 30 days on parts replaced.",
  shop_name: "FixPoint Mobile Care",
  shop_address: "42 Market Street, Lahore",
  shop_phone: "+92 300 555 0188",
  primary_color: "#126c5b",
  secondary_color: "#e9b949",
  currency: "Rs.",
  tax_rate: 0,
  inventory_module_enabled: false,
  repair_module_enabled: true,
  technician_module_enabled: true,
  suspended: false,
  platform_client_id: null,
  platform_url: null,
  platform_anon: null,
  per_receipt_rate: 5,
  per_ticket_rate: 10,
  per_item_rate: 1,
};

export const configState = { loaded: false };

export let SESSION = {
  employee: null,
  isAdmin: false,
  loginSkipped: false,
};

export function setSession(next) {
  SESSION = next;
}

let renderFn = () => {};

export function registerRender(fn) {
  renderFn = fn;
}

export function render() {
  renderFn();
}

export const ACCESS = {
  "Business Owner": [
    "dashboard", "repairs", "inventory", "reports", "receipts", "employees", "settings", "pos", "workshop",
  ],
  Manager: ["dashboard", "repairs", "inventory", "reports", "receipts", "employees"],
  Cashier: ["pos"],
  Technician: ["workshop"],
};

export const ADMIN_MODULES = [
  ["dashboard", "▦", "Dashboard"],
  ["repairs", "◈", "Repair Tickets"],
  ["inventory", "▤", "Inventory"],
  ["reports", "▧", "Reports"],
  ["employees", "♙", "Employees"],
  ["receipts", "◉", "Receipts"],
  ["settings", "◐", "Settings"],
];

export function can(mod) {
  if (mod === "repairs" && !CFG.repair_module_enabled) return false;
  if (mod === "inventory" && !CFG.inventory_module_enabled) return false;
  if (mod === "workshop" && !CFG.technician_module_enabled) return false;
  return ACCESS[state.role]?.includes(mod) ?? false;
}

export const money = (v, sym = "Rs.") =>
  `${sym} ${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export function uid(p) {
  return `${p}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}
