import { signOut } from "firebase/auth";
import { requireAdmin } from "./admin-guard.js";
import { auth } from "./firebase-init.js";

const dashboardContent = document.querySelector("#admin-dashboard-content");
const identity = document.querySelector("#admin-identity");
const logoutButton = document.querySelector("#admin-logout");

async function endSessionAndReturnToLogin() {
  if (auth) {
    try {
      await signOut(auth);
    } catch {
      // La redirección mantiene el área administrativa protegida aun si falla el cierre remoto.
    }
  }

  window.location.replace("login.html");
}

async function protectDashboard() {
  try {
    const { user, profile } = await requireAdmin();
    identity.textContent = profile.displayName || user.email;
    identity.hidden = false;
    dashboardContent.hidden = false;
  } catch {
    await endSessionAndReturnToLogin();
  }
}

logoutButton?.addEventListener("click", endSessionAndReturnToLogin);

protectDashboard();
