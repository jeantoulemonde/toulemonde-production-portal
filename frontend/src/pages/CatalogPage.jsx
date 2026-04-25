import React, { useMemo, useState } from "react";

const email = "client@example.com";

const catalogItems = [
  {
    code: "LIN-CONF-001",
    family: "Lin",
    application: "Confection",
    label: "Fil de lin confection",
    description: "Fil naturel pour confection et usage textile.",
    support: "Bobine",
    unit: "kg",
  },
  {
    code: "COTON-TISS-001",
    family: "Coton",
    application: "Tissage",
    label: "Fil coton tissage",
    description: "Fil coton polyvalent pour chaîne et trame.",
    support: "Cône",
    unit: "kg",
  },
  {
    code: "SYN-TECH-001",
    family: "Synthétique",
    application: "Technique",
    label: "Fil technique synthétique",
    description: "Fil résistant pour applications techniques.",
    support: "Tube carton",
    unit: "kg",
  },
  {
    code: "DIV-BROD-001",
    family: "Divers",
    application: "Broderie",
    label: "Fil fantaisie broderie",
    description: "Fil spécial pour broderie et finitions.",
    support: "Bobine à joue",
    unit: "bobines",
  },
];

export default function CatalogPage() {
  const [familyFilter, setFamilyFilter] = useState("Tous");
  const [addingCode, setAddingCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const filteredItems = useMemo(() => {
    if (familyFilter === "Tous") return catalogItems;
    return catalogItems.filter((item) => item.family === familyFilter);
  }, [familyFilter]);

async function addToCart(item) {
  try {
    setAddingCode(item.code);
    setMessage("");
    setError("");

    const response = await fetch("/api/cart/items", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        product_code: item.code,
        family: item.family,
        application: item.application,
        product_label: item.label,
        color: "",
        quantity: 1,
        unit: item.unit,
        support: item.support,
        requested_date: "",
        comment: "",
      }),
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(data.error || `Impossible d'ajouter au panier (${response.status})`);
    }

    setMessage(`"${item.label}" a été ajouté au panier.`);
  } catch (err) {
    console.error(err);
    setError(err.message || "Erreur ajout panier");
  } finally {
    setAddingCode("");
  }
}

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Catalogue</p>
          <h2 style={styles.title}>Sélection de fils</h2>
          <p style={styles.text}>
            Choisissez une famille puis ajoutez vos articles au panier.
          </p>
        </div>

        <select
          style={styles.select}
          value={familyFilter}
          onChange={(e) => setFamilyFilter(e.target.value)}
        >
          {["Tous", "Lin", "Coton", "Synthétique", "Divers"].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {message ? <div style={styles.success}>{message}</div> : null}
      {error ? <div style={styles.error}>{error}</div> : null}

      <div style={styles.grid}>
        {filteredItems.map((item) => (
          <div key={item.code} style={styles.card}>
            <div style={styles.cardFamily}>{item.family}</div>
            <div style={styles.cardTitle}>{item.label}</div>
            <div style={styles.cardApp}>{item.application}</div>
            <div style={styles.cardText}>{item.description}</div>

            <div style={styles.meta}>
              <span>{item.support}</span>
              <span>{item.unit}</span>
            </div>

            <button
              style={styles.button}
              onClick={() => addToCart(item)}
              disabled={addingCode === item.code}
            >
              {addingCode === item.code ? "Ajout..." : "Ajouter au panier"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 20,
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    letterSpacing: "0.24em",
    textTransform: "uppercase",
    opacity: 0.65,
  },
  title: {
    margin: "8px 0 8px",
    fontSize: 34,
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    color: "rgb(0,0,254)",
  },
  text: {
    margin: 0,
    fontSize: 14,
    opacity: 0.8,
  },
  select: {
    minWidth: 180,
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(60, 40, 20, 0.16)",
    background: "#fffaf2",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 20,
  },
  card: {
    background: "#fffaf2",
    border: "1px solid rgba(60, 40, 20, 0.08)",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 12px 30px rgba(40, 30, 20, 0.06)",
  },
  cardFamily: {
    fontSize: 11,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    opacity: 0.6,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 28,
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    marginBottom: 6,
  },
  cardApp: {
    fontSize: 13,
    color: "rgb(0,0,254)",
    marginBottom: 10,
  },
  cardText: {
    fontSize: 14,
    opacity: 0.78,
    lineHeight: 1.7,
    marginBottom: 16,
  },
  meta: {
    display: "flex",
    gap: 10,
    fontSize: 12,
    opacity: 0.65,
    marginBottom: 18,
  },
  button: {
    border: "none",
    background: "rgb(0,0,254)",
    color: "#fff",
    borderRadius: 999,
    padding: "12px 18px",
    cursor: "pointer",
    fontWeight: 600,
  },
  success: {
    padding: 12,
    background: "rgba(90, 140, 90, 0.14)",
    color: "#2f6b3c",
    borderRadius: 12,
  },
  error: {
    padding: 12,
    background: "rgba(180, 80, 80, 0.14)",
    color: "#9b3d3d",
    borderRadius: 12,
  },
};