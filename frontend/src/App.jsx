import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate, useParams } from "react-router";
import { useEffect, useState } from "react";
import { Building2, Contact, FileText, Gauge, Home, LogOut, PanelLeft, PlusCircle, ScrollText, Settings, Shield, User, Users, ClipboardList } from "lucide-react";
import logoMarkWhite from "./assets/M-DEFONCE.png";
import logoMarkBlue from "./assets/M-RVB-2.png";
import atelierMachines from "./assets/atelier-machines.png";
import atelierBobines from "./assets/atelier-bobines.png";
import atelierMatiere from "./assets/atelier-matiere.png";
import { T } from "./theme";

const API_URL = "";

function getSession() {
  return {
    token: localStorage.getItem("portal_access_token"),
    user: JSON.parse(localStorage.getItem("portal_user") || "null"),
  };
}

async function api(path, options = {}) {
  const { token } = getSession();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Erreur API");
  return data;
}

const ADMIN_ROLES = ["admin_portal", "commercial", "production", "super_admin"];

function Protected({ children, roles, redirectTo = "/client/login" }) {
  const { token, user } = getSession();
  if (!token || !user) return <Navigate to={redirectTo} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={redirectTo} replace />;
  return children;
}

function ClientProtectedRoute({ children }) {
  return <Protected roles={["client"]} redirectTo="/client/login">{children}</Protected>;
}

function AdminProtectedRoute({ children }) {
  return <Protected roles={ADMIN_ROLES} redirectTo="/admin/login">{children}</Protected>;
}

function AdminOnly({ children }) {
  return <AdminProtectedRoute>{children}</AdminProtectedRoute>;
}

function useIsMobile(breakpoint = 860) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= breakpoint);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);

  return isMobile;
}

