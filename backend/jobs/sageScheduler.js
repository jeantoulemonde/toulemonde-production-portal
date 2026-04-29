const { sageLogger } = require("../services/loggerCategories");
const logMessages = require("../services/logMessages");

function toIntervalMs(value) {
  const seconds = Number(value || 60);
  return Math.max(seconds, 10) * 1000;
}

function createSageScheduler({ getConnectorConfig, runSageImport, runSageExport }) {
  let timer = null;
  let importRunning = false;
  let exportRunning = false;

  async function runAutomaticSync() {
    const connector = await getConnectorConfig();
    const config = connector.config || {};

    // Pas de log si désactivé : déjà loggué au boot, inutile de répéter à chaque cycle.
    if (!connector.enabled) return;

    if (config.inbound?.enabled !== false) {
      if (!importRunning) {
        importRunning = true;
        const startedAt = Date.now();
        sageLogger.debug(logMessages.sage.importStarted({ trigger: "scheduler" }), { trigger: "scheduler" });
        try {
          const result = await runSageImport();
          sageLogger.info(logMessages.sage.importDone({
            ordersUpdated: result?.ordersUpdated || result?.processed || 0,
            duration: Date.now() - startedAt,
          }), {
            duration: Date.now() - startedAt,
            ordersUpdated: result?.ordersUpdated || result?.processed || 0,
          });
        } catch (error) {
          sageLogger.error(logMessages.sage.importFailed({ duration: Date.now() - startedAt }), {
            error,
            duration: Date.now() - startedAt,
          });
        } finally {
          importRunning = false;
        }
      }
    }

    if (config.outbound?.enabled === true) {
      if (!exportRunning) {
        exportRunning = true;
        try {
          await runSageExport();
        } catch (error) {
          sageLogger.error(logMessages.sage.exportFailed(), { error });
        } finally {
          exportRunning = false;
        }
      }
    }
  }

  async function startSageScheduler() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    const connector = await getConnectorConfig();
    const config = connector.config || {};

    if (!connector.enabled) {
      sageLogger.info(logMessages.sage.schedulerSkipped({ reason: "connecteur désactivé" }));
      return;
    }

    const importEnabled = config.inbound?.enabled !== false;
    const exportEnabled = config.outbound?.enabled === true;

    if (!importEnabled && !exportEnabled) {
      sageLogger.info(logMessages.sage.schedulerSkipped({ reason: "import et export désactivés" }));
      return;
    }

    const activeIntervals = [];
    if (importEnabled) activeIntervals.push(Number(config.inbound?.intervalSeconds || 60));
    if (exportEnabled) activeIntervals.push(Number(config.outbound?.intervalSeconds || 60));
    const frequencyMs = toIntervalMs(Math.min(...activeIntervals));
    sageLogger.info(logMessages.sage.schedulerStarted({ frequencyMs }), { frequencyMs });

    timer = setInterval(() => {
      runAutomaticSync().catch((error) => {
        sageLogger.error(logMessages.sage.schedulerError(), { error });
      });
    }, frequencyMs);

    runAutomaticSync().catch((error) => {
      sageLogger.error(logMessages.sage.schedulerError(), { error, phase: "initial" });
    });
  }

  function stopSageScheduler() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    startSageScheduler,
    stopSageScheduler,
    runAutomaticSync,
  };
}

module.exports = {
  createSageScheduler,
};
