import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase-init.js";

function requireFirebaseServices() {
  if (!auth || !db) {
    throw new Error(
      "Firebase requiere una configuración web válida antes de usar usuarios."
    );
  }
}

/**
 * Espera a que Firebase Authentication resuelva la sesión actual.
 * Devuelve `null` cuando no existe un usuario autenticado.
 */
export function getAuthenticatedUser() {
  requireFirebaseServices();

  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        resolve(user);
      },
      reject
    );
  });
}

/**
 * Obtiene el perfil existente en `users/{uid}`. Esta función nunca crea ni
 * modifica documentos de usuario.
 */
export async function getUserProfile(uid) {
  requireFirebaseServices();

  if (typeof uid !== "string" || !uid.trim()) {
    return null;
  }

  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? { uid: snapshot.id, ...snapshot.data() } : null;
}

/**
 * Devuelve la sesión y su perfil Firestore, o `null` si no hay sesión.
 */
export async function getCurrentUserContext() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return null;
  }

  const profile = await getUserProfile(user.uid);
  return { user, profile };
}

/**
 * Un administrador debe tener un perfil existente, rol `admin` y estar activo.
 */
export async function isCurrentUserAdmin() {
  const context = await getCurrentUserContext();

  return Boolean(
    context?.profile?.role === "admin" && context.profile.isActive === true
  );
}