function Layout() {
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
    localStorage.removeItem("portal_access_token");
    localStorage.removeItem("portal_refresh_token");
    localStorage.removeItem("portal_user");
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
          <Route index element={<Dashboard />} />
          <Route path="orders/new" element={<NewYarnOrder />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="documents" element={<Placeholder title="Documents" />} />
          <Route path="profile" element={<ClientProfile />} />
          <Route path="contact" element={<Placeholder title="Contacter Toulemonde Production" />} />
          <Route path="admin/*" element={<Navigate to="/client" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function NavItem({ to, label, icon: Icon, collapsed = false, end = false, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      style={({ isActive }) => ({
        ...styles.navItem,
        ...(collapsed ? styles.navItemCollapsed : {}),
        background: isActive ? T.bleuPale : "transparent",
        color: isActive ? T.bleu : T.noir,
        borderColor: isActive ? T.bleuBorder : T.border,
      })}
      title={collapsed ? label : undefined}
    >
      {Icon && <Icon size={18} strokeWidth={1.8} />}
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}

function AdminLayout() {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem("portal_access_token");
    localStorage.removeItem("portal_refresh_token");
    localStorage.removeItem("portal_user");
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
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="orders/:id" element={<AdminOrderDetail />} />
          <Route path="connector-sage" element={<AdminConnectorSage />} />
          <Route path="sync-logs" element={<AdminSyncLogs />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function AdminNavItem({ to, label, icon: Icon, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        ...styles.adminNavItem,
        ...(isActive ? styles.adminNavItemActive : {}),
      })}
    >
      <Icon size={18} strokeWidth={1.8} />
      <span>{label}</span>
    </NavLink>
  );
}

function Login({ mode = "client" }) {
  const navigate = useNavigate();
  const isAdmin = mode === "admin";
  const [email, setEmail] = useState(isAdmin ? "admin@toulemonde.local" : "client@demo.local");
  const [password, setPassword] = useState(isAdmin ? "Admin123!" : "Client123!");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    try {
      const data = await api(isAdmin ? "/api/auth/admin/login" : "/api/auth/client/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("portal_access_token", data.accessToken);
      localStorage.setItem("portal_refresh_token", data.refreshToken);
      localStorage.setItem("portal_user", JSON.stringify(data.user));
      navigate(data.redirectTo || (isAdmin ? "/admin" : "/client"));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={styles.loginPage}>
      <form style={styles.loginCard} onSubmit={submit}>
        <div style={styles.brand}>TOULEMONDE</div>
        <h1 style={styles.loginTitle}>{isAdmin ? "Back-office admin" : "Portail privé filature"}</h1>
        <p style={styles.muted}>{isAdmin ? "Accès réservé aux équipes Toulemonde Production." : "Accès privé à vos commandes de fil et documents de production."}</p>
        {error && <div style={styles.error}>{error}</div>}
        <Field label="Email"><input style={styles.input} value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
        <Field label="Mot de passe"><input style={styles.input} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
        <button style={styles.primaryButton}>Connexion</button>
        <button type="button" style={styles.linkButton} onClick={() => navigate(isAdmin ? "/admin/forgot-password" : "/client/forgot-password")}>Mot de passe oublié</button>
        <div style={styles.helpText}>{isAdmin ? "Démo admin : admin@toulemonde.local / Admin123!" : "Démo client : client@demo.local / Client123!"}</div>
      </form>
    </div>
  );
}

function ForgotPassword({ mode = "client" }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetLink, setResetLink] = useState("");
  const isAdmin = mode === "admin";
  async function submit(event) {
    event.preventDefault();
    const data = await api(isAdmin ? "/api/auth/admin/forgot-password" : "/api/auth/client/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
    setMessage(data.message);
    setResetLink(data.resetLink || "");
  }
  return (
    <div style={styles.loginPage}>
      <form style={styles.loginCard} onSubmit={submit}>
        <div style={styles.brand}>TOULEMONDE</div>
        <h1 style={styles.loginTitle}>{isAdmin ? "Accès admin oublié" : "Mot de passe oublié"}</h1>
        <p style={styles.muted}>Saisissez votre email pour préparer une réinitialisation sécurisée.</p>
        <Field label="Email"><input style={styles.input} value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
        <button style={styles.primaryButton}>Envoyer</button>
        {message && <div style={styles.success}>{message}{resetLink && <div style={styles.helpText}>Dev : {resetLink}</div>}</div>}
      </form>
    </div>
  );
}

function ResetPassword({ mode = "client" }) {
  const navigate = useNavigate();
  const { token } = useParams();
  const isAdmin = mode === "admin";
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    try {
      setError("");
      await api(isAdmin ? "/api/auth/admin/reset-password" : "/api/auth/client/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
      setMessage("Mot de passe mis à jour.");
      setTimeout(() => navigate(isAdmin ? "/admin/login" : "/client/login"), 700);
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <div style={styles.loginPage}>
      <form style={styles.loginCard} onSubmit={submit}>
        <div style={styles.brand}>TOULEMONDE</div>
        <h1 style={styles.loginTitle}>Nouveau mot de passe</h1>
        <Field label="Mot de passe"><input style={styles.input} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
        <button style={styles.primaryButton}>Valider</button>
        {error && <div style={styles.error}>{error}</div>}
        {message && <div style={styles.success}>{message}</div>}
        <div style={styles.helpText}>Minimum 10 caractères.</div>
      </form>
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [orders, setOrders] = useState([]);
  useEffect(() => { api("/api/client/orders").then(setOrders).catch(console.error); }, []);
  const ongoingOrders = orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).slice(0, 5);
  const latestOrders = orders.slice(0, 3);

  return (
    <div style={styles.pageStack}>
      <section style={styles.heroPanel}>
        <img src={atelierMachines} alt="" style={styles.heroImage} />
        <div style={styles.heroOverlay} />
        <div style={styles.heroContent}>
          <div style={styles.overlineLight}>Portail privé filature</div>
          <h2 style={styles.heroTitle}>Bienvenue dans votre espace production Toulemonde</h2>
          <p style={styles.heroText}>Créez et suivez vos commandes de fil en temps réel.</p>
        </div>
        <button style={styles.primaryButton} onClick={() => navigate("/client/orders/new")}>Nouvelle commande</button>
      </section>

      <div style={{ ...styles.dashboardGrid, ...(isMobile ? styles.dashboardGridMobile : {}) }}>
        <section style={styles.cardWide}>
          <h2 style={styles.cardTitle}>Mes commandes en cours</h2>
          <ClientOrdersTable orders={ongoingOrders} columns={["order", "reference", "material", "count", "quantity", "status", "date"]} empty="Aucune commande en cours." />
        </section>

        <section style={styles.cardWide}>
          <h2 style={styles.cardTitle}>Actions rapides</h2>
          <div style={styles.quickActions}>
            <button style={styles.quickButton} onClick={() => navigate("/client/orders/new")}>Nouvelle commande</button>
            <button style={styles.quickButton} onClick={() => navigate("/client/orders")}>Mes commandes</button>
            <button style={styles.quickButton} onClick={() => navigate("/client/documents")}>Documents</button>
            <button style={styles.quickButton} onClick={() => navigate("/client/contact")}>Contacter Toulemonde Production</button>
          </div>
        </section>

        <section style={styles.cardWide}>
          <h2 style={styles.cardTitle}>Dernières commandes</h2>
          <ClientOrdersTable orders={latestOrders} columns={["material", "count", "quantity", "status"]} empty="Aucune commande récente." />
        </section>
      </div>
    </div>
  );
}

function NewYarnOrder() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const steps = ["Référence", "Fil", "Production", "Livraison", "Document", "Validation"];
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    customer_reference: "",
    requested_date: "",
    urgent: false,
    comment: "",
    material: "",
    yarn_count_nm: "",
    ply_number: "2",
    twist: "Retordu",
    color: "",
    dyeing_required: false,
    color_reference: "",
    quantity_kg: "",
    conditioning: "Cônes",
    destination_usage: "Tricotage",
    tolerance_percent: "",
    requested_delivery_date: "",
    partial_delivery_allowed: false,
  });
  const [errors, setErrors] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validateStep(targetStep = step) {
    const nextErrors = {};
    if (targetStep === 0) {
      if (!form.customer_reference.trim()) nextErrors.customer_reference = "Référence client obligatoire.";
      if (!form.requested_date) nextErrors.requested_date = "Date souhaitée obligatoire.";
    }
    if (targetStep === 1) {
      if (!form.material) nextErrors.material = "Matière obligatoire.";
      if (!form.yarn_count_nm) nextErrors.yarn_count_nm = "Titre Nm obligatoire.";
    }
    if (targetStep === 2 && !form.quantity_kg) {
      nextErrors.quantity_kg = "Quantité obligatoire.";
    }
    if (targetStep === 3 && !form.requested_delivery_date) {
      nextErrors.requested_delivery_date = "Date de livraison souhaitée obligatoire.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function nextStep() {
    if (!validateStep(step)) return;
    setStep((prev) => Math.min(prev + 1, steps.length - 1));
  }

  function previousStep() {
    setErrors({});
    setStep((prev) => Math.max(prev - 1, 0));
  }

  async function submit(event) {
    event.preventDefault();
    const valid = [0, 1, 2, 3, 4].every((stepIndex) => validateStep(stepIndex));
    if (!valid) return;

    try {
      setLoading(true);
      setSuccess("");
      await api("/api/client/orders", { method: "POST", body: JSON.stringify(form) });
      setSuccess("Votre commande a bien été envoyée à Toulemonde Production.");
      setTimeout(() => navigate("/client/orders"), 800);
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form style={styles.wizardShell} onSubmit={submit}>
      <div style={{ ...styles.wizardHeader, ...(isMobile ? styles.wizardHeaderMobile : {}) }}>
        <div>
          <div style={styles.overline}>Commande de fil</div>
          <h2 style={styles.cardTitle}>Nouvelle commande filature</h2>
        </div>
        <img src={step < 2 ? atelierBobines : atelierMatiere} alt="" style={styles.wizardImage} />
      </div>
      <div style={styles.stepper}>
        {steps.map((label, index) => (
          <button key={label} type="button" style={{ ...styles.stepPill, ...(index === step ? styles.stepPillActive : {}) }} onClick={() => index <= step && setStep(index)}>
            <span style={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span>{label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div style={styles.formGrid}>
          <Field label="Référence client" error={errors.customer_reference}><input style={styles.input} value={form.customer_reference} onChange={(e) => update("customer_reference", e.target.value)} /></Field>
          <Field label="Date souhaitée" error={errors.requested_date}><input style={styles.input} type="date" value={form.requested_date} onChange={(e) => update("requested_date", e.target.value)} /></Field>
          <label style={styles.checkLine}><input type="checkbox" checked={form.urgent} onChange={(e) => update("urgent", e.target.checked)} /> Commande urgente</label>
          <Field label="Commentaire"><textarea style={styles.textarea} value={form.comment} onChange={(e) => update("comment", e.target.value)} /></Field>
        </div>
      )}

      {step === 1 && (
        <div style={styles.formGrid}>
          <Field label="Matière" error={errors.material}><Select value={form.material} onChange={(value) => update("material", value)} options={["", "Laine", "Coton", "Lin", "Mérinos", "Mélange"]} /></Field>
          <Field label="Titre Nm" error={errors.yarn_count_nm}><Select value={form.yarn_count_nm} onChange={(value) => update("yarn_count_nm", value)} options={["", "Nm 1/18", "Nm 2/28", "Nm 2/30", "Nm 3/34"]} /></Field>
          <Field label="Nombre de plis"><Select value={form.ply_number} onChange={(value) => update("ply_number", value)} options={["1", "2", "3", "4"]} /></Field>
          <Field label="Retordage"><Select value={form.twist} onChange={(value) => update("twist", value)} options={["Simple", "Retordu", "S/Z", "Spécifique"]} /></Field>
          <Field label="Couleur"><input style={styles.input} value={form.color} onChange={(e) => update("color", e.target.value)} /></Field>
          <Field label="Référence couleur"><input style={styles.input} value={form.color_reference} onChange={(e) => update("color_reference", e.target.value)} /></Field>
          <label style={styles.checkLine}><input type="checkbox" checked={form.dyeing_required} onChange={(e) => update("dyeing_required", e.target.checked)} /> Teinture requise</label>
        </div>
      )}

      {step === 2 && (
        <div style={styles.formGrid}>
          <Field label="Quantité kg" error={errors.quantity_kg}><input style={styles.input} type="number" value={form.quantity_kg} onChange={(e) => update("quantity_kg", e.target.value)} /></Field>
          <Field label="Conditionnement"><Select value={form.conditioning} onChange={(value) => update("conditioning", value)} options={["Cônes", "Bobines", "Écheveaux"]} /></Field>
          <Field label="Usage destination"><Select value={form.destination_usage} onChange={(value) => update("destination_usage", value)} options={["Tricotage", "Tissage", "Teinture", "Retordage"]} /></Field>
          <Field label="Tolérance %"><input style={styles.input} type="number" value={form.tolerance_percent} onChange={(e) => update("tolerance_percent", e.target.value)} /></Field>
        </div>
      )}

      {step === 3 && (
        <div style={styles.formGrid}>
          <Field label="Date de livraison souhaitée" error={errors.requested_delivery_date}><input style={styles.input} type="date" value={form.requested_delivery_date} onChange={(e) => update("requested_delivery_date", e.target.value)} /></Field>
          <label style={styles.checkLine}><input type="checkbox" checked={form.partial_delivery_allowed} onChange={(e) => update("partial_delivery_allowed", e.target.checked)} /> Livraison partielle acceptée</label>
        </div>
      )}

      {step === 4 && (
        <div style={styles.uploadPanel}>
          <div>
            <div style={styles.overline}>Document technique</div>
            <h3 style={styles.uploadTitle}>Ajoutez un fichier utile à la production</h3>
            <p style={styles.muted}>Formats acceptés : PDF, JPG ou PNG.</p>
          </div>
          <Field label="Fichier technique">
            <input style={styles.input} type="file" accept=".pdf,image/jpeg,image/png" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
            {selectedFile && <span style={styles.fileName}>{selectedFile.name}</span>}
          </Field>
        </div>
      )}

      {step === 5 && <OrderSummary form={form} selectedFile={selectedFile} />}

      {errors.submit && <div style={styles.error}>{errors.submit}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <div style={styles.formActions}>
        {step > 0 && <button type="button" style={styles.ghostButton} onClick={previousStep}>Retour</button>}
        {step < steps.length - 1 ? (
          <button type="button" style={styles.primaryButton} onClick={nextStep}>Continuer</button>
        ) : (
          <button style={styles.primaryButton} disabled={loading}>{loading ? "Envoi..." : "Envoyer la commande"}</button>
        )}
      </div>
    </form>
  );
}

function Orders() {
  const [orders, setOrders] = useState([]);
  useEffect(() => { api("/api/client/orders").then(setOrders).catch(console.error); }, []);
  return <OrderList title="Mes commandes" orders={orders} />;
}

function ClientProfile() {
  const [profile, setProfile] = useState({
    company_name: "",
    vat_number: "",
    email: "",
    phone: "",
    billing_address: "",
    billing_postal_code: "",
    billing_city: "",
    billing_country: "",
    shipping_address: "",
    shipping_postal_code: "",
    shipping_city: "",
    shipping_country: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/client/profile")
      .then((data) => setProfile((prev) => ({ ...prev, ...data })))
      .catch((err) => setError(err.message));
  }, []);

  function update(field, value) {
    setProfile((prev) => ({ ...prev, [field]: value }));
  }

  async function save(event) {
    event.preventDefault();
    try {
      setError("");
      setMessage("");
      const data = await api("/api/client/profile", { method: "PUT", body: JSON.stringify(profile) });
      setProfile((prev) => ({ ...prev, ...data.profile }));
      setMessage("Vos informations ont bien été mises à jour.");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form style={styles.pageStack} onSubmit={save}>
      <section style={styles.profileHero}>
        <img src={atelierMatiere} alt="" style={styles.profileHeroImage} />
        <div style={styles.heroOverlay} />
        <div style={styles.heroContent}>
          <div style={styles.overlineLight}>Profil client</div>
          <h2 style={styles.heroTitle}>Vos informations de compte</h2>
          <p style={styles.heroText}>Mettez à jour les coordonnées utilisées pour vos commandes et échanges de production.</p>
        </div>
      </section>

      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.success}>{message}</div>}

      <ProfileSection title="Informations société">
        <Field label="Société"><input style={styles.input} value={profile.company_name || ""} onChange={(e) => update("company_name", e.target.value)} /></Field>
        <Field label="N° TVA"><input style={styles.input} value={profile.vat_number || ""} onChange={(e) => update("vat_number", e.target.value)} /></Field>
        <Field label="Email"><input style={styles.input} value={profile.email || ""} onChange={(e) => update("email", e.target.value)} /></Field>
        <Field label="Téléphone"><input style={styles.input} value={profile.phone || ""} onChange={(e) => update("phone", e.target.value)} /></Field>
      </ProfileSection>

      <ProfileSection title="Adresse facturation">
        <Field label="Adresse"><input style={styles.input} value={profile.billing_address || ""} onChange={(e) => update("billing_address", e.target.value)} /></Field>
        <Field label="Code postal"><input style={styles.input} value={profile.billing_postal_code || ""} onChange={(e) => update("billing_postal_code", e.target.value)} /></Field>
        <Field label="Ville"><input style={styles.input} value={profile.billing_city || ""} onChange={(e) => update("billing_city", e.target.value)} /></Field>
        <Field label="Pays"><input style={styles.input} value={profile.billing_country || ""} onChange={(e) => update("billing_country", e.target.value)} /></Field>
      </ProfileSection>

      <ProfileSection title="Adresse livraison">
        <Field label="Adresse"><input style={styles.input} value={profile.shipping_address || ""} onChange={(e) => update("shipping_address", e.target.value)} /></Field>
        <Field label="Code postal"><input style={styles.input} value={profile.shipping_postal_code || ""} onChange={(e) => update("shipping_postal_code", e.target.value)} /></Field>
        <Field label="Ville"><input style={styles.input} value={profile.shipping_city || ""} onChange={(e) => update("shipping_city", e.target.value)} /></Field>
        <Field label="Pays"><input style={styles.input} value={profile.shipping_country || ""} onChange={(e) => update("shipping_country", e.target.value)} /></Field>
      </ProfileSection>

      <ProfileSection title="Contact principal">
        <Field label="Nom"><input style={styles.input} value={profile.contact_name || ""} onChange={(e) => update("contact_name", e.target.value)} /></Field>
        <Field label="Email"><input style={styles.input} value={profile.contact_email || ""} onChange={(e) => update("contact_email", e.target.value)} /></Field>
        <Field label="Téléphone"><input style={styles.input} value={profile.contact_phone || ""} onChange={(e) => update("contact_phone", e.target.value)} /></Field>
      </ProfileSection>

      <div style={styles.formActions}>
        <button style={styles.primaryButton}>Mettre à jour mes informations</button>
      </div>
    </form>
  );
}

function ProfileSection({ title, children }) {
  return (
    <section style={styles.cardWide}>
      <h2 style={styles.cardTitle}>{title}</h2>
      <div style={styles.formGrid}>{children}</div>
    </section>
  );
}

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api("/api/admin/dashboard").then(setStats).catch(console.error); }, []);
  return (
    <div style={styles.pageStack}>
      <AdminPageHeader title="Dashboard" subtitle="Pilotage du portail client Toulemonde Production." />
      <div style={styles.grid}>
        <Metric title="Clients" value={stats?.clients ?? "—"} />
        <Metric title="Utilisateurs" value={stats?.users ?? "—"} />
        <Metric title="Commandes" value={stats?.orders ?? "—"} />
        <Metric title="Actions en attente" value={stats?.pendingActions ?? "—"} />
      </div>
    </div>
  );
}

function AdminClients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ company_name: "", vat_number: "", email: "", phone: "", billing_city: "", billing_country: "", contact_name: "", contact_email: "", contact_phone: "", sage_customer_code: "", create_user: true, user_name: "", user_email: "", user_password: "" });
  const [message, setMessage] = useState("");
  useEffect(() => { api("/api/admin/clients").then(setClients).catch(console.error); }, []);

  async function createClient(event) {
    event.preventDefault();
    const data = await api("/api/admin/clients", {
      method: "POST",
      body: JSON.stringify({
        client: {
          company_name: form.company_name,
          vat_number: form.vat_number,
          email: form.email,
          phone: form.phone,
          billing_city: form.billing_city,
          billing_country: form.billing_country,
          contact_name: form.contact_name,
          contact_email: form.contact_email || form.email,
          contact_phone: form.contact_phone,
          sage_customer_code: form.sage_customer_code,
        },
        user: {
          create_user: form.create_user,
          name: form.user_name || form.contact_name,
          email: form.user_email || form.contact_email || form.email,
          password: form.user_password,
        },
      }),
    });
    setMessage(data.invitationLink ? `Client créé. Invitation : ${data.invitationLink}` : "Client créé.");
    setFormOpen(false);
    setForm({ company_name: "", vat_number: "", email: "", phone: "", billing_city: "", billing_country: "", contact_name: "", contact_email: "", contact_phone: "", sage_customer_code: "", create_user: true, user_name: "", user_email: "", user_password: "" });
    setClients(await api("/api/admin/clients"));
  }

  return (
    <div style={styles.pageStack}>
      <AdminPageHeader title="Clients" subtitle="Gestion des comptes clients et informations société.">
        <button style={styles.primaryButton} onClick={() => setFormOpen((open) => !open)}>Nouveau client</button>
      </AdminPageHeader>
      {message && <div style={styles.success}>{message}</div>}
      {formOpen && (
        <form style={styles.cardWide} onSubmit={createClient}>
          <h2 style={styles.cardTitle}>Nouveau client</h2>
          <div style={styles.formGrid}>
            {["company_name", "vat_number", "email", "phone", "billing_city", "billing_country", "contact_name", "contact_email", "contact_phone", "sage_customer_code"].map((field) => (
              <Field key={field} label={adminFieldLabel(field)}>
                <input style={styles.input} value={form[field] || ""} onChange={(e) => setForm({ ...form, [field]: e.target.value })} />
              </Field>
            ))}
          </div>
          <h2 style={styles.cardTitle}>Utilisateur client</h2>
          <div style={styles.formGrid}>
            <label style={styles.checkLine}><input type="checkbox" checked={form.create_user} onChange={(e) => setForm({ ...form, create_user: e.target.checked })} /> Créer un utilisateur lié</label>
            <Field label="Nom utilisateur"><input style={styles.input} value={form.user_name} onChange={(e) => setForm({ ...form, user_name: e.target.value })} /></Field>
            <Field label="Email utilisateur"><input style={styles.input} value={form.user_email} onChange={(e) => setForm({ ...form, user_email: e.target.value })} /></Field>
            <Field label="Mot de passe initial"><input style={styles.input} type="password" value={form.user_password} onChange={(e) => setForm({ ...form, user_password: e.target.value })} /></Field>
          </div>
          <button style={styles.primaryButton}>Créer client</button>
        </form>
      )}
      <section style={styles.cardWide}>
        <SimpleTable
          columns={["company_name", "vat_number", "contact_email", "phone", "billing_city", "billing_country", "status", "created_at"]}
          rows={clients.map((client) => ({ ...client, status: client.is_active ? "Actif" : "Inactif" }))}
          actions={(client) => <button style={styles.linkButton} onClick={() => navigate(`/admin/clients/${client.id}`)}>Voir détail</button>}
        />
      </section>
    </div>
  );
}

function AdminClientDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [client, setClient] = useState({});
  const [message, setMessage] = useState("");

  async function load() {
    const next = await api(`/api/admin/clients/${id}`);
    setData(next);
    setClient(next.client);
  }

  useEffect(() => { load().catch(console.error); }, [id]);

  async function save(event) {
    event.preventDefault();
    await api(`/api/admin/clients/${id}`, { method: "PUT", body: JSON.stringify(client) });
    setMessage("Client enregistré.");
    await load();
  }

  async function resetPassword() {
    const user = data?.users?.[0];
    if (!user) return setMessage("Aucun utilisateur client lié.");
    const result = await api(`/api/admin/users/${user.id}/reset-password`, { method: "POST" });
    setMessage(`Lien de réinitialisation : ${result.resetLink}`);
  }

  if (!data) return <div style={styles.cardWide}>Chargement...</div>;

  return (
    <form style={styles.pageStack} onSubmit={save}>
      <AdminPageHeader title={client.company_name || "Client"} subtitle="Détail client, coordonnées, informations Sage et commandes liées.">
        <button type="button" style={styles.ghostButton} onClick={resetPassword}>Réinitialiser mot de passe</button>
      </AdminPageHeader>
      {message && <div style={styles.success}>{message}</div>}
      <ProfileSection title="Informations société">
        {["company_name", "vat_number", "contact_email", "phone"].map((field) => <AdminInput key={field} field={field} value={client[field]} onChange={(value) => setClient({ ...client, [field]: value })} />)}
      </ProfileSection>
      <ProfileSection title="Adresse facturation">
        {["billing_address", "billing_postal_code", "billing_city", "billing_country"].map((field) => <AdminInput key={field} field={field} value={client[field]} onChange={(value) => setClient({ ...client, [field]: value })} />)}
      </ProfileSection>
      <ProfileSection title="Adresse livraison">
        {["shipping_address", "shipping_postal_code", "shipping_city", "shipping_country"].map((field) => <AdminInput key={field} field={field} value={client[field]} onChange={(value) => setClient({ ...client, [field]: value })} />)}
      </ProfileSection>
      <ProfileSection title="Contact principal">
        {["contact_name", "contact_email", "contact_phone"].map((field) => <AdminInput key={field} field={field} value={client[field]} onChange={(value) => setClient({ ...client, [field]: value })} />)}
      </ProfileSection>
      <ProfileSection title="Informations ERP">
        {["sage_customer_code", "last_sync_status", "last_sync_at"].map((field) => <AdminInput key={field} field={field} value={client[field]} onChange={(value) => setClient({ ...client, [field]: value })} />)}
      </ProfileSection>
      <button style={styles.primaryButton}>Enregistrer</button>
      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Commandes du client</h2>
        <ClientOrdersTable orders={data.orders || []} columns={["order", "reference", "material", "count", "quantity", "status", "date"]} empty="Aucune commande." />
      </section>
    </form>
  );
}

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ full_name: "", email: "", role: "client", client_id: "", password: "" });
  const [message, setMessage] = useState("");
  async function load() {
    setUsers(await api("/api/admin/users"));
    setClients(await api("/api/admin/clients"));
  }
  useEffect(() => { load().catch(console.error); }, []);

  async function createUser(event) {
    event.preventDefault();
    const result = await api("/api/admin/users", { method: "POST", body: JSON.stringify(form) });
    setMessage(`Utilisateur créé. Invitation : ${result.invitationLink}`);
    setForm({ full_name: "", email: "", role: "client", client_id: "", password: "" });
    await load();
  }

  async function resetUser(user) {
    const result = await api(`/api/admin/users/${user.id}/reset-password`, { method: "POST" });
    setMessage(`Lien de réinitialisation : ${result.resetLink}`);
  }

  return (
    <div style={styles.pageStack}>
      <AdminPageHeader title="Utilisateurs" subtitle="Comptes client et rôles internes." />
      {message && <div style={styles.success}>{message}</div>}
      <form style={styles.cardWide} onSubmit={createUser}>
        <h2 style={styles.cardTitle}>Créer utilisateur</h2>
        <div style={styles.formGrid}>
          <Field label="Nom"><input style={styles.input} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Email"><input style={styles.input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Rôle"><Select value={form.role} onChange={(value) => setForm({ ...form, role: value })} options={["client", "admin_portal", "commercial", "production", "super_admin"]} /></Field>
          <Field label="Client"><Select value={form.client_id} onChange={(value) => setForm({ ...form, client_id: value })} options={["", ...clients.map((client) => String(client.id))]} /></Field>
          <Field label="Mot de passe initial"><input style={styles.input} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        </div>
        <button style={styles.primaryButton}>Créer utilisateur</button>
      </form>
      <section style={styles.cardWide}>
        <SimpleTable columns={["full_name", "email", "role", "client_name", "status", "last_login_at", "created_at"]} rows={users.map((user) => ({ ...user, status: user.is_active ? "Actif" : "Inactif" }))} actions={(user) => <button style={styles.linkButton} onClick={() => resetUser(user)}>Reset</button>} />
      </section>
    </div>
  );
}

function AdminOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  useEffect(() => { api("/api/admin/orders").then(setOrders).catch(console.error); }, []);
  return (
    <div style={styles.pageStack}>
      <AdminPageHeader title="Commandes" subtitle="Suivi interne des commandes portail et statuts." />
      <section style={styles.cardWide}>
        <SimpleTable
          columns={["order_number", "client_reference", "company_name", "material", "yarn_count", "quantity_kg", "status", "sage_order_number", "created_at", "requested_delivery_date"]}
          rows={orders}
          actions={(order) => <button style={styles.linkButton} onClick={() => navigate(`/admin/orders/${order.id}`)}>Détail</button>}
        />
      </section>
    </div>
  );
}

function AdminOrderDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("");
  useEffect(() => { api(`/api/admin/orders/${id}`).then(setData).catch(console.error); }, [id]);
  if (!data) return <div style={styles.cardWide}>Chargement...</div>;
  const { order } = data;
  async function forceSync() {
    const result = await api(`/api/admin/orders/${id}/force-sync`, { method: "POST" });
    setMessage(`Action créée : ${result.actionId}`);
  }
  return (
    <div style={styles.pageStack}>
      <AdminPageHeader title={order.order_number || `Commande ${id}`} subtitle={order.company_name || "Commande portail"}>
        <button style={styles.primaryButton} onClick={forceSync}>Forcer sync Sage</button>
      </AdminPageHeader>
      {message && <div style={styles.success}>{message}</div>}
      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Détails techniques</h2>
        <div style={styles.summaryGrid}>
          {["client_reference", "material", "yarn_count", "quantity_kg", "status", "sage_order_number", "requested_delivery_date", "internal_comment"].map((field) => (
            <div key={field} style={styles.summaryItem}><div style={styles.label}>{adminFieldLabel(field)}</div><div>{order[field] || "—"}</div></div>
          ))}
        </div>
      </section>
      <section style={styles.cardWide}><h2 style={styles.cardTitle}>Historique statut</h2><SimpleTable columns={["old_status", "new_status", "source", "message", "created_at"]} rows={data.history || []} /></section>
      <section style={styles.cardWide}><h2 style={styles.cardTitle}>Logs sync</h2><SimpleTable columns={["system", "direction", "status", "message", "created_at"]} rows={data.logs || []} /></section>
    </div>
  );
}

