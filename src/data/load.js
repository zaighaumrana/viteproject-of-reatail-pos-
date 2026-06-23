import { CFG, configState, render, sb, state } from "../context.js";
import { applyBranding, loadConfig } from "../config.js";

export async function load() {
  const ok = await loadConfig(sb);
  if (ok) configState.loaded = true;

  const fetchInventory = CFG.inventory_module_enabled === true
    ? sb.from("inventory").select("*").order("name")
    : Promise.resolve({ data: [] });

  const [tickets, sales, employees, udhar, returns_, inventory_] = await Promise.all([
    sb.from("tickets").select("*").order("id", { ascending: false }),
    sb.from("sales").select("*").order("id", { ascending: false }),
    sb.from("employees").select("id, name, role, status").order("name"),
    sb.from("udhar").select("*").order("id", { ascending: false }),
    sb.from("returns").select("*").order("id", { ascending: false }),
    fetchInventory,
  ]);

  state.data = {
    tickets: tickets.data || [],
    sales: sales.data || [],
    employees: employees.data || [],
    udhar: udhar.data || [],
    returns: returns_.data || [],
    inventory: inventory_.data || [],
    config: CFG,
  };

  applyBranding();
  render();
}
