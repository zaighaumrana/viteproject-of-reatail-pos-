import { registerRender, state } from "./context.js";
import "../styles.css";
import { initSession } from "./session.js";
import { renderApp } from "./ui/render.js";
import { load } from "./data/load.js";
import { registerKeyboardEvents } from "./events/keyboard.js";

import "./events/click.js";
import "./events/input.js";
import "./events/change.js";
import "./events/submit.js";

initSession();
registerRender(renderApp);

registerKeyboardEvents();

window.addEventListener("online", () => {
  state.online = true;
  renderApp();
});
window.addEventListener("offline", () => {
  state.online = false;
  renderApp();
});
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  state.installPrompt = e;
  renderApp();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}

load().catch((err) => console.error("Boot failed:", err));
