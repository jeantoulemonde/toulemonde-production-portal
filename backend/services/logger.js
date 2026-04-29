// Logger Winston : transports fichiers rotatifs par catégorie + console en dev.
// Format JSON structuré avec masquage automatique des champs sensibles.

const fs = require("fs");
const path = require("path");
const winston = require("winston");
require("winston-daily-rotate-file");

const LOG_LEVEL = (process.env.LOG_LEVEL || "info").toLowerCase();
const LOG_DIR = process.env.LOG_DIR
  ? path.isAbsolute(process.env.LOG_DIR)
    ? process.env.LOG_DIR
    : path.resolve(__dirname, "..", process.env.LOG_DIR)
  : path.resolve(__dirname, "..", "logs");
const LOG_RETENTION_DAYS = String(process.env.LOG_RETENTION_DAYS || "30");
const LOG_MAX_SIZE = process.env.LOG_MAX_SIZE || "20m";

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Niveaux custom : on ajoute "critical" en plus des niveaux standard.
const levels = { critical: 0, error: 1, warn: 2, info: 3, debug: 4 };
const colors = {
  critical: "red bold",
  error: "red",
  warn: "yellow",
  info: "green",
  debug: "gray",
};
winston.addColors(colors);

const SENSITIVE_KEYS = new Set([
  "password",
  "password_hash",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "resettoken",
  "reset_token",
  "reset_token_hash",
  "invitationlink",
  "invitation_link",
  "resetlink",
  "reset_link",
  "authorization",
  "anthropic_api_key",
  "resend_api_key",
  "jwt_secret",
  "refresh_secret",
  "agent_api_key",
  "postgres_password",
]);

function redactSensitive(value, depth = 0) {
  if (depth > 6 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => redactSensitive(v, depth + 1));
  if (typeof value !== "object") return value;
  if (value instanceof Error) {
    return {
      message: value.message,
      stack: value.stack,
      code: value.code,
    };
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(String(k).toLowerCase())) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = redactSensitive(v, depth + 1);
    }
  }
  return out;
}

// Format JSON pour les fichiers : on garantit timestamp, level, category, message, et meta filtré.
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format((info) => {
    // Sépare les champs reconnus du reste qui finit dans meta.
    const { timestamp, level, message, category, error, stack, ...rest } = info;
    const known = {
      timestamp,
      level,
      category: category || "system",
      message,
    };
    // Erreur structurée si présente
    if (error || stack) {
      known.error = redactSensitive({
        message: error?.message || (typeof error === "string" ? error : undefined),
        stack: error?.stack || stack,
        code: error?.code,
      });
    }
    // Champs racine réservés (utiles pour filtrer côté UI)
    for (const key of ["userId", "orderId", "clientId", "ip", "duration", "method", "url", "statusCode"]) {
      if (rest[key] !== undefined) {
        known[key] = rest[key];
        delete rest[key];
      }
    }
    if (Object.keys(rest).length > 0) {
      known.meta = redactSensitive(rest);
    }
    return known;
  })(),
  winston.format.json()
);

// Format console lisible pour le dev.
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, category }) => {
    const cat = category ? `[${category}]` : "";
    return `${timestamp} ${level} ${cat} ${message}`;
  })
);

function categoryFilter(targetCategory) {
  return winston.format((info) => {
    if (info.category === targetCategory) return info;
    return false;
  })();
}

function rotatingFile({ filename, level, category }) {
  const transportFormat = category
    ? winston.format.combine(categoryFilter(category), fileFormat)
    : fileFormat;
  return new winston.transports.DailyRotateFile({
    filename: path.join(LOG_DIR, `${filename}-%DATE%.log`),
    datePattern: "YYYY-MM-DD",
    maxFiles: `${LOG_RETENTION_DAYS}d`,
    maxSize: LOG_MAX_SIZE,
    zippedArchive: true,
    level,
    format: transportFormat,
  });
}

const transports = [
  // error.log : uniquement error + critical (toutes catégories)
  rotatingFile({ filename: "error", level: "error" }),
  // un fichier par catégorie métier
  rotatingFile({ filename: "api", level: "debug", category: "api" }),
  rotatingFile({ filename: "auth", level: "debug", category: "auth" }),
  rotatingFile({ filename: "orders", level: "debug", category: "order" }),
  rotatingFile({ filename: "sage", level: "debug", category: "sage" }),
  rotatingFile({ filename: "mail", level: "debug", category: "mail" }),
  // combined.log : tout (sauf debug en prod)
  rotatingFile({ filename: "combined", level: LOG_LEVEL }),
];

if (process.env.NODE_ENV !== "production") {
  transports.push(
    new winston.transports.Console({
      level: LOG_LEVEL,
      format: consoleFormat,
    })
  );
}

const logger = winston.createLogger({
  levels,
  level: LOG_LEVEL,
  transports,
  exitOnError: false,
});

logger.LOG_DIR = LOG_DIR;
logger.LOG_LEVEL = LOG_LEVEL;
logger.redactSensitive = redactSensitive;

module.exports = logger;
