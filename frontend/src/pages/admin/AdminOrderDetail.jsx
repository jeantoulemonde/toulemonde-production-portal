import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { api } from "../../api/api";
import { styles } from "../../styles";
import { adminFieldLabel } from "../../utils/formatters";
import PageHeader from "../../components/PageHeader";
import SimpleTable from "../../components/SimpleTable";

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
      <PageHeader variant="admin" kicker="Administration" title={order.order_number || `Commande ${id}`} subtitle={order.company_name || "Commande portail"}>
        <button style={styles.primaryButton} onClick={forceSync}>Forcer sync Sage</button>
      </PageHeader>
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

export default AdminOrderDetail;
