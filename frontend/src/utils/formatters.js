export const clientStatusLabels = {
  draft: "Brouillon",
  submitted: "Envoyée",
  pending_validation: "En validation",
  pending_sage_sync: "Envoyée",
  sage_sync_failed: "En validation",
  sent_to_sage: "Acceptée",
  approved: "Acceptée",
  imported_to_leon: "En production",
  in_production: "En production",
  ready: "Prête",
  delivered: "Livrée",
  cancelled: "Annulée",
};

export function clientStatus(status) {
  return clientStatusLabels[status] || "En traitement";
}

export function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-BE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-BE", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function formatCell(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.includes("T")) return formatDateTime(value);
  return String(value);
}

export function adminFieldLabel(field) {
  const labels = {
    company_name: "Société",
    vat_number: "TVA",
    contact_email: "Email",
    email: "Email",
    phone: "Téléphone",
    billing_address: "Adresse facturation",
    billing_postal_code: "Code postal facturation",
    billing_city: "Ville facturation",
    billing_country: "Pays facturation",
    shipping_address: "Adresse livraison",
    shipping_postal_code: "Code postal livraison",
    shipping_city: "Ville livraison",
    shipping_country: "Pays livraison",
    contact_name: "Contact",
    contact_phone: "Téléphone contact",
    sage_customer_code: "Code client Sage",
    last_sync_status: "Dernier statut sync",
    last_sync_at: "Dernière sync",
    customer_code: "Code client",
    full_name: "Nom",
    client_name: "Client",
    client_code: "Code client",
    user_display: "Utilisateur portail",
    user_status: "Statut utilisateur",
    order_number: "N° commande",
    client_reference: "Référence client",
    material: "Matière",
    yarn_count: "Titre Nm",
    quantity_kg: "Quantité kg",
    status: "Statut",
    sage_order_number: "N° Sage",
    created_at: "Créé le",
    requested_delivery_date: "Livraison souhaitée",
    requested_date: "Date souhaitée",
    old_status: "Ancien statut",
    new_status: "Nouveau statut",
    source: "Source",
    message: "Message",
    system: "Système",
    direction: "Direction",
    entity_type: "Entité",
    entity_id: "ID entité",
    internal_comment: "Commentaire interne",
    intervalSeconds: "Fréquence (secondes)",
    host: "Hôte",
    port: "Port",
    database: "Base",
    user: "Utilisateur",
    password: "Mot de passe",
    type: "Type",
    role: "Rôle",
    last_login_at: "Dernière connexion",
  };
  return labels[field] || field;
}
