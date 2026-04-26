import { Navigate } from "react-router";
import { getSession } from "./session";

export const ADMIN_ROLES = ["admin_portal", "commercial", "production", "super_admin"];

function Protected({ children, roles, redirectTo }) {
  const { token, user } = getSession();

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
    <Protected roles={["client"]} redirectTo="/client/login">
      {children}
    </Protected>
  );
}

export function AdminProtectedRoute({ children }) {
  return (
    <Protected roles={ADMIN_ROLES} redirectTo="/admin/login">
      {children}
    </Protected>
  );
}