function AdminConnectorSage() {
  const defaultConfig = {
    type: "postgres",
    host: "",
    port: 5432,
    database: "",
    user: "",
    password: "",
    ssl: false,
    inbound: { enabled: true, sourceQuery: "", afterImportUpdateQuery: "", intervalSeconds: 60 },
    outbound: { enabled: false, createCustomerEnabled: true, createOrderEnabled: true, updateOrderStatusEnabled: true, intervalSeconds: 60 },
  };
  const [enabled, setEnabled] = useState(false);
  const [config, setConfig] = useState(defaultConfig);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState("");

  async function load() {
    const data = await api("/api/admin/connector-sage");
    setEnabled(data.enabled);
    setStatus(data);
    setConfig({ ...defaultConfig, ...(data.config || {}), inbound: { ...defaultConfig.inbound, ...(data.config?.inbound || {}) }, outbound: { ...defaultConfig.outbound, ...(data.config?.outbound || {}) } });
  }
  useEffect(() => { load().catch(console.error); }, []);
  function update(field, value) { setConfig((prev) => ({ ...prev, [field]: value })); }
  function updateNested(group, field, value) { setConfig((prev) => ({ ...prev, [group]: { ...prev[group], [field]: value } })); }
  async function save() {
    await api("/api/admin/connector-sage", { method: "PUT", body: JSON.stringify({ enabled, config }) });
    setMessage("Configuration enregistrée.");
    await load();
  }
  async function test() {
    const result = await api("/api/admin/connector-sage/test", { method: "POST" });
    setMessage(result.message);
    await load();
  }
  async function runSync(path) {
    const result = await api(path, { method: "POST" });
    setMessage(`Synchronisation déclenchée : ${JSON.stringify(result)}`);
    await load();
  }
  return (
    <div style={styles.pageStack}>
      <AdminPageHeader title="Connecteur Sage" subtitle="Configuration admin des échanges entre le portail et Sage." />
      {message && <div style={styles.success}>{message}</div>}
      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Statut</h2>
        <div style={styles.grid}>
          <Metric title="Statut" value={status?.status || "—"} />
          <Metric title="Dernier test" value={formatDateTime(status?.last_check_at)} />
          <Metric title="Entrant" value={formatDateTime(status?.last_inbound_sync_at)} />
          <Metric title="Sortant" value={formatDateTime(status?.last_outbound_sync_at)} />
        </div>
      </section>
      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Connexion Sage</h2>
        <div style={styles.formGrid}>
          <label style={styles.checkLine}><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Connecteur actif</label>
          {["type", "host", "port", "database", "user", "password"].map((field) => <AdminInput key={field} field={field} value={config[field]} onChange={(value) => update(field, value)} type={field === "password" ? "password" : "text"} />)}
          <label style={styles.checkLine}><input type="checkbox" checked={config.ssl} onChange={(e) => update("ssl", e.target.checked)} /> SSL</label>
        </div>
      </section>
      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Synchronisation entrante</h2>
        <div style={styles.formGrid}>
          <label style={styles.checkLine}><input type="checkbox" checked={config.inbound.enabled} onChange={(e) => updateNested("inbound", "enabled", e.target.checked)} /> Import activé</label>
          <AdminInput field="intervalSeconds" value={config.inbound.intervalSeconds} onChange={(value) => updateNested("inbound", "intervalSeconds", Number(value))} />
          <Field label="Requête source"><textarea style={styles.textarea} value={config.inbound.sourceQuery} onChange={(e) => updateNested("inbound", "sourceQuery", e.target.value)} /></Field>
          <Field label="Requête après import"><textarea style={styles.textarea} value={config.inbound.afterImportUpdateQuery} onChange={(e) => updateNested("inbound", "afterImportUpdateQuery", e.target.value)} /></Field>
        </div>
      </section>
      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Synchronisation sortante</h2>
        <div style={styles.formGrid}>
          <label style={styles.checkLine}><input type="checkbox" checked={config.outbound.enabled} onChange={(e) => updateNested("outbound", "enabled", e.target.checked)} /> Export activé</label>
          <AdminInput field="intervalSeconds" value={config.outbound.intervalSeconds} onChange={(value) => updateNested("outbound", "intervalSeconds", Number(value))} />
          <label style={styles.checkLine}><input type="checkbox" checked={config.outbound.createCustomerEnabled} onChange={(e) => updateNested("outbound", "createCustomerEnabled", e.target.checked)} /> Création client</label>
          <label style={styles.checkLine}><input type="checkbox" checked={config.outbound.createOrderEnabled} onChange={(e) => updateNested("outbound", "createOrderEnabled", e.target.checked)} /> Création commande</label>
          <label style={styles.checkLine}><input type="checkbox" checked={config.outbound.updateOrderStatusEnabled} onChange={(e) => updateNested("outbound", "updateOrderStatusEnabled", e.target.checked)} /> Mise à jour statut</label>
        </div>
      </section>
      <div style={styles.formActions}>
        <button style={styles.primaryButton} type="button" onClick={save}>Sauvegarder</button>
        <button style={styles.ghostButton} type="button" onClick={test}>Tester connexion</button>
        <button style={styles.ghostButton} type="button" onClick={() => runSync("/api/admin/connector-sage/sync-inbound")}>Synchronisation entrante maintenant</button>
        <button style={styles.ghostButton} type="button" onClick={() => runSync("/api/admin/connector-sage/sync-outbound")}>Synchronisation sortante maintenant</button>
      </div>
    </div>
  );
}

