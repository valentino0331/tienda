export class AdminAccessError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AdminAccessError";
    this.code = code;
  }
}

export function shouldRedirectToAdminLogin(error) {
  return error instanceof AdminAccessError && ["auth-required", "admin-required"].includes(error.code);
}

export function getToken() {
  return localStorage.getItem('admin_token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('admin_token', token);
  } else {
    localStorage.removeItem('admin_token');
  }
}

export function getAuthHeaders() {
  const token = getToken();
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export async function requireAdmin() {
  const token = getToken();
  if (!token) {
    throw new AdminAccessError("auth-required", "Se requiere una sesión autenticada para acceder al área administrativa.");
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      setToken(null);
      throw new AdminAccessError("auth-required", "Sesión expirada o inválida.");
    }
    const data = await res.json();
    if (!data.user || data.user.role !== 'admin') {
      throw new AdminAccessError("admin-required", "Se requiere rol de administrador.");
    }
    return { user: data.user, profile: { role: 'admin', isActive: true, email: data.user.email } };
  } catch (err) {
    if (err instanceof AdminAccessError) throw err;
    throw new AdminAccessError("auth-required", err.message);
  }
}
