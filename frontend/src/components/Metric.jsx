import { styles } from "../styles";

function Metric({ title, value }) {
  return (
    <div style={styles.card}>
      <div style={styles.metricTitle}>{title}</div>
      <div style={styles.metricValue}>{value}</div>
    </div>
  );
}

export default Metric;
