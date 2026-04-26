import { useEffect, useState } from "react";
import { api } from "../../api/api";
import { styles } from "../../styles";
import ProfileSection, { ProfileInput } from "../../components/ProfileSection";

function ClientProfile() {
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
    <form style={styles.profilePage} onSubmit={save}>
      <section style={styles.profileHeaderCard}>
        <div>
          <div style={styles.overline}>Compte client</div>
          <h1 style={styles.profileTitle}>Mon profil</h1>
          <p style={styles.profileSubtitle}>
            Gérez les informations de votre société, vos coordonnées et vos
            adresses utilisées pour vos commandes de production.
          </p>
        </div>

        <div style={styles.profileIdentityCard}>
          <div style={styles.profileAvatar}>
            {(profile.company_name || profile.contact_name || "T").charAt(0)}
          </div>
          <div>
            <div style={styles.profileIdentityName}>
              {profile.company_name || "Société non renseignée"}
            </div>
            <div style={styles.profileIdentityMeta}>
              {profile.vat_number || "TVA non renseignée"}
            </div>
          </div>
        </div>
      </section>

      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.success}>{message}</div>}

      <ProfileSection
        title="Informations société"
        description="Identité administrative utilisée pour vos commandes."
      >
        <ProfileInput label="Société" value={profile.company_name} onChange={(value) => update("company_name", value)} />
        <ProfileInput label="N° TVA" value={profile.vat_number} onChange={(value) => update("vat_number", value)} />
        <ProfileInput label="Email société" value={profile.email} onChange={(value) => update("email", value)} />
        <ProfileInput label="Téléphone société" value={profile.phone} onChange={(value) => update("phone", value)} />
      </ProfileSection>

      <ProfileSection
        title="Adresse de facturation"
        description="Adresse reprise sur vos documents administratifs."
      >
        <ProfileInput label="Adresse" value={profile.billing_address} onChange={(value) => update("billing_address", value)} full />
        <ProfileInput label="Code postal" value={profile.billing_postal_code} onChange={(value) => update("billing_postal_code", value)} />
        <ProfileInput label="Ville" value={profile.billing_city} onChange={(value) => update("billing_city", value)} />
        <ProfileInput label="Pays" value={profile.billing_country} onChange={(value) => update("billing_country", value)} />
      </ProfileSection>

      <ProfileSection
        title="Adresse de livraison"
        description="Adresse utilisée pour l’expédition de vos productions."
      >
        <ProfileInput label="Adresse" value={profile.shipping_address} onChange={(value) => update("shipping_address", value)} full />
        <ProfileInput label="Code postal" value={profile.shipping_postal_code} onChange={(value) => update("shipping_postal_code", value)} />
        <ProfileInput label="Ville" value={profile.shipping_city} onChange={(value) => update("shipping_city", value)} />
        <ProfileInput label="Pays" value={profile.shipping_country} onChange={(value) => update("shipping_country", value)} />
      </ProfileSection>

      <ProfileSection
        title="Contact principal"
        description="Personne de référence pour le suivi des commandes."
      >
        <ProfileInput label="Nom" value={profile.contact_name} onChange={(value) => update("contact_name", value)} />
        <ProfileInput label="Email" value={profile.contact_email} onChange={(value) => update("contact_email", value)} />
        <ProfileInput label="Téléphone" value={profile.contact_phone} onChange={(value) => update("contact_phone", value)} />
      </ProfileSection>

      <div style={styles.profileActions}>
        <button style={styles.primaryButton}>Mettre à jour mes informations</button>
      </div>
    </form>
  );
}

export default ClientProfile;
