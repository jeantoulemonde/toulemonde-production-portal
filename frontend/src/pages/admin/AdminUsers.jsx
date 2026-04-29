import { useEffect, useState } from "react";
import { api } from "../../api/api";
import { styles } from "../../styles";
import { T } from "../../theme";
import { getSession } from "../../auth/session";
import PageHeader from "../../components/PageHeader";
import Field from "../../components/Field";
import Select from "../../components/Select";
import SimpleTable from "../../components/SimpleTable";
import LoadingState from "../../components/LoadingState";

const EMPTY_FORM = { full_name: "", email: "", role: "client", client_id: "", password: "" };

function AdminUsers() {
  const currentUserId = getSession("admin").user?.id;
  const [users, setUsers] = useState(null);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deleteModal, setDeleteModal] = useState(null);
  // null | { id, fullName, email }

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
      setMessage(
        result.invitationLink
          ? `Utilisateur créé. Lien d'invitation (dev) : ${result.invitationLink}`
          : `Utilisateur créé. Invitation envoyée à ${result.invitedEmail || form.email}.`
      );
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
      setMessage(
        result.resetLink
          ? `Lien de réinitialisation (dev) : ${result.resetLink}`
          : `Email de réinitialisation envoyé à ${result.sentTo || user.email}.`
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete() {
    if (!deleteModal) return;
    const targetId = deleteModal.id;
    try {
      setError("");
      setMessage("");
      await api(`/api/admin/users/${targetId}`, { method: "DELETE" });
      setUsers((prev) => (prev || []).filter((u) => u.id !== targetId));
      setMessage("Utilisateur supprimé.");
      setDeleteModal(null);
    } catch (err) {
      setError(err.message || "Impossible de supprimer cet utilisateur.");
      setDeleteModal(null);
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
          <SimpleTable
            columns={["full_name", "email", "role", "client_name", "status", "last_login_at", "created_at"]}
            rows={users.map((user) => ({ ...user, status: user.is_active ? "Actif" : "Inactif" }))}
            actions={(user) => (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button style={styles.linkButton} onClick={() => resetUser(user)}>Reset</button>
                {user.id !== currentUserId && (
                  <button
                    type="button"
                    style={local.deleteButton}
                    onClick={() => setDeleteModal({ id: user.id, fullName: user.full_name, email: user.email })}
                  >
                    Supprimer
                  </button>
                )}
              </div>
            )}
          />
        </section>
      )}

      {deleteModal && (
        <div
          style={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-user-title"
          onClick={() => setDeleteModal(null)}
        >
          <div style={{ ...styles.modal, width: "min(420px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <h2 id="delete-user-title" style={styles.cardTitle}>Supprimer cet utilisateur ?</h2>
            <p style={styles.muted}>
              Vous êtes sur le point de supprimer le compte de{" "}
              <strong style={{ color: T.noir }}>{deleteModal.fullName || deleteModal.email}</strong>
              {deleteModal.fullName ? ` (${deleteModal.email})` : ""}.
              <br />
              Cette action est irréversible.
            </p>
            <div style={styles.formActions}>
              <button type="button" style={styles.ghostButton} onClick={() => setDeleteModal(null)}>
                Annuler
              </button>
              <button type="button" style={local.deleteButtonSolid} onClick={handleDelete}>
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const local = {
  // Bouton "Supprimer" inline dans le tableau (style ghost teinté danger)
  deleteButton: {
    minHeight: 28,
    border: `1px solid ${T.danger}`,
    background: "transparent",
    color: T.danger,
    borderRadius: 12,
    padding: "0 12px",
    cursor: "pointer",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontSize: 12,
  },
  // Bouton "Supprimer définitivement" dans la modale (fond plein danger)
  deleteButtonSolid: {
    minHeight: 44,
    border: "none",
    background: T.danger,
    color: "#fff",
    borderRadius: 12,
    padding: "0 16px",
    cursor: "pointer",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontSize: 13,
  },
};

export default AdminUsers;
