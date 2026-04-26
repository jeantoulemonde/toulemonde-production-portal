export const clientStatusLabels = {
  draft: "Brouillon",
  submitted: "Envoyée",
  pending_validation: "En validation",
  rejected: "Refusée",
  pending_sage_sync: "Acceptée",
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
  if (typeof value === "string" && clientStatusLabels[value]) return clientStatus(value);
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
    line_count: "Nombre de lignes",
    total_quantity_kg: "Quantité totale kg",
    line_number: "Ligne",
    client_reference: "Référence client",
    material: "Matière",
    application_type: "Application",
    material_family: "Famille matière",
    material_quality: "Qualité matière",
    count_system: "Système de titrage",
    yarn_count: "Titre Nm",
    dtex: "dtex",
    custom_count: "Titrage spécifique",
    ply_number: "Nombre de plis",
    twist_type: "Type de retordage",
    twist_direction: "Sens de torsion",
    finish: "Finition",
    color_mode: "Mode couleur",
    color_name: "Nom couleur",
    color_reference: "Référence couleur",
    dyeing_required: "Teinture requise",
    dyeing_comment: "Commentaire teinture",
    quantity_kg: "Quantité kg",
    conditioning: "Conditionnement",
    packaging: "Conditionnement",
    meterage_per_unit: "Métrage/support",
    destination_usage: "Usage",
    tolerance_percent: "Tolérance",
    partial_delivery_allowed: "Livraison partielle",
    production_comment: "Commentaire production",
    delivery_address_choice: "Choix adresse",
    delivery_address: "Adresse livraison",
    delivery_comment: "Commentaire livraison",
    technical_file_name: "Fichier technique",
    urgent: "Urgence",
    comment: "Commentaire",
    status: "Statut",
    sage_order_number: "N° Sage",
    invoice_number: "N° facture",
    invoice_date: "Date facture",
    invoice_total_ht: "Total HT",
    invoice_total_ttc: "Total TTC",
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
    document_type: "Type document",
    filename: "Fichier",
    sage_reference: "Référence Sage",
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
