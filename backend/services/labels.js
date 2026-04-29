// Traductions code technique -> libellé humain pour les messages de log.
// Centralisé ici pour cohérence avec l'UI admin et faciliter les évolutions.

function roleLabel(role) {
  const map = {
    client: "client",
    commercial: "commercial",
    admin_portal: "administrateur",
    production: "production",
    super_admin: "super administrateur",
  };
  return map[role] || role || "utilisateur";
}

function statusLabel(status) {
  const map = {
    draft: "Brouillon",
    submitted: "Soumise",
    pending_approval: "En attente d'approbation",
    pending_validation: "En attente de validation client",
    approved: "Approuvée",
    rejected: "Rejetée",
    in_production: "En production",
    ready: "Prête",
    delivered: "Livrée",
    cancelled: "Annulée",
  };
  return map[status] || status || "—";
}

function typeLabel(type) {
  const map = {
    yarn: "fil industriel",
    mercerie: "mercerie",
    technical: "fil industriel",
  };
  return map[type] || type || "commande";
}

function triggerLabel(trigger) {
  const map = {
    scheduler: "automatique",
    manual: "déclenchée manuellement",
    boot: "au démarrage",
  };
  return map[trigger] || trigger || "—";
}

function templateLabel(templateKey) {
  const map = {
    invite_user: "Invitation nouvel utilisateur",
    reset_password: "Réinitialisation mot de passe",
    order_submitted: "Confirmation de commande",
    order_approved: "Commande approuvée",
    order_status_changed: "Changement de statut de commande",
    order_pending_validation: "Validation client requise",
  };
  return map[templateKey] || templateKey || "(modèle inconnu)";
}

function categoryLabel(category) {
  const map = {
    api: "Trafic API",
    auth: "Connexions",
    order: "Commandes",
    sage: "Synchronisation Sage",
    mail: "Emails",
    system: "Système",
    frontend: "Erreurs interface",
  };
  return map[category] || category || "—";
}

function levelLabel(level) {
  const map = {
    critical: "Critique",
    error: "Erreur",
    warn: "Avertissement",
    info: "Information",
    debug: "Détail technique",
  };
  return map[level] || level;
}

function formatDuration(ms) {
  if (ms === null || ms === undefined) return "—";
  const n = Number(ms);
  if (!Number.isFinite(n)) return "—";
  if (n < 1000) return `${Math.round(n)} ms`;
  if (n < 60000) return `${(n / 1000).toFixed(1)} s`;
  return `${Math.floor(n / 60000)} min ${Math.round((n % 60000) / 1000)} s`;
}

module.exports = {
  roleLabel,
  statusLabel,
  typeLabel,
  triggerLabel,
  templateLabel,
  categoryLabel,
  levelLabel,
  formatDuration,
};
