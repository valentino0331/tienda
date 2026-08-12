import { setToken, requireAdmin } from "./admin-guard.js";

const form = document.querySelector("#admin-login-form");
const emailInput = document.querySelector("#admin-email");
const passwordInput = document.querySelector("#admin-password");
const statusMessage = document.querySelector("#login-status");
const submitButton = form?.querySelector('button[type="submit"]');

function showStatus(message) {
  if (statusMessage) {
    statusMessage.textContent = message;
    statusMessage.hidden = false;
  }
}

function setSubmitting(isSubmitting) {
  if (submitButton) {
    submitButton.disabled = isSubmitting;
    submitButton.textContent = isSubmitting ? "Validando acceso..." : "Iniciar sesión";
  }
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  event.stopPropagation();

  setSubmitting(true);
  if (statusMessage) statusMessage.hidden = true;

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Error al iniciar sesión.");
    }

    setToken(data.token);
    await requireAdmin();
    window.location.assign("dashboard.html");
  } catch (error) {
    showStatus(error.message || "No fue posible iniciar sesión. Inténtalo nuevamente.");
  } finally {
    passwordInput.value = "";
    setSubmitting(false);
  }
});
