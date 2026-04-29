import { useEffect, useState } from "react";
import { api } from "../../api/api";
import { styles } from "../../styles";
import PageHeader from "../../components/PageHeader";
import Field from "../../components/Field";
import Select from "../../components/Select";
import SimpleTable from "../../components/SimpleTable";
import LoadingState from "../../components/LoadingState";

const EMPTY_FORM = { full_name: "", email: "", role: "client", client_id: "", password: "" };

function AdminUsers() {
  const [users, setUsers] = useState(null);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setUsers(await api("/api/admin/users"));
      setClients(await api("/api/admin/clients"));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function createUser(event) {
    event.preventDefault();
    try {
      setError("");
      setMessage("");
      const result = await api("/api/admin/users", { method: "POST", body: JSON.stringify(form) });
      setMessage(`Utilisateur créé. Invitation : ${result.invitationLink}`);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function resetUser(user) {
    try {
      setError("");
      const result = await api(`/api/admin/users/${user.id}/reset-password`, { method: "POST" });
      setMessage(`Lien de réinitialisation : ${result.resetLink}`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={styles.pageStack}>
      <PageHeader variant="admin" kicker="Administration" title="Utilisateurs" subtitle="Comptes client et rôles internes." />
      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.success}>{message}</div>}
      <form style={styles.cardWide} onSubmit={createUser}>
        <h2 style={styles.cardTitle}>Créer utilisateur</h2>
        <div style={styles.formGrid}>
          <Field label="Nom"><input style={styles.input} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Email"><input style={styles.input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Rôle"><Select value={form.role} onChange={(value) => setForm({ ...form, role: value })} options={["client", "admin_portal", "commercial", "production", "super_admin"]} /></Field>
          <Field label="Client"><Select value={form.client_id} onChange={(value) => setForm({ ...form, client_id: value })} options={["", ...clients.map((client) => String(client.id))]} /></Field>
          <Field label="Mot de passe initial"><input style={styles.input} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        </div>
        <button style={styles.primaryButton}>Créer utilisateur</button>
      </form>
      {users === null ? <LoadingState message="Chargement des utilisateurs..." /> : (
        <section style={styles.cardWide}>
          <SimpleTable columns={["full_name", "email", "role", "client_name", "status", "last_login_at", "created_at"]} rows={users.map((user) => ({ ...user, status: user.is_active ? "Actif" : "Inactif" }))} actions={(user) => <button style={styles.linkButton} onClick={() => resetUser(user)}>Reset</button>} />
        </section>
      )}
    </div>
  );
}

export default AdminUsers;
