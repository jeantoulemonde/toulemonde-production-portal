import { T } from "../theme";

// Bandeau de section utilisé sur le dashboard client, le menu de navigation
// et au-dessus des pages internes pour distinguer visuellement les deux
// modules métier ("Fil industriel" vs "Mercerie"). Mode `compact` pour le
// menu (sans la ligne dégradée et avec marges adaptées).
function SectionHeader({ type, compact = false }) {
  const isIndus = type === "industriel";
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      ...(compact ? { margin: "16px 4px 8px" } : { marginBottom: 16 }),
    }}>
      <div style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 12px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        background: isIndus ? T.industrielLight : T.mercerieLight,
        border: `0.5px solid ${isIndus ? T.industrielBorder : T.mercerieBorder}`,
        color: isIndus ? T.industrielText : T.mercerieText,
        flexShrink: 0,
        fontFamily: T.fontBody,
      }}>
        <span style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: isIndus ? T.industriel : T.mercerie,
          display: "inline-block",
        }} />
        {isIndus ? "Fil industriel" : "Mercerie"}
      </div>
      {!compact && (
        <div style={{
          flex: 1,
          height: 1,
          background: isIndus
            ? `linear-gradient(to right, ${T.industrielBorder}, transparent)`
            : `linear-gradient(to right, ${T.mercerieBorder}, transparent)`,
        }} />
      )}
    </div>
  );
}

export default SectionHeader;
