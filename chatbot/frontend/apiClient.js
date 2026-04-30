// ============================================================================
// POC chatbot — module isolé, activé par CHATBOT_ENABLED.
// Retrait : voir chatbot/README.md → "Procédure de désactivation / retrait".
// ============================================================================
// Fetch wrapper utilisé par le module chatbot.
// Lit le token JWT depuis les mêmes clés localStorage que session.js du portail.

const TOKEN_KEYS = {
  client: "portal_client_access_token",
  admin: "portal_admin_access_token",
};

function readToken(scope) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEYS[scope]) || null;
  } catch {
    return null;
  }
}

// Choisit le scope selon l'URL d'abord (/client/* → client, /admin/* → admin),
// puis fallback sur la priorité historique (admin > client) pour les pages
// neutres (login, racine). Évite que la bulle client soit masquée quand
// l'utilisateur est connecté sur les deux scopes en parallèle.
function readActiveScope() {
  if (typeof window === "undefined") return null;
  const path = window.location.pathname || "";
  const hasAdmin = !!window.localStorage.getItem(TOKEN_KEYS.admin);
  const hasClient = !!window.localStorage.getItem(TOKEN_KEYS.client);
  if (path.startsWith("/admin")) return hasAdmin ? "admin" : null;
  if (path.startsWith("/client")) return hasClient ? "client" : null;
  if (hasAdmin) return "admin";
  if (hasClient) return "client";
  return null;
}

export async function chatFetch(path, opts = {}) {
  const scope = opts.scope || readActiveScope();
  const token = scope ? readToken(scope) : null;
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers || {}),
  };
  const response = await fetch(path, { ...opts, headers });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error = new Error(data?.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export { readActiveScope };