// ============================================================================
// Cleanup scheduler — purge quotidienne (3h00) des tables qui croissent
// linéairement (audit_logs, mail_logs, sync_logs, chat_rag_queries).
// Sans ce job, la DB grossit indéfiniment ; avec, la rétention est bornée.
// Suit le pattern factory de sageScheduler.js : créer via createCleanupScheduler
// puis appeler start() depuis server.js.
// ============================================================================

const { systemLogger } = require("../services/loggerCategories");

// Rétentions par table — en jours. Override possible via env var pour tuning prod.
const RETENTIONS = [
  { table: "audit_logs",        days: Number(process.env.CLEANUP_AUDIT_DAYS || 90) },
  { table: "mail_logs",         days: Number(process.env.CLEANUP_MAIL_DAYS  || 90) },
  { table: "sync_logs",         days: Number(process.env.CLEANUP_SYNC_DAYS  || 60) },
  // chat_rag_queries n'existe que si le module chatbot a tourné au moins une
  // fois (migration créée à la demande). On try/catch dans runCleanup.
  { table: "chat_rag_queries",  days: Number(process.env.CLEANUP_RAG_DAYS   || 30) },
];

// Heure quotidienne d'exécution (default 3h00 — heure creuse).
function defaultHour() { return Number(process.env.CLEANUP_HOUR_LOCAL || 3); }
function defaultMinute() { return Number(process.env.CLEANUP_MINUTE_LOCAL || 0); }

// Calcule les ms jusqu'au prochain HH:MM local (jour suivant si déjà passé aujourd'hui).
function msUntilNext(hour, minute) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

async function purgeTable(pool, { table, days }) {
  try {
    const result = await pool.query(
      `DELETE FROM ${table} WHERE created_at < NOW() - INTERVAL '${days} days'`
    );
    return { table, days, deleted: result.rowCount || 0, ok: true };
  } catch (err) {
    // Table peut ne pas exister (chat_rag_queries si chatbot n'a jamais été
    // activé) — ce n'est pas une erreur fatale, juste un skip propre.
    const tableMissing = /relation .* does not exist/i.test(err.message || "");
    return {
      table, days, deleted: 0, ok: false,
      error: err.message,
      tableMissing,
    };
  }
}

async function runCleanup(pool) {
  const startedAt = Date.now();
  const results = [];
  for (const cfg of RETENTIONS) {
    const r = await purgeTable(pool, cfg);
    results.push(r);
  }
  const duration = Date.now() - startedAt;
  const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
  const failures = results.filter((r) => !r.ok && !r.tableMissing);

  systemLogger.info(`Cleanup quotidien terminé : ${totalDeleted} ligne(s) supprimée(s) en ${duration} ms`, {
    duration,
    totalDeleted,
    perTable: results.map((r) => ({ table: r.table, days: r.days, deleted: r.deleted, skipped: !!r.tableMissing })),
  });
  for (const f of failures) {
    systemLogger.error(`Cleanup ${f.table} a échoué : ${f.error}`, { table: f.table, error: f.error });
  }
  return { totalDeleted, duration, results };
}

function createCleanupScheduler({ pool }) {
  let timeoutHandle = null;
  let intervalHandle = null;
  let started = false;

  function scheduleNext() {
    const ms = msUntilNext(defaultHour(), defaultMinute());
    timeoutHandle = setTimeout(async () => {
      try { await runCleanup(pool); }
      catch (err) { systemLogger.error("Erreur cleanup scheduler", { error: err }); }
      // Bascule sur un setInterval 24h après le premier déclenchement.
      intervalHandle = setInterval(async () => {
        try { await runCleanup(pool); }
        catch (err) { systemLogger.error("Erreur cleanup scheduler", { error: err }); }
      }, 24 * 60 * 60 * 1000);
    }, ms);
  }

  return {
    start() {
      if (started) return;
      started = true;
      scheduleNext();
      const ms = msUntilNext(defaultHour(), defaultMinute());
      const hours = Math.floor(ms / 3600000);
      const minutes = Math.floor((ms % 3600000) / 60000);
      systemLogger.info(
        `Cleanup scheduler démarré — prochaine purge dans ${hours}h${String(minutes).padStart(2, "0")} ` +
        `(rétentions : ${RETENTIONS.map((r) => `${r.table}=${r.days}j`).join(", ")})`
      );
    },
    stop() {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (intervalHandle) clearInterval(intervalHandle);
      timeoutHandle = null;
      intervalHandle = null;
      started = false;
    },
    // Exposé pour les tests / CLI manuel.
    runOnce: () => runCleanup(pool),
  };
}

module.exports = { createCleanupScheduler };
