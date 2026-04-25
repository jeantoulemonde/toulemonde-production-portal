import React, { useEffect, useMemo, useState } from "react";

const email = "client@example.com";

export default function CartPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadCart() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`/api/cart?email=${encodeURIComponent(email)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Impossible de charger le panier");
      }

      setItems(data.items || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Erreur chargement panier");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCart();
  }, []);

  const totalLines = useMemo(() => items.length, [items]);

  async function removeItem(id) {
    try {
      setError("");
      setMessage("");

      const response = await fetch(`/api/cart/items/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Impossible de supprimer l'article");
      }

      setMessage("Article supprimé du panier.");
      loadCart();
    } catch (err) {
      console.error(err);
      setError(err.message || "Erreur suppression article");
    }
  }

  async function checkout() {
    try {
      setError("");
      setMessage("");

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Impossible de valider la commande");
      }

      setMessage(`Commande validée : ${data.orderNumber}`);
      loadCart();
    } catch (err) {
      console.error(err);
      setError(err.message || "Erreur validation commande");
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Panier</p>
          <h2 style={styles.title}>Votre sélection</h2>
          <p style={styles.text}>
            Vérifiez vos articles avant de passer à la validation.
          </p>
        </div>

        <div style={styles.counter}>{totalLines} ligne(s)</div>
      </div>

      {message ? <div style={styles.success}>{message}</div> : null}
      {error ? <div style={styles.error}>{error}</div> : null}

      {loading ? (
        <div style={styles.card}>Chargement du panier...</div>
      ) : items.length === 0 ? (
        <div style={styles.card}>Votre panier est vide.</div>
      ) : (
        <>
          <div style={styles.list}>
            {items.map((item) => (
              <div key={item.id} style={styles.item}>
                <div>
                  <div style={styles.itemTitle}>{item.product_label}</div>
                  <div style={styles.itemMeta}>
                    {item.family} · {item.application || "—"} · {item.quantity}{" "}
                    {item.unit || ""}
                  </div>
                  <div style={styles.itemSub}>
                    Support : {item.support || "—"}{" "}
                    {item.color ? `· Coloris : ${item.color}` : ""}
                  </div>
                </div>

                <button
                  style={styles.deleteButton}
                  onClick={() => removeItem(item.id)}
                >
                  Supprimer
                </button>
              </div>
            ))}
          </div>

          <div style={styles.footerActions}>
            <button style={styles.checkoutButton} onClick={checkout}>
              Valider ma commande
            </button>
          </div>
        </>
      )}
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
  counter: {
    background: "#fffaf2",
    border: "1px solid rgba(60, 40, 20, 0.08)",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 600,
  },
  card: {
    background: "#fffaf2",
    border: "1px solid rgba(60, 40, 20, 0.08)",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 12px 30px rgba(40, 30, 20, 0.06)",
  },
  list: {
    display: "grid",
    gap: 14,
  },
  item: {
    background: "#fffaf2",
    border: "1px solid rgba(60, 40, 20, 0.08)",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 12px 30px rgba(40, 30, 20, 0.06)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
  },
  itemTitle: {
    fontSize: 24,
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    marginBottom: 6,
  },
  itemMeta: {
    fontSize: 14,
    color: "rgb(0,0,254)",
    marginBottom: 6,
  },
  itemSub: {
    fontSize: 13,
    opacity: 0.7,
  },
  deleteButton: {
    border: "1px solid rgba(180, 80, 80, 0.2)",
    background: "rgba(180, 80, 80, 0.08)",
    color: "#9b3d3d",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  footerActions: {
    display: "flex",
    justifyContent: "flex-end",
  },
  checkoutButton: {
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