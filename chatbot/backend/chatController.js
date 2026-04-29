// ============================================================================
// POC chatbot — module isolé, activé par CHATBOT_ENABLED.
// Retrait : voir chatbot/README.md → "Procédure de désactivation / retrait".
// ============================================================================
// Logique métier du chatbot, indépendante d'Express.

const db = require("./db");
const logger = require("./logger");
const { callClaude } = require("./ollamaService");
const { buildSystemPrompt } = require("./contextBuilder");
const { searchAndRerank, formatResults } = require("./ragRetriever");

const HISTORY_LIMIT = 6; // nombre de messages renvoyés au modèle pour le contexte

function clientIdFromUser(user) {
  return user?.clientId || null;
}

// ────────────────────────────────────────────────────────────────────────────
// Côté client
// ────────────────────────────────────────────────────────────────────────────

async function getOrCreateActiveSession({ user }) {
  const clientId = clientIdFromUser(user);
  const userId = user.sub;
  let session = await db.get(
    `SELECT * FROM chat_sessions
     WHERE user_id = ? AND status IN ('open', 'escalated')
     ORDER BY id DESC LIMIT 1`,
    [userId]
  );
  if (!session) {
    const result = await db.run(
      `INSERT INTO chat_sessions (client_id, user_id, status, last_message_at, created_at)
       VALUES (?, ?, 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [clientId, userId]
    );
    session = await db.get(`SELECT * FROM chat_sessions WHERE id = ?`, [result.id]);
    logger.info(`Nouvelle session de chat ouverte pour utilisateur #${userId}`, {
      sessionId: session.id,
      userId,
      clientId,
    });
  }
  return session;
}

async function loadHistory({ sessionId, user }) {
  const session = await db.get(
    `SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?`,
    [sessionId, user.sub]
  );
  if (!session) return null;
  const rows = await db.all(
    `SELECT id, role, content, metadata_json, created_at FROM chat_messages
     WHERE session_id = ? ORDER BY id ASC`,
    [sessionId]
  );
  const messages = rows.map((r) => {
    const meta = typeof r.metadata_json === "string"
      ? safeJsonParse(r.metadata_json)
      : (r.metadata_json || {});
    return {
      id: r.id,
      role: r.role,
      content: r.content,
      created_at: r.created_at,
      ...(meta.citations ? { citations: meta.citations } : {}),
      ...(meta.feedback ? { feedback: meta.feedback } : {}),
    };
  });
  return { session, messages };
}

