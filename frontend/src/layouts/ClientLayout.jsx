import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router";
import { Contact, FileText, Home, LogOut, PanelLeft, PlusCircle, User, ClipboardList } from "lucide-react";
import logoMarkWhite from "../assets/M-DEFONCE.png";
import logoMarkBlue from "../assets/M-RVB-2.png";
import { clearSession } from "../auth/session";
import { styles } from "../styles";
import { useIsMobile } from "../utils/useIsMobile";
import NavItem from "../components/NavItem";
import ClientDashboard from "../pages/client/ClientDashboard";
import NewYarnOrder from "../pages/client/NewYarnOrder";
import ClientOrders from "../pages/client/ClientOrders";
import ClientOrderDetail from "../pages/client/ClientOrderDetail";
import ClientDocuments from "../pages/client/ClientDocuments";
import ClientProfile from "../pages/client/ClientProfile";
import ClientContact from "../pages/client/ClientContact";

function ClientLayout() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useIsMobile(900);
  const drawerVisible = isMobile ? menuOpen : true;
  const drawerExpanded = isMobile ? menuOpen : menuOpen;
  const mainShift = isMobile ? 0 : drawerExpanded ? 288 : 76;

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  function logout() {
    clearSession();
    navigate("/client/login");
  }

  return (
    <div style={styles.shell}>
      <header style={styles.appTopBar}>
        <div style={styles.topBarLeft}>
          <button
            type="button"
            aria-label={menuOpen ? "Replier la navigation" : "Ouvrir la navigation"}
            aria-expanded={menuOpen}
            style={styles.panelButton}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <PanelLeft size={24} strokeWidth={1.8} />
          </button>
          <img
            src={logoMarkWhite}
            alt="Toulemonde"
            style={{
              ...styles.headerLogo,
              ...(drawerExpanded ? styles.headerLogoOpen : styles.headerLogoClosed),
            }}
          />
          <div style={styles.brandText}>Toulemonde Production</div>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.headerActionButton} onClick={() => navigate("/client/profile")}>Profil</button>
        </div>
      </header>

      {isMobile && menuOpen && <button aria-label="Fermer le menu" style={styles.menuOverlay} onClick={() => setMenuOpen(false)} />}

      <aside
        style={{
          ...styles.menuDrawer,
          ...(drawerVisible ? styles.menuDrawerVisible : styles.menuDrawerHidden),
          ...(drawerExpanded ? styles.menuDrawerExpanded : styles.menuDrawerCollapsed),
          ...(isMobile ? styles.menuDrawerMobile : {}),
        }}
      >
        <div style={styles.menuLogoPanel}>
          <img src={logoMarkBlue} alt="Toulemonde" style={styles.menuLogo} />
          {drawerExpanded && <div style={styles.menuSubtitle}>Portail privé filature</div>}
        </div>
        <nav style={styles.nav}>
          <NavItem to="/client" label="Accueil" icon={Home} collapsed={!drawerExpanded} end onNavigate={() => isMobile && setMenuOpen(false)} />
          <NavItem to="/client/orders/new" label="Nouvelle commande" icon={PlusCircle} collapsed={!drawerExpanded} onNavigate={() => isMobile && setMenuOpen(false)} />
          <NavItem to="/client/orders" label="Mes commandes" icon={ClipboardList} collapsed={!drawerExpanded} onNavigate={() => isMobile && setMenuOpen(false)} />
          <NavItem to="/client/documents" label="Documents" icon={FileText} collapsed={!drawerExpanded} onNavigate={() => isMobile && setMenuOpen(false)} />
          <NavItem to="/client/profile" label="Profil" icon={User} collapsed={!drawerExpanded} onNavigate={() => isMobile && setMenuOpen(false)} />
          <NavItem to="/client/contact" label="Contact" icon={Contact} collapsed={!drawerExpanded} onNavigate={() => isMobile && setMenuOpen(false)} />
        </nav>
        <button style={{ ...styles.logoutButton, ...(!drawerExpanded ? styles.logoutButtonCollapsed : {}) }} onClick={logout} title="Déconnexion">
          <LogOut size={18} />
          {drawerExpanded && <span>Déconnexion</span>}
        </button>
      </aside>

      <main style={{ ...styles.main, marginLeft: mainShift }}>
        <Routes>
          <Route index element={<ClientDashboard />} />
          <Route path="orders/new" element={<NewYarnOrder />} />
          <Route path="orders" element={<ClientOrders />} />
          <Route path="orders/:id" element={<ClientOrderDetail />} />
          <Route path="documents" element={<ClientDocuments />} />
          <Route path="profile" element={<ClientProfile />} />
          <Route path="contact" element={<ClientContact />} />
          <Route path="admin/*" element={<Navigate to="/client" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default ClientLayout;
