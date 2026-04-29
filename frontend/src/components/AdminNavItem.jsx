import { NavLink } from "react-router";
import { styles } from "../styles";

function AdminNavItem({ to, label, icon: Icon, end = false, badge = 0, collapsed = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      style={({ isActive }) => ({
        ...styles.adminNavItem,
        ...(isActive ? styles.adminNavItemActive : {}),
        ...(collapsed ? { justifyContent: "center", padding: "0 10px", position: "relative" } : {}),
      })}
    >
      <Icon size={18} strokeWidth={1.8} />
      {!collapsed && <span>{label}</span>}
      {badge > 0 && (
        collapsed
          ? (
            <span
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                minWidth: 16,
                height: 16,
                padding: "0 4px",
                borderRadius: 999,
                background: "rgb(0,0,254)",
                color: "#fff",
                fontSize: 9,
                fontWeight: 900,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
              }}
            >
              {badge > 99 ? "99+" : badge}
            </span>
          )
          : <span style={styles.adminNavBadge}>{badge}</span>
      )}
    </NavLink>
  );
}

export default AdminNavItem;
