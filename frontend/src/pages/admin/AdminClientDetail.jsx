import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { api } from "../../api/api";
import { styles } from "../../styles";
import { formatDateTime } from "../../utils/formatters";
import AdminPageHeader from "../../components/AdminPageHeader";
import AdminInput from "../../components/AdminInput";
import ClientOrdersTable from "../../components/ClientOrdersTable";
import ProfileSection from "../../components/ProfileSection";

function AdminClientDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [client, setClient] = useState({});
  const [message, setMessage] = useState("");

  async function load() {
    const next = await api(`/api/admin/clients/${id}`);
    setData(next);
    setClient(next.client);
  }

  useEffect(() => { load().catch(console.error); }, [id]);

  async function save(event) {
    event.preventDefault();
    await api(`/api/admin/clients/${id}`, { method: "PUT", body: JSON.stringify(client) });
    setMessage("Client enregistré.");
    await load();
  }

  async function resetPassword() {
    const user = data?.users?.[0];
    if (!user) return setMessage("Aucun utilisateur client lié.");
    const result = await api(`/api/admin/users/${user.id}/reset-password`, { method: "POST" });
    setMessage(`Lien de réinitialisation : ${result.resetLink}`);
  }

  async function createLinkedUser() {
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
    setMessage(`Utilisateur créé. Invitation : ${result.invitationLink}`);
    await load();
  }

  if (!data) return <div style={styles.cardWide}>Chargement...</div>;

  return (
    <form style={styles.pageStack} onSubmit={save}>
      <AdminPageHeader title={client.company_name || "Client"} subtitle="Détail client, coordonnées, informations Sage et commandes liées.">
        <button type="button" style={styles.ghostButton} onClick={resetPassword}>Réinitialiser mot de passe</button>
      </AdminPageHeader>
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
        <h2 style={styles.cardTitle}>Utilisateur portail</h2>
        {client.user_id ? (
          <div style={styles.summaryGrid}>
            <div style={styles.summaryItem}><div style={styles.label}>Nom</div><div>{client.user_name || "—"}</div></div>
            <div style={styles.summaryItem}><div style={styles.label}>Email</div><div>{client.user_email || "—"}</div></div>
            <div style={styles.summaryItem}><div style={styles.label}>Statut</div><div>{client.user_status || "—"}</div></div>
            <div style={styles.summaryItem}><div style={styles.label}>Dernière connexion</div><div>{formatDateTime(client.last_login_at)}</div></div>
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
