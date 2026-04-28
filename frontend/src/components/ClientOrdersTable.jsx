import { styles } from "../styles";
import { clientStatus, formatDate } from "../utils/formatters";

function ClientOrdersTable({ orders, columns, empty, actions }) {
  if (!orders.length) return <div style={styles.emptyState}>{empty}</div>;

  const labels = {
    order: "N° demande",
    type: "Type",
    reference: "Référence client",
    application: "Application",
    material: "Matière",
    count: "Titrage",
    lines: "Lignes",
    quantity: "Quantité",
    status: "Statut",
    date: "Date souhaitée",
  };
  const values = {
    order: (order) => order.order_number || "—",
    type: (order) => <span style={styles.badge}>{order.order_type === "catalog" ? "Mercerie" : "Industriel"}</span>,
    reference: (order) => order.client_reference || "—",
    application: (order) => order.order_type === "catalog" ? "Catalogue" : order.first_application_type || order.application_type || order.destination_usage || "—",
    material: (order) => order.order_type === "catalog" ? "Mercerie" : [order.first_material_family || order.material_family || order.material, order.first_material_quality || order.material_quality].filter(Boolean).join(" - ") || "—",
    count: (order) => order.order_type === "catalog" ? "—" : order.first_yarn_count_nm || order.first_dtex || order.first_custom_count || order.yarn_count || order.dtex || order.custom_count || "—",
    lines: (order) => order.line_count || "—",
    quantity: (order) => `${order.total_quantity_kg || order.quantity_kg || "—"} kg`,
    status: (order) => <span style={styles.badge}>{clientStatus(order.status)}</span>,
    date: (order) => formatDate(order.requested_delivery_date || order.requested_date),
  };

  return (
    <div style={{ ...styles.table, gridTemplateColumns: `repeat(${columns.length + (actions ? 1 : 0)}, minmax(120px, 1fr))` }}>
      {columns.map((column) => (
        <div key={`head-${column}`} style={styles.tableHead}>{labels[column]}</div>
      ))}
      {actions && <div style={styles.tableHead}>Actions</div>}
      {orders.map((order) => {
        const rowKey = order._key || `${order.order_type || "technical"}-${order.id}`;
        return columns.map((column) => (
          <div key={`${rowKey}-${column}`} style={styles.cell}>{values[column](order)}</div>
        )).concat(actions ? [<div key={`${rowKey}-actions`} style={styles.cell}>{actions(order)}</div>] : []);
      })}
    </div>
  );
}

export default ClientOrdersTable;
