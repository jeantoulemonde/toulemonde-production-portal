import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../../api/api";
import { styles } from "../../styles";
import { adminFieldLabel } from "../../utils/formatters";
import AdminPageHeader from "../../components/AdminPageHeader";
import Field from "../../components/Field";
import SimpleTable from "../../components/SimpleTable";

function AdminClients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ company_name: "", vat_number: "", email: "", phone: "", billing_city: "", billing_country: "", contact_name: "", contact_email: "", contact_phone: "", sage_customer_code: "", create_user: true, user_name: "", user_email: "", user_password: "" });
  const [message, setMessage] = useState("");
  useEffect(() => { api("/api/admin/clients").then(setClients).catch(console.error); }, []);

  async function createClient(event) {
    event.preventDefault();
    const data = await api("/api/admin/clients", {
      method: "POST",
      body: JSON.stringify({
        client: {
          company_name: form.company_name,
          vat_number: form.vat_number,
          email: form.email,
          phone: form.phone,
          billing_city: form.billing_city,
          billing_country: form.billing_country,
          contact_name: form.contact_name,
          contact_email: form.contact_email || form.email,
          contact_phone: form.contact_phone,
          sage_customer_code: form.sage_customer_code,
        },
        user: {
          create_user: form.create_user,
          name: form.user_name || form.contact_name,
          email: form.user_email || form.contact_email || form.email,
          password: form.user_password,
        },
      }),
    });
    setMessage(data.invitationLink ? `Client créé. Invitation : ${data.invitationLink}` : "Client créé.");
    setFormOpen(false);
    setForm({ company_name: "", vat_number: "", email: "", phone: "", billing_city: "", billing_country: "", contact_name: "", contact_email: "", contact_phone: "", sage_customer_code: "", create_user: true, user_name: "", user_email: "", user_password: "" });
    setClients(await api("/api/admin/clients"));
  }

  return (
    <div style={styles.pageStack}>
      <AdminPageHeader title="Clients" subtitle="Gestion des comptes clients et informations société.">
        <button style={styles.primaryButton} onClick={() => setFormOpen((open) => !open)}>Nouveau client</button>
      </AdminPageHeader>
      {message && <div style={styles.success}>{message}</div>}
      {formOpen && (
        <form style={styles.cardWide} onSubmit={createClient}>
          <h2 style={styles.cardTitle}>Nouveau client</h2>
          <div style={styles.formGrid}>
            {["company_name", "vat_number", "email", "phone", "billing_city", "billing_country", "contact_name", "contact_email", "contact_phone", "sage_customer_code"].map((field) => (
              <Field key={field} label={adminFieldLabel(field)}>
                <input style={styles.input} value={form[field] || ""} onChange={(e) => setForm({ ...form, [field]: e.target.value })} />
              </Field>
            ))}
          </div>
          <h2 style={styles.cardTitle}>Utilisateur client</h2>
          <div style={styles.formGrid}>
            <label style={styles.checkLine}><input type="checkbox" checked={form.create_user} onChange={(e) => setForm({ ...form, create_user: e.target.checked })} /> Créer un utilisateur lié</label>
            <Field label="Nom utilisateur"><input style={styles.input} value={form.user_name} onChange={(e) => setForm({ ...form, user_name: e.target.value })} /></Field>
            <Field label="Email utilisateur"><input style={styles.input} value={form.user_email} onChange={(e) => setForm({ ...form, user_email: e.target.value })} /></Field>
            <Field label="Mot de passe initial"><input style={styles.input} type="password" value={form.user_password} onChange={(e) => setForm({ ...form, user_password: e.target.value })} /></Field>
          </div>
          <button style={styles.primaryButton}>Créer client</button>
        </form>
      )}
      <section style={styles.cardWide}>
        <SimpleTable
          columns={["company_name", "vat_number", "contact_email", "phone", "billing_city", "billing_country", "user_display", "status", "created_at"]}
          rows={clients.map((client) => ({ ...client, user_display: client.user_name || client.user_email || "Aucun utilisateur créé", status: client.is_active ? "Actif" : "Inactif" }))}
          actions={(client) => <button style={styles.linkButton} onClick={() => navigate(`/admin/clients/${client.id}`)}>Voir détail</button>}
        />
      </section>
    </div>
  );
}

export default AdminClients;
