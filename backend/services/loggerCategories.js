// Loggers spécialisés par catégorie. Chacun ajoute automatiquement
// le champ `category` qui est utilisé pour le routage vers le bon fichier.

const logger = require("./logger");
const messages = require("./logMessages");
const labels = require("./labels");

const apiLogger = logger.child({ category: "api" });
const authLogger = logger.child({ category: "auth" });
const orderLogger = logger.child({ category: "order" });
const sageLogger = logger.child({ category: "sage" });
const mailLogger = logger.child({ category: "mail" });
const systemLogger = logger.child({ category: "system" });

module.exports = {
  logger,
  apiLogger,
  authLogger,
  orderLogger,
  sageLogger,
  mailLogger,
  systemLogger,
  messages,
  labels,
  redactSensitive: logger.redactSensitive,
};
