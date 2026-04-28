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
  const [typeFilter, setTypeFilter] = useState("all");
  const [message, setMessage] = useState("");
  async function loadOrders() {
    const [technicalOrders, catalogOrders] = await Promise.all([
      api("/api/client/orders"),
      api("/api/client/catalog/orders"),
    ]);
    setOrders([
      ...technicalOrders.map((order) => ({ ...order, order_type: "technical" })),
      ...catalogOrders.map((order) => ({
        ...order,
        order_type: "catalog",
        client_reference: order.customer_reference,
        total_quantity_kg: order.total_quantity,
      })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
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
      <section style={styles.cardWide}>
        <div style={styles.formActions}>
          <button type="button" style={typeFilter === "all" ? styles.primaryButton : styles.ghostButton} onClick={() => setTypeFilter("all")}>Toutes</button>
          <button type="button" style={typeFilter === "technical" ? styles.primaryButton : styles.ghostButton} onClick={() => setTypeFilter("technical")}>Industriel</button>
          <button type="button" style={typeFilter === "catalog" ? styles.primaryButton : styles.ghostButton} onClick={() => setTypeFilter("catalog")}>Mercerie</button>
        </div>
      </section>
      <OrderList
        title="Demandes de commande"
        orders={orders.filter((order) => typeFilter === "all" || order.order_type === typeFilter)}
        onOpen={(order) => navigate(`/client/orders/${order.id}`)}
        onResume={(order) => navigate(`/client/orders/new?draftId=${order.id}`)}
        onOpenCatalog={() => navigate("/client/mercerie/orders")}
        onDeleteDraft={deleteDraft}
        onSubmitDraft={submitDraft}
      />
    </PageContainer>
  );
}

function OrderList({ title, orders, onOpen, onResume, onOpenCatalog, onDeleteDraft, onSubmitDraft }) {
  return (
    <section style={styles.cardWide}>
      <h2 style={styles.cardTitle}>{title}</h2>
      <ClientOrdersTable
        orders={orders}
        columns={["type", "order", "reference", "lines", "application", "material", "count", "quantity", "status", "date"]}
        empty="Aucune demande pour le moment."
        actions={(order) => order.order_type === "catalog" ? (
          <button style={styles.linkButton} onClick={onOpenCatalog}>Commandes mercerie</button>
        ) : order.status === "draft" ? (
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
