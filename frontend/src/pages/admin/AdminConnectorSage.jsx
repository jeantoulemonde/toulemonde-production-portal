import { useEffect, useState } from "react";
import { api } from "../../api/api";
import { styles } from "../../styles";
import { formatDateTime } from "../../utils/formatters";
import PageHeader from "../../components/PageHeader";
import AdminInput from "../../components/AdminInput";
import Field from "../../components/Field";
import Metric from "../../components/Metric";

function AdminConnectorSage() {
  const defaultConfig = {
    type: "postgres",
    host: "localhost",
    port: 5432,
    database: "sage_simu",
    user: "",
    password: "",
    ssl: false,
    inbound: { enabled: true, sourceQuery: "", afterImportUpdateQuery: "", intervalSeconds: 60 },
    outbound: { enabled: false, createCustomerEnabled: true, createOrderEnabled: true, updateOrderStatusEnabled: true, intervalSeconds: 60 },
  };
  const [enabled, setEnabled] = useState(false);
  const [config, setConfig] = useState(defaultConfig);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await api("/api/admin/connector-sage");
      setEnabled(data.enabled);
      setStatus(data);
      setConfig({ ...defaultConfig, ...(data.config || {}), inbound: { ...defaultConfig.inbound, ...(data.config?.inbound || {}) }, outbound: { ...defaultConfig.outbound, ...(data.config?.outbound || {}) } });
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => { load(); }, []);
  function update(field, value) { setConfig((prev) => ({ ...prev, [field]: value })); }
  function updateNested(group, field, value) { setConfig((prev) => ({ ...prev, [group]: { ...prev[group], [field]: value } })); }
  async function save() {
    try {
      setError("");
      setMessage("");
      await api("/api/admin/connector-sage", { method: "PUT", body: JSON.stringify({ enabled, config }) });
      setMessage("Configuration enregistrée.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function test() {
    try {
      setError("");
      setMessage("");
      await api("/api/admin/connector-sage", { method: "PUT", body: JSON.stringify({ enabled, config }) });
      const result = await api("/api/admin/connector-sage/test", { method: "POST" });
      setMessage(result.connected ? result.message : `Connexion SageSimu échouée : ${result.message}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function runSync(path) {
    try {
      setError("");
      setMessage("");
      const result = await api(path, { method: "POST" });
      setMessage(`Synchronisation déclenchée. ${result.processed || 0} traitée(s), ${result.failed || 0} échec(s).`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <div style={styles.pageStack}>
      <PageHeader variant="admin" kicker="Administration" title="Connecteur Sage" subtitle="Configuration admin des échanges entre le portail et Sage." />
      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.success}>{message}</div>}
      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Statut</h2>
        <div style={styles.grid}>
          <Metric title="Statut" value={status?.status || "—"} />
          <Metric title="Dernier test" value={formatDateTime(status?.last_check_at)} />
          <Metric title="Entrant" value={formatDateTime(status?.last_inbound_sync_at)} />
          <Metric title="Sortant" value={formatDateTime(status?.last_outbound_sync_at)} />
          <Metric
            title="Agent leon"
            value={
              status?.agent?.status === "online"
                ? `🟢 online (${formatDateTime(status?.agent?.last_seen_at)})`
                : status?.agent?.last_seen_at
                  ? `🔴 offline (vu ${formatDateTime(status?.agent?.last_seen_at)})`
                  : "🔴 jamais connecté"
            }
          />
        </div>
        {status?.last_error && <div style={{ ...styles.error, marginTop: 14 }}>{status.last_error}</div>}
      </section>
      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Connexion Sage</h2>
        <div style={styles.formGrid}>
          <label style={styles.checkLine}><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Connecteur actif</label>
          <AdminInput field="type" value={config.type} onChange={(value) => update("type", value)} />
          <AdminInput field="host" value={config.host} onChange={(value) => update("host", value)} />
          <AdminInput field="port" value={config.port} onChange={(value) => update("port", value)} />
          <AdminInput field="database" value={config.database} onChange={(value) => update("database", value)} />
          <Field label="Utilisateur PostgreSQL">
            <input style={styles.input} value={config.user || ""} onChange={(event) => update("user", event.target.value)} placeholder="Laisser vide pour l'utilisateur local PostgreSQL" />
            <div style={styles.helpText}>Ce champ n'est pas votre compte admin du portail. Pour PostgreSQL local, laissez vide ou utilisez un rôle existant, par exemple votre utilisateur macOS.</div>
          </Field>
          <Field label="Mot de passe PostgreSQL">
            <input style={styles.input} type="password" value={config.password || ""} onChange={(event) => update("password", event.target.value)} placeholder={config.password === "********" ? "Mot de passe déjà configuré" : ""} />
          </Field>
          <label style={styles.checkLine}><input type="checkbox" checked={config.ssl} onChange={(e) => update("ssl", e.target.checked)} /> SSL</label>
        </div>
      </section>
      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Synchronisation entrante</h2>
        <div style={styles.formGrid}>
          <label style={styles.checkLine}><input type="checkbox" checked={config.inbound.enabled} onChange={(e) => updateNested("inbound", "enabled", e.target.checked)} /> Import activé</label>
          <AdminInput field="intervalSeconds" value={config.inbound.intervalSeconds} onChange={(value) => updateNested("inbound", "intervalSeconds", Number(value))} />
          <Field label="Requête source"><textarea style={styles.textarea} value={config.inbound.sourceQuery} onChange={(e) => updateNested("inbound", "sourceQuery", e.target.value)} /></Field>
          <Field label="Requête après import"><textarea style={styles.textarea} value={config.inbound.afterImportUpdateQuery} onChange={(e) => updateNested("inbound", "afterImportUpdateQuery", e.target.value)} /></Field>
        </div>
      </section>
      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Synchronisation sortante</h2>
        <div style={styles.formGrid}>
          <label style={styles.checkLine}><input type="checkbox" checked={config.outbound.enabled} onChange={(e) => updateNested("outbound", "enabled", e.target.checked)} /> Export activé</label>
          <AdminInput field="intervalSeconds" value={config.outbound.intervalSeconds} onChange={(value) => updateNested("outbound", "intervalSeconds", Number(value))} />
          <label style={styles.checkLine}><input type="checkbox" checked={config.outbound.createCustomerEnabled} onChange={(e) => updateNested("outbound", "createCustomerEnabled", e.target.checked)} /> Création client</label>
          <label style={styles.checkLine}><input type="checkbox" checked={config.outbound.createOrderEnabled} onChange={(e) => updateNested("outbound", "createOrderEnabled", e.target.checked)} /> Création commande</label>
          <label style={styles.checkLine}><input type="checkbox" checked={config.outbound.updateOrderStatusEnabled} onChange={(e) => updateNested("outbound", "updateOrderStatusEnabled", e.target.checked)} /> Mise à jour statut</label>
        </div>
      </section>
      <div style={styles.formActions}>
        <button style={styles.primaryButton} type="button" onClick={save}>Sauvegarder</button>
        <button style={styles.ghostButton} type="button" onClick={test}>Tester connexion</button>
        <button style={styles.ghostButton} type="button" onClick={() => runSync("/api/admin/connector-sage/sync-inbound")}>Synchronisation entrante maintenant</button>
        <button style={styles.ghostButton} type="button" onClick={() => runSync("/api/admin/connector-sage/sync-outbound")}>Synchronisation sortante maintenant</button>
      </div>
    </div>
  );
}

export default AdminConnectorSage;
