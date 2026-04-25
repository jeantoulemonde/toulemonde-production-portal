import React from "react";
import { useNavigate } from "react-router";
import clientSpools from "../assets/client-spools.png";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div style={styles.wrap}>
      <section style={styles.heroCard}>
        <div style={styles.heroContent}>
          <p style={styles.eyebrow}>Bienvenue</p>
          <h2 style={styles.title}>Votre espace client Toulemonde</h2>
          <p style={styles.text}>
            Préparez vos commandes, consultez votre historique et échangez plus
            facilement avec nos équipes.
          </p>

          <div style={styles.actions}>
            <button style={styles.primaryButton} onClick={() => navigate("/catalog")}>
              Accéder au catalogue
            </button>
            <button style={styles.secondaryButton} onClick={() => navigate("/orders")}>
              Voir mes commandes
            </button>
          </div>
        </div>

        <img src={clientSpools} alt="Bobines de fil" style={styles.heroImage} />
      </section>

      <section style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.cardEyebrow}>Catalogue</div>
          <div style={styles.cardTitle}>Fils & usages</div>
          <div style={styles.cardText}>
            Explorez les familles lin, coton, synthétique et divers, avec les
            principaux usages métier.
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardEyebrow}>Panier</div>
          <div style={styles.cardTitle}>Préparation simple</div>
          <div style={styles.cardText}>
            Constituez votre demande progressivement avant validation finale.
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardEyebrow}>Suivi</div>
          <div style={styles.cardTitle}>Visibilité</div>
          <div style={styles.cardText}>
            Retrouvez facilement le statut de vos commandes et demandes en cours.
          </div>
        </div>
      </section>
    </div>
  );
}

const styles = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  heroCard: {
    background: "#fffaf2",
    border: "1px solid rgba(60, 40, 20, 0.08)",
    borderRadius: "24px",
    overflow: "hidden",
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    boxShadow: "0 12px 30px rgba(40, 30, 20, 0.06)",
  },
  heroContent: {
    padding: "32px",
  },
  eyebrow: {
    margin: 0,
    fontSize: "12px",
    letterSpacing: "0.24em",
    textTransform: "uppercase",
    opacity: 0.65,
  },
  title: {
    margin: "10px 0 12px",
    fontSize: "42px",
    lineHeight: 1.02,
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    color: "rgb(0,0,254)",
  },
  text: {
    margin: 0,
    fontSize: "15px",
    opacity: 0.8,
    lineHeight: 1.7,
    maxWidth: 520,
  },
  actions: {
    display: "flex",
    gap: 12,
    marginTop: 24,
    flexWrap: "wrap",
  },
  primaryButton: {
    border: "none",
    background: "rgb(0,0,254)",
    color: "#fff",
    borderRadius: "999px",
    padding: "12px 18px",
    cursor: "pointer",
    fontWeight: 600,
  },
  secondaryButton: {
    border: "1px solid rgba(60, 40, 20, 0.16)",
    background: "transparent",
    color: "#2b2b2b",
    borderRadius: "999px",
    padding: "12px 18px",
    cursor: "pointer",
    fontWeight: 600,
  },
  heroImage: {
    width: "100%",
    height: "100%",
    minHeight: 340,
    objectFit: "cover",
    display: "block",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 20,
  },
  card: {
    background: "#fffaf2",
    border: "1px solid rgba(60, 40, 20, 0.08)",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 12px 30px rgba(40, 30, 20, 0.06)",
  },
  cardEyebrow: {
    fontSize: "11px",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    opacity: 0.6,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: "24px",
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    marginBottom: 10,
  },
  cardText: {
    fontSize: "14px",
    lineHeight: 1.7,
    opacity: 0.78,
  },
};