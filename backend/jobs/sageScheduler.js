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
        try {
          await runSageImport();
        } catch (error) {
          console.error("[SAGE SCHEDULER] erreur import :", error.message);
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
          console.error("[SAGE SCHEDULER] erreur export :", error.message);
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
      console.log("[SAGE SCHEDULER] non démarré : connecteur désactivé");
      return;
    }

    const importEnabled = config.inbound?.enabled !== false;
    const exportEnabled = config.outbound?.enabled === true;

    if (!importEnabled && !exportEnabled) {
      console.log("[SAGE SCHEDULER] non démarré : import/export désactivés");
      return;
    }

    const activeIntervals = [];
    if (importEnabled) activeIntervals.push(Number(config.inbound?.intervalSeconds || 60));
    if (exportEnabled) activeIntervals.push(Number(config.outbound?.intervalSeconds || 60));
    const frequencyMs = toIntervalMs(Math.min(...activeIntervals));
    console.log(`[SAGE SCHEDULER] démarré toutes les ${frequencyMs / 1000}s`);

    timer = setInterval(() => {
      runAutomaticSync().catch((error) => {
        console.error("[SAGE SCHEDULER] erreur globale :", error.message);
      });
    }, frequencyMs);

    runAutomaticSync().catch((error) => {
      console.error("[SAGE SCHEDULER] erreur initiale :", error.message);
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
