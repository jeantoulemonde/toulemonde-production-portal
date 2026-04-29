import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router";
import { Building2, ClipboardList, Gauge, LogOut, Package, ScrollText, Settings, Users } from "lucide-react";
import logoMarkWhite from "../assets/M-DEFONCE.png";
import { clearSession } from "../auth/session";
import { api } from "../api/api";
import { styles } from "../styles";
import { useIsMobile } from "../utils/useIsMobile";
import AdminNavItem from "../components/AdminNavItem";
import HealthStatusBadge from "../components/HealthStatusBadge";
import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminClients from "../pages/admin/AdminClients";
import AdminClientDetail from "../pages/admin/AdminClientDetail";
import AdminUsers from "../pages/admin/AdminUsers";
import AdminOrders from "../pages/admin/AdminOrders";
import AdminOrderDetail from "../pages/admin/AdminOrderDetail";
import AdminConnectorSage from "../pages/admin/AdminConnectorSage";
import AdminSyncLogs from "../pages/admin/AdminSyncLogs";
import AdminCatalog from "../pages/admin/AdminCatalog";

function AdminLayout() {
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const isMobile = useIsMobile(980);

  async function loadPendingCount() {
    const data = await api("/api/admin/orders/pending-count");
    setPendingCount(data.count || 0);
  }

  useEffect(() => {
    loadPendingCount().catch((err) => {
      // Badge count failure is non-blocking; admin pages will show their own errors.
      console.warn("[AdminLayout] pending-count fetch failed:", err.message);
    });
  }, []);

  function logout() {
    clearSession("admin");
    navigate("/admin/login");
  }

  return (
    <div style={{ ...styles.adminShell, ...(isMobile ? styles.adminShellMobile : {}) }}>
      <aside style={{ ...styles.adminSidebar, ...(isMobile ? styles.adminSidebarMobile : {}) }}>
        <div>
          <div style={styles.adminBrand}>
            <img src={logoMarkWhite} alt="" style={styles.adminLogo} />
            <div>
              <div style={styles.adminBrandTitle}>Admin Toulemonde</div>
              <div style={styles.adminBrandSub}>Back-office portail</div>
            </div>
          </div>
          <nav style={{ ...styles.adminNav, ...(isMobile ? styles.adminNavMobile : {}) }}>
            <AdminNavItem to="/admin" label="Dashboard" icon={Gauge} end />
            <AdminNavItem to="/admin/clients" label="Clients" icon={Building2} />
            <AdminNavItem to="/admin/users" label="Utilisateurs" icon={Users} />
            <AdminNavItem to="/admin/orders" label="Commandes" icon={ClipboardList} badge={pendingCount} />
            <AdminNavItem to="/admin/catalog" label="Catalogue mercerie" icon={Package} />
            <AdminNavItem to="/admin/connector-sage" label="Connecteur Sage" icon={Settings} />
            <AdminNavItem to="/admin/sync-logs" label="Logs de synchronisation" icon={ScrollText} />
          </nav>
        </div>
        <div style={styles.adminSidebarFooter}>
          <HealthStatusBadge showSage />
          <button style={styles.adminLogoutButton} onClick={logout}><LogOut size={17} />Déconnexion</button>
        </div>
      </aside>
      <main style={{ ...styles.adminMain, ...(isMobile ? styles.adminMainMobile : {}) }}>
        <Routes>
          <Route index element={<AdminDashboard />} />
          <Route path="clients" element={<AdminClients />} />
          <Route path="clients/:id" element={<AdminClientDetail />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="orders" element={<AdminOrders onPendingCountChange={loadPendingCount} />} />
          <Route path="orders/:id" element={<AdminOrderDetail />} />
          <Route path="catalog" element={<AdminCatalog />} />
          <Route path="connector-sage" element={<AdminConnectorSage />} />
          <Route path="sync-logs" element={<AdminSyncLogs />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default AdminLayout;
