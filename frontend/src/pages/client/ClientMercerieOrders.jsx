import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../../api/api";
import PageContainer from "../../components/PageContainer";
import PageHeader from "../../components/PageHeader";
import SimpleTable from "../../components/SimpleTable";
import { styles } from "../../styles";

const statusLabels = {
  draft: "Brouillon",
  submitted: "Envoyée",
  confirmed: "Confirmée",
  preparing: "En préparation",
  ready: "Prête",
  delivered: "Livrée",
  cancelled: "Annulée",
};

function ClientMercerieOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/client/catalog/orders").then(setOrders).catch((err) => setError(err.message));
  }, []);

  return (
    <PageContainer>
      <PageHeader
        kicker="Mercerie"
        title="Commandes mercerie"
        subtitle="Retrouvez vos commandes d’articles standards du catalogue."
      >
        <button style={styles.primaryButton} onClick={() => navigate("/client/mercerie")}>Nouvelle commande mercerie</button>
      </PageHeader>

      {error && <div style={styles.error}>{error}</div>}
      <section style={styles.cardWide}>
        {orders === null ? (
          <div style={styles.emptyState}>Chargement des commandes...</div>
        ) : !orders.length ? (
          <div style={styles.emptyState}>
            Aucune commande mercerie pour le moment.
            <div style={{ marginTop: 12 }}>
              <button type="button" style={styles.primaryButton} onClick={() => navigate("/client/mercerie")}>
                Voir le catalogue
              </button>
            </div>
          </div>
        ) : (
          <SimpleTable
            columns={["order_number", "customer_reference", "line_count", "order_total", "status", "requested_delivery_date", "created_at"]}
            rows={orders.map((order) => ({
              ...order,
              status: statusLabels[order.status] || order.status,
              order_total: Number(order.order_total || 0).toFixed(2),
            }))}
            actions={(order) => (
              <button style={styles.linkButton} onClick={() => navigate(`/client/mercerie/orders/${order.id}`)}>
                Détail
              </button>
            )}
          />
        )}
      </section>
    </PageContainer>
  );
}

export default ClientMercerieOrders;
