// Catalogue centralisé des messages de log, en français orienté métier.
// Chaque entrée est une fonction qui prend un objet de contexte et retourne
// une phrase lisible directement par un utilisateur non technique.

const {
  roleLabel,
  statusLabel,
  typeLabel,
  triggerLabel,
  templateLabel,
  formatDuration,
} = require("./labels");

const auth = {
  loginSuccess: ({ email, role }) =>
    `Connexion réussie de ${email} (${roleLabel(role)})`,
  loginBadPassword: ({ email }) =>
    `Échec de connexion : mot de passe incorrect (${email})`,
  loginNotFound: ({ email }) =>
    `Échec de connexion : compte inexistant ou désactivé (${email})`,
  loginForbiddenRole: ({ email, redirectTo }) =>
    `Connexion refusée : rôle non autorisé sur ${redirectTo} (${email})`,
  rateLimited: ({ email, ip }) =>
    `Trop de tentatives de connexion (${email || "inconnu"}, IP ${ip || "?"}), blocage temporaire`,
  tokenExpired: ({ route }) =>
    `Session expirée, l'utilisateur doit se reconnecter (route ${route || "?"})`,
  tokenInvalid: ({ route }) =>
    `Tentative d'accès avec un jeton invalide (route ${route || "?"})`,
  resetRequested: ({ email }) =>
    `Demande de réinitialisation du mot de passe pour ${email}`,
  resetUsed: ({ email }) =>
    `Mot de passe réinitialisé avec succès pour ${email}`,
  resetInvalid: () =>
    `Tentative de réinitialisation avec un lien invalide ou expiré`,
};

const order = {
  draftCreated: ({ orderId, type }) =>
    `Brouillon de commande ${typeLabel(type)} créé (#${orderId})`,
  submitted: ({ orderId, fullName, totalKg, linesCount }) => {
    const who = fullName ? `par ${fullName}` : "";
    const detail = totalKg
      ? `${linesCount || 0} ligne(s), ${totalKg} kg`
      : `${linesCount || 0} ligne(s)`;
    return `Commande #${orderId} soumise ${who} (${detail})`.trim();
  },
  approved: ({ orderId, by, comment }) =>
    `Commande #${orderId} approuvée par ${by || "l'administration"}${comment ? ` — ${comment}` : ""}`,
  rejected: ({ orderId, by, reason }) =>
    `Commande #${orderId} rejetée par ${by || "l'administration"}${reason ? ` — Motif : ${reason}` : ""}`,
  statusChanged: ({ orderId, oldStatus, newStatus, changedBy }) =>
    `Commande #${orderId} : ${statusLabel(oldStatus)} → ${statusLabel(newStatus)}${changedBy ? ` (par ${changedBy})` : ""}`,
  saveError: ({ orderId, userId }) =>
    `Erreur lors de l'enregistrement de la commande ${orderId ? `#${orderId}` : "(brouillon)"}${userId ? ` (utilisateur #${userId})` : ""}`,
  draftDeleted: ({ orderId, by }) =>
    `Brouillon #${orderId} supprimé${by ? ` par ${by}` : ""}`,
  forceSync: ({ orderId, by }) =>
    `Envoi Sage manuel demandé pour la commande #${orderId}${by ? ` par ${by}` : ""}`,
};

const sage = {
  importStarted: ({ trigger }) =>
    `Synchronisation Sage démarrée (${triggerLabel(trigger)})`,
  importDone: ({ ordersUpdated, duration }) =>
    `Synchronisation Sage terminée : ${ordersUpdated || 0} commande(s) mises à jour en ${formatDuration(duration)}`,
  importFailed: ({ duration }) =>
    `Échec de la synchronisation Sage${duration ? ` (après ${formatDuration(duration)})` : ""}`,
  exportFailed: () =>
    `Échec de l'export Sage`,
  actionCreated: ({ actionId, type, orderId }) =>
    `Action Sage "${type || "?"}" créée pour la commande #${orderId} (action #${actionId})`,
  actionExecuted: ({ actionId, agentId, duration }) =>
    `Action Sage #${actionId} exécutée par l'agent ${agentId || "(?)"} en ${formatDuration(duration)}`,
  actionFailed: ({ actionId, retryCount }) =>
    `Action Sage #${actionId} en échec${retryCount ? ` (tentative ${retryCount})` : ""}`,
  duplicateDetected: ({ actionId, lockedBy }) =>
    `Action Sage #${actionId} déjà en cours de traitement, doublon évité${lockedBy ? ` (verrou ${lockedBy})` : ""}`,
  sageOffline: ({ host }) =>
    `Connexion Sage perdue, agent injoignable${host ? ` (${host})` : ""}`,
  schedulerStarted: ({ frequencyMs }) =>
    `Planificateur Sage démarré (fréquence : toutes les ${Math.round(frequencyMs / 1000)} s)`,
  schedulerSkipped: ({ reason }) =>
    `Planificateur Sage non démarré : ${reason || "raison inconnue"}`,
  schedulerError: () =>
    `Erreur dans le planificateur Sage`,
};

const mail = {
  sent: ({ to, templateKey, orderId }) =>
    `Email "${templateLabel(templateKey)}" envoyé à ${to}${orderId ? ` (commande #${orderId})` : ""}`,
  failed: ({ to, templateKey, orderId }) =>
    `Échec d'envoi de l'email "${templateLabel(templateKey)}" à ${to}${orderId ? ` (commande #${orderId})` : ""}`,
  templateMissing: ({ templateKey }) =>
    `Modèle d'email "${templateLabel(templateKey)}" introuvable en base`,
  noRecipient: ({ orderId, templateKey }) =>
    `Pas d'adresse email pour la commande #${orderId}, email "${templateLabel(templateKey)}" non envoyé`,
};

const system = {
  serverStarted: ({ port, env, dbType, version }) =>
    `Serveur démarré sur le port ${port} (environnement : ${env || "development"}${dbType ? `, base ${dbType}` : ""}${version ? `, version ${version}` : ""})`,
  dbConnected: ({ db }) =>
    `Connexion à la base de données réussie${db ? ` (${db})` : ""}`,
  dbFailed: () =>
    `Impossible de se connecter à la base de données`,
  dbInitFailed: () =>
    `Erreur lors de l'initialisation de la base portail`,
  dbIdleError: () =>
    `Erreur sur un client Postgres inactif`,
  envMissing: ({ variable }) =>
    `Variable d'environnement requise manquante : ${variable}`,
  uncaught: () =>
    `Erreur inattendue non gérée dans le serveur (uncaughtException)`,
  unhandled: () =>
    `Promesse rejetée sans gestionnaire d'erreur (unhandledRejection)`,
  unhandledHttp: ({ method, path }) =>
    `Erreur non gérée sur ${method || "?"} ${path || "?"}`,
  auditLogError: () =>
    `Échec d'écriture dans le journal d'audit`,
};

const adminUser = {
  created: ({ email, role, by }) =>
    `Utilisateur ${email} (${roleLabel(role)}) créé${by ? ` par ${by}` : ""}`,
  deleted: ({ email, by }) =>
    `Utilisateur ${email} supprimé${by ? ` par ${by}` : ""}`,
  statusChanged: ({ email, active }) =>
    `Utilisateur ${email} ${active ? "réactivé" : "désactivé"}`,
};

module.exports = { auth, order, sage, mail, system, adminUser };
