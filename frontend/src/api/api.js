import { getLegacySession, getSession } from "../auth/session";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3010";

function getScopeForPath(path) {
  if (path.startsWith("/api/admin")) return "admin";
  if (path.startsWith("/api/client")) return "client";
  if (path.startsWith("/api/auth/admin")) return "admin";
  if (path.startsWith("/api/auth/client")) return "client";
  return "client";
}

export async function api(path, options = {}) {
  const session = getSession(getScopeForPath(path));
  const legacySession = getLegacySession();
  const { token } = session.token ? session : legacySession;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Erreur API");
  }

  return data;
}
