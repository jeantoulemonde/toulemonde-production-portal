import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { api } from "../../api/api";
import { styles } from "../../styles";
import { formatDateTime } from "../../utils/formatters";
import PageHeader from "../../components/PageHeader";
import AdminInput from "../../components/AdminInput";
import ClientOrdersTable from "../../components/ClientOrdersTable";
import ProfileSection from "../../components/ProfileSection";
import LoadingState from "../../components/LoadingState";

function AdminClientDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [client, setClient] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const next = await api(`/api/admin/clients/${id}`);
      setData(next);
      setClient(next.client);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function save(event) {
    event.preventDefault();
    try {
      setError("");
      setMessage("");
      await api(`/api/admin/clients/${id}`, { method: "PUT", body: JSON.stringify(client) });
      setMessage("Client enregistré.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveModules() {
    try {
      setError("");
      setMessage("");
      await api(`/api/admin/clients/${id}/modules`, {
        method: "PATCH",
        body: JSON.stringify({
          access_yarn: Boolean(client.access_yarn),
          access_mercerie: Boolean(client.access_mercerie),
        }),
      });
      setMessage("Modules mis à jour. Les utilisateurs verront le changement à leur prochaine connexion.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function resetPassword() {
    try {
      setError("");
      const user = linkedUser;
      if (!user) return setMessage("Aucun utilisateur client lié.");
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

  async function toggleLinkedUserStatus() {
    try {
      setError("");
      const user = linkedUser;
      if (!user) return setMessage("Aucun utilisateur client lié.");
      const nextActive = !(user.is_active === 1 || user.status === "active");

      await api(`/api/admin/users/${user.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: nextActive }),
      });

      setMessage(nextActive ? "Utilisateur réactivé." : "Utilisateur désactivé.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createLinkedUser() {
    try {
      setError("");
      const email = client.contact_email || client.email;
      if (!email) return setMessage("Ajoutez un email de contact avant de créer l'utilisateur.");
      const result = await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          full_name: client.contact_name || client.company_name,
          email,
          role: "client",
          client_id: client.id,
        }),
      });
      setMessage(
        result.invitationLink
          ? `Utilisateur créé. Lien d'invitation (dev) : ${result.invitationLink}`
          : `Utilisateur créé. Invitation envoyée à ${result.invitedEmail || email}.`
      );
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!data && error) return <div style={styles.error}>{error}</div>;
  if (!data) return <LoadingState message="Chargement du client..." />;

  const linkedUser = data.users?.[0] || (client.user_id ? {
    id: client.user_id,
    full_name: client.user_name,
    email: client.user_email,
    status: client.user_status,
    last_login_at: client.last_login_at,
    is_active: client.user_status === "active" ? 1 : 0,
  } : null);
  const linkedUserActive = linkedUser && (linkedUser.is_active === 1 || linkedUser.status === "active");

  return (
    <form style={styles.pageStack} onSubmit={save}>
      <PageHeader variant="admin" kicker="Administration" title={client.company_name || "Client"} subtitle="Détail client, coordonnées, informations Sage et commandes liées.">
        {linkedUser && <button type="button" style={styles.ghostButton} onClick={resetPassword}>Réinitialiser mot de passe</button>}
      </PageHeader>
      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.success}>{message}</div>}
      <ProfileSection title="Informations société">
        {["company_name", "vat_number", "contact_email", "phone"].map((field) => <AdminInput key={field} field={field} value={client[field]} onChange={(value) => setClient({ ...client, [field]: value })} />)}
      </ProfileSection>
      <ProfileSection title="Adresse facturation">
        {["billing_address", "billing_postal_code", "billing_city", "billing_country"].map((field) => <AdminInput key={field} field={field} value={client[field]} onChange={(value) => setClient({ ...client, [field]: value })} />)}
      </ProfileSection>
      <ProfileSection title="Adresse livraison">
        {["shipping_address", "shipping_postal_code", "shipping_city", "shipping_country"].map((field) => <AdminInput key={field} field={field} value={client[field]} onChange={(value) => setClient({ ...client, [field]: value })} />)}
      </ProfileSection>
      <ProfileSection title="Contact principal">
        {["contact_name", "contact_email", "contact_phone"].map((field) => <AdminInput key={field} field={field} value={client[field]} onChange={(value) => setClient({ ...client, [field]: value })} />)}
      </ProfileSection>
      <ProfileSection title="Informations ERP">
        {["sage_customer_code", "last_sync_status", "last_sync_at"].map((field) => <AdminInput key={field} field={field} value={client[field]} onChange={(value) => setClient({ ...client, [field]: value })} />)}
      </ProfileSection>
      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Modules accessibles</h2>
        <p style={styles.muted}>Définit ce que les utilisateurs de ce client voient dans le portail. Au moins un module obligatoire.</p>
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <label style={styles.checkLine}>
            <input
              type="checkbox"
              checked={Boolean(client.access_yarn)}
              onChange={(e) => setClient({ ...client, access_yarn: e.target.checked ? 1 : 0 })}
            />
            Demandes fil industriel
          </label>
          <label style={styles.checkLine}>
            <input
              type="checkbox"
              checked={Boolean(client.access_mercerie)}
              onChange={(e) => setClient({ ...client, access_mercerie: e.target.checked ? 1 : 0 })}
            />
            Catalogue & commandes mercerie
          </label>
        </div>
        <div style={{ marginTop: 12 }}>
          <button type="button" style={styles.primaryButton} onClick={saveModules}>Sauvegarder modules</button>
        </div>
      </section>
      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Utilisateur portail</h2>
        {linkedUser ? (
          <div style={styles.summaryGrid}>
            <div style={styles.summaryItem}><div style={styles.label}>Nom</div><div>{linkedUser.full_name || linkedUser.user_name || client.user_name || "—"}</div></div>
            <div style={styles.summaryItem}><div style={styles.label}>Email de connexion</div><div>{linkedUser.email || client.user_email || "—"}</div></div>
            <div style={styles.summaryItem}><div style={styles.label}>Statut utilisateur</div><div>{linkedUserActive ? "Actif" : "Désactivé"}</div></div>
            <div style={styles.summaryItem}><div style={styles.label}>Dernière connexion</div><div>{formatDateTime(linkedUser.last_login_at || client.last_login_at)}</div></div>
            <div style={{ ...styles.summaryItem, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button type="button" style={styles.ghostButton} onClick={resetPassword}>Reset password</button>
              <button type="button" style={styles.ghostButton} onClick={toggleLinkedUserStatus}>
                {linkedUserActive ? "Désactiver utilisateur" : "Réactiver utilisateur"}
              </button>
            </div>
          </div>
        ) : (
          <div style={styles.emptyState}>
            Aucun utilisateur créé
            <div style={{ marginTop: 12 }}>
              <button type="button" style={styles.primaryButton} onClick={createLinkedUser}>Créer utilisateur</button>
            </div>
          </div>
        )}
      </section>
      <button style={styles.primaryButton}>Enregistrer</button>
      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Commandes du client</h2>
        <ClientOrdersTable orders={data.orders || []} columns={["order", "reference", "material", "count", "quantity", "status", "date"]} empty="Aucune commande." />
      </section>
    </form>
  );
}

export default AdminClientDetail;
