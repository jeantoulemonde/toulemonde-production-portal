import { styles } from "../styles";

function Placeholder({ title }) {
  return (
    <section style={styles.cardWide}>
      <h2 style={styles.cardTitle}>{title}</h2>
      <p style={styles.muted}>Module prêt à raccorder aux données métier.</p>
    </section>
  );
}

export default Placeholder;
