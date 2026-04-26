import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../../api/api";
import { styles } from "../../styles";
import PageHeader from "../../components/PageHeader";
import SimpleTable from "../../components/SimpleTable";

function AdminOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  useEffect(() => { api("/api/admin/orders").then(setOrders).catch(console.error); }, []);
  return (
    <div style={styles.pageStack}>
      <PageHeader variant="admin" kicker="Administration" title="Commandes" subtitle="Suivi interne des commandes portail et statuts." />
      <section style={styles.cardWide}>
        <SimpleTable
          columns={["order_number", "client_reference", "company_name", "material", "yarn_count", "quantity_kg", "status", "sage_order_number", "created_at", "requested_delivery_date"]}
          rows={orders}
          actions={(order) => <button style={styles.linkButton} onClick={() => navigate(`/admin/orders/${order.id}`)}>Détail</button>}
        />
      </section>
    </div>
  );
}

export default AdminOrders;
