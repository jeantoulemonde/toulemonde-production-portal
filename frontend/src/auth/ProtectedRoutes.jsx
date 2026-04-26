import { Navigate } from "react-router";
import { getLegacySession, getSession } from "./session";

export const ADMIN_ROLES = ["admin_portal", "commercial", "production", "super_admin"];

function Protected({ children, roles, redirectTo, scope }) {
  const session = getSession(scope);
  const legacySession = getLegacySession();
  const { token, user } = session.token ? session : legacySession;

  if (!token || !user) {
    return <Navigate to={redirectTo} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}

export function ClientProtectedRoute({ children }) {
  return (
    <Protected scope="client" roles={["client"]} redirectTo="/client/login">
      {children}
    </Protected>
  );
}

export function AdminProtectedRoute({ children }) {
  return (
    <Protected scope="admin" roles={ADMIN_ROLES} redirectTo="/admin/login">
      {children}
    </Protected>
  );
}
