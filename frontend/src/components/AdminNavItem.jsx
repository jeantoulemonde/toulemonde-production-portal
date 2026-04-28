import { NavLink } from "react-router";
import { styles } from "../styles";

function AdminNavItem({ to, label, icon: Icon, end = false, badge = 0 }) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        ...styles.adminNavItem,
        ...(isActive ? styles.adminNavItemActive : {}),
      })}
    >
      <Icon size={18} strokeWidth={1.8} />
      <span>{label}</span>
      {badge > 0 && <span style={styles.adminNavBadge}>{badge}</span>}
    </NavLink>
  );
}

export default AdminNavItem;
