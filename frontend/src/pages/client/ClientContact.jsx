import { Mail, Phone, MapPin, Clock, Globe } from "lucide-react";
import PageContainer from "../../components/PageContainer";
import PageHeader from "../../components/PageHeader";
import { styles } from "../../styles";
import { T } from "../../theme";

// Source : https://jtoulemonde.com/ (site officiel J. Toulemonde & Fils,
// maison mère du portail Toulemonde Production).
const CONTACT = {
  email: "contact@jtoulemonde.com",
  phone: "+33 (0)3 20 72 00 26",
  address: "J. Toulemonde & Fils — 7-23 Rue Pierre Brossolette, 59700 Marcq-en-Barœul, France",
  hours: "Lundi → Vendredi, 8h30 – 17h30",
  website: "https://jtoulemonde.com",
};

export default function ClientContact() {
  return (
    <PageContainer>
      <PageHeader
        kicker="Portail client"
        title="Contacter Toulemonde Production"
        subtitle="Pour toute question commerciale, technique ou logistique sur vos demandes."
      />

      <section style={{ ...styles.cardWide, display: "grid", gap: 14 }}>
        <h2 style={styles.cardTitle}>Service commercial</h2>
        <ContactRow icon={Mail} label="Email">
          <a href={`mailto:${CONTACT.email}`} style={{ color: T.bleu, fontWeight: 800 }}>
            {CONTACT.email}
          </a>
        </ContactRow>
        <ContactRow icon={Phone} label="Téléphone">
          <a href={`tel:${CONTACT.phone.replace(/\s/g, "")}`} style={{ color: T.bleu, fontWeight: 800 }}>
            {CONTACT.phone}
          </a>
        </ContactRow>
        <ContactRow icon={MapPin} label="Adresse">
          <span>{CONTACT.address}</span>
        </ContactRow>
        <ContactRow icon={Globe} label="Site web">
          <a href={CONTACT.website} target="_blank" rel="noopener noreferrer" style={{ color: T.bleu, fontWeight: 800 }}>
            jtoulemonde.com
          </a>
        </ContactRow>
        <ContactRow icon={Clock} label="Horaires">
          <span>{CONTACT.hours}</span>
        </ContactRow>
      </section>

      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Pour les demandes urgentes</h2>
        <p style={styles.muted}>
          Les commandes en cours peuvent être suivies directement depuis votre espace.
          Pour une demande urgente concernant une production, indiquez-le dans le
          champ « Urgence » lors de votre nouvelle demande, ou contactez votre
          interlocuteur commercial habituel.
        </p>
      </section>
    </PageContainer>
  );
}

function ContactRow({ icon: Icon, label, children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 110px 1fr", gap: 14, alignItems: "center" }}>
      <span style={{ color: T.bleu, display: "inline-flex" }}>
        <Icon size={18} strokeWidth={1.8} />
      </span>
      <span style={{ ...styles.label, color: T.textSoft }}>{label}</span>
      <span style={{ color: T.noir }}>{children}</span>
    </div>
  );
}
