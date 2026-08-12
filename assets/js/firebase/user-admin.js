import { getToken, setToken, requireAdmin } from "./admin-guard.js";

export async function getCurrentUserContext() {
  try {
    return await requireAdmin();
  } catch (e) {
    return null;
  }
}

export async function isCurrentUserAdmin() {
  const ctx = await getCurrentUserContext();
  return Boolean(ctx && ctx.profile && ctx.profile.role === 'admin');
}

export function logoutUser() {
  setToken(null);
  window.location.assign("login.html");
}
