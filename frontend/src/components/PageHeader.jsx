import { styles } from "../styles";

function PageHeader({ title, subtitle, kicker, children, variant = "client" }) {
  return (
    <header style={styles.pageHeader}>
      <div style={styles.pageHeaderText}>
        {kicker && (
          <p
            style={{
              ...styles.pageHeaderKicker,
              ...(variant === "admin" ? styles.pageHeaderKickerAdmin : styles.pageHeaderKickerClient),
            }}
          >
            {kicker}
          </p>
        )}
        <h1 style={styles.pageHeaderTitle}>{title}</h1>
        {subtitle && <p style={styles.pageHeaderSubtitle}>{subtitle}</p>}
      </div>
      {children && <div style={styles.pageHeaderActions}>{children}</div>}
    </header>
  );
}

export default PageHeader;
