import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import atelierMachines from "../../assets/atelier-machines.png";
import { api } from "../../api/api";
import { styles } from "../../styles";
import { useIsMobile } from "../../utils/useIsMobile";
import ClientOrdersTable from "../../components/ClientOrdersTable";

function ClientDashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [orders, setOrders] = useState([]);
  useEffect(() => { api("/api/client/orders").then(setOrders).catch(console.error); }, []);
  const ongoingOrders = orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).slice(0, 5);
  const latestOrders = orders.slice(0, 3);

  return (
    <div style={styles.pageStack}>
      <section style={styles.heroPanel}>
        <img src={atelierMachines} alt="" style={styles.heroImage} />
        <div style={styles.heroOverlay} />
        <div style={styles.heroContent}>
          <div style={styles.overlineLight}>Portail privé filature</div>
          <h2 style={styles.heroTitle}>Bienvenue dans votre espace production Toulemonde</h2>
          <p style={styles.heroText}>Créez et suivez vos commandes de fil en temps réel.</p>
        </div>
        <button style={styles.primaryButton} onClick={() => navigate("/client/orders/new")}>Nouvelle commande</button>
      </section>

      <div style={{ ...styles.dashboardGrid, ...(isMobile ? styles.dashboardGridMobile : {}) }}>
        <section style={styles.cardWide}>
          <h2 style={styles.cardTitle}>Mes commandes en cours</h2>
          <ClientOrdersTable orders={ongoingOrders} columns={["order", "reference", "material", "count", "quantity", "status", "date"]} empty="Aucune commande en cours." />
        </section>

        <section style={styles.cardWide}>
          <h2 style={styles.cardTitle}>Actions rapides</h2>
          <div style={styles.quickActions}>
            <button style={styles.quickButton} onClick={() => navigate("/client/orders/new")}>Nouvelle commande</button>
            <button style={styles.quickButton} onClick={() => navigate("/client/orders")}>Mes commandes</button>
            <button style={styles.quickButton} onClick={() => navigate("/client/documents")}>Documents</button>
            <button style={styles.quickButton} onClick={() => navigate("/client/contact")}>Contacter Toulemonde Production</button>
          </div>
        </section>

        <section style={styles.cardWide}>
          <h2 style={styles.cardTitle}>Dernières commandes</h2>
          <ClientOrdersTable orders={latestOrders} columns={["material", "count", "quantity", "status"]} empty="Aucune commande récente." />
        </section>
      </div>
    </div>
  );
}

export default ClientDashboard;
