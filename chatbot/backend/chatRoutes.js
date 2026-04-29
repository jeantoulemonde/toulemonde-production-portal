// ============================================================================
// POC chatbot — module isolé, activé par CHATBOT_ENABLED.
// Retrait : voir chatbot/README.md → "Procédure de désactivation / retrait".
// ============================================================================
// Router Express du module chatbot. Auto-portant : auth interne, DB interne.
// Monté par server.js avec : app.use('/api/chat', require('./chatbot/backend/chatRoutes'))

const express = require("express");
const { authRequired, requireClient, requireAdmin } = require("./auth");
const controller = require("./chatController");
const ollama = require("./ollamaService");
const logger = require("./logger");

const router = express.Router();

// Warmup non bloquant : charge les 2 modèles Ollama (génération + embed) en RAM
// dès le démarrage du backend. Combiné avec keep_alive=24h dans ollamaService,
// le premier message utilisateur n'attend plus le cold-start.
setTimeout(() => {
  ollama.warmupModel().catch(() => { /* déjà loggé en interne */ });
}, 1000);

// ─── Rate-limit anti-abus par utilisateur (en mémoire, simple Map) ──────────
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1h glissante
const RATE_MAX = Number(process.env.CHATBOT_RATE_LIMIT_PER_HOUR || 30);
const rateBuckets = new Map(); // userId -> [timestamp, ...]

function rateLimit(req, res, next) {
  const key = req.user?.sub;
  if (!key) return next();
  const now = Date.now();
  const bucket = (rateBuckets.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (bucket.length >= RATE_MAX) {
    return res.status(429).json({
      error: `Limite atteinte : ${RATE_MAX} messages par heure. Réessayez plus tard.`,
    });
  }
  bucket.push(now);
  rateBuckets.set(key, bucket);
  next();
}

// ───────────────────────────── Routes client ────────────────────────────────

router.post("/sessions/current", authRequired, requireClient, async (req, res) => {
  try {
    const session = await controller.getOrCreateActiveSession({ user: req.user });
    res.json({ session });
  } catch (err) {
    logger.error("Erreur récupération session", { error: err });
    res.status(500).json({ error: "Erreur récupération session" });
  }
});

router.get("/sessions/current/messages", authRequired, requireClient, async (req, res) => {
  try {
    const session = await controller.getOrCreateActiveSession({ user: req.user });
    const data = await controller.loadHistory({ sessionId: session.id, user: req.user });
    res.json(data || { session, messages: [] });
  } catch (err) {
    logger.error("Erreur lecture historique", { error: err });
    res.status(500).json({ error: "Erreur lecture historique" });
  }
});

router.post("/sessions/current/messages", authRequired, requireClient, rateLimit, async (req, res) => {
  // Validation HTTP classique (400 JSON) avant de basculer en SSE.
  const trimmed = String(req.body?.content || "").trim();
  if (!trimmed) return res.status(400).json({ error: "Message vide" });
  if (trimmed.length > 4000) return res.status(400).json({ error: "Message trop long (4000 caractères max)" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // AbortController lié à la déconnexion client → annule l'appel Ollama
  // amont si l'utilisateur clique sur "stop" ou ferme l'onglet.
  const ac = new AbortController();
  let aborted = false;
  req.on("close", () => {
    if (!res.writableEnded) {
      aborted = true;
      ac.abort();
    }
  });

  const send = (event, data) => {
    if (aborted) return;
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }
    catch { /* socket déjà fermé */ }
  };

  try {
    await controller.streamMessage({
      user: req.user,
      content: trimmed,
      onEvent: send,
      abortSignal: ac.signal,
    });
  } catch (err) {
    if (!aborted) {
      logger.error("Erreur stream message", { error: err });
      send("error", { error: err.message || "Erreur serveur" });
    }
  } finally {
    if (!aborted) res.end();
  }
});

router.post("/messages/:id/feedback", authRequired, requireClient, async (req, res) => {
  try {
    const result = await controller.setMessageFeedback({
      user: req.user,
      messageId: Number(req.params.id),
      score: req.body?.score,
      comment: req.body?.comment,
    });
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    logger.error("Erreur feedback", { error: err });
    res.status(500).json({ error: "Erreur feedback" });
  }
});

router.post("/sessions/current/escalate", authRequired, requireClient, async (req, res) => {
  try {
    const result = await controller.requestEscalation({ user: req.user, reason: req.body?.reason });
    res.json(result);
  } catch (err) {
    logger.error("Erreur escalation", { error: err });
    res.status(500).json({ error: "Erreur escalation" });
  }
});

// ───────────────────────────── Routes admin ─────────────────────────────────

router.get("/admin/sessions", authRequired, requireAdmin, async (req, res) => {
  try {
    const sessions = await controller.listSessions({
      status: req.query.status,
      limit: req.query.limit,
    });
    res.json({ sessions });
  } catch (err) {
    logger.error("Erreur liste sessions admin", { error: err });
    res.status(500).json({ error: "Erreur liste sessions" });
  }
});

router.get("/admin/sessions/:id", authRequired, requireAdmin, async (req, res) => {
  try {
    const data = await controller.getSessionDetail({ sessionId: Number(req.params.id) });
    if (!data) return res.status(404).json({ error: "Session introuvable" });
    res.json(data);
  } catch (err) {
    logger.error("Erreur détail session", { error: err });
    res.status(500).json({ error: "Erreur détail session" });
  }
});

router.post("/admin/sessions/:id/reply", authRequired, requireAdmin, async (req, res) => {
  try {
    const result = await controller.adminReply({
      sessionId: Number(req.params.id),
      adminUser: req.user,
      content: req.body?.content,
    });
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    logger.error("Erreur réponse admin", { error: err });
    res.status(500).json({ error: "Erreur réponse admin" });
  }
});

router.post("/admin/sessions/:id/close", authRequired, requireAdmin, async (req, res) => {
  try {
    const result = await controller.closeSession({
      sessionId: Number(req.params.id),
      adminUser: req.user,
    });
    if (result.error) return res.status(404).json(result);
    res.json(result);
  } catch (err) {
    logger.error("Erreur clôture session", { error: err });
    res.status(500).json({ error: "Erreur clôture session" });
  }
});

router.get("/admin/escalations/pending-count", authRequired, requireAdmin, async (req, res) => {
  try {
    const count = await controller.getPendingEscalationCount();
    res.json({ count });
  } catch (err) {
    logger.error("Erreur compteur escalations", { error: err });
    res.status(500).json({ error: "Erreur compteur escalations" });
  }
});

module.exports = router;