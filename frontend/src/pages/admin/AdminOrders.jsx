import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../../api/api";
import { styles } from "../../styles";
import PageHeader from "../../components/PageHeader";
import SimpleTable from "../../components/SimpleTable";

function AdminOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("validation");
  useEffect(() => { api("/api/admin/orders").then(setOrders).catch(console.error); }, []);

  const filteredOrders = orders.filter((order) => {
    if (filter === "all") return true;
    if (filter === "validation") return ["submitted", "pending_validation"].includes(order.status);
    if (filter === "approved") return order.status === "approved";
    if (filter === "sage") return ["pending_sage_sync", "sage_sync_failed", "sent_to_sage"].includes(order.status);
    if (filter === "rejected") return order.status === "rejected";
    return true;
  });

  return (
    <div style={styles.pageStack}>
      <PageHeader variant="admin" kicker="Administration" title="Commandes" subtitle="Suivi interne des demandes portail et statuts." />
      <section style={styles.cardWide}>
        <div style={styles.formActions}>
          <button type="button" style={filter === "validation" ? styles.primaryButton : styles.ghostButton} onClick={() => setFilter("validation")}>À valider</button>
          <button type="button" style={filter === "approved" ? styles.primaryButton : styles.ghostButton} onClick={() => setFilter("approved")}>Approuvées</button>
          <button type="button" style={filter === "sage" ? styles.primaryButton : styles.ghostButton} onClick={() => setFilter("sage")}>Échanges Sage</button>
          <button type="button" style={filter === "rejected" ? styles.primaryButton : styles.ghostButton} onClick={() => setFilter("rejected")}>Refusées</button>
          <button type="button" style={filter === "all" ? styles.primaryButton : styles.ghostButton} onClick={() => setFilter("all")}>Toutes</button>
        </div>
        <SimpleTable
          columns={["order_number", "company_name", "client_reference", "line_count", "total_quantity_kg", "status", "sage_order_number", "created_at", "requested_delivery_date"]}
          rows={filteredOrders}
          actions={(order) => <button style={styles.linkButton} onClick={() => navigate(`/admin/orders/${order.id}`)}>Détail</button>}
        />
      </section>
    </div>
  );
}

export default AdminOrders;
