import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import logoToulemonde from "../assets/logo-toulemonde-new.png";

export default function ClientLayout() {
  const navigate = useNavigate();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    async function loadCartCount() {
      const email = "client@example.com";

      try {
        const response = await fetch(
          `/api/cart?email=${encodeURIComponent(email)}`
        );
        const data = await response.json();
        setCartCount(data.items?.length || 0);
      } catch (err) {
        console.error(err);
      }
    }

    loadCartCount();
  }, []);

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div>
          <img
            src={logoToulemonde}
            alt="Toulemonde"
            style={styles.logo}
          />

          <p style={styles.eyebrow}>Portail privé</p>
          <h2 style={styles.sidebarTitle}>Espace client</h2>
          <p style={styles.sidebarText}>
            Consultez vos demandes, préparez vos commandes et suivez leur avancement.
          </p>
        </div>

        <nav style={styles.nav}>
          <NavItem to="/" label="Accueil" end />
          <NavItem to="/catalog" label="Catalogue" />
          <NavItem to="/cart" label={`Panier (${cartCount})`} />
          <NavItem to="/orders" label="Mes commandes" />
          <NavItem to="/profile" label="Mon profil" />
        </nav>

        <div style={styles.sidebarFooter}>
          <button
            style={styles.secondaryButton}
            onClick={() => navigate("/catalog")}
          >
            Nouvelle commande
          </button>
        </div>
      </aside>

      <main style={styles.main}>
        <div style={styles.topbar}>
          <div>
            <p style={styles.topbarLabel}>J. Toulemonde &amp; Fils</p>
            <h1 style={styles.topbarTitle}>Portail client</h1>
          </div>

          <div style={styles.userCard}>
            <div style={styles.userAvatar}>C</div>
            <div>
              <div style={styles.userName}>Compte client</div>
              <div style={styles.userRole}>Accès privé</div>
            </div>
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, label, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        ...styles.navItem,
        background: isActive ? "rgb(0,0,254)" : "transparent",
        color: isActive ? "#ffffff" : "#2b2b2b",
        border: isActive
          ? "1px solid rgb(0,0,254)"
          : "1px solid rgba(60, 40, 20, 0.08)",
      })}
    >
      {label}
    </NavLink>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "300px 1fr",
    background: "#f7f2e8",
    fontFamily: "'DM Sans', Arial, sans-serif",
    color: "#2b2b2b",
  },
  sidebar: {
    borderRight: "1px solid rgba(60, 40, 20, 0.08)",
    background: "#fffaf2",
    padding: "28px 20px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  logo: {
    width: 150,
    height: "auto",
    objectFit: "contain",
    marginBottom: 18,
  },
  eyebrow: {
    margin: 0,
    fontSize: "11px",
    letterSpacing: "0.28em",
    textTransform: "uppercase",
    opacity: 0.6,
  },
  sidebarTitle: {
    margin: "10px 0 8px",
    fontSize: "30px",
    lineHeight: 1.05,
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    color: "rgb(0,0,254)",
  },
  sidebarText: {
    margin: 0,
    fontSize: "14px",
    opacity: 0.75,
    lineHeight: 1.6,
  },
  nav: {
    display: "grid",
    gap: "10px",
    marginTop: "28px",
    alignContent: "start",
  },
  navItem: {
    textDecoration: "none",
    padding: "14px 16px",
    borderRadius: "16px",
    fontWeight: 600,
    transition: "all 0.2s ease",
  },
  sidebarFooter: {
    marginTop: "24px",
  },
  secondaryButton: {
    border: "1px solid rgba(60, 40, 20, 0.16)",
    background: "transparent",
    color: "#2b2b2b",
    borderRadius: "999px",
    padding: "12px 18px",
    cursor: "pointer",
    fontWeight: 600,
    width: "100%",
  },
  main: {
    padding: "28px",
  },
  topbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },
  topbarLabel: {
    margin: 0,
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.24em",
    opacity: 0.6,
  },
  topbarTitle: {
    margin: "8px 0 0",
    fontSize: "34px",
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    color: "rgb(0,0,254)",
  },
  userCard: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    background: "#fffaf2",
    border: "1px solid rgba(60, 40, 20, 0.08)",
    borderRadius: "20px",
    padding: "10px 14px",
    boxShadow: "0 10px 25px rgba(40, 30, 20, 0.05)",
  },
  userAvatar: {
    width: "40px",
    height: "40px",
    borderRadius: "999px",
    background: "rgb(0,0,254)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
  },
  userName: {
    fontSize: "14px",
    fontWeight: 700,
  },
  userRole: {
    fontSize: "12px",
    opacity: 0.65,
    letterSpacing: "0.08em",
  },
};