import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { styles } from "../../styles";
import { api } from "../../api/api";
import ClientOrdersTable from "../../components/ClientOrdersTable";
import PageHeader from "../../components/PageHeader";
import PageContainer from "../../components/PageContainer";

function ClientOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState("");
  async function loadOrders() {
    const next = await api("/api/client/orders");
    setOrders(next);
  }
  useEffect(() => { loadOrders().catch(console.error); }, []);

  async function deleteDraft(order) {
    await api(`/api/client/orders/${order.id}`, { method: "DELETE" });
    setMessage("Brouillon supprimé.");
    await loadOrders();
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
        title="Mes demandes"
        subtitle="Consultez l’historique et l’avancement de vos demandes de production."
      />
      {message && <div style={message.includes("incomplète") || message.includes("manqu") ? styles.error : styles.success}>{message}</div>}
      <OrderList
        title="Demandes de commande"
        orders={orders}
        onOpen={(order) => navigate(`/client/orders/${order.id}`)}
        onResume={(order) => navigate(`/client/orders/new?draftId=${order.id}`)}
        onDeleteDraft={deleteDraft}
        onSubmitDraft={submitDraft}
      />
    </PageContainer>
  );
}

function OrderList({ title, orders, onOpen, onResume, onDeleteDraft, onSubmitDraft }) {
  return (
    <section style={styles.cardWide}>
      <h2 style={styles.cardTitle}>{title}</h2>
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
    </section>
  );
}

export default ClientOrders;