// Variante streaming : émet des événements via onEvent(type, data) :
//   meta  → { sessionId, userMessageId }                           dès l'insert du msg user
//   delta → { content: "<chunk>" }                                  pour chaque token Mistral/Qwen
//   done  → { session, assistant, escalated }                       à la fin
//   error → { error: "...", technical?: "..." }                    en cas d'échec
async function streamMessage({ user, content, onEvent, abortSignal = null }) {
  const trimmed = String(content || "").trim();
  if (!trimmed) { onEvent("error", { error: "Message vide" }); return; }
  if (trimmed.length > 4000) { onEvent("error", { error: "Message trop long (4000 caractères max)" }); return; }

  const session = await getOrCreateActiveSession({ user });

  const userInsert = await db.run(
    `INSERT INTO chat_messages (session_id, role, content, created_at)
     VALUES (?, 'user', ?, CURRENT_TIMESTAMP)`,
    [session.id, trimmed]
  );

  if (!session.title) {
    await db.run(`UPDATE chat_sessions SET title = ? WHERE id = ?`, [trimmed.slice(0, 50), session.id]);
  }
  await db.run(
    `UPDATE chat_sessions SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [session.id]
  );

  onEvent("meta", { sessionId: session.id, userMessageId: userInsert.id });

  if (session.status === "escalated") {
    onEvent("done", {
      session: await db.get(`SELECT * FROM chat_sessions WHERE id = ?`, [session.id]),
      assistant: null,
      escalated: true,
      info: "Votre demande a été transmise à un conseiller, vous serez recontacté(e) ici.",
    });
    return;
  }

  const recent = await db.all(
    `SELECT role, content FROM chat_messages
     WHERE session_id = ? AND role IN ('user', 'assistant')
     ORDER BY id DESC LIMIT ?`,
    [session.id, HISTORY_LIMIT]
  );
  const conversation = recent.reverse().map((m) => ({ role: m.role, content: m.content }));

  let systemPrompt;
  try {
    systemPrompt = await buildSystemPrompt({ clientId: clientIdFromUser(user) });
  } catch (err) {
    logger.error("Échec de la construction du contexte client", { error: err });
    systemPrompt = "Tu es l'assistant virtuel du portail Toulemonde Production. Réponds de manière concise et professionnelle.";
  }

  // Capture les hits RAG pour les exposer en citations dans l'event "done".
  let ragHits = [];
  try {
    const rag = await searchAndRerank(trimmed, {
      sourceTypes: ["catalogue", "filature"],
      topK: 2,
      minScore: 0.5,
      sessionId: session.id,
    });
    ragHits = rag.results || [];
    const ragBlock = formatResults(ragHits);
    if (ragBlock) systemPrompt = `${systemPrompt}\n\n${ragBlock}`;
  } catch (err) {
    logger.warn("RAG indisponible pour ce tour, on continue sans", { error: err.message });
  }

  // Streaming Mistral/Qwen via onToken — chaque chunk est repropagé en SSE.
  // abortSignal annule l'appel HTTP à Ollama si le client se déconnecte.
  const result = await callClaude({
    systemPrompt,
    messages: conversation,
    onToken: (text) => onEvent("delta", { content: text }),
    abortSignal,
  });

  if (result.error) {
    // Génération annulée par l'utilisateur (stop) → pas d'erreur loggée.
    if (abortSignal?.aborted) return;
    await db.run(
      `INSERT INTO chat_messages (session_id, role, content, metadata_json, created_at)
       VALUES (?, 'system', ?, ?, CURRENT_TIMESTAMP)`,
      [session.id, `[Erreur IA] ${result.error}`, JSON.stringify({ technical: result.technical })]
    );
    onEvent("error", { error: result.error, technical: result.technical });
    return;
  }

  const meta = { model: result.model, usage: result.usage, stopReason: result.stopReason };
  const insertResult = await db.run(
    `INSERT INTO chat_messages (session_id, role, content, metadata_json, created_at)
     VALUES (?, 'assistant', ?, ?, CURRENT_TIMESTAMP)`,
    [session.id, result.content, JSON.stringify(meta)]
  );
  await db.run(
    `UPDATE chat_sessions SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [session.id]
  );
  const assistantMessage = await db.get(
    `SELECT id, role, content, created_at FROM chat_messages WHERE id = ?`,
    [insertResult.id]
  );

  // Citations : on n'expose les badges produits que pour les hits issus du
  // catalogue (les chunks filature sont du texte pur, pas de fiche produit).
  const citations = ragHits
    .filter((h) => h.source_type === "catalogue")
    .map((h) => {
      const meta = typeof h.metadata === "string" ? safeJsonParse(h.metadata) : (h.metadata || {});
      return {
        id: meta.id,
        sku: meta.sku || h.source_id,
        title: meta.title || h.source_id,
        price: meta.price,
        currency: meta.currency || "EUR",
        unit_label: meta.unit_label || "pièce",
        image_url: meta.image_url || null,
        score: Number(h.score?.toFixed?.(3) ?? h.score),
      };
    });

  // Persiste les citations dans le metadata du message pour permettre un
  // re-render correct au prochain reload de la conversation.
  if (citations.length > 0) {
    await db.run(
      `UPDATE chat_messages SET metadata_json = ? WHERE id = ?`,
      [JSON.stringify({ ...meta, citations }), insertResult.id]
    );
  }

  onEvent("done", {
    session: await db.get(`SELECT * FROM chat_sessions WHERE id = ?`, [session.id]),
    assistant: { ...assistantMessage, citations },
    escalated: false,
  });
}

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}

async function requestEscalation({ user, reason }) {
  const session = await getOrCreateActiveSession({ user });
  if (session.status === "escalated") {
    return { session, alreadyPending: true };
  }
  await db.run(
    `UPDATE chat_sessions SET status = 'escalated' WHERE id = ?`,
    [session.id]
  );
  await db.run(
    `INSERT INTO chat_escalations (session_id, reason, status, requested_at)
     VALUES (?, ?, 'pending', CURRENT_TIMESTAMP)`,
    [session.id, reason || null]
  );
  await db.run(
    `INSERT INTO chat_messages (session_id, role, content, created_at)
     VALUES (?, 'system', 'Demande de prise en charge humaine envoyée. Un conseiller va vous répondre dans cette même fenêtre.', CURRENT_TIMESTAMP)`,
    [session.id]
  );
  logger.info(`Escalation demandée pour la session #${session.id}`, {
    sessionId: session.id,
    userId: user.sub,
    reason,
  });
  return { session: await db.get(`SELECT * FROM chat_sessions WHERE id = ?`, [session.id]) };
}

// ────────────────────────────────────────────────────────────────────────────
// Côté admin
// ────────────────────────────────────────────────────────────────────────────

async function listSessions({ status, limit = 50 }) {
  const validStatuses = ["open", "escalated", "closed"];
  const wheres = [];
  const params = [];
  if (status && validStatuses.includes(status)) {
    wheres.push("s.status = ?");
    params.push(status);
  }
  const whereSql = wheres.length ? `WHERE ${wheres.join(" AND ")}` : "";
  const rows = await db.all(
    `SELECT s.id, s.client_id, s.user_id, s.status, s.title, s.last_message_at, s.created_at, s.closed_at,
            c.company_name, c.customer_code,
            u.email AS user_email, u.full_name AS user_name,
            (SELECT COUNT(*) FROM chat_messages m WHERE m.session_id = s.id) AS message_count
     FROM chat_sessions s
     LEFT JOIN portal_clients c ON c.id = s.client_id
     LEFT JOIN portal_users u ON u.id = s.user_id
     ${whereSql}
     ORDER BY s.last_message_at DESC NULLS LAST, s.id DESC
     LIMIT ?`,
    [...params, Math.min(Number(limit), 200)]
  );
  return rows;
}

