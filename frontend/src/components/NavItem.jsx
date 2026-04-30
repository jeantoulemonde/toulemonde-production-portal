import { useState } from "react";
import { NavLink } from "react-router";
import { T } from "../theme";
import { styles } from "../styles";

// Couleurs des sections "Fil industriel" / "Mercerie" — appliquées
// uniquement quand la prop `accent` est fournie (rétro-compat : sans
// accent, le NavItem reste sur le bleu portail comme avant).
const ACCENTS = {
  industriel: { bg: T.industrielLight, text: T.industriel, border: T.industrielBorder, bar: T.industriel },
  mercerie:   { bg: T.mercerieLight,   text: T.mercerie,   border: T.mercerieBorder,   bar: T.mercerie },
};

function NavItem({ to, label, icon: Icon, collapsed = false, end = false, onNavigate, accent }) {
  const [hovered, setHovered] = useState(false);
  const acc = accent ? ACCENTS[accent] : null;
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={({ isActive }) => {
        const accented = acc && (isActive || hovered);
        return {
          ...styles.navItem,
          ...(collapsed ? styles.navItemCollapsed : {}),
          background: isActive
            ? (acc ? acc.bg : T.bleuPale)
            : (hovered && acc ? acc.bg : "transparent"),
          color: isActive
            ? (acc ? acc.text : T.bleu)
            : (hovered && acc ? acc.text : T.noir),
          borderColor: isActive
            ? (acc ? acc.border : T.bleuBorder)
            : T.border,
          // boxShadow inset au lieu de borderLeft pour éviter le conflit
          // shorthand `border` (défini dans styles.navItem) + longhand `borderLeft`.
          ...(accented ? { boxShadow: `inset 2px 0 0 ${acc.bar}` } : {}),
        };
      }}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
    >
      {Icon && <Icon size={18} strokeWidth={1.8} />}
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}

export default NavItem;
