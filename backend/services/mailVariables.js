// Catalogue des variables disponibles par template d'email.
// Utilisé pour :
//   - L'aide contextuelle dans l'éditeur admin (liste des {{vars}})
//   - Les données fictives utilisées par /preview et /test

const VARIABLE_DEFS = {
  invite_user: [
    { key: "fullName", description: "Nom complet du destinataire", sample: "Jean Dupont" },
    { key: "companyName", description: "Nom de la société", sample: "Maison Dupont SARL" },
    { key: "invitationLink", description: "Lien d'invitation (URL complète)", sample: "https://portail.toulemonde.fr/client/reset-password/abc123def456" },
    { key: "expiresIn", description: "Durée de validité du lien", sample: "30 minutes" },
    { key: "portalLink", description: "URL d'accueil du portail", sample: "https://portail.toulemonde.fr" },
  ],
  reset_password: [
    { key: "fullName", description: "Nom complet du destinataire", sample: "Jean Dupont" },
    { key: "resetLink", description: "Lien de réinitialisation (URL complète)", sample: "https://portail.toulemonde.fr/client/reset-password/abc123def456" },
    { key: "expiresIn", description: "Durée de validité du lien", sample: "30 minutes" },
    { key: "portalLink", description: "URL d'accueil du portail", sample: "https://portail.toulemonde.fr" },
  ],
  order_submitted: [
    { key: "fullName", description: "Nom complet du destinataire", sample: "Jean Dupont" },
    { key: "companyName", description: "Nom de la société", sample: "Maison Dupont SARL" },
    { key: "orderNumber", description: "Numéro de commande", sample: "TP-2026-0042" },
    { key: "orderLines", description: "Lignes de commande (HTML pré-rendu)", sample: "<ul><li>Polyester technique 80 - 25 kg</li></ul>", raw: true },
    { key: "submittedAt", description: "Date de soumission", sample: "29/04/2026" },
    { key: "portalLink", description: "URL pour suivre la commande", sample: "https://portail.toulemonde.fr/client/orders" },
  ],
  order_approved: [
    { key: "fullName", description: "Nom complet du destinataire", sample: "Jean Dupont" },
    { key: "companyName", description: "Nom de la société", sample: "Maison Dupont SARL" },
    { key: "orderNumber", description: "Numéro de commande", sample: "TP-2026-0042" },
    { key: "adminComment", description: "Commentaire du commercial (peut être vide)", sample: "Validée selon devis du 15/04." },
    { key: "portalLink", description: "URL de la commande", sample: "https://portail.toulemonde.fr/client/orders/42" },
  ],
  order_status_changed: [
    { key: "fullName", description: "Nom complet du destinataire", sample: "Jean Dupont" },
    { key: "companyName", description: "Nom de la société", sample: "Maison Dupont SARL" },
    { key: "orderNumber", description: "Numéro de commande", sample: "TP-2026-0042" },
    { key: "oldStatus", description: "Ancien statut (libellé)", sample: "En attente validation" },
    { key: "newStatus", description: "Nouveau statut (libellé)", sample: "En validation" },
    { key: "adminComment", description: "Motif ou commentaire admin (peut être vide)", sample: "Merci de préciser le titrage." },
    { key: "portalLink", description: "URL de la commande", sample: "https://portail.toulemonde.fr/client/orders/42" },
  ],
  document_ready: [
    { key: "fullName", description: "Nom complet du destinataire", sample: "Jean Dupont" },
    { key: "companyName", description: "Nom de la société", sample: "Maison Dupont SARL" },
    { key: "orderNumber", description: "Numéro de commande", sample: "TP-2026-0042" },
    { key: "documentType", description: "Type de document (libellé)", sample: "Bon de livraison" },
    { key: "downloadLink", description: "Lien de téléchargement direct", sample: "https://portail.toulemonde.fr/uploads/bl-tp-2026-0042.pdf" },
    { key: "portalLink", description: "URL de la commande", sample: "https://portail.toulemonde.fr/client/orders/42" },
  ],
};

function getVariables(templateKey) {
  return VARIABLE_DEFS[templateKey] || [];
}

function getSampleData(templateKey) {
  const defs = VARIABLE_DEFS[templateKey] || [];
  const out = {};
  for (const def of defs) out[def.key] = def.sample;
  return out;
}

function getAllTemplateKeys() {
  return Object.keys(VARIABLE_DEFS);
}

module.exports = {
  VARIABLE_DEFS,
  getVariables,
  getSampleData,
  getAllTemplateKeys,
};
