import React, { useEffect, useState } from "react";

export default function ProfilePage() {
  const [form, setForm] = useState({
    email: "client@example.com",
    company_name: "",
    vat_number: "",
    contact_name: "",
    phone: "",
    billing_address: "",
    delivery_address: "",
    city: "",
    postal_code: "",
    country: "Belgique",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`/api/profile?email=${encodeURIComponent(form.email)}`);

        if (!response.ok) {
          throw new Error("Impossible de charger le profil");
        }

        const data = await response.json();

        if (data) {
          setForm((prev) => ({
            ...prev,
            ...data,
          }));
        }
      } catch (err) {
        console.error(err);
        setError("Impossible de charger le profil.");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  function updateField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur sauvegarde profil");
      }

      setSuccessMessage("Profil enregistré avec succès.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Erreur sauvegarde profil.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={styles.card}>Chargement du profil...</div>;
  }

  return (
    <div style={styles.card}>
      <p style={styles.eyebrow}>Coordonnées</p>
      <h2 style={styles.title}>Mon profil</h2>
      <p style={styles.text}>
        Renseignez vos informations de contact et de livraison.
      </p>

      {error ? <div style={styles.error}>{error}</div> : null}
      {successMessage ? <div style={styles.success}>{successMessage}</div> : null}

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.grid}>
          <Field
            label="Email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
          />
          <Field
            label="Nom du contact"
            value={form.contact_name}
            onChange={(e) => updateField("contact_name", e.target.value)}
          />
          <Field
            label="Société"
            value={form.company_name}
            onChange={(e) => updateField("company_name", e.target.value)}
          />
          <Field
            label="TVA"
            value={form.vat_number}
            onChange={(e) => updateField("vat_number", e.target.value)}
          />
          <Field
            label="Téléphone"
            value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
          />
          <Field
            label="Ville"
            value={form.city}
            onChange={(e) => updateField("city", e.target.value)}
          />
          <Field
            label="Code postal"
            value={form.postal_code}
            onChange={(e) => updateField("postal_code", e.target.value)}
          />
          <Field
            label="Pays"
            value={form.country}
            onChange={(e) => updateField("country", e.target.value)}
          />
        </div>

        <Field
          label="Adresse de facturation"
          value={form.billing_address}
          onChange={(e) => updateField("billing_address", e.target.value)}
        />

        <Field
          label="Adresse de livraison"
          value={form.delivery_address}
          onChange={(e) => updateField("delivery_address", e.target.value)}
        />

        <button type="submit" style={styles.button} disabled={saving}>
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <input style={styles.input} value={value ?? ""} onChange={onChange} />
    </div>
  );
}

const styles = {
  card: {
    background: "#fffaf2",
    border: "1px solid rgba(60, 40, 20, 0.08)",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 12px 30px rgba(40, 30, 20, 0.06)",
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    letterSpacing: "0.24em",
    textTransform: "uppercase",
    opacity: 0.65,
  },
  title: {
    margin: "8px 0 8px",
    fontSize: 34,
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    color: "rgb(0,0,254)",
  },
  text: {
    margin: 0,
    fontSize: 14,
    opacity: 0.8,
  },
  form: {
    display: "grid",
    gap: 14,
    marginTop: 20,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 11,
    opacity: 0.7,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(60, 40, 20, 0.16)",
    background: "white",
    fontSize: 14,
  },
  button: {
    border: "none",
    background: "rgb(0,0,254)",
    color: "#fff",
    borderRadius: 999,
    padding: "12px 18px",
    cursor: "pointer",
    fontWeight: 600,
    width: "fit-content",
    marginTop: 8,
  },
  error: {
    marginTop: 16,
    padding: 12,
    background: "rgba(180, 80, 80, 0.14)",
    color: "#9b3d3d",
    borderRadius: 12,
  },
  success: {
    marginTop: 16,
    padding: 12,
    background: "rgba(90, 140, 90, 0.14)",
    color: "#2f6b3c",
    borderRadius: 12,
  },
};