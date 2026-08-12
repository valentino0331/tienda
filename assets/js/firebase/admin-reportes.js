import { requireAdmin, shouldRedirectToAdminLogin, getAuthHeaders, setToken } from "./admin-guard.js";

const content = document.querySelector("#admin-reports-content"),
  identity = document.querySelector("#admin-identity"),
  logoutButton = document.querySelector("#admin-logout");

logoutButton?.addEventListener("click", () => {
  setToken(null);
  window.location.assign("login.html");
});

async function init() {
  try {
    const admin = await requireAdmin();
    if (identity) { identity.textContent = admin.user.email; identity.hidden = false; }
    if (content) content.hidden = false;
  } catch (err) {
    if (shouldRedirectToAdminLogin(err)) window.location.assign("login.html");
  }
}

init();
