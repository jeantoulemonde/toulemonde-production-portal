import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { api } from "../../api/api";
import PageHeader from "../../components/PageHeader";
import PageContainer from "../../components/PageContainer";
import { T } from "../../theme";
import { useIsMobile } from "../../utils/useIsMobile";

function ClientProfile() {
  const isMobile = useIsMobile(980);
  const [profile, setProfile] = useState({
    company_name: "",
    vat_number: "",
    email: "",
    phone: "",
    billing_address: "",
    billing_postal_code: "",
    billing_city: "",
    billing_country: "",
    shipping_address: "",
    shipping_postal_code: "",
    shipping_city: "",
    shipping_country: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/client/profile")
      .then((data) => setProfile((prev) => ({ ...prev, ...data })))
      .catch((err) => setError(err.message));
  }, []);

  function update(field, value) {
    setProfile((prev) => ({ ...prev, [field]: value }));
  }

  async function save(event) {
    event.preventDefault();

    try {
      setError("");
      setMessage("");

      const data = await api("/api/client/profile", {
        method: "PUT",
        body: JSON.stringify(profile),
      });

      setProfile((prev) => ({ ...prev, ...data.profile }));
      setMessage("Vos informations ont bien été mises à jour.");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <PageContainer as="form" onSubmit={save}>
      <PageHeader
        kicker="Portail client"
        title="Mon profil"
        subtitle="Complétez vos informations afin de faciliter le traitement de vos commandes, documents et livraisons."
      />

      {error && <div style={profileStyles.error}>{error}</div>}
      {message && <div style={profileStyles.success}>{message}</div>}

      <div style={{ ...profileStyles.layout, ...(isMobile ? profileStyles.layoutMobile : {}) }}>
        <aside style={{ ...profileStyles.summary, ...(isMobile ? profileStyles.summaryMobile : {}) }}>
          <div style={profileStyles.avatar}>
            {(profile.company_name || profile.contact_name || "T").charAt(0)}
          </div>

          <div>
            <h2 style={profileStyles.summaryTitle}>
              {profile.company_name || "Société non renseignée"}
            </h2>
            <p style={profileStyles.summaryText}>
              {profile.vat_number || "TVA non renseignée"}
            </p>
          </div>

          <div style={profileStyles.summaryList}>
            <SummaryItem label="Contact" value={profile.contact_name} />
            <SummaryItem label="Email" value={profile.contact_email || profile.email} />
            <SummaryItem label="Téléphone" value={profile.contact_phone || profile.phone} />
            <SummaryItem label="Pays" value={profile.billing_country || profile.shipping_country} />
          </div>

          <div style={profileStyles.note}>
            Ces données seront visibles par Toulemonde Production pour assurer
            le suivi commercial et logistique.
          </div>
        </aside>

        <main style={profileStyles.content}>
          <Section title="Informations société" defaultOpen isMobile={isMobile}>
            <Field label="Société">
              <input
                style={profileStyles.input}
                value={profile.company_name || ""}
                onChange={(e) => update("company_name", e.target.value)}
              />
            </Field>

            <Field label="N° TVA">
              <input
                style={profileStyles.input}
                value={profile.vat_number || ""}
                onChange={(e) => update("vat_number", e.target.value)}
              />
            </Field>

            <Field label="Email société">
              <input
                style={profileStyles.input}
                value={profile.email || ""}
                onChange={(e) => update("email", e.target.value)}
              />
            </Field>

            <Field label="Téléphone société">
              <input
                style={profileStyles.input}
                value={profile.phone || ""}
                onChange={(e) => update("phone", e.target.value)}
              />
            </Field>
          </Section>

          <Section title="Adresse de facturation" isMobile={isMobile}>
            <Field label="Adresse" full>
              <input
                style={profileStyles.input}
                value={profile.billing_address || ""}
                onChange={(e) => update("billing_address", e.target.value)}
              />
            </Field>

            <Field label="Code postal">
              <input
                style={profileStyles.input}
                value={profile.billing_postal_code || ""}
                onChange={(e) => update("billing_postal_code", e.target.value)}
              />
            </Field>

            <Field label="Ville">
              <input
                style={profileStyles.input}
                value={profile.billing_city || ""}
                onChange={(e) => update("billing_city", e.target.value)}
              />
            </Field>

            <Field label="Pays">
              <input
                style={profileStyles.input}
                value={profile.billing_country || ""}
                onChange={(e) => update("billing_country", e.target.value)}
              />
            </Field>
          </Section>

          <Section title="Adresse de livraison" isMobile={isMobile}>
            <Field label="Adresse" full>
              <input
                style={profileStyles.input}
                value={profile.shipping_address || ""}
                onChange={(e) => update("shipping_address", e.target.value)}
              />
            </Field>

            <Field label="Code postal">
              <input
                style={profileStyles.input}
                value={profile.shipping_postal_code || ""}
                onChange={(e) => update("shipping_postal_code", e.target.value)}
              />
            </Field>

            <Field label="Ville">
              <input
                style={profileStyles.input}
                value={profile.shipping_city || ""}
                onChange={(e) => update("shipping_city", e.target.value)}
              />
            </Field>

            <Field label="Pays">
              <input
                style={profileStyles.input}
                value={profile.shipping_country || ""}
                onChange={(e) => update("shipping_country", e.target.value)}
              />
            </Field>
          </Section>

          <Section title="Contact principal" isMobile={isMobile}>
            <Field label="Nom">
              <input
                style={profileStyles.input}
                value={profile.contact_name || ""}
                onChange={(e) => update("contact_name", e.target.value)}
              />
            </Field>

            <Field label="Email">
              <input
                style={profileStyles.input}
                value={profile.contact_email || ""}
                onChange={(e) => update("contact_email", e.target.value)}
              />
            </Field>

            <Field label="Téléphone">
              <input
                style={profileStyles.input}
                value={profile.contact_phone || ""}
                onChange={(e) => update("contact_phone", e.target.value)}
              />
            </Field>
          </Section>

          <div style={profileStyles.actions}>
            <button type="submit" style={profileStyles.button}>
              Enregistrer les modifications
            </button>
          </div>
        </main>
      </div>
    </PageContainer>
  );
}

function Section({ title, children, defaultOpen = false, isMobile = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section style={profileStyles.section}>
      <button
        type="button"
        style={{
          ...profileStyles.sectionHeaderButton,
          ...(open ? profileStyles.sectionHeaderButtonOpen : {}),
        }}
        onClick={() => setOpen((value) => !value)}
      >
        <h2 style={profileStyles.sectionTitle}>{title}</h2>

        <ChevronDown
          size={20}
          strokeWidth={2}
          style={{
            color: T.bleu,
            transition: "transform 0.22s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {open && <div style={{ ...profileStyles.grid, ...(isMobile ? profileStyles.gridMobile : {}) }}>{children}</div>}
    </section>
  );
}

function Field({ label, children, full = false }) {
  return (
    <label
      style={{
        ...profileStyles.field,
        ...(full ? profileStyles.fullField : {}),
      }}
    >
      <span style={profileStyles.label}>{label}</span>
      {children}
    </label>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div style={profileStyles.summaryItem}>
      <span style={profileStyles.summaryItemLabel}>{label}</span>
      <strong style={profileStyles.summaryItemValue}>
        {value || "Non renseigné"}
      </strong>
    </div>
  );
}

const profileStyles = {
  header: {
    background: "#fff",
    border: `1px solid ${T.border}`,
    borderRadius: 24,
    padding: "26px 30px",
    boxShadow: T.shadowSoft,
  },

  kicker: {
    margin: 0,
    fontSize: 11,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: T.textSoft,
    fontWeight: 800,
  },

  title: {
    margin: "8px 0",
    fontFamily: T.fontTitle,
    fontSize: 46,
    lineHeight: 1,
    color: T.noir,
    fontWeight: 800,
    letterSpacing: "-0.04em",
  },

  subtitle: {
    margin: 0,
    maxWidth: 720,
    color: T.textSoft,
    lineHeight: 1.55,
    fontSize: 15,
  },

  layout: {
    display: "grid",
    gridTemplateColumns: "300px minmax(0, 1fr)",
    gap: 24,
    alignItems: "start",
  },

  layoutMobile: {
    gridTemplateColumns: "1fr",
  },

  summary: {
    position: "sticky",
    top: 96,
    display: "grid",
    gap: 18,
    background: "#fff",
    border: `1px solid ${T.border}`,
    borderRadius: 18,
    padding: 22,
    boxShadow: T.shadowSoft,
  },

  summaryMobile: {
    position: "relative",
    top: "auto",
  },

  avatar: {
    width: 64,
    height: 64,
    borderRadius: 18,
    display: "grid",
    placeItems: "center",
    background: T.bleu,
    color: "#fff",
    fontSize: 28,
    fontWeight: 900,
    textTransform: "uppercase",
  },

  summaryTitle: {
    margin: 0,
    fontSize: 20,
    lineHeight: 1.2,
    color: T.noir,
  },

  summaryText: {
    margin: "5px 0 0",
    color: T.textSoft,
    fontSize: 13,
  },

  summaryList: {
    display: "grid",
    gap: 12,
    paddingTop: 4,
  },

  summaryItem: {
    display: "grid",
    gap: 4,
    paddingBottom: 12,
    borderBottom: `1px solid ${T.border}`,
  },

  summaryItemLabel: {
    fontSize: 11,
    color: T.textSoft,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 800,
  },

  summaryItemValue: {
    fontSize: 14,
    color: T.noir,
  },

  note: {
    padding: 14,
    borderRadius: 16,
    background: T.bleuPale,
    color: T.noir,
    fontSize: 13,
    lineHeight: 1.5,
    border: `1px solid ${T.bleuBorder}`,
  },

  content: {
    display: "grid",
    gap: 18,
  },

  section: {
    background: "#fff",
    border: `1px solid ${T.border}`,
    borderRadius: 18,
    boxShadow: T.shadowSoft,
    overflow: "hidden",
  },

  sectionHeaderButton: {
    width: "100%",
    padding: "18px 22px",
    border: "none",
    background: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
    textAlign: "left",
  },

  sectionHeaderButtonOpen: {
    borderBottom: `1px solid ${T.border}`,
    background: "linear-gradient(180deg, #ffffff 0%, #fbfbfb 100%)",
  },

  sectionTitle: {
    margin: 0,
    fontFamily: T.fontTitle,
    fontSize: 18,
    color: T.noir,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
    padding: 22,
  },

  gridMobile: {
    gridTemplateColumns: "1fr",
  },

  field: {
    display: "grid",
    gap: 7,
  },

  fullField: {
    gridColumn: "1 / -1",
  },

  label: {
    fontSize: 11,
    fontWeight: 800,
    color: T.textSoft,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    height: 48,
    padding: "0 14px",
    borderRadius: 12,
    border: `1px solid ${T.border}`,
    background: "#fff",
    color: T.noir,
    fontSize: 14,
    outline: "none",
  },

  actions: {
    display: "flex",
    justifyContent: "flex-end",
    paddingTop: 4,
  },

  button: {
    border: "none",
    background: T.bleu,
    color: "#fff",
    minHeight: 44,
    borderRadius: 12,
    padding: "0 18px",
    cursor: "pointer",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    boxShadow: "0 16px 28px rgba(0,0,254,0.18)",
  },

  error: {
    padding: 14,
    borderRadius: 12,
    color: T.danger,
    background: "rgba(159,29,29,0.08)",
    border: "1px solid rgba(159,29,29,0.18)",
  },

  success: {
    padding: 14,
    borderRadius: 12,
    color: T.green,
    background: "rgba(35,107,56,0.08)",
    border: "1px solid rgba(35,107,56,0.18)",
  },
};

export default ClientProfile;
