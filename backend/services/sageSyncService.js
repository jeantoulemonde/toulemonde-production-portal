function createSageSyncService({ run, insertSyncLog, syncSageInboundStatuses, processPendingSageActions }) {
  async function runSageImport() {
    console.log("Sage import started");
    try {
      const result = await syncSageInboundStatuses();
      await run(
        `UPDATE connector_settings SET last_inbound_sync_at = CURRENT_TIMESTAMP, last_error = NULL WHERE connector_key = 'sage_portal'`
      );
      console.log("Sage import finished");
      return result;
    } catch (error) {
      await run(
        `UPDATE connector_settings SET last_inbound_sync_at = CURRENT_TIMESTAMP, last_error = ? WHERE connector_key = 'sage_portal'`,
        [error.message]
      ).catch(() => {});
      await insertSyncLog("SAGE_PORTAL", "sage_to_website", "error", error.message);
      console.error("Sage import error:", error.message);
      throw error;
    }
  }

  async function runSageExport() {
    console.log("Sage export started");
    try {
      const result = await processPendingSageActions();
      await run(
        `UPDATE connector_settings SET last_outbound_sync_at = CURRENT_TIMESTAMP, last_error = NULL WHERE connector_key = 'sage_portal'`
      );
      console.log("Sage export finished");
      return result;
    } catch (error) {
      await run(
        `UPDATE connector_settings SET last_outbound_sync_at = CURRENT_TIMESTAMP, last_error = ? WHERE connector_key = 'sage_portal'`,
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
  };
}

module.exports = {
  createSageSyncService,
};
