import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router";
import { Activity, Building2, ClipboardList, Gauge, LogOut, Mail, MessageCircle, Package, PanelLeft, ScrollText, Settings, Users } from "lucide-react";
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
import AdminMailTemplates from "../pages/admin/AdminMailTemplates";
import AdminLogs from "../pages/admin/AdminLogs";
import AdminChatPage from "../pages/admin/AdminChatPage";

const SIDEBAR_EXPANDED_WIDTH = 288;
const SIDEBAR_COLLAPSED_WIDTH = 90;
const STORAGE_KEY = "admin_sidebar_expanded";

function readInitialExpanded() {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true;
    return raw === "true";
  } catch {
    return true;
  }
}

function AdminLayout() {
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const isMobile = useIsMobile(980);
  // État lu depuis localStorage AVANT le premier render pour éviter le saut visuel.
  const [expanded, setExpanded] = useState(readInitialExpanded);

  // En mobile, on ignore le toggle : la sidebar passe en bandeau horizontal.
  const collapsed = !isMobile && !expanded;

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

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(expanded));
    } catch {
      // localStorage indisponible (mode privé strict) : on continue sans persister.
    }
  }, [expanded]);

  function logout() {
    clearSession("admin");
    navigate("/admin/login");
  }

  // Animation de la largeur du panneau gauche : on garde le grid mais on transitionne
  // gridTemplateColumns. Compatible avec les navigateurs modernes.
  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;
  const shellStyle = {
    ...styles.adminShell,
    ...(isMobile ? styles.adminShellMobile : { gridTemplateColumns: `${sidebarWidth}px minmax(0, 1fr)` }),
    transition: "grid-template-columns 0.25s ease",
  };

  return (
    <div style={shellStyle}>
      <aside
        style={{
          ...styles.adminSidebar,
          ...(isMobile ? styles.adminSidebarMobile : {}),
          ...(collapsed ? { padding: "18px 12px" } : {}),
          transition: "padding 0.25s ease",
        }}
      >
        <div>
          <div
            style={{
              ...styles.adminBrand,
              ...(collapsed ? { flexDirection: "column", gap: 10, padding: "6px 0 18px" } : {}),
            }}
          >
            <img src={logoMarkWhite} alt="" style={styles.adminLogo} />
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.adminBrandTitle}>Admin Toulemonde</div>
                <div style={styles.adminBrandSub}>Back-office portail</div>
              </div>
            )}
            {!isMobile && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                title={collapsed ? "Déplier la navigation" : "Replier la navigation"}
                aria-label={collapsed ? "Déplier la navigation" : "Replier la navigation"}
                aria-expanded={!collapsed}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                  flexShrink: 0,
                }}
              >
                <PanelLeft size={16} strokeWidth={1.8} />
              </button>
            )}
          </div>
          <nav style={{ ...styles.adminNav, ...(isMobile ? styles.adminNavMobile : {}) }}>
            <AdminNavItem to="/admin" label="Dashboard" icon={Gauge} collapsed={collapsed} end />
            <AdminNavItem to="/admin/clients" label="Clients" icon={Building2} collapsed={collapsed} />
            <AdminNavItem to="/admin/users" label="Utilisateurs" icon={Users} collapsed={collapsed} />
            <AdminNavItem to="/admin/orders" label="Commandes" icon={ClipboardList} badge={pendingCount} collapsed={collapsed} />
            <AdminNavItem to="/admin/catalog" label="Catalogue mercerie" icon={Package} collapsed={collapsed} />
            <AdminNavItem to="/admin/mail-templates" label="Templates email" icon={Mail} collapsed={collapsed} />
            <AdminNavItem to="/admin/logs" label="Activité du portail" icon={Activity} collapsed={collapsed} />
            <AdminNavItem to="/admin/chat" label="Conversations" icon={MessageCircle} collapsed={collapsed} />
            <AdminNavItem to="/admin/connector-sage" label="Connecteur Sage" icon={Settings} collapsed={collapsed} />
            <AdminNavItem to="/admin/sync-logs" label="Logs de synchronisation" icon={ScrollText} collapsed={collapsed} />
          </nav>
        </div>
        <div style={styles.adminSidebarFooter}>
          {!collapsed && <HealthStatusBadge showSage />}
          <button
            style={{
              ...styles.adminLogoutButton,
              ...(collapsed ? { justifyContent: "center", padding: 0, width: 46, marginInline: "auto" } : {}),
            }}
            onClick={logout}
            title={collapsed ? "Déconnexion" : undefined}
            aria-label={collapsed ? "Déconnexion" : undefined}
          >
            <LogOut size={17} />
            {!collapsed && "Déconnexion"}
          </button>
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
          <Route path="mail-templates" element={<AdminMailTemplates />} />
          <Route path="logs" element={<AdminLogs />} />
          <Route path="chat" element={<AdminChatPage />} />
          <Route path="connector-sage" element={<AdminConnectorSage />} />
          <Route path="sync-logs" element={<AdminSyncLogs />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default AdminLayout;
