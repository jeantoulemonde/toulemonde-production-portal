import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3010";

function StatusItem({ label, status }) {
  const connected = status === "connected";
  const color = connected ? "#16a34a" : "#dc2626";
  const text = connected ? "OK" : "ERROR";

  return (
    <div style={styles.item} title={`${label}: ${connected ? "connected" : "disconnected"}`}>
      <span style={{ ...styles.dot, background: color }} />
      <span>{label}: {text}</span>
    </div>
  );
}

function HealthStatusBadge({ showSage = false }) {
  const [dbStatus, setDbStatus] = useState("disconnected");
  const [sageStatus, setSageStatus] = useState("disconnected");

  useEffect(() => {
    let active = true;

    async function checkHealth() {
      try {
        const response = await fetch(`${API_URL}/api/health/db`);
        const data = await response.json();
        if (active) setDbStatus(data.database === "connected" ? "connected" : "disconnected");
      } catch {
        if (active) setDbStatus("disconnected");
      }

      if (!showSage) return;

      try {
        const response = await fetch(`${API_URL}/api/health/sage`);
        const data = await response.json();
        if (active) setSageStatus(data.database === "connected" ? "connected" : "disconnected");
      } catch {
        if (active) setSageStatus("disconnected");
      }
    }

    checkHealth();
    return () => {
      active = false;
    };
  }, [showSage]);

  return (
    <div style={styles.wrap} aria-label="Statut des connexions">
      <StatusItem label="DB" status={dbStatus} />
      {showSage && <StatusItem label="SAGE" status={sageStatus} />}
    </div>
  );
}

const styles = {
  wrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    minHeight: 28,
    padding: "0 10px",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 999,
    color: "#fff",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    background: "rgba(255,255,255,0.06)",
    whiteSpace: "nowrap",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flex: "0 0 auto",
  },
};

export default HealthStatusBadge;
