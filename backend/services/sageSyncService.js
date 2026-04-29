function createSageSyncService({ run, get, insertSyncLog, syncSageInboundStatuses, processPendingSageActions }) {
  // Lot B : un agent est considéré "vivant" si un heartbeat a été reçu il y a < 60s.
  // Quand l'agent leon est actif, le scheduler interne se met en veille pour l'export
  // afin d'éviter le double-traitement.
  async function isAgentAlive() {
    if (!get) return false;
    try {
      const recent = await get(
        `SELECT 1 AS alive FROM agent_status_logs
         WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '60 seconds'
         ORDER BY id DESC LIMIT 1`
      );
      return Boolean(recent);
    } catch (err) {
      // Ne pas bloquer le scheduler si la requête échoue
      return false;
    }
  }

  async function runSageImport() {
    try {
      const result = await syncSageInboundStatuses();
      // Lot D : last_check_at reflète la dernière vérification réelle (pas seulement le bouton manuel).
      await run(
        `UPDATE connector_settings SET last_inbound_sync_at = CURRENT_TIMESTAMP, last_check_at = CURRENT_TIMESTAMP, last_error = NULL WHERE connector_key = 'sage_portal'`
      );
      return result;
    } catch (error) {
      await run(
        `UPDATE connector_settings SET last_inbound_sync_at = CURRENT_TIMESTAMP, last_check_at = CURRENT_TIMESTAMP, last_error = ? WHERE connector_key = 'sage_portal'`,
        [error.message]
      ).catch(() => {});
      await insertSyncLog("SAGE_PORTAL", "sage_to_website", "error", error.message);
      console.error("Sage import error:", error.message);
      throw error;
    }
  }

  async function runSageExport() {
    // Lot B : si l'agent leon est en ligne, il prend le relai → on skip.
    if (await isAgentAlive()) {
      return { skipped: "agent_active", checked: 0, processed: 0, failed: 0 };
    }
    try {
      const result = await processPendingSageActions();
      await run(
        `UPDATE connector_settings SET last_outbound_sync_at = CURRENT_TIMESTAMP, last_check_at = CURRENT_TIMESTAMP, last_error = NULL WHERE connector_key = 'sage_portal'`
      );
      return result;
    } catch (error) {
      await run(
        `UPDATE connector_settings SET last_outbound_sync_at = CURRENT_TIMESTAMP, last_check_at = CURRENT_TIMESTAMP, last_error = ? WHERE connector_key = 'sage_portal'`,
        [error.message]
      ).catch(() => {});
      await insertSyncLog("SAGE_PORTAL", "website_to_sage", "error", error.message);
      console.error("Sage export error:", error.message);
      throw error;
    }
  }

  return {
    runSageImport,
    runSageExport,
    isAgentAlive,
  };
}

module.exports = {
  createSageSyncService,
};