function AdminSyncLogs() {
  const [logs, setLogs] = useState([]);
  useEffect(() => { api("/api/admin/sync-logs").then(setLogs).catch(console.error); }, []);
  return (
    <div style={styles.pageStack}>
      <AdminPageHeader title="Logs de synchronisation" subtitle="Historique admin des échanges et traitements." />
      <section style={styles.cardWide}>
        <SimpleTable columns={["system", "direction", "status", "message", "entity_type", "entity_id", "created_at"]} rows={logs} />
      </section>
    </div>
  );
}

function AdminPageHeader({ title, subtitle, children }) {
  return (
    <div style={styles.adminPageHeader}>
      <div>
        <div style={styles.overline}>Administration</div>
        <h1 style={styles.pageTitle}>{title}</h1>
        {subtitle && <p style={styles.muted}>{subtitle}</p>}
      </div>
      {children && <div style={styles.headerActions}>{children}</div>}
    </div>
  );
}

function AdminInput({ field, value, onChange, type = "text" }) {
  return (
    <Field label={adminFieldLabel(field)}>
      <input style={styles.input} type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function SimpleTable({ columns, rows, actions }) {
  if (!rows?.length) return <div style={styles.emptyState}>Aucune donnée.</div>;
  return (
    <div style={{ ...styles.table, gridTemplateColumns: `repeat(${columns.length + (actions ? 1 : 0)}, minmax(145px, 1fr))` }}>
      {columns.map((column) => <div key={column} style={styles.tableHead}>{adminFieldLabel(column)}</div>)}
      {actions && <div style={styles.tableHead}>Actions</div>}
      {rows.map((row, rowIndex) => (
        <FragmentRow key={row.id || rowIndex}>
          {columns.map((column) => <div key={`${row.id || rowIndex}-${column}`} style={styles.cell}>{formatCell(row[column])}</div>)}
          {actions && <div style={styles.cell}>{actions(row)}</div>}
        </FragmentRow>
      ))}
    </div>
  );
}

function FragmentRow({ children }) {
  return children;
}

function formatCell(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.includes("T")) return formatDateTime(value);
  return String(value);
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-BE", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function adminFieldLabel(field) {
  const labels = {
    company_name: "Société",
    vat_number: "TVA",
    contact_email: "Email",
    email: "Email",
    phone: "Téléphone",
    billing_address: "Adresse facturation",
    billing_postal_code: "Code postal facturation",
    billing_city: "Ville facturation",
    billing_country: "Pays facturation",
    shipping_address: "Adresse livraison",
    shipping_postal_code: "Code postal livraison",
    shipping_city: "Ville livraison",
    shipping_country: "Pays livraison",
    contact_name: "Contact",
    contact_phone: "Téléphone contact",
    sage_customer_code: "Code client Sage",
    last_sync_status: "Dernier statut sync",
    last_sync_at: "Dernière sync",
    customer_code: "Code client",
    full_name: "Nom",
    client_name: "Client",
    client_code: "Code client",
    order_number: "N° commande",
    client_reference: "Référence client",
    material: "Matière",
    yarn_count: "Titre Nm",
    quantity_kg: "Quantité kg",
    status: "Statut",
    sage_order_number: "N° Sage",
    created_at: "Créé le",
    requested_delivery_date: "Livraison souhaitée",
    requested_date: "Date souhaitée",
    old_status: "Ancien statut",
    new_status: "Nouveau statut",
    source: "Source",
    message: "Message",
    system: "Système",
    direction: "Direction",
    entity_type: "Entité",
    entity_id: "ID entité",
    internal_comment: "Commentaire interne",
    intervalSeconds: "Fréquence (secondes)",
    host: "Hôte",
    port: "Port",
    database: "Base",
    user: "Utilisateur",
    password: "Mot de passe",
    type: "Type",
    role: "Rôle",
    last_login_at: "Dernière connexion",
  };
  return labels[field] || field;
}

function AdminOrders() {
  const [orders, setOrders] = useState([]);
  useEffect(() => { api("/api/admin/orders").then(setOrders).catch(console.error); }, []);
  return <OrderList title="Vue globale commandes" orders={orders} />;
}

function OrderList({ title, orders }) {
  return (
    <section style={styles.cardWide}>
      <h2 style={styles.cardTitle}>{title}</h2>
      <ClientOrdersTable orders={orders} columns={["order", "reference", "material", "count", "quantity", "status", "date"]} empty="Aucune commande pour le moment." />
    </section>
  );
}

const clientStatusLabels = {
  draft: "Brouillon",
  submitted: "Envoyée",
  pending_validation: "En validation",
  pending_sage_sync: "Envoyée",
  sage_sync_failed: "En validation",
  sent_to_sage: "Acceptée",
  approved: "Acceptée",
  imported_to_leon: "En production",
  in_production: "En production",
  ready: "Prête",
  delivered: "Livrée",
  cancelled: "Annulée",
};

function clientStatus(status) {
  return clientStatusLabels[status] || "En traitement";
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-BE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function ClientOrdersTable({ orders, columns, empty }) {
  if (!orders.length) return <div style={styles.emptyState}>{empty}</div>;
  const labels = {
    order: "N° commande",
    reference: "Référence client",
    material: "Matière",
    count: "Titre Nm",
    quantity: "Quantité",
    status: "Statut",
    date: "Date souhaitée",
  };
  const values = {
    order: (order) => order.order_number || "—",
    reference: (order) => order.client_reference || "—",
    material: (order) => order.material || "—",
    count: (order) => order.yarn_count || "—",
    quantity: (order) => `${order.quantity_kg || "—"} kg`,
    status: (order) => <span style={styles.badge}>{clientStatus(order.status)}</span>,
    date: (order) => formatDate(order.requested_date),
  };

  return (
    <div style={{ ...styles.table, gridTemplateColumns: `repeat(${columns.length}, minmax(120px, 1fr))` }}>
      {columns.map((column) => <div key={`head-${column}`} style={styles.tableHead}>{labels[column]}</div>)}
      {orders.map((order) => columns.map((column) => (
        <div key={`${order.id}-${column}`} style={styles.cell}>{values[column](order)}</div>
      )))}
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select style={styles.input} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option} value={option}>{option || "Sélectionner"}</option>)}
    </select>
  );
}

