import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { api } from "../../api/api";
import PageHeader from "../../components/PageHeader";
import SimpleTable from "../../components/SimpleTable";
import { styles } from "../../styles";
import { adminFieldLabel, clientStatus, formatDate } from "../../utils/formatters";

function AdminOrderDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [internalComment, setInternalComment] = useState("");

  async function load() {
    const next = await api(`/api/admin/orders/${id}`);
    setData(next);
    setInternalComment(next.order?.internal_comment || "");
  }

  useEffect(() => { load().catch(console.error); }, [id]);

  const specs = useMemo(() => {
    const raw = data?.specs?.[0]?.specs_json;
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }, [data]);

  if (!data) return <div style={styles.cardWide}>Chargement...</div>;

  const { order } = data;

  async function updateStatus(status, defaultMessage) {
    await api(`/api/admin/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
        message: statusMessage || defaultMessage,
        internal_comment: internalComment,
      }),
    });
    setMessage("Statut mis à jour.");
    setStatusMessage("");
    await load();
  }

  const technicalRows = [
    ["order_number", order.order_number],
    ["client_reference", order.client_reference],
    ["company_name", order.company_name],
    ["status", clientStatus(order.status)],
    ["material", order.material],
    ["yarn_count", order.yarn_count],
    ["ply_number", order.ply_number || specs.ply_number],
    ["twist", order.twist],
    ["color", order.color],
    ["color_reference", order.color_reference || specs.color_reference],
    ["dyeing_required", order.dyeing_required ? "Oui" : "Non"],
    ["quantity_kg", order.quantity_kg ? `${order.quantity_kg} kg` : null],
    ["conditioning", order.conditioning],
    ["destination_usage", order.destination_usage],
    ["tolerance_percent", order.tolerance_percent !== null && order.tolerance_percent !== undefined ? `${order.tolerance_percent}%` : order.tolerance],
    ["requested_date", formatDate(order.requested_date)],
    ["requested_delivery_date", formatDate(order.requested_delivery_date)],
    ["partial_delivery_allowed", order.partial_delivery_allowed ? "Oui" : "Non"],
    ["sage_order_number", order.sage_order_number],
    ["internal_comment", order.internal_comment],
    ["comment", order.comment],
  ];

  return (
    <div style={styles.pageStack}>
      <PageHeader
        variant="admin"
        kicker="Administration"
        title={order.order_number || `Commande ${id}`}
        subtitle={order.company_name || "Commande portail"}
      />

      {message && <div style={styles.success}>{message}</div>}

      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Validation admin</h2>
        <div style={styles.formGrid}>
          <label style={styles.field}>
            <span style={styles.label}>Message / commentaire interne</span>
            <textarea
              style={styles.textarea}
              value={statusMessage || internalComment}
              onChange={(event) => {
                setStatusMessage(event.target.value);
                setInternalComment(event.target.value);
              }}
              placeholder="Commentaire interne, motif de refus ou demande de correction"
            />
          </label>
        </div>
        <div style={styles.formActions}>
          <button type="button" style={styles.primaryButton} onClick={() => updateStatus("approved", "Commande approuvée")}>Approuver</button>
          <button type="button" style={styles.ghostButton} onClick={() => updateStatus("rejected", "Commande refusée")}>Refuser</button>
          <button type="button" style={styles.ghostButton} onClick={() => updateStatus("pending_validation", "Correction demandée")}>Demander correction</button>
          <button type="button" style={styles.ghostButton} onClick={() => updateStatus(order.status, "Commentaire interne mis à jour")}>Ajouter commentaire interne</button>
        </div>
      </section>

      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Détails techniques</h2>
        <div style={styles.summaryGrid}>
          {technicalRows.map(([field, value]) => (
            <div key={field} style={styles.summaryItem}>
              <div style={styles.label}>{adminFieldLabel(field)}</div>
              <div>{value || "—"}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Historique statut</h2>
        <SimpleTable columns={["old_status", "new_status", "source", "message", "created_at"]} rows={data.history || []} />
      </section>

      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Logs sync</h2>
        <SimpleTable columns={["system", "direction", "status", "message", "created_at"]} rows={data.logs || []} />
      </section>
    </div>
  );
}

export default AdminOrderDetail;
