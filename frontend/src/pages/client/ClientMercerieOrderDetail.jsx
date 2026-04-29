import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { api } from "../../api/api";
import PageContainer from "../../components/PageContainer";
import PageHeader from "../../components/PageHeader";
import SimpleTable from "../../components/SimpleTable";
import LoadingState from "../../components/LoadingState";
import { styles } from "../../styles";
import { T } from "../../theme";
import { formatDate, formatDateTime } from "../../utils/formatters";

const STATUS_LABELS = {
  draft: "Brouillon",
  submitted: "Envoyée",
  confirmed: "Confirmée",
  preparing: "En préparation",
  ready: "Prête",
  delivered: "Livrée",
  cancelled: "Annulée",
};

function ClientMercerieOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/api/client/catalog/orders/${id}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);

  if (!data && error) return (
    <PageContainer>
      <div style={styles.error}>{error}</div>
      <button style={styles.ghostButton} onClick={() => navigate("/client/mercerie/orders")}>← Retour</button>
    </PageContainer>
  );
  if (!data) return <LoadingState message="Chargement de la commande..." />;

  const { order, lines } = data;
  const statusLabel = STATUS_LABELS[order.status] || order.status;
  const orderTotal = lines.reduce(
    (sum, line) => sum + Number(line.line_total || (line.unit_price || 0) * (line.quantity || 0)),
    0
  );

  return (
    <PageContainer>
      <PageHeader
        kicker="Mercerie"
        title={order.order_number || `Commande ${order.id}`}
        subtitle={order.customer_reference ? `Référence client : ${order.customer_reference}` : "Commande mercerie"}
      >
        <button style={styles.ghostButton} onClick={() => navigate("/client/mercerie/orders")}>← Mes commandes mercerie</button>
      </PageHeader>

      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Résumé</h2>
        <div style={styles.summaryGrid}>
          <SummaryItem label="Statut">
            <span style={styles.badge}>{statusLabel}</span>
          </SummaryItem>
          <SummaryItem label="Date de création">{formatDateTime(order.created_at)}</SummaryItem>
          <SummaryItem label="Livraison souhaitée">{formatDate(order.requested_delivery_date)}</SummaryItem>
          <SummaryItem label="Lignes">{lines.length}</SummaryItem>
          <SummaryItem label="Total">{orderTotal > 0 ? `${orderTotal.toFixed(2)} EUR` : "Sur demande"}</SummaryItem>
        </div>
        {order.comment && (
          <div style={{ marginTop: 14 }}>
            <div style={styles.label}>Commentaire</div>
            <p style={{ ...styles.muted, marginTop: 6 }}>{order.comment}</p>
          </div>
        )}
      </section>

      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Articles commandés</h2>
        <SimpleTable
          columns={["sku", "product_name", "color_name", "quantity", "unit_label", "unit_price", "line_total"]}
          rows={lines.map((line) => ({
            ...line,
            color_name: line.color_name
              ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {line.color_hex && (
                    <span style={{ width: 14, height: 14, borderRadius: "50%", background: line.color_hex, border: `1px solid ${T.borderMid}` }} />
                  )}
                  {line.color_name}
                  {line.variant_reference ? ` · ${line.variant_reference}` : ""}
                </span>
              )
              : "—",
            unit_price: line.unit_price !== null && line.unit_price !== undefined ? `${Number(line.unit_price).toFixed(2)} EUR` : "—",
            line_total: line.line_total !== null && line.line_total !== undefined ? `${Number(line.line_total).toFixed(2)} EUR` : "—",
          }))}
        />
      </section>
    </PageContainer>
  );
}

function SummaryItem({ label, children }) {
  return (
    <div style={styles.summaryItem}>
      <div style={styles.label}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

export default ClientMercerieOrderDetail;