function OrderSummary({ form, selectedFile }) {
  const rows = [
    ["Référence", form.customer_reference],
    ["Date souhaitée", form.requested_date],
    ["Urgence", form.urgent ? "Oui" : "Non"],
    ["Matière", form.material],
    ["Titre Nm", form.yarn_count_nm],
    ["Brins", form.ply_number],
    ["Retordage", form.twist],
    ["Couleur", form.color],
    ["Teinture", form.dyeing_required ? "Oui" : "Non"],
    ["Quantité", `${form.quantity_kg || "—"} kg`],
    ["Conditionnement", form.conditioning],
    ["Usage", form.destination_usage],
    ["Livraison souhaitée", form.requested_delivery_date],
    ["Livraison partielle", form.partial_delivery_allowed ? "Oui" : "Non"],
    ["Fichier", selectedFile?.name || "Aucun fichier sélectionné"],
  ];
  return (
    <div style={styles.summaryGrid}>
      {rows.map(([label, value]) => (
        <div key={label} style={styles.summaryItem}>
          <div style={styles.label}>{label}</div>
          <div>{value || "—"}</div>
        </div>
      ))}
    </div>
  );
}

function OrderDetail() {
  return <Placeholder title="Détail commande" />;
}

function SyncMonitoring() {
  const [status, setStatus] = useState(null);
  useEffect(() => { api("/api/admin/sync/status").then(setStatus).catch(console.error); }, []);
  return (
    <section style={styles.cardWide}>
      <h2 style={styles.cardTitle}>Monitoring synchronisation</h2>
      <div style={styles.grid}>
        <Metric title="Agent" value={status?.agentStatus || "unknown"} />
        <Metric title="Actions pending" value={status?.pendingActions ?? "—"} />
        <Metric title="Sage" value={status?.sageConnectivity || "unknown"} />
        <Metric title="Léon" value={status?.leonConnectivity || "unknown"} />
      </div>
    </section>
  );
}

