import { useEffect, useState } from "react";
import { api } from "../../api/api";
import { styles } from "../../styles";
import PageHeader from "../../components/PageHeader";
import Metric from "../../components/Metric";

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api("/api/admin/dashboard").then(setStats).catch(console.error); }, []);
  return (
    <div style={styles.pageStack}>
      <PageHeader variant="admin" kicker="Administration" title="Dashboard" subtitle="Pilotage du portail client Toulemonde Production." />
      <div style={styles.grid}>
        <Metric title="Clients" value={stats?.clients ?? "—"} />
        <Metric title="Utilisateurs" value={stats?.users ?? "—"} />
        <Metric title="Commandes" value={stats?.orders ?? "—"} />
        <Metric title="Actions en attente" value={stats?.pendingActions ?? "—"} />
      </div>
    </div>
  );
}

export default AdminDashboard;
