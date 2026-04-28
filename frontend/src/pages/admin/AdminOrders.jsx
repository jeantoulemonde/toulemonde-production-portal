import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../../api/api";
import { styles } from "../../styles";
import PageHeader from "../../components/PageHeader";
import SimpleTable from "../../components/SimpleTable";

function AdminOrders({ onPendingCountChange }) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("validation");
  const [approveOrder, setApproveOrder] = useState(null);
  const [approveComment, setApproveComment] = useState("");
  const [message, setMessage] = useState("");

  async function loadOrders() {
    const data = await api("/api/admin/orders");
    setOrders(data);
  }

  useEffect(() => { loadOrders().catch(console.error); }, []);

  const filteredOrders = orders.filter((order) => {
    if (filter === "all") return true;
    if (filter === "validation") return ["pending_approval"].includes(order.status);
    if (filter === "approved") return order.status === "approved";
    if (filter === "rejected") return order.status === "rejected";
    return true;
  });

  async function confirmApprove() {
    if (!approveOrder) return;
    await api(`/api/orders/${approveOrder.id}/approve`, {
      method: "POST",
      body: JSON.stringify({ comment: approveComment }),
    });
    setMessage("Commande approuvée.");
    setApproveOrder(null);
    setApproveComment("");
    await loadOrders();
    await onPendingCountChange?.();
  }

  return (
    <div style={styles.pageStack}>
      <PageHeader variant="admin" kicker="Administration" title="Commandes" subtitle="Suivi interne des demandes portail et statuts." />
      {message && <div style={styles.success}>{message}</div>}
      <section style={styles.cardWide}>
        <div style={styles.formActions}>
          <button type="button" style={filter === "validation" ? styles.primaryButton : styles.ghostButton} onClick={() => setFilter("validation")}>À valider</button>
          <button type="button" style={filter === "approved" ? styles.primaryButton : styles.ghostButton} onClick={() => setFilter("approved")}>Approuvées</button>
          <button type="button" style={filter === "rejected" ? styles.primaryButton : styles.ghostButton} onClick={() => setFilter("rejected")}>Refusées</button>
          <button type="button" style={filter === "all" ? styles.primaryButton : styles.ghostButton} onClick={() => setFilter("all")}>Toutes</button>
        </div>
        <SimpleTable
          columns={["order_number", "company_name", "client_reference", "line_count", "total_quantity_kg", "status", "sage_status", "created_at", "requested_delivery_date"]}
          rows={filteredOrders}
          actions={(order) => (
            <div style={local.actions}>
              <button style={styles.linkButton} onClick={() => navigate(`/admin/orders/${order.id}`)}>Détail</button>
              {order.status === "pending_approval" && (
                <button style={styles.linkButton} onClick={() => setApproveOrder(order)}>Approuver</button>
              )}
            </div>
          )}
        />
      </section>
      {approveOrder && (
        <div style={local.modalOverlay} role="dialog" aria-modal="true">
          <div style={local.modal}>
            <h2 style={styles.cardTitle}>Valider la commande</h2>
            <p style={styles.muted}>Êtes-vous sûr de vouloir valider cette commande ?</p>
            <label style={styles.field}>
              <span style={styles.label}>Commentaire facultatif</span>
              <textarea
                style={styles.textarea}
                value={approveComment}
                onChange={(event) => setApproveComment(event.target.value)}
                placeholder="Commentaire interne de validation"
              />
            </label>
            <div style={styles.formActions}>
              <button type="button" style={styles.ghostButton} onClick={() => setApproveOrder(null)}>Annuler</button>
              <button type="button" style={styles.primaryButton} onClick={confirmApprove}>Confirmer la validation</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const local = {
  actions: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  modalOverlay: { position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  modal: { width: "min(560px, 100%)", background: "#fff", borderRadius: 18, padding: 22, display: "grid", gap: 16, boxShadow: "0 28px 80px rgba(0,0,0,0.28)" },
};

export default AdminOrders;
