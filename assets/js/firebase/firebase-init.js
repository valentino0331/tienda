import { initializeApp } from "firebase/app";
import { firebaseConfig } from "./config.js";

const requiredConfigKeys = ["apiKey", "authDomain", "projectId", "appId"];

const hasValidFirebaseConfig =
  firebaseConfig &&
  typeof firebaseConfig === "object" &&
  requiredConfigKeys.every(
    (key) => typeof firebaseConfig[key] === "string" && firebaseConfig[key].trim()
  );

/**
 * Aplicación Firebase compartida. Permanecerá sin inicializar hasta que se
 * agregue la configuración real de la aplicación web registrada.
 *
 * Aquí se podrán incorporar posteriormente Authentication, Firestore,
 * Storage y App Check mediante los imports modulares correspondientes.
 */
export const app = hasValidFirebaseConfig ? initializeApp(firebaseConfig) : null;
