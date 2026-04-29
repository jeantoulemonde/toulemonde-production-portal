import { clearSession, getLegacySession, getSession } from "../auth/session";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3010";

function getScopeForPath(path) {
  if (path.startsWith("/api/admin")) return "admin";
  if (path.startsWith("/api/client")) return "client";
  if (path.startsWith("/api/auth/admin")) return "admin";
  if (path.startsWith("/api/auth/client")) return "client";
  return "client";
}

export async function api(path, options = {}) {
  const scope = getScopeForPath(path);
  const session = getSession(scope);
  const legacySession = getLegacySession();
  const activeSession = session.token ? session : legacySession;
  const { token, user } = activeSession;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  const isAuthFormRoute = /\/api\/auth\/(client\/|admin\/)?(login|forgot-password|reset-password)$/.test(path);
  if (response.status === 401 && !isAuthFormRoute) {
    const currentPath = window.location.pathname;
    const isAdminRole = ["admin_portal", "commercial", "production", "super_admin"].includes(user?.role);
    const isAdminRoute = currentPath.startsWith("/admin") || path.startsWith("/api/admin") || isAdminRole;
    clearSession(isAdminRoute ? "admin" : "client");
    clearSession("legacy");
    window.location.href = isAdminRoute ? "/admin/login?expired=1" : "/client/login?expired=1";
    throw new Error(data.error || "Session expirée");
  }

  if (response.status === 403 && data?.code === "MODULE_FORBIDDEN") {
    clearSession(user?.role === "client" ? "client" : "admin");
    clearSession("legacy");
    window.location.href = "/client/login?moduleRevoked=1";
    throw new Error(data.error || "Module non disponible");
  }

  if (!response.ok) {
    throw new Error(data.error || "Erreur API");
  }

  return data;
}
