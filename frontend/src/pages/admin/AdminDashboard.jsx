import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../../api/api";
import { styles } from "../../styles";
import PageHeader from "../../components/PageHeader";
import Metric from "../../components/Metric";

function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  useEffect(() => { api("/api/admin/dashboard").then(setStats).catch(console.error); }, []);
  return (
    <div style={styles.pageStack}>
      <PageHeader variant="admin" kicker="Administration" title="Dashboard" subtitle="Pilotage du portail client Toulemonde Production." />
      {(stats?.pendingApproval || 0) > 0 && (
        <button type="button" style={local.notification} onClick={() => navigate("/admin/orders")}>
          <strong>
            {stats.pendingApproval === 1
              ? "1 nouvelle commande en attente"
              : `${stats.pendingApproval} commandes en attente`}
          </strong>
          <span>Ouvrir les commandes à valider</span>
        </button>
      )}
      <div style={styles.grid}>
        <Metric title="Clients" value={stats?.clients ?? "—"} />
        <Metric title="Utilisateurs" value={stats?.users ?? "—"} />
        <Metric title="Commandes" value={stats?.orders ?? "—"} />
        <Metric title="Actions en attente" value={stats?.pendingActions ?? "—"} />
      </div>
    </div>
  );
}

const local = {
  notification: {
    width: "100%",
    border: "1px solid rgba(0,0,254,0.24)",
    background: "rgba(0,0,254,0.06)",
    color: "#0a0a0a",
    borderRadius: 16,
    padding: "16px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    cursor: "pointer",
    textAlign: "left",
    fontWeight: 800,
  },
};

export default AdminDashboard;
