import { NavLink } from "react-router";
import { styles } from "../styles";

function AdminNavItem({ to, label, icon: Icon, end = false }) {
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
    </NavLink>
  );
}

export default AdminNavItem;
