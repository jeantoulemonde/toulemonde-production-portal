// Routes admin pour la consultation des logs.
// Factory pour pouvoir injecter authRequired/requireAdmin sans import circulaire.

const fs = require("fs");
const path = require("path");
const express = require("express");

const logger = require("../services/logger");

// Map onglet UI -> nom de fichier (sans le suffixe -DATE.log)
const CATEGORY_TO_FILENAME = {
  error: "error",
  api: "api",
  auth: "auth",
  order: "orders",
  sage: "sage",
  mail: "mail",
  combined: "combined",
};

function listLogFilesForPrefix(prefix, days = 30) {
  if (!fs.existsSync(logger.LOG_DIR)) return [];
  const all = fs.readdirSync(logger.LOG_DIR);
  // Fichiers `prefix-YYYY-MM-DD.log` (ou .log.gz si rotation compressée)
  const rx = new RegExp(`^${prefix}-(\\d{4}-\\d{2}-\\d{2})\\.log(\\.gz)?$`);
  return all
    .map((name) => {
      const m = name.match(rx);
      if (!m) return null;
      return { name, date: m[1], compressed: Boolean(m[2]), full: path.join(logger.LOG_DIR, name) };
    })
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? 1 : -1)) // plus récent d'abord
    .slice(0, days);
}

function safeParseLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return { level: "info", message: line, timestamp: new Date().toISOString(), category: "system" };
  }
}

// Lit les N dernières lignes JSON d'un fichier .log (ignore les .gz pour l'instant).
// Plafond de sécurité : 5 MB lus max.
function readLastLines(filePath, maxLines) {
  const stats = fs.statSync(filePath);
  const MAX_BYTES = 5 * 1024 * 1024;
  const start = stats.size > MAX_BYTES ? stats.size - MAX_BYTES : 0;
  const buf = Buffer.alloc(stats.size - start);
  const fd = fs.openSync(filePath, "r");
  try {
    fs.readSync(fd, buf, 0, buf.length, start);
  } finally {
    fs.closeSync(fd);
  }
  const lines = buf.toString("utf8").split("\n").filter((l) => l.length > 0);
  return lines.slice(-maxLines);
}

function entryMatchesFilters(entry, { level, search, from, to }) {
  if (level && level !== "all") {
    if (level === "warn+") {
      if (!["warn", "error", "critical"].includes(entry.level)) return false;
    } else if (level === "error+") {
      if (!["error", "critical"].includes(entry.level)) return false;
    } else if (entry.level !== level) {
      return false;
    }
  }
  if (search) {
    const s = String(search).toLowerCase();
    const hay = `${entry.message || ""} ${entry.userId || ""} ${entry.orderId || ""} ${entry.ip || ""} ${entry.url || ""}`.toLowerCase();
    if (!hay.includes(s)) return false;
  }
  if (from) {
    if (!entry.timestamp || entry.timestamp < from) return false;
  }
  if (to) {
    if (!entry.timestamp || entry.timestamp > to) return false;
  }
  return true;
}

function readEntriesForCategory(category, { lines, level, search, from, to }) {
  const prefix = CATEGORY_TO_FILENAME[category];
  if (!prefix) return [];
  // On lit les fichiers les plus récents jusqu'à atteindre `lines` après filtrage,
  // dans la limite de 7 fichiers (≈ 1 semaine).
  const files = listLogFilesForPrefix(prefix, 7);
  const collected = [];
  for (const f of files) {
    if (f.compressed) continue; // les .gz sont les anciens, on les zappe
    let raw;
    try {
      raw = readLastLines(f.full, lines * 4); // surdimensionne avant filtrage
    } catch {
      continue;
    }
    for (const line of raw) {
      const entry = safeParseLine(line);
      if (entryMatchesFilters(entry, { level, search, from, to })) {
        collected.push(entry);
      }
    }
    if (collected.length >= lines) break;
  }
  // Tri antichronologique et coupe au nombre demandé.
  collected.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  return collected.slice(0, lines);
}

function buildOverviewSummary() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const counters = {
    loginSuccess: 0,
    loginFailed: 0,
    ordersSubmitted: 0,
    mailsSent: 0,
    mailsSimulated: 0,
    mailsFailed: 0,
    sageSyncs: 0,
    sageSyncFailed: 0,
    serverErrors: 0,
  };
  const watchlist = [];

  const authEntries = readEntriesForCategory("auth", { lines: 1000, from: since });
  for (const e of authEntries) {
    if (/Connexion réussie/i.test(e.message)) counters.loginSuccess += 1;
    else if (/Échec de connexion/i.test(e.message)) counters.loginFailed += 1;
  }

  const orderEntries = readEntriesForCategory("order", { lines: 1000, from: since });
  for (const e of orderEntries) {
    if (/soumise/i.test(e.message)) counters.ordersSubmitted += 1;
  }

  const mailEntries = readEntriesForCategory("mail", { lines: 1000, from: since });
  for (const e of mailEntries) {
    // Distinguer "envoyé" réel vs "simulé" (mode console).
    if (/simulé pour/i.test(e.message)) counters.mailsSimulated += 1;
    else if (/^Email .* envoyé/i.test(e.message)) counters.mailsSent += 1;
    if (/^Échec d'envoi/i.test(e.message)) counters.mailsFailed += 1;
  }

  const sageEntries = readEntriesForCategory("sage", { lines: 1000, from: since });
  for (const e of sageEntries) {
    if (/Synchronisation Sage terminée/i.test(e.message)) counters.sageSyncs += 1;
    if (/Échec de la synchronisation Sage/i.test(e.message)) counters.sageSyncFailed += 1;
  }

  const errorEntries = readEntriesForCategory("error", { lines: 50, from: since });
  counters.serverErrors = errorEntries.length;
  for (const e of errorEntries.slice(0, 10)) watchlist.push(e);

  return { since, counters, watchlist };
}

function createAdminLogsRouter(authRequired, requireAdmin) {
  const router = express.Router();

  router.use(authRequired, requireAdmin);

  router.get("/overview", (req, res) => {
    try {
      res.json(buildOverviewSummary());
    } catch (error) {
      res.status(500).json({ error: "Erreur lecture vue d'ensemble" });
    }
  });

  router.get("/errors/recent", (req, res) => {
    try {
      const lines = Math.min(Number(req.query.lines || 50), 200);
      const entries = readEntriesForCategory("error", { lines });
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Erreur lecture des dernières erreurs" });
    }
  });

  router.get("/:category", (req, res) => {
    try {
      const { category } = req.params;
      if (!CATEGORY_TO_FILENAME[category]) {
        return res.status(400).json({ error: "Catégorie inconnue" });
      }
      const lines = Math.min(Number(req.query.lines || 200), 1000);
      const level = req.query.level || "all";
      const search = req.query.search || "";
      const from = req.query.from || null;
      const to = req.query.to || null;
      const entries = readEntriesForCategory(category, { lines, level, search, from, to });
      res.json({ entries, category, count: entries.length });
    } catch (error) {
      res.status(500).json({ error: "Erreur lecture des logs" });
    }
  });

  return router;
}

module.exports = { createAdminLogsRouter };
