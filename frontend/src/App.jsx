import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import ClientLayout from "./layouts/ClientLayout";
import AdminLayout from "./layouts/AdminLayout";
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import { ClientProtectedRoute, AdminProtectedRoute } from "./auth/ProtectedRoutes";
import { reportError } from "./utils/errorReporter";
// Note : le widget chatbot est désormais un projet séparé (~/toulemonde-chatbot)
// chargé via <script src="..."> dans index.html. Pas d'import React ici.

if (typeof window !== "undefined" && !window.__leonErrorHandlersInstalled) {
  window.__leonErrorHandlersInstalled = true;
  window.addEventListener("error", (e) => {
    reportError(e.error || new Error(e.message), { src: e.filename, line: e.lineno, col: e.colno });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
    reportError(reason, { type: "unhandledrejection" });
  });
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/client/login" element={<Login mode="client" />} />
        <Route path="/client/forgot-password" element={<ForgotPassword mode="client" />} />
        <Route path="/client/reset-password/:token" element={<ResetPassword mode="client" />} />

        <Route path="/admin/login" element={<Login mode="admin" />} />
        <Route path="/admin/forgot-password" element={<ForgotPassword mode="admin" />} />
        <Route path="/admin/reset-password/:token" element={<ResetPassword mode="admin" />} />

        <Route path="/login" element={<Navigate to="/client/login" replace />} />
        <Route path="/forgot-password" element={<Navigate to="/client/forgot-password" replace />} />
        <Route path="/reset-password/:token" element={<ResetPassword mode="client" />} />

        <Route
          path="/client/*"
          element={
            <ClientProtectedRoute>
              <ClientLayout />
            </ClientProtectedRoute>
          }
        />

        <Route
          path="/admin/*"
          element={
            <AdminProtectedRoute>
              <AdminLayout />
            </AdminProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/client" replace />} />
        <Route path="/orders/new" element={<Navigate to="/client/orders/new" replace />} />
        <Route path="/orders" element={<Navigate to="/client/orders" replace />} />
        <Route path="/orders/:id" element={<Navigate to="/client/orders" replace />} />
        <Route path="/documents" element={<Navigate to="/client/documents" replace />} />
        <Route path="/profile" element={<Navigate to="/client/profile" replace />} />
        <Route path="/contact" element={<Navigate to="/client/contact" replace />} />
        <Route path="*" element={<Navigate to="/client" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
