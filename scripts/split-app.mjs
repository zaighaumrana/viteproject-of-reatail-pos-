/**
 * One-time splitter: reads legacy app.js and writes src/ modules.
 * Run: node scripts/split-app.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "src");
const legacy = fs.readFileSync(path.join(root, "app.js"), "utf8");
const lines = legacy.split("\n");

function slice(start, end) {
  return lines.slice(start - 1, end).join("\n");
}

fs.mkdirSync(path.join(src, "auth"), { recursive: true });
fs.mkdirSync(path.join(src, "data"), { recursive: true });
fs.mkdirSync(path.join(src, "pages"), { recursive: true });
fs.mkdirSync(path.join(src, "ui"), { recursive: true });
fs.mkdirSync(path.join(src, "print"), { recursive: true });
fs.mkdirSync(path.join(src, "events"), { recursive: true });
fs.mkdirSync(path.join(src, "modals"), { recursive: true });
fs.mkdirSync(path.join(src, "cart"), { recursive: true });

// Sections by line numbers from original app.js (1-indexed)
const sections = {
  "data/tickets-ops.js": [272, 334],
  "auth/login.js": [336, 480],
  "auth/pin-prompt.js": [481, 558],
  "print/thermal.js": [560, 744],
  "ui/render-core.js": [746, 914],
  "pages/settings.js": [916, 1090],
  "pages/pos.js": [1092, 1353],
  "pages/admin.js": [1354, 1803],
  "modals/index.js": [1805, 2386],
  "data/udhar.js": [2388, 2425],
  "ui/receipt-preview.js": [2429, 2459],
  "cart/index.js": [2461, 2585],
  "events/click.js": [2587, 3148],
  "events/input.js": [3150, 3168],
  "events/change.js": [3170, 3209],
  "events/submit.js": [3211, 3380],
};

for (const [file, [start, end]] of Object.entries(sections)) {
  const body = slice(start, end);
  fs.writeFileSync(path.join(src, file), body + "\n");
}

console.log("Split", Object.keys(sections).length, "modules into src/");
