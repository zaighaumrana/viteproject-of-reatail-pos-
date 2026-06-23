/**
 * Adds imports/exports to split module files.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, "..", "src");

const commonImport = `import { state, CFG, SESSION, sb, money, can, ADMIN_MODULES, render, setSession } from "../context.js";
import { applyBranding, currentTenant, scoped, pingUsage, verifyAdminPassword } from "../config.js";
import { saveSession, clearSession, applyAdminLogin, applyEmployeeLogin } from "../session.js";
`;

const fileImports = {
  "data/tickets-ops.js": commonImport,
  "auth/pin-prompt.js": `${commonImport}import { verifyPin } from "./tickets-ops.js";\n`.replace("./tickets-ops", "../data/tickets-ops"),
  "print/thermal.js": `import { CFG, money } from "../context.js";\n`,
  "ui/render-core.js": `${commonImport}import { loginScreen } from "../auth/login.js";
import { modal } from "../modals/index.js";
import { pos } from "../pages/pos.js";
import { dashboard, technicianView, repairs, inventory, reports, employees, receipts } from "../pages/admin.js";
import { settings } from "../pages/settings.js";
`,
  "pages/settings.js": `${commonImport}import { tit, fld } from "../ui/helpers.js";
`,
  "pages/pos.js": `${commonImport}import { tit } from "../ui/helpers.js";
import { buildShiftStats } from "../print/thermal.js";
`,
  "pages/admin.js": `${commonImport}import { tit, tlb, tbl, statusBadge, stockBadge, productName } from "../ui/helpers.js";
`,
  "modals/index.js": `${commonImport}import { pinPromptHTML } from "../auth/pin-prompt.js";
import { fld, modalActions } from "../ui/helpers.js";
import { buildShiftStats, buildReceiptSlip } from "../print/thermal.js";
import { receiptPreview } from "../ui/receipt-preview.js";
`,
  "data/udhar.js": commonImport + `import { buildReturnSlip, printThermal } from "../print/thermal.js";\n`,
  "ui/receipt-preview.js": `import { money } from "../context.js";
import { currentTenant } from "../config.js";
`,
  "cart/index.js": `${commonImport}import { scoped } from "../config.js";
import { updateTicket } from "../data/tickets-ops.js";
import { pingUsage } from "../config.js";
import { openPinPrompt } from "../auth/pin-prompt.js";
import { load } from "../data/load.js";
`,
  "events/click.js": `${commonImport}import { submitPin } from "../auth/login.js";
import { handlePpKey, openPinPrompt } from "../auth/pin-prompt.js";
import { load } from "../data/load.js";
import { createTicket, updateTicket } from "../data/tickets-ops.js";
import { checkout, addToCart, updateQty } from "../cart/index.js";
import { printThermal, buildShiftStats, buildReceiptSlip } from "../print/thermal.js";
import { settleUdhar } from "../data/udhar.js";
import { clearSession, saveSession } from "../session.js";
import { setSession } from "../context.js";
`,
  "events/input.js": `import { state, CFG, money, render } from "../context.js";
import { onPasswordInput } from "../auth/login.js";
`,
  "events/change.js": `${commonImport}import { can } from "../context.js";
`,
  "events/submit.js": `${commonImport}import { load } from "../data/load.js";
import { createTicket, updateTicket } from "../data/tickets-ops.js";
import { pingUsage, verifyAdminPassword } from "../config.js";
import { openPinPrompt } from "../auth/pin-prompt.js";
import { processReturn } from "../data/udhar.js";
import { printThermal, buildTicketSlip } from "../print/thermal.js";
import { checkout } from "../cart/index.js";
`,
};

function exportFunctions(code) {
  return code.replace(/^(async )?function (\w+)/gm, (m, asyncKw, name) => {
    if (m.startsWith("export")) return m;
    return `export ${asyncKw || ""}function ${name}`;
  });
}

for (const [rel, header] of Object.entries(fileImports)) {
  const full = path.join(src, rel);
  if (!fs.existsSync(full)) continue;
  let body = fs.readFileSync(full, "utf8");
  body = exportFunctions(body);
  fs.writeFileSync(full, header + "\n" + body);
  console.log("Wired", rel);
}

// Fix pin-prompt verifyAdmin to use verifyAdminPassword
const pinPath = path.join(src, "auth/pin-prompt.js");
let pin = fs.readFileSync(pinPath, "utf8");
pin = pin.replace(
  /res = await verifyAdmin\(pin\);/g,
  "res = (await verifyAdminPassword(sb, pin)) ? { ok: true } : { ok: false };"
);
fs.writeFileSync(pinPath, pin);

// Fix tickets-ops verifyAdmin
const ticketsPath = path.join(src, "data/tickets-ops.js");
let tickets = fs.readFileSync(ticketsPath, "utf8");
tickets = tickets.replace(
  /async function verifyAdmin\(pin\) \{[\s\S]*?\}/,
  `export async function verifyAdmin(pin) {
  const ok = await verifyAdminPassword(sb, pin);
  return ok ? { ok: true } : { ok: false };
}`
);
if (!tickets.includes("verifyAdminPassword")) {
  tickets = tickets.replace(
    commonImport.trim(),
    commonImport.trim() // already has verifyAdminPassword via config import - add explicitly
  );
}
tickets = `import { sb, SESSION } from "../context.js";
import { verifyAdminPassword } from "../config.js";

` + tickets.split("\n").slice(2).join("\n");
tickets = exportFunctions(tickets);
fs.writeFileSync(ticketsPath, tickets);

console.log("Done wiring modules.");
