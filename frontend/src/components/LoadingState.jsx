import { styles } from "../styles";

function LoadingState({ message = "Chargement..." }) {
  return (
    <div style={styles.cardWide} role="status" aria-live="polite">
      {message}
    </div>
  );
}

export default LoadingState;