function CatalogAdmin() {
  const [article, setArticle] = useState({ code: "", label: "", family: "" });
  async function saveArticle() {
    await api("/api/admin/catalog/articles", { method: "POST", body: JSON.stringify(article) });
    setArticle({ code: "", label: "", family: "" });
  }
  return (
    <section style={styles.cardWide}>
      <h2 style={styles.cardTitle}>Catalogue technique</h2>
      <div style={styles.formGrid}>
        <Field label="Code article"><input style={styles.input} value={article.code} onChange={(e) => setArticle({ ...article, code: e.target.value })} /></Field>
        <Field label="Libellé"><input style={styles.input} value={article.label} onChange={(e) => setArticle({ ...article, label: e.target.value })} /></Field>
        <Field label="Famille"><input style={styles.input} value={article.family} onChange={(e) => setArticle({ ...article, family: e.target.value })} /></Field>
      </div>
      <button style={styles.primaryButton} onClick={saveArticle}>Ajouter / mettre à jour</button>
    </section>
  );
}

function Placeholder({ title }) {
  return <section style={styles.cardWide}><h2 style={styles.cardTitle}>{title}</h2><p style={styles.muted}>Module prêt à raccorder aux données métier.</p></section>;
}

function Field({ label, children, error }) {
  return <label style={styles.field}><span style={styles.label}>{label}</span>{children}{error && <span style={styles.inlineError}>{error}</span>}</label>;
}

