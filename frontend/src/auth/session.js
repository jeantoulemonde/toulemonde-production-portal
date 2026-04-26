export function getSession() {
  return {
    token: localStorage.getItem("portal_access_token"),
    user: JSON.parse(localStorage.getItem("portal_user") || "null"),
  };
}

export function setSession(data) {
  localStorage.setItem("portal_access_token", data.accessToken);
  localStorage.setItem("portal_refresh_token", data.refreshToken);
  localStorage.setItem("portal_user", JSON.stringify(data.user));
}

export function clearSession() {
  localStorage.removeItem("portal_access_token");
  localStorage.removeItem("portal_refresh_token");
  localStorage.removeItem("portal_user");
}
