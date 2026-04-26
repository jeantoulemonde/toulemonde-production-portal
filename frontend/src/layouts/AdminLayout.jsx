import { Navigate, Route, Routes, useNavigate } from "react-router";
import { Building2, ClipboardList, Gauge, LogOut, ScrollText, Settings, Users } from "lucide-react";
import logoMarkWhite from "../assets/M-DEFONCE.png";
import { clearSession } from "../auth/session";
import { styles } from "../styles";
import AdminNavItem from "../components/AdminNavItem";
import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminClients from "../pages/admin/AdminClients";
import AdminClientDetail from "../pages/admin/AdminClientDetail";
import AdminUsers from "../pages/admin/AdminUsers";
import AdminOrders from "../pages/admin/AdminOrders";
import AdminOrderDetail from "../pages/admin/AdminOrderDetail";
import AdminConnectorSage from "../pages/admin/AdminConnectorSage";
import AdminSyncLogs from "../pages/admin/AdminSyncLogs";

function AdminLayout() {
  const navigate = useNavigate();

  function logout() {
    clearSession("admin");
    navigate("/admin/login");
  }

  return (
    <div style={styles.adminShell}>
      <aside style={styles.adminSidebar}>
        <div>
          <div style={styles.adminBrand}>
            <img src={logoMarkWhite} alt="" style={styles.adminLogo} />
            <div>
              <div style={styles.adminBrandTitle}>Admin Toulemonde</div>
              <div style={styles.adminBrandSub}>Back-office portail</div>
            </div>
          </div>
          <nav style={styles.adminNav}>
            <AdminNavItem to="/admin" label="Dashboard" icon={Gauge} end />
            <AdminNavItem to="/admin/clients" label="Clients" icon={Building2} />
            <AdminNavItem to="/admin/users" label="Utilisateurs" icon={Users} />
            <AdminNavItem to="/admin/orders" label="Commandes" icon={ClipboardList} />
            <AdminNavItem to="/admin/connector-sage" label="Connecteur Sage" icon={Settings} />
            <AdminNavItem to="/admin/sync-logs" label="Logs de synchronisation" icon={ScrollText} />
          </nav>
        </div>
        <button style={styles.adminLogoutButton} onClick={logout}><LogOut size={17} />Déconnexion</button>
      </aside>
      <main style={styles.adminMain}>
        <Routes>
          <Route index element={<AdminDashboard />} />
          <Route path="clients" element={<AdminClients />} />
          <Route path="clients/:id" element={<AdminClientDetail />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/:id" element={<AdminOrderDetail />} />
          <Route path="connector-sage" element={<AdminConnectorSage />} />
          <Route path="sync-logs" element={<AdminSyncLogs />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default AdminLayout;
