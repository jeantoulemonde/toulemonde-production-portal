import { styles } from "../styles";
import { adminFieldLabel, formatCell } from "../utils/formatters";

function SimpleTable({ columns, rows, actions }) {
  if (!rows?.length) return <div style={styles.emptyState}>Aucune donnée.</div>;

  return (
    <div style={{ ...styles.table, gridTemplateColumns: `repeat(${columns.length + (actions ? 1 : 0)}, minmax(145px, 1fr))` }}>
      {columns.map((column) => (
        <div key={column} style={styles.tableHead}>{adminFieldLabel(column)}</div>
      ))}
      {actions && <div style={styles.tableHead}>Actions</div>}
      {rows.map((row, rowIndex) => (
        <FragmentRow key={row.id || rowIndex}>
          {columns.map((column) => (
            <div key={`${row.id || rowIndex}-${column}`} style={styles.cell}>{formatCell(row[column])}</div>
          ))}
          {actions && <div style={styles.cell}>{actions(row)}</div>}
        </FragmentRow>
      ))}
    </div>
  );
}

function FragmentRow({ children }) {
  return children;
}

export default SimpleTable;
