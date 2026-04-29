// ============================================================================
// POC chatbot — module isolé, activé par CHATBOT_ENABLED.
// Retrait : voir chatbot/README.md → "Procédure de désactivation / retrait".
// ============================================================================
// Proxy léger vers le logger principal (Winston) si dispo, sinon fallback console.
// Catégorie dédiée "chatbot" pour router vers le bon fichier.

let chatLogger = null;

try {
  // Essaie d'utiliser le logger Winston du portail principal.
  // Le require est wrappé pour ne pas casser si le module est utilisé ailleurs.
  const baseLogger = require(require("path").resolve(
    __dirname,
    "../../backend/services/logger.js"
  ));
  chatLogger = baseLogger.child({ category: "chatbot" });
} catch {
  chatLogger = null;
}

function fallback(level) {
  return (message, meta) => {
    const m = meta ? ` ${JSON.stringify(meta)}` : "";
    // eslint-disable-next-line no-console
    console[level === "warn" ? "warn" : level === "error" || level === "critical" ? "error" : "log"](
      `[chatbot/${level}] ${message}${m}`
    );
  };
}

module.exports = chatLogger || {
  info: fallback("info"),
  warn: fallback("warn"),
  error: fallback("error"),
  debug: fallback("debug"),
  critical: fallback("critical"),
};