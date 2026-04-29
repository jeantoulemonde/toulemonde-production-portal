import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { styles } from "../../styles";
import { api } from "../../api/api";
import ClientOrdersTable from "../../components/ClientOrdersTable";
import PageHeader from "../../components/PageHeader";
import PageContainer from "../../components/PageContainer";

function ClientOrders() {
  const navigate = useNavigate();
  const location = useLocation();
  const [orders, setOrders] = useState(null);
  const [message, setMessage] = useState(location.state?.successMessage || "");
  const [error, setError] = useState("");

  async function loadOrders() {
    try {
      const technicalOrders = await api("/api/client/orders");
      setOrders(
        technicalOrders
          .map((order) => ({ ...order, order_type: "technical" }))
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      );
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => { loadOrders(); }, []);

  async function deleteDraft(order) {
    try {
      setError("");
      setMessage("");
      await api(`/api/client/orders/${order.id}`, { method: "DELETE" });
      setMessage("Brouillon supprimé.");
      await loadOrders();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitDraft(order) {
    try {
      await api(`/api/client/orders/${order.id}/submit`, { method: "POST" });
      setMessage("Demande soumise à Toulemonde Production.");
      await loadOrders();
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        kicker="Portail client"
        title="Mes demandes de fil"
        subtitle="Consultez l’historique et l’avancement de vos demandes de production."
      >
        <button style={styles.primaryButton} onClick={() => navigate("/client/orders/new")}>Nouvelle demande</button>
      </PageHeader>
      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={message.includes("incomplète") || message.includes("manqu") ? styles.error : styles.success}>{message}</div>}
      <OrderList
        title="Demandes de commande"
        orders={orders || []}
        onOpen={(order) => navigate(`/client/orders/${order.id}`)}
        onResume={(order) => navigate(`/client/orders/new?draftId=${order.id}`)}
        onDeleteDraft={deleteDraft}
        onSubmitDraft={submitDraft}
        onCreateNew={() => navigate("/client/orders/new")}
      />
    </PageContainer>
  );
}

function OrderList({ title, orders, onOpen, onResume, onDeleteDraft, onSubmitDraft, onCreateNew }) {
  return (
    <section style={styles.cardWide}>
      <h2 style={styles.cardTitle}>{title}</h2>
      {!orders.length ? (
        <div style={styles.emptyState}>
          Vous n'avez pas encore fait de demande de fil.
          <div style={{ marginTop: 12 }}>
            <button style={styles.primaryButton} onClick={onCreateNew}>Démarrer une demande</button>
          </div>
        </div>
      ) : (
        <ClientOrdersTable
          orders={orders}
          columns={["order", "reference", "lines", "application", "material", "count", "quantity", "status", "date"]}
          empty="Aucune demande pour le moment."
          actions={(order) => order.status === "draft" ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button style={styles.linkButton} onClick={() => onResume(order)}>Reprendre</button>
              <button style={styles.linkButton} onClick={() => onSubmitDraft(order)}>Soumettre</button>
              <button style={styles.linkButton} onClick={() => onDeleteDraft(order)}>Supprimer</button>
            </div>
          ) : <button style={styles.linkButton} onClick={() => onOpen(order)}>Détail</button>}
        />
      )}
    </section>
  );
}

export default ClientOrders;
