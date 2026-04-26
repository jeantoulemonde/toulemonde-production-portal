import { useEffect, useState } from "react";
import { api } from "../../api/api";
import { styles } from "../../styles";
import PageHeader from "../../components/PageHeader";
import Field from "../../components/Field";
import Select from "../../components/Select";
import SimpleTable from "../../components/SimpleTable";

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ full_name: "", email: "", role: "client", client_id: "", password: "" });
  const [message, setMessage] = useState("");
  async function load() {
    setUsers(await api("/api/admin/users"));
    setClients(await api("/api/admin/clients"));
  }
  useEffect(() => { load().catch(console.error); }, []);

  async function createUser(event) {
    event.preventDefault();
    const result = await api("/api/admin/users", { method: "POST", body: JSON.stringify(form) });
    setMessage(`Utilisateur créé. Invitation : ${result.invitationLink}`);
    setForm({ full_name: "", email: "", role: "client", client_id: "", password: "" });
    await load();
  }

  async function resetUser(user) {
    const result = await api(`/api/admin/users/${user.id}/reset-password`, { method: "POST" });
    setMessage(`Lien de réinitialisation : ${result.resetLink}`);
  }

  return (
    <div style={styles.pageStack}>
      <PageHeader variant="admin" kicker="Administration" title="Utilisateurs" subtitle="Comptes client et rôles internes." />
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
      <section style={styles.cardWide}>
        <SimpleTable columns={["full_name", "email", "role", "client_name", "status", "last_login_at", "created_at"]} rows={users.map((user) => ({ ...user, status: user.is_active ? "Actif" : "Inactif" }))} actions={(user) => <button style={styles.linkButton} onClick={() => resetUser(user)}>Reset</button>} />
      </section>
    </div>
  );
}

export default AdminUsers;
