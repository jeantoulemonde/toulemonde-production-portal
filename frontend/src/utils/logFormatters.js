// Helpers UI pour la page Activité du portail.
// Tout ce qui transforme un log JSON brut en éléments lisibles.

import { T } from "../theme";

export const LEVEL_META = {
  critical: { label: "Critique", color: T.danger, bg: "rgba(159,29,29,0.12)", icon: "🔴" },
  error: { label: "Erreur", color: T.danger, bg: "rgba(159,29,29,0.10)", icon: "🔴" },
  warn: { label: "Avertissement", color: "#a85a07", bg: "rgba(168,90,7,0.12)", icon: "🟠" },
  info: { label: "Information", color: T.success, bg: "rgba(35,107,56,0.10)", icon: "🟢" },
  debug: { label: "Détail technique", color: T.textSoft, bg: "rgba(0,0,0,0.04)", icon: "⚪" },
};

export const CATEGORY_TABS = [
  { key: "overview", label: "Vue d'ensemble" },
  { key: "error", label: "Erreurs" },
  { key: "auth", label: "Connexions" },
  { key: "order", label: "Commandes" },
  { key: "sage", label: "Synchro Sage" },
  { key: "mail", label: "Emails" },
  { key: "api", label: "Trafic API" },
];

export function levelMeta(level) {
  return LEVEL_META[level] || LEVEL_META.info;
}

export function formatTimestamp(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const sameDay = d.toDateString() === new Date().toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  return d.toLocaleString("fr-BE", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function formatTimestampLong(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-BE", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

// Construit un résumé "humain" des champs de contexte (userId, orderId...).
export function describeContext(entry) {
  const parts = [];
  if (entry.userId) parts.push(`👤 utilisateur #${entry.userId}`);
  if (entry.orderId) parts.push(`📦 commande ${entry.orderId}`);
  if (entry.clientId) parts.push(`🏢 client #${entry.clientId}`);
  if (entry.ip) parts.push(`🌐 ${entry.ip}`);
  if (entry.method && entry.url) parts.push(`${entry.method} ${entry.url}`);
  if (entry.statusCode) parts.push(`HTTP ${entry.statusCode}`);
  if (entry.duration !== undefined) parts.push(`${entry.duration} ms`);
  return parts.join(" · ");
}
