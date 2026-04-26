import { styles } from "../styles";

function Field({ label, children, error }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
      {error && <span style={styles.inlineError}>{error}</span>}
    </label>
  );
}

export default Field;
