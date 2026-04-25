import React, { useEffect, useState } from "react";

const email = "client@example.com";

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOrders() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`/api/orders?email=${encodeURIComponent(email)}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Impossible de charger les commandes");
        }

        setOrders(data || []);
      } catch (err) {
        console.error(err);
        setError(err.message || "Erreur chargement commandes");
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, []);

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Commandes</p>
          <h2 style={styles.title}>Mon historique</h2>
          <p style={styles.text}>
            Retrouvez ici vos commandes validées.
          </p>
        </div>
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}

      {loading ? (
        <div style={styles.card}>Chargement des commandes...</div>
      ) : orders.length === 0 ? (
        <div style={styles.card}>Aucune commande validée pour le moment.</div>
      ) : (
        <div style={styles.list}>
          {orders.map((order) => (
            <div key={order.id} style={styles.card}>
              <div style={styles.row}>
                <div>
                  <div style={styles.orderNumber}>{order.order_number}</div>
                  <div style={styles.meta}>
                    {order.total_lines} ligne(s) · {formatDate(order.created_at)}
                  </div>
                </div>

                <div style={styles.badge}>{order.status}</div>
              </div>
            </div>
          ))}
        </div>
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
  list: {
    display: "grid",
    gap: 14,
  },
  card: {
    background: "#fffaf2",
    border: "1px solid rgba(60, 40, 20, 0.08)",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 12px 30px rgba(40, 30, 20, 0.06)",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
  },
  orderNumber: {
    fontSize: 26,
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    marginBottom: 6,
  },
  meta: {
    fontSize: 13,
    opacity: 0.72,
  },
  badge: {
    background: "rgba(0,0,254,0.08)",
    color: "rgb(0,0,254)",
    border: "1px solid rgba(0,0,254,0.18)",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
  },
  error: {
    padding: 12,
    background: "rgba(180, 80, 80, 0.14)",
    color: "#9b3d3d",
    borderRadius: 12,
  },
};