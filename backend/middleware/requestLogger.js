// Middleware Express : log de chaque requête HTTP avec durée, statut,
// utilisateur (si authentifié) et IP. Branché juste après cors/rate-limit.

const { apiLogger, redactSensitive } = require("../services/loggerCategories");

const SKIP_PREFIXES = ["/api/health"];

function shouldSkip(url) {
  return SKIP_PREFIXES.some((prefix) => url.startsWith(prefix));
}

function summarizeBody(body) {
  if (!body || typeof body !== "object") return undefined;
  const redacted = redactSensitive(body);
  // On garde une version compacte (max ~500 chars) pour ne pas gonfler les logs.
  try {
    const json = JSON.stringify(redacted);
    if (json.length > 500) return json.slice(0, 500) + "…";
    return redacted;
  } catch {
    return undefined;
  }
}

function requestLogger(req, res, next) {
  if (shouldSkip(req.path)) return next();

  const startedAt = process.hrtime.bigint();
  const { method, originalUrl } = req;
  const ip = req.ip;
  const userAgent = req.headers["user-agent"] || "";
  const bodySize = Number(req.headers["content-length"] || 0);

  res.on("finish", () => {
    const duration = Number((process.hrtime.bigint() - startedAt) / 1000000n);
    const statusCode = res.statusCode;
    const userId = req.user?.sub || null;
    const role = req.user?.role || null;

    const meta = {
      method,
      url: originalUrl,
      statusCode,
      duration,
      userId,
      role,
      ip,
      userAgent,
      bodySize,
    };

    let level = "info";
    let message = `${method} ${originalUrl} → ${statusCode} en ${duration} ms`;
    if (statusCode >= 500) {
      level = "error";
      message = `Erreur serveur sur ${method} ${originalUrl} (${statusCode}) en ${duration} ms`;
    } else if (statusCode >= 400) {
      level = "warn";
      message = `Requête refusée sur ${method} ${originalUrl} (${statusCode}) en ${duration} ms`;
      // Pour les 4xx/5xx on ajoute un résumé du body redacté si présent
      if (req.body) meta.bodySummary = summarizeBody(req.body);
    }

    apiLogger.log(level, message, meta);
  });

  next();
}

module.exports = { requestLogger };
