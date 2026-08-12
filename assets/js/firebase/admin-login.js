import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { AdminAccessError, requireAdmin } from "./admin-guard.js";
import { auth } from "./firebase-init.js";

const form = document.querySelector("#admin-login-form");
const emailInput = document.querySelector("#admin-email");
const passwordInput = document.querySelector("#admin-password");
const statusMessage = document.querySelector("#login-status");
const submitButton = form?.querySelector('button[type="submit"]');

function showStatus(message) {
  statusMessage.textContent = message;
  statusMessage.hidden = false;
}

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? "Validando acceso..." : "Iniciar sesión";
}

function getLoginErrorMessage(error) {
  switch (error.code) {
    case "auth/invalid-email":
      return "Ingresa un correo electrónico válido.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "El correo o la contraseña son incorrectos.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera un momento antes de volver a intentarlo.";
    case "auth/network-request-failed":
      return "No se pudo conectar. Revisa tu conexión e inténtalo nuevamente.";
    default:
      return "No fue posible iniciar sesión. Inténtalo nuevamente.";
  }
}

async function rejectUnauthorizedAccess(message) {
  if (auth) {
    try {
      await signOut(auth);
    } catch {
      // El mensaje de acceso denegado sigue siendo necesario si falla el cierre remoto.
    }
  }

  showStatus(message);
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  event.stopPropagation();

  if (!auth) {
    showStatus("La configuración de Firebase no está disponible.");
    return;
  }

  setSubmitting(true);
  statusMessage.hidden = true;
  let signedIn = false;

  try {
    await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
    signedIn = true;
    await requireAdmin();
    window.location.assign("dashboard.html");
  } catch (error) {
    if (signedIn) {
      const message =
        error instanceof AdminAccessError
          ? "Acceso no autorizado. Se requiere un administrador activo."
          : "No se pudo verificar el acceso administrativo. La sesión fue cerrada.";
      await rejectUnauthorizedAccess(message);
    } else {
      showStatus(getLoginErrorMessage(error));
    }
  } finally {
    passwordInput.value = "";
    setSubmitting(false);
  }
});
