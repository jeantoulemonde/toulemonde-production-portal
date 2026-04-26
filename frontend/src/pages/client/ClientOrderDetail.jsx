import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { api } from "../../api/api";
import PageHeader from "../../components/PageHeader";
import { styles } from "../../styles";
import { clientStatus, formatDate } from "../../utils/formatters";

function ClientOrderDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/api/client/orders/${id}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);

  const specs = useMemo(() => {
    const raw = data?.specs?.[0]?.specs_json;
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }, [data]);

  if (error) return <div style={styles.error}>{error}</div>;
  if (!data) return <div style={styles.cardWide}>Chargement...</div>;

  const { order } = data;
  const rows = [
    ["N° commande", order.order_number],
    ["Référence client", order.client_reference],
    ["Statut", clientStatus(order.status)],
    ["Date souhaitée", formatDate(order.requested_date)],
    ["Livraison souhaitée", formatDate(order.requested_delivery_date)],
    ["Matière", order.material],
    ["Titre Nm", order.yarn_count],
    ["Nombre de plis", order.ply_number || specs.ply_number],
    ["Retordage", order.twist],
    ["Couleur", order.color],
    ["Référence couleur", order.color_reference || specs.color_reference],
    ["Teinture requise", order.dyeing_required ? "Oui" : "Non"],
    ["Quantité", `${order.quantity_kg || "—"} kg`],
    ["Conditionnement", order.conditioning],
    ["Usage", order.destination_usage],
    ["Tolérance", order.tolerance_percent !== null && order.tolerance_percent !== undefined ? `${order.tolerance_percent}%` : order.tolerance],
    ["Livraison partielle", order.partial_delivery_allowed ? "Oui" : "Non"],
    ["Commentaire", order.comment],
  ];

  return (
    <div style={styles.pageStack}>
      <PageHeader
        kicker="Portail client"
        title={order.order_number || "Détail commande"}
        subtitle="Résumé métier de votre demande de production."
      />

      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Résumé commande</h2>
        <div style={styles.summaryGrid}>
          {rows.map(([label, value]) => (
            <div key={label} style={styles.summaryItem}>
              <div style={styles.label}>{label}</div>
              <div>{value || "—"}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default ClientOrderDetail;
