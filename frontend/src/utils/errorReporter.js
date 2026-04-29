// Remonte les erreurs JS du navigateur vers le backend (POST /api/client-error).
// Fire-and-forget : on n'attend rien et on n'alarme jamais l'utilisateur.

const IGNORED_PATTERNS = [
  /Failed to fetch/i,
  /NetworkError/i,
  /Load failed/i,
  /ResizeObserver loop/i,
  /AbortError/i,
];

// Throttle simple : max 5 reports / 60s par message identique.
const recentReports = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function shouldThrottle(key) {
  const now = Date.now();
  const entry = recentReports.get(key) || { count: 0, since: now };
  if (now - entry.since > WINDOW_MS) {
    recentReports.set(key, { count: 1, since: now });
    return false;
  }
  if (entry.count >= MAX_PER_WINDOW) return true;
  recentReports.set(key, { count: entry.count + 1, since: entry.since });
  return false;
}

// Dérive un message lisible à partir de la route active.
function deriveContextualMessage(error) {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const sectionMap = [
    [/^\/client\/orders\/new/, "Nouvelle commande"],
    [/^\/client\/orders/, "Mes commandes"],
    [/^\/client\/mercerie/, "Catalogue mercerie"],
    [/^\/client\/profile/, "Mon profil"],
    [/^\/client\/documents/, "Mes documents"],
    [/^\/client\/contact/, "Page Contact"],
    [/^\/client/, "Espace client"],
    [/^\/admin\/orders/, "Admin — Commandes"],
    [/^\/admin\/clients/, "Admin — Clients"],
    [/^\/admin\/users/, "Admin — Utilisateurs"],
    [/^\/admin\/catalog/, "Admin — Catalogue"],
    [/^\/admin\/mail/, "Admin — Emails"],
    [/^\/admin\/logs/, "Admin — Activité du portail"],
    [/^\/admin/, "Admin"],
  ];
  const section = sectionMap.find(([rx]) => rx.test(path))?.[1] || "Page inconnue";
  const technical = error?.message || String(error || "");
  return `Erreur dans la page "${section}" — ${technical.slice(0, 200)}`;
}

export function reportError(error, context = {}) {
  try {
    const technical = error?.message || String(error || "");
    if (IGNORED_PATTERNS.some((rx) => rx.test(technical))) return;

    const message = deriveContextualMessage(error);
    if (shouldThrottle(message)) return;

    if (import.meta.env.DEV) {
      // En dev, on logue dans la console et on n'envoie pas au backend
      // pour éviter de polluer error.log pendant les itérations.
      console.error("[errorReporter]", message, error, context);
      return;
    }

    const payload = {
      message,
      stack: error?.stack || null,
      url: typeof window !== "undefined" ? window.location.href : null,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      ...context,
    };

    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => { /* silent */ });
  } catch {
    // Ne jamais throw depuis le reporter.
  }
}