async function getSessionDetail({ sessionId }) {
  const session = await db.get(
    `SELECT s.*, c.company_name, c.customer_code, u.email AS user_email, u.full_name AS user_name
     FROM chat_sessions s
     LEFT JOIN portal_clients c ON c.id = s.client_id
     LEFT JOIN portal_users u ON u.id = s.user_id
     WHERE s.id = ?`,
    [sessionId]
  );
  if (!session) return null;
  const messages = await db.all(
    `SELECT id, role, content, metadata_json, created_at FROM chat_messages
     WHERE session_id = ? ORDER BY id ASC`,
    [sessionId]
  );
  const escalations = await db.all(
    `SELECT id, reason, status, requested_at, handled_by, handled_at FROM chat_escalations
     WHERE session_id = ? ORDER BY id DESC`,
    [sessionId]
  );
  return { session, messages, escalations };
}

async function adminReply({ sessionId, adminUser, content }) {
  const trimmed = String(content || "").trim();
  if (!trimmed) return { error: "Réponse vide" };
  const session = await db.get(`SELECT * FROM chat_sessions WHERE id = ?`, [sessionId]);
  if (!session) return { error: "Session introuvable" };

  const insertResult = await db.run(
    `INSERT INTO chat_messages (session_id, role, content, metadata_json, created_at)
     VALUES (?, 'admin', ?, ?, CURRENT_TIMESTAMP)`,
    [sessionId, trimmed, JSON.stringify({ adminId: adminUser.sub, adminEmail: adminUser.email })]
  );
  await db.run(
    `UPDATE chat_sessions SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [sessionId]
  );
  // Marque l'escalation pending comme accepted dès la première réponse admin
  await db.run(
    `UPDATE chat_escalations
     SET status = 'accepted', handled_by = ?, handled_at = CURRENT_TIMESTAMP
     WHERE session_id = ? AND status = 'pending'`,
    [adminUser.sub, sessionId]
  );
  logger.info(`Réponse admin sur la session #${sessionId} par ${adminUser.email}`, {
    sessionId,
    adminId: adminUser.sub,
  });
  return {
    message: await db.get(
      `SELECT id, role, content, created_at FROM chat_messages WHERE id = ?`,
      [insertResult.id]
    ),
  };
}

async function closeSession({ sessionId, adminUser }) {
  const session = await db.get(`SELECT * FROM chat_sessions WHERE id = ?`, [sessionId]);
  if (!session) return { error: "Session introuvable" };
  await db.run(
    `UPDATE chat_sessions SET status = 'closed', closed_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [sessionId]
  );
  await db.run(
    `UPDATE chat_escalations SET status = 'resolved', handled_at = CURRENT_TIMESTAMP, handled_by = ?
     WHERE session_id = ? AND status IN ('pending', 'accepted')`,
    [adminUser.sub, sessionId]
  );
  await db.run(
    `INSERT INTO chat_messages (session_id, role, content, created_at)
     VALUES (?, 'system', 'Conversation clôturée par un conseiller.', CURRENT_TIMESTAMP)`,
    [sessionId]
  );
  return { session: await db.get(`SELECT * FROM chat_sessions WHERE id = ?`, [sessionId]) };
}

// Stocke un feedback 👍/👎 dans metadata_json. Ne crée pas de nouvelle table —
// metadata_json contient déjà les autres infos par message (model, usage, citations).
async function setMessageFeedback({ user, messageId, score, comment }) {
  const numScore = Number(score);
  if (numScore !== 1 && numScore !== -1) return { error: "score doit être +1 ou -1" };
  // Verrouille au scope du user : la session doit lui appartenir.
  const row = await db.get(
    `SELECT m.id, m.metadata_json, s.user_id
     FROM chat_messages m
     JOIN chat_sessions s ON s.id = m.session_id
     WHERE m.id = ? AND m.role = 'assistant'`,
    [messageId]
  );
  if (!row) return { error: "Message introuvable" };
  if (row.user_id !== user.sub) return { error: "Non autorisé" };

  const meta = typeof row.metadata_json === "string"
    ? safeJsonParse(row.metadata_json)
    : (row.metadata_json || {});
  meta.feedback = {
    score: numScore,
    comment: comment ? String(comment).slice(0, 500) : null,
    at: new Date().toISOString(),
  };
  await db.run(`UPDATE chat_messages SET metadata_json = ? WHERE id = ?`, [JSON.stringify(meta), messageId]);
  return { feedback: meta.feedback };
}

async function getPendingEscalationCount() {
  const row = await db.get(
    `SELECT COUNT(*)::int AS c FROM chat_escalations WHERE status = 'pending'`
  );
  return row?.c || 0;
}

module.exports = {
  // client
  getOrCreateActiveSession,
  loadHistory,
  streamMessage,
  requestEscalation,
  setMessageFeedback,
  // admin
  listSessions,
  getSessionDetail,
  adminReply,
  closeSession,
  getPendingEscalationCount,
};