import { styles } from "../styles";
import { clientStatus, formatDate } from "../utils/formatters";

function ClientOrdersTable({ orders, columns, empty }) {
  if (!orders.length) return <div style={styles.emptyState}>{empty}</div>;

  const labels = {
    order: "N° commande",
    reference: "Référence client",
    material: "Matière",
    count: "Titre Nm",
    quantity: "Quantité",
    status: "Statut",
    date: "Date souhaitée",
  };
  const values = {
    order: (order) => order.order_number || "—",
    reference: (order) => order.client_reference || "—",
    material: (order) => order.material || "—",
    count: (order) => order.yarn_count || "—",
    quantity: (order) => `${order.quantity_kg || "—"} kg`,
    status: (order) => <span style={styles.badge}>{clientStatus(order.status)}</span>,
    date: (order) => formatDate(order.requested_date),
  };

  return (
    <div style={{ ...styles.table, gridTemplateColumns: `repeat(${columns.length}, minmax(120px, 1fr))` }}>
      {columns.map((column) => (
        <div key={`head-${column}`} style={styles.tableHead}>{labels[column]}</div>
      ))}
      {orders.map((order) => columns.map((column) => (
        <div key={`${order.id}-${column}`} style={styles.cell}>{values[column](order)}</div>
      )))}
    </div>
  );
}

export default ClientOrdersTable;
