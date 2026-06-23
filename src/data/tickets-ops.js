import { sb, SESSION } from "../context.js";
import { verifyAdminPassword } from "../config.js";

// ── PIN verification (never loads pin_code on GET, only verifies) ──
export async function verifyPin(pin) {
  if (await verifyAdminPassword(sb, pin)) {
    return { ok: false };
  }
  const { data, error } = await sb
    .from("employees")
    .select("id, name, role, status")
    .eq("pin_code", String(pin))
    .eq("status", "Active")
    .single();
  if (error || !data) return { ok: false };
  return { ok: true, employee: { id: data.id, name: data.name, role: data.role } };
}

export async function verifyAdmin(pin) {
  const ok = await verifyAdminPassword(sb, pin);
  return ok ? { ok: true } : { ok: false };
}

// ── Ticket number generator ────────────────────────────────────────
export function generateTicketNumber() {
  const year = new Date().getFullYear();
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `FP-${year}-${rand}`;
}

// ── Create repair ticket ───────────────────────────────────────────
export async function createTicket(payload) {
  const ticket_number = generateTicketNumber();
  const { data, error } = await sb.from("tickets").insert({
    ticket_number,
    customer_name:   payload.customerName   || "",
    customer_phone:  payload.customerPhone  || "",
    device_brand:    payload.deviceBrand    || "",
    device_model:    payload.deviceModel    || "",
    imei:            payload.imei           || "",
    components_noted: payload.components   || [],
    estimated_quote: Number(payload.estimatedQuote || 0),
    advance_payment: Number(payload.advance        || 0),
    advance_method:  payload.advanceMethod  || "",
    status:          "Pending",
    technician_note: payload.technicianNote || "",
    created_by:      SESSION.employee?.name || "Counter",
  }).select().single();

  if (error) { console.error("createTicket:", error); return { ok: false, error: error.message }; }
  return { ok: true, data };
}

// ── Update ticket (add components at checkout, status change, decline) ──
export async function updateTicket(id, updates) {
  // remap JS camelCase keys to Supabase snake_case column names
  const mapped = {};
  if (updates.components    !== undefined) mapped.components_noted = updates.components;
  if (updates.status        !== undefined) mapped.status            = updates.status;
  if (updates.declineReason !== undefined) mapped.decline_reason    = updates.declineReason;
  if (updates.technicianNote!== undefined) mapped.technician_note   = updates.technicianNote;
  if (updates.settledAt     !== undefined) mapped.settled_at        = updates.settledAt;

  const { error } = await sb.from("tickets").update(mapped).eq("id", id);
  if (error) { console.error("updateTicket:", error); return { ok: false, error: error.message }; }
  return { ok: true };
}
