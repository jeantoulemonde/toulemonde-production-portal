import { useEffect, useState } from "react";
import { api } from "../../api/api";
import { styles } from "../../styles";
import PageHeader from "../../components/PageHeader";
import SimpleTable from "../../components/SimpleTable";
import LoadingState from "../../components/LoadingState";

function AdminSyncLogs() {
  const [logs, setLogs] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/api/admin/sync-logs").then(setLogs).catch((err) => setError(err.message));
  }, []);
  return (
    <div style={styles.pageStack}>
      <PageHeader variant="admin" kicker="Administration" title="Logs de synchronisation" subtitle="Historique admin des échanges et traitements." />
      {error && <div style={styles.error}>{error}</div>}
      {logs === null ? <LoadingState message="Chargement des logs..." /> : (
        <section style={styles.cardWide}>
          <SimpleTable columns={["system", "direction", "status", "message", "entity_type", "entity_id", "created_at"]} rows={logs} />
        </section>
      )}
    </div>
  );
}

export default AdminSyncLogs;