function Metric({ title, value }) {
  return <div style={styles.card}><div style={styles.metricTitle}>{title}</div><div style={styles.metricValue}>{value}</div></div>;
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
        <Route path="/client/*" element={<ClientProtectedRoute><Layout /></ClientProtectedRoute>} />
        <Route path="/admin/*" element={<AdminProtectedRoute><AdminLayout /></AdminProtectedRoute>} />
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

const styles = {
  shell: { minHeight: "100vh", background: T.ecru, color: T.noir, fontFamily: T.fontBody },
  appTopBar: { height: 72, background: "#050505", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 clamp(14px, 3vw, 32px)", position: "sticky", top: 0, zIndex: 140, boxSizing: "border-box", borderBottom: `1px solid rgba(255,255,255,0.10)` },
  topBarLeft: { display: "flex", alignItems: "center", gap: 16, minWidth: 0 },
  panelButton: { width: 46, height: 46, borderRadius: 12, border: "1px solid rgba(255,255,255,0.20)", background: "rgba(255,255,255,0.06)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s ease" },
  headerLogo: { height: 36, width: "auto", objectFit: "contain", display: "block", transition: "transform 0.25s ease-in-out", transformOrigin: "center" },
  headerLogoClosed: { transform: "rotate(0deg)" },
  headerLogoOpen: { transform: "rotate(90deg) translateX(-4px)" },
  menuButton: { width: 48, height: 48, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, cursor: "pointer", padding: 0, justifySelf: "end" },
  menuLine: { width: 19, height: 2, background: "#fff", borderRadius: 999, transition: "all 0.22s ease" },
  menuLineTopOpen: { transform: "translateY(7px) rotate(45deg)" },
  menuLineMiddleOpen: { opacity: 0 },
  menuLineBottomOpen: { transform: "translateY(-7px) rotate(-45deg)" },
  brandLockup: { display: "flex", alignItems: "center", gap: 14, minWidth: 0 },
  brandRule: { width: 112, height: 1, background: "rgba(255,255,255,0.42)" },
  brandText: { letterSpacing: "0.22em", fontWeight: 800, fontSize: "clamp(12px, 2vw, 15px)", whiteSpace: "nowrap", textTransform: "uppercase" },
  headerActions: { display: "flex", alignItems: "center", gap: 10 },
  headerActionButton: { border: "1px solid rgba(255,255,255,0.20)", background: "transparent", color: "#fff", borderRadius: 999, padding: "9px 14px", cursor: "pointer", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800 },
  menuOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)", border: 0, zIndex: 110, cursor: "default" },
  menuDrawer: { position: "fixed", top: 72, left: 0, bottom: 0, background: "#fff", borderRight: `1px solid ${T.border}`, boxShadow: T.shadowSoft, padding: 14, display: "flex", flexDirection: "column", gap: 18, transition: "width 0.25s ease, transform 0.25s ease, opacity 0.25s ease", zIndex: 130, boxSizing: "border-box", overflowY: "auto", overflowX: "hidden" },
  menuDrawerVisible: { transform: "translateX(0)", opacity: 1, pointerEvents: "auto" },
  menuDrawerHidden: { transform: "translateX(-100%)", opacity: 0, pointerEvents: "none" },
  menuDrawerExpanded: { width: 288 },
  menuDrawerCollapsed: { width: 76 },
  menuDrawerMobile: { width: "min(320px, 86vw)", boxShadow: "0 28px 70px rgba(0,0,0,0.28)" },
  menuLogoPanel: { background: "#fff", border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, display: "grid", gap: 10, justifyItems: "center" },
  menuLogo: { width: 42, height: "auto", objectFit: "contain" },
  menuSubtitle: { color: T.textSoft, fontSize: 12, lineHeight: 1.5 },
  menuSectionLabel: { margin: "10px 4px 0", color: T.textSoft, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" },
  nav: { display: "grid", gap: 8 },
  navItem: { minHeight: 46, padding: "0 13px", borderRadius: 12, textDecoration: "none", border: `1px solid ${T.border}`, fontSize: 12, fontWeight: 800, letterSpacing: "0.03em", textTransform: "uppercase", transition: "all 0.18s ease", display: "flex", alignItems: "center", gap: 11, whiteSpace: "nowrap" },
  navItemCollapsed: { width: 46, padding: 0, justifyContent: "center" },
  logoutButton: { minHeight: 46, border: `1px solid ${T.borderMid}`, background: "transparent", borderRadius: 12, padding: "0 13px", cursor: "pointer", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: T.noir, display: "flex", alignItems: "center", gap: 11, marginTop: "auto", whiteSpace: "nowrap" },
  logoutButtonCollapsed: { width: 46, padding: 0, justifyContent: "center" },
  brand: { color: T.bleu, letterSpacing: "0.28em", fontWeight: 800, fontSize: 13 },
  ghostButton: { border: `1px solid ${T.border}`, background: "transparent", borderRadius: 6, padding: "12px 14px", cursor: "pointer", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" },
  main: { padding: "28px clamp(18px, 3vw, 34px) 46px", minWidth: 0, boxSizing: "border-box", transition: "margin-left 0.25s ease", maxWidth: 1510 },
  topbar: { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", marginBottom: 24, flexWrap: "wrap" },
  overline: { fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: T.textSoft },
  pageTitle: { margin: "6px 0 0", fontFamily: T.fontDisplay, color: T.bleu, fontSize: "clamp(34px, 5vw, 58px)", lineHeight: 0.98, fontWeight: 400 },
  loginPage: { minHeight: "100vh", background: T.ecru, display: "grid", placeItems: "center", fontFamily: T.fontBody, padding: 20, boxSizing: "border-box" },
  loginCard: { width: "min(430px, 100%)", background: T.blanc, border: `1px solid ${T.border}`, borderRadius: 8, padding: 28, display: "grid", gap: 14, boxShadow: "0 24px 60px rgba(0,0,0,0.08)" },
  loginTitle: { fontFamily: T.fontDisplay, fontSize: 38, margin: "8px 0 0", color: T.bleu, fontWeight: 400, lineHeight: 1 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 },
  pageStack: { display: "grid", gap: 20 },
  heroPanel: { minHeight: 430, position: "relative", overflow: "hidden", borderRadius: T.cardRadius, padding: "42px clamp(22px, 5vw, 58px)", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 18, boxShadow: T.shadowSoft, flexWrap: "wrap", background: "#050505" },
  heroImage: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(1)", transform: "scale(1.02)" },
  heroOverlay: { position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(0,0,0,0.72), rgba(0,0,0,0.34) 55%, rgba(0,0,0,0.15))" },
  heroContent: { position: "relative", zIndex: 1, maxWidth: 760 },
  overlineLight: { fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(255,255,255,0.70)" },
  heroTitle: { fontFamily: T.fontDisplay, color: "#fff", fontSize: "clamp(42px, 7vw, 76px)", lineHeight: 0.95, margin: "12px 0", fontWeight: 400, maxWidth: 820 },
  heroText: { color: "rgba(255,255,255,0.78)", margin: 0, lineHeight: 1.55, maxWidth: 620, fontSize: 17 },
  dashboardGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1.45fr) minmax(280px, 0.75fr)", gap: 20, alignItems: "start" },
  dashboardGridMobile: { gridTemplateColumns: "1fr" },
  quickActions: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 },
  quickButton: { border: `1px solid ${T.border}`, background: "#fff", color: T.noir, borderRadius: 12, padding: "15px 16px", cursor: "pointer", fontWeight: 800, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.06em", boxShadow: "0 10px 24px rgba(0,0,0,0.035)" },
  card: { background: T.blanc, border: `1px solid ${T.border}`, borderRadius: T.cardRadius, padding: 18 },
  cardWide: { background: T.blanc, border: `1px solid ${T.border}`, borderRadius: T.cardRadius, padding: "22px clamp(16px, 3vw, 28px)", display: "grid", gap: 16, boxShadow: T.shadowSoft },
  cardTitle: { fontFamily: T.fontDisplay, fontSize: 30, margin: 0, color: T.noir, fontWeight: 400 },
  metricTitle: { fontSize: 11, color: T.textSoft, textTransform: "uppercase", letterSpacing: "0.18em" },
  metricValue: { fontFamily: T.fontDisplay, fontSize: 34, marginTop: 8 },
  wizardShell: { background: T.blanc, border: `1px solid ${T.border}`, borderRadius: T.cardRadius, padding: "22px clamp(16px, 3vw, 28px)", display: "grid", gap: 18, boxShadow: T.shadowSoft, overflow: "hidden" },
  wizardHeader: { display: "grid", gridTemplateColumns: "minmax(0,1fr) 220px", gap: 18, alignItems: "center" },
  wizardHeaderMobile: { gridTemplateColumns: "1fr" },
  wizardImage: { width: "100%", height: 130, objectFit: "cover", filter: "grayscale(1)", borderRadius: 14 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  field: { display: "grid", gap: 6, textAlign: "left" },
  label: { fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: T.textSoft },
  inlineError: { color: T.danger, fontSize: 12 },
  input: { border: `1px solid ${T.border}`, background: "#fff", borderRadius: 10, padding: "12px 12px", font: "inherit", width: "100%", minWidth: 0 },
  textarea: { border: `1px solid ${T.border}`, background: "#fff", borderRadius: 10, padding: "12px 12px", minHeight: 96, font: "inherit", width: "100%" },
  checkLine: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 22 },
  primaryButton: { border: "none", background: T.bleu, color: "#fff", borderRadius: 6, padding: "12px 16px", cursor: "pointer", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" },
  formActions: { display: "flex", justifyContent: "space-between", gap: 12, marginTop: 4 },
  stepper: { display: "flex", gap: 8, flexWrap: "wrap" },
  stepPill: { border: `1px solid ${T.border}`, background: "#fff", color: T.noir, borderRadius: 12, padding: "10px 12px", cursor: "pointer", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", display: "inline-flex", alignItems: "center", gap: 8 },
  stepPillActive: { background: T.bleu, color: "#fff", borderColor: T.bleu },
  stepNumber: { fontSize: 10, opacity: 0.72 },
  fileName: { color: T.textSoft, fontSize: 12 },
  uploadPanel: { minHeight: 230, background: T.ecru, border: `1px solid ${T.border}`, borderRadius: 14, padding: 22, display: "grid", gap: 18, alignContent: "center" },
  uploadTitle: { fontFamily: T.fontDisplay, fontSize: 32, lineHeight: 1, margin: 0, fontWeight: 400 },
  profileHero: { minHeight: 310, position: "relative", overflow: "hidden", borderRadius: T.cardRadius, padding: "38px clamp(22px, 5vw, 58px)", display: "flex", alignItems: "flex-end", boxShadow: T.shadowSoft, background: "#050505" },
  profileHeroImage: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(1)" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 },
  summaryItem: { background: T.ecru, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12 },
  muted: { color: T.textSoft, lineHeight: 1.5 },
  helpText: { fontSize: 12, color: T.textSoft, lineHeight: 1.4 },
  error: { background: "rgba(159,29,29,0.08)", color: T.danger, border: "1px solid rgba(159,29,29,0.22)", borderRadius: 6, padding: 10 },
  success: { background: "rgba(35,107,56,0.08)", color: T.green, border: "1px solid rgba(35,107,56,0.22)", borderRadius: 6, padding: 10 },
  table: { display: "grid", border: `1px solid ${T.border}`, borderRadius: 8, overflow: "auto", background: "#fff" },
  tableHead: { padding: 12, background: T.ecru, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: T.textSoft },
  cell: { padding: 12, borderTop: `1px solid ${T.border}`, fontSize: 13 },
  badge: { display: "inline-flex", padding: "5px 8px", background: T.bleuPale, color: T.bleu, border: `1px solid ${T.bleuBorder}`, borderRadius: 6, fontSize: 11, textTransform: "uppercase", fontWeight: 800 },
  emptyState: { padding: 18, background: T.ecru, borderRadius: 8, color: T.textSoft },
  linkButton: { border: "none", background: "transparent", color: T.bleu, cursor: "pointer", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", padding: 0, fontSize: 12, textAlign: "left" },
  adminShell: { minHeight: "100vh", display: "grid", gridTemplateColumns: "290px minmax(0, 1fr)", background: T.ecru, color: T.noir, fontFamily: T.fontBody },
  adminSidebar: { position: "sticky", top: 0, height: "100vh", background: "#050505", color: "#fff", padding: 18, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 20, boxSizing: "border-box" },
  adminBrand: { display: "flex", alignItems: "center", gap: 14, padding: "10px 8px 24px", borderBottom: "1px solid rgba(255,255,255,0.12)" },
  adminLogo: { height: 34, objectFit: "contain" },
  adminBrandTitle: { fontSize: 13, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase" },
  adminBrandSub: { fontSize: 12, color: "rgba(255,255,255,0.62)", marginTop: 4 },
  adminNav: { display: "grid", gap: 8, marginTop: 18 },
  adminNavItem: { minHeight: 44, padding: "0 12px", borderRadius: 12, color: "rgba(255,255,255,0.76)", textDecoration: "none", display: "flex", alignItems: "center", gap: 10, fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", border: "1px solid transparent" },
  adminNavItemActive: { color: "#fff", background: "rgba(0,0,254,0.42)", borderColor: "rgba(255,255,255,0.16)" },
  adminLogoutButton: { minHeight: 44, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.06)", color: "#fff", borderRadius: 12, padding: "0 12px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" },
  adminMain: { padding: "28px clamp(18px, 3vw, 38px) 48px", minWidth: 0 },
  adminPageHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, marginBottom: 4, flexWrap: "wrap" },
};
