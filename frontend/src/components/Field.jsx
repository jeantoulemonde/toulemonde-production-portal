import { styles } from "../styles";

function Field({ label, children, error }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {error ? (
        <div style={styles.fieldErrorRing}>{children}</div>
      ) : (
        children
      )}
      {error && <span style={styles.inlineError}>{error}</span>}
    </label>
  );
}

export default Field;
