import { Fragment, isValidElement } from "react";
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
      {rows.map((row, rowIndex) => {
        const rowKey = row._key || row.id || rowIndex;
        return (
          <Fragment key={rowKey}>
            {columns.map((column) => {
              const value = row[column];
              return (
                <div key={`${rowKey}-${column}`} style={styles.cell}>
                  {isValidElement(value) ? value : formatCell(value)}
                </div>
              );
            })}
            {actions && <div key={`${rowKey}-actions`} style={styles.cell}>{actions(row)}</div>}
          </Fragment>
        );
      })}
    </div>
  );
}

export default SimpleTable;
