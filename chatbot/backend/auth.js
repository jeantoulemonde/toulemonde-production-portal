// ============================================================================
// POC chatbot — module isolé, activé par CHATBOT_ENABLED.
// Retrait : voir chatbot/README.md → "Procédure de désactivation / retrait".
// ============================================================================
// Auth autonome pour le module chatbot. Vérifie le JWT Bearer et pose req.user
// avec les mêmes champs que le middleware authRequired du portail principal.

const jwt = require("jsonwebtoken");

const ADMIN_ROLES = ["admin_portal", "commercial", "production", "super_admin"];

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Token manquant", code: "TOKEN_INVALID" });
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "dev-change-me");
    next();
  } catch {
    res.status(401).json({ error: "Token invalide ou expiré", code: "TOKEN_INVALID" });
  }
}

function requireClient(req, res, next) {
  if (!req.user || req.user.role !== "client") {
    return res.status(403).json({ error: "Réservé aux clients" });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !ADMIN_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: "Réservé aux administrateurs" });
  }
  next();
}

module.exports = {
  authRequired,
  requireClient,
  requireAdmin,
  ADMIN_ROLES,
};