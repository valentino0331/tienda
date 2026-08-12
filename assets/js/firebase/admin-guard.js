import { getCurrentUserContext } from "./user-admin.js";

export class AdminAccessError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AdminAccessError";
    this.code = code;
  }
}

/**
 * Protección reutilizable para futuras páginas de `/admin`.
 * Debe ejecutarse antes de cargar datos o acciones administrativas.
 */
export async function requireAdmin() {
  const context = await getCurrentUserContext();

  if (!context) {
    throw new AdminAccessError(
      "auth-required",
      "Se requiere una sesión autenticada para acceder al área administrativa."
    );
  }

  if (context.profile?.role !== "admin" || context.profile.isActive !== true) {
    throw new AdminAccessError(
      "admin-required",
      "Se requiere un usuario administrador activo para acceder a esta área."
    );
  }

  return context;
}
