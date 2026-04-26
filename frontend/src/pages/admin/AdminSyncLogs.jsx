import { useEffect, useState } from "react";
import { api } from "../../api/api";
import { styles } from "../../styles";
import PageHeader from "../../components/PageHeader";
import SimpleTable from "../../components/SimpleTable";

function AdminSyncLogs() {
  const [logs, setLogs] = useState([]);
  useEffect(() => { api("/api/admin/sync-logs").then(setLogs).catch(console.error); }, []);
  return (
    <div style={styles.pageStack}>
      <PageHeader variant="admin" kicker="Administration" title="Logs de synchronisation" subtitle="Historique admin des échanges et traitements." />
      <section style={styles.cardWide}>
        <SimpleTable columns={["system", "direction", "status", "message", "entity_type", "entity_id", "created_at"]} rows={logs} />
      </section>
    </div>
  );
}

export default AdminSyncLogs;
