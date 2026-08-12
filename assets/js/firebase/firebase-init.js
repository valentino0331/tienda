import { initializeApp } from "firebase/app";
import { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app-check.js";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { appCheckSiteKey, firebaseConfig } from "./config.js";

const requiredConfigKeys = ["apiKey", "authDomain", "projectId", "appId"];
const localHosts = new Set(["localhost", "127.0.0.1"]);
const currentUrl = new URL(window.location.href);
const isLocalHost = localHosts.has(currentUrl.hostname);
const emulatorSessionKey = "exclusiveShopUseEmulators";
const emulatorRequested = currentUrl.searchParams.get("firebase") === "emulator";

if (isLocalHost && emulatorRequested) {
  window.sessionStorage.setItem(emulatorSessionKey, "true");
}

const useEmulators = isLocalHost && (
  emulatorRequested || window.sessionStorage.getItem(emulatorSessionKey) === "true"
);

if (isLocalHost && !useEmulators) {
  console.warn("Firebase local bloqueado: abre la aplicación con ?firebase=emulator para usar Emulator Suite.");
}

const hasValidFirebaseConfig =
  firebaseConfig &&
  typeof firebaseConfig === "object" &&
  requiredConfigKeys.every(
    (key) => typeof firebaseConfig[key] === "string" && firebaseConfig[key].trim()
  );

const activeConfig = useEmulators
  ? {
      ...firebaseConfig,
      projectId: "demo-exclusive-shop",
      authDomain: "demo-exclusive-shop.firebaseapp.com"
    }
  : firebaseConfig;

/**
 * Aplicación Firebase compartida.
 */
export const app = hasValidFirebaseConfig && (!isLocalHost || useEmulators) ? initializeApp(activeConfig) : null;

// App Check solo se inicializa fuera de localhost. El Emulator Suite no recibe
// tokens de producción ni necesita Debug Provider para las pruebas automatizadas.
export const appCheck = app && !isLocalHost
  ? initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true
    })
  : null;

let appCheckStatus = { enabled: Boolean(appCheck), valid: appCheck ? null : false, errorCode: null };

/** Espera una atestación sin exponer ni registrar el token. */
export async function ensureAppCheckToken() {
  if (!appCheck) return { ...appCheckStatus, skipped: true };
  try {
    const result = await getToken(appCheck, false);
    if (!result?.token) throw new Error("App Check no devolvió un token.");
    appCheckStatus = { enabled: true, valid: true, errorCode: null };
    return { ...appCheckStatus };
  } catch (error) {
    appCheckStatus = { enabled: true, valid: false, errorCode: error?.code || "app-check-token-unavailable" };
    console.warn("No se pudo obtener un token App Check para una operación protegida.", { code: appCheckStatus.errorCode });
    throw error;
  }
}

export function getAppCheckStatus() {
  return { ...appCheckStatus };
}

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

if (useEmulators && auth && db) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

export const firebaseEnvironment = useEmulators ? "emulator" : "production";
