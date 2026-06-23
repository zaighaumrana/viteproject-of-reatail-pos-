import { state, SESSION, setSession } from "./context.js";

function loadSession() {
  try {
    const s = sessionStorage.getItem("retailos_session");
    return s ? JSON.parse(s) : { employee: null, isAdmin: false, loginSkipped: false };
  } catch {
    return { employee: null, isAdmin: false, loginSkipped: false };
  }
}

export function initSession() {
  setSession(loadSession());
  restoreRouteFromSession();
}

export function saveSession() {
  try {
    sessionStorage.setItem("retailos_session", JSON.stringify(SESSION));
    sessionStorage.setItem("retailos_route", state.route);
    sessionStorage.setItem("retailos_module", state.adminModule);
  } catch {
    /* ignore */
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem("retailos_session");
    sessionStorage.removeItem("retailos_route");
    sessionStorage.removeItem("retailos_module");
  } catch {
    /* ignore */
  }
}

function restoreRouteFromSession() {
  try {
    const r = sessionStorage.getItem("retailos_route");
    const m = sessionStorage.getItem("retailos_module");
    const s = sessionStorage.getItem("retailos_session");
    const sess = s ? JSON.parse(s) : null;
    const isAdmin = sess?.isAdmin === true;
    const role = sess?.employee?.role || "";
    const isBackOffice = isAdmin || role === "Business Owner" || role === "Manager";

    if (r && !(isBackOffice && r === "pos")) {
      state.route = r;
    }
    if (isBackOffice && (!r || r === "pos")) {
      state.route = "admin";
    }
    if (m) {
      state.adminModule = m;
    } else if (isBackOffice) {
      state.adminModule = "dashboard";
    }
  } catch (e) {
    console.warn("Session restore failed", e);
  }
}

export function applyAdminLogin() {
  setSession({
    employee: { name: "Admin", role: "Business Owner" },
    isAdmin: true,
    loginSkipped: false,
  });
  state.role = "Business Owner";
  state.route = "admin";
  state.adminModule = "dashboard";
  saveSession();
}

export function applyEmployeeLogin(employee) {
  setSession({ employee, isAdmin: false, loginSkipped: false });
  state.role = employee.role;
  if (employee.role === "Cashier") {
    state.route = "pos";
  } else if (employee.role === "Technician") {
    state.route = "workshop";
  } else if (employee.role === "Business Owner" || employee.role === "Manager") {
    state.route = "admin";
    state.adminModule = "dashboard";
  }
  saveSession();
}
