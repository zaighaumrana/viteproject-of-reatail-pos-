import { SESSION, render, state } from "../context.js";
import { isOnLoginScreen, onPasswordInput, submitPin } from "../auth/login.js";
import { handlePpKey, resetPinPrompt, submitPp } from "../auth/pin-prompt.js";

export function registerKeyboardEvents() {
  document.addEventListener("keydown", (e) => {
    if (isOnLoginScreen() && e.key === "Enter") {
      e.preventDefault();
      submitPin();
      return;
    }

    const pinPromptOpen = !!document.getElementById("pp-display");
    if (!pinPromptOpen) return;

    if (e.key === "Enter") {
      e.preventDefault();
      submitPp();
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      handlePpKey("⌫");
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      state.modal = null;
      resetPinPrompt();
      render();
      return;
    }
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      handlePpKey(e.key);
    }
  });

  document.addEventListener("input", (e) => {
    if (e.target.id === "login-password") {
      onPasswordInput(e.target.value);
    }
  });
}
