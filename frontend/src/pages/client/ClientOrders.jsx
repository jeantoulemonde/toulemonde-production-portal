import { useEffect, useState } from "react";
import { styles } from "../../styles";
import { api } from "../../api/api";
import ClientOrdersTable from "../../components/ClientOrdersTable";

function ClientOrders() {
  const [orders, setOrders] = useState([]);
  useEffect(() => { api("/api/client/orders").then(setOrders).catch(console.error); }, []);
  return <OrderList title="Mes commandes" orders={orders} />;
}

function OrderList({ title, orders }) {
  return (
    <section style={styles.cardWide}>
      <h2 style={styles.cardTitle}>{title}</h2>
      <ClientOrdersTable
        orders={orders}
        columns={["order", "reference", "material", "count", "quantity", "status", "date"]}
        empty="Aucune commande pour le moment."
      />
    </section>
  );
}

export default ClientOrders;
