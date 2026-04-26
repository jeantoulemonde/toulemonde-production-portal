const SESSION_KEYS = {
  client: {
    accessToken: "portal_client_access_token",
    refreshToken: "portal_client_refresh_token",
    user: "portal_client_user",
  },
  admin: {
    accessToken: "portal_admin_access_token",
    refreshToken: "portal_admin_refresh_token",
    user: "portal_admin_user",
  },
  legacy: {
    accessToken: "portal_access_token",
    refreshToken: "portal_refresh_token",
    user: "portal_user",
  },
};

export function getSession(scope = "client") {
  const keys = SESSION_KEYS[scope] || SESSION_KEYS.client;
  const token = localStorage.getItem(keys.accessToken);
  const rawUser = localStorage.getItem(keys.user);

  if (token || rawUser) {
    return {
      token,
      user: JSON.parse(rawUser || "null"),
    };
  }

  return {
    token: null,
    user: null,
  };
}

export function getLegacySession() {
  return {
    token: localStorage.getItem(SESSION_KEYS.legacy.accessToken),
    user: JSON.parse(localStorage.getItem(SESSION_KEYS.legacy.user) || "null"),
  };
}

export function setSession(data, scope = "client") {
  const keys = SESSION_KEYS[scope] || SESSION_KEYS.client;
  localStorage.setItem(keys.accessToken, data.accessToken);
  localStorage.setItem(keys.refreshToken, data.refreshToken);
  localStorage.setItem(keys.user, JSON.stringify(data.user));

  localStorage.removeItem(SESSION_KEYS.legacy.accessToken);
  localStorage.removeItem(SESSION_KEYS.legacy.refreshToken);
  localStorage.removeItem(SESSION_KEYS.legacy.user);
}

export function clearSession(scope) {
  const scopes = scope ? [scope] : ["client", "admin", "legacy"];

  scopes.forEach((currentScope) => {
    const keys = SESSION_KEYS[currentScope];
    if (!keys) return;
    localStorage.removeItem(keys.accessToken);
    localStorage.removeItem(keys.refreshToken);
    localStorage.removeItem(keys.user);
  });
}
