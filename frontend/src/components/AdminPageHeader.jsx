import { styles } from "../styles";

function AdminPageHeader({ title, subtitle, children }) {
  return (
    <div style={styles.adminPageHeader}>
      <div>
        <div style={styles.overline}>Administration</div>
        <h1 style={styles.pageTitle}>{title}</h1>
        {subtitle && <p style={styles.muted}>{subtitle}</p>}
      </div>
      {children && <div style={styles.headerActions}>{children}</div>}
    </div>
  );
}

export default AdminPageHeader;
