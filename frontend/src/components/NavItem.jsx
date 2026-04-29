import { NavLink } from "react-router";
import { T } from "../theme";
import { styles } from "../styles";

function NavItem({ to, label, icon: Icon, collapsed = false, end = false, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      style={({ isActive }) => ({
        ...styles.navItem,
        ...(collapsed ? styles.navItemCollapsed : {}),
        background: isActive ? T.bleuPale : "transparent",
        color: isActive ? T.bleu : T.noir,
        borderColor: isActive ? T.bleuBorder : T.border,
      })}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
    >
      {Icon && <Icon size={18} strokeWidth={1.8} />}
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}

export default NavItem;
