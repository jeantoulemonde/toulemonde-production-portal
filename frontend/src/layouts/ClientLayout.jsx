import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router";
import { Contact, FileText, Home, LogOut, PanelLeft, PlusCircle, User, ClipboardList, Package, ShoppingCart, ListChecks } from "lucide-react";
import logoMarkWhite from "../assets/M-DEFONCE.png";
import { clearSession, getSession, userModules } from "../auth/session";
import { styles } from "../styles";
import { useIsMobile } from "../utils/useIsMobile";
import NavItem from "../components/NavItem";
import SectionHeader from "../components/SectionHeader";
import ClientDashboard from "../pages/client/ClientDashboard";
import NewYarnOrder from "../pages/client/NewYarnOrder";
import ClientOrders from "../pages/client/ClientOrders";
import ClientOrderDetail from "../pages/client/ClientOrderDetail";
import ClientDocuments from "../pages/client/ClientDocuments";
import ClientProfile from "../pages/client/ClientProfile";
import ClientContact from "../pages/client/ClientContact";
import ClientMercerieCatalog from "../pages/client/ClientMercerieCatalog";
import ClientMercerieCart from "../pages/client/ClientMercerieCart";
import ClientMercerieOrders from "../pages/client/ClientMercerieOrders";
import ClientMercerieOrderDetail from "../pages/client/ClientMercerieOrderDetail";
import ClientMercerieProductDetail from "../pages/client/ClientMercerieProductDetail";

function ClientLayout() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useIsMobile(900);
  const drawerVisible = isMobile ? menuOpen : true;
  const drawerExpanded = menuOpen;
  const modules = userModules(getSession("client").user);
  const isMixte = modules.yarn && modules.mercerie;
  const SIDEBAR_COLLAPSED_WIDTH = 88;
  const SIDEBAR_EXPANDED_WIDTH = 288;
  const mainShift = isMobile ? 0 : drawerExpanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH;

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  async function logout() {
    // Best-effort : purge les sessions chatbot du user pour repartir
    // sur un historique vierge au prochain login (gain de latence sur le
    // 1er message). On le fait AVANT clearSession sinon plus de JWT pour
    // s'authentifier auprès du chatbot.
    try {
      const token = localStorage.getItem("portal_client_access_token");
      if (token) {
        const chatbotUrl = import.meta.env.VITE_CHATBOT_URL || "http://localhost:3020";
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 1500); // ne bloque pas le logout
        await fetch(`${chatbotUrl}/api/chat/sessions/current`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          signal: ctrl.signal,
        }).catch(() => {});
        clearTimeout(timeoutId);
      }
    } catch { /* silencieux */ }
    clearSession("client");
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

        <nav style={styles.nav}>
          <NavItem to="/client" label="Accueil" icon={Home} collapsed={!drawerExpanded} end onNavigate={() => isMobile && setMenuOpen(false)} />

          {isMixte && drawerExpanded && (
            <SectionHeader type="industriel" compact />
          )}
          {modules.yarn && (
            <>
              <NavItem to="/client/orders/new" label="Nouvelle demande" icon={PlusCircle} collapsed={!drawerExpanded} accent="industriel" onNavigate={() => isMobile && setMenuOpen(false)} />
              <NavItem to="/client/orders" label={isMixte ? "Mes demandes" : "Mes demandes"} icon={ClipboardList} collapsed={!drawerExpanded} accent="industriel" onNavigate={() => isMobile && setMenuOpen(false)} />
            </>
          )}

          {isMixte && drawerExpanded && (
            <SectionHeader type="mercerie" compact />
          )}
          {modules.mercerie && (
            <>
              <NavItem to="/client/mercerie" label="Catalogue" icon={Package} collapsed={!drawerExpanded} accent="mercerie" onNavigate={() => isMobile && setMenuOpen(false)} />
              <NavItem to="/client/mercerie/cart" label="Panier" icon={ShoppingCart} collapsed={!drawerExpanded} accent="mercerie" onNavigate={() => isMobile && setMenuOpen(false)} />
              <NavItem to="/client/mercerie/orders" label="Commandes mercerie" icon={ListChecks} collapsed={!drawerExpanded} accent="mercerie" onNavigate={() => isMobile && setMenuOpen(false)} />
            </>
          )}

          {isMixte && drawerExpanded && (
            <div style={styles.menuSectionLabel}>Mon compte</div>
          )}
          <NavItem to="/client/documents" label="Documents" icon={FileText} collapsed={!drawerExpanded} onNavigate={() => isMobile && setMenuOpen(false)} />
          <NavItem to="/client/profile" label="Profil" icon={User} collapsed={!drawerExpanded} onNavigate={() => isMobile && setMenuOpen(false)} />
          <NavItem to="/client/contact" label="Contact" icon={Contact} collapsed={!drawerExpanded} onNavigate={() => isMobile && setMenuOpen(false)} />
        </nav>
        <button
          style={{ ...styles.logoutButton, ...(!drawerExpanded ? styles.logoutButtonCollapsed : {}) }}
          onClick={logout}
          title="Déconnexion"
          aria-label="Déconnexion"
        >
          <LogOut size={18} />
          {drawerExpanded && <span>Déconnexion</span>}
        </button>
      </aside>

      <main style={{ ...styles.main, marginLeft: mainShift }}>
        <div style={styles.mainInner}>
          <Routes>
            <Route index element={<ClientDashboard />} />
            {modules.yarn && (
              <>
                <Route path="orders/new" element={<NewYarnOrder />} />
                <Route path="orders" element={<ClientOrders />} />
                <Route path="orders/:id" element={<ClientOrderDetail />} />
              </>
            )}
            {modules.mercerie && (
              <>
                <Route path="mercerie" element={<ClientMercerieCatalog />} />
                <Route path="mercerie/products/:id" element={<ClientMercerieProductDetail />} />
                <Route path="mercerie/cart" element={<ClientMercerieCart />} />
                <Route path="mercerie/orders" element={<ClientMercerieOrders />} />
                <Route path="mercerie/orders/:id" element={<ClientMercerieOrderDetail />} />
              </>
            )}
            <Route path="documents" element={<ClientDocuments />} />
            <Route path="profile" element={<ClientProfile />} />
            <Route path="contact" element={<ClientContact />} />
            <Route path="*" element={<Navigate to="/client" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default ClientLayout;
