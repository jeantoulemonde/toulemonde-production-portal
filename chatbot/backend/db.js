// ============================================================================
// POC chatbot — module isolé, activé par CHATBOT_ENABLED.
// Retrait : voir chatbot/README.md → "Procédure de désactivation / retrait".
// ============================================================================
// Pool PG dédié au module chatbot. Lit les mêmes POSTGRES_* env vars que le
// portail principal mais maintient une connexion distincte pour l'isolation.

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB || "toulemonde_portal",
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : false,
  max: 5,
});

pool.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("[chatbot] erreur idle Postgres :", err.message);
});

// Adaptation SQL : remplace ? par $1, $2, ... (compat avec le style du portail).
function adaptSql(sql) {
  let result = "";
  let paramIdx = 0;
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < sql.length; i += 1) {
    const c = sql[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    if (c === "?" && !inSingle && !inDouble) {
      paramIdx += 1;
      result += "$" + paramIdx;
    } else {
      result += c;
    }
  }
  return result;
}

async function run(sql, params = []) {
  const translated = adaptSql(sql);
  const needsReturning = /^\s*INSERT\s+INTO\s+/i.test(translated) && !/\bRETURNING\b/i.test(translated);
  const finalSql = needsReturning ? translated.replace(/;\s*$/, "") + " RETURNING id" : translated;
  const result = await pool.query(finalSql, params);
  const firstRow = result.rows && result.rows[0];
  return {
    id: firstRow && firstRow.id !== undefined ? firstRow.id : null,
    changes: result.rowCount || 0,
  };
}

async function get(sql, params = []) {
  const result = await pool.query(adaptSql(sql), params);
  return result.rows[0];
}

async function all(sql, params = []) {
  const result = await pool.query(adaptSql(sql), params);
  return result.rows;
}

let migrated = false;

// Liste les migrations à appliquer, triées par nom (001_, 002_, ...).
// Exclut les fichiers .down.sql (retrait manuel uniquement).
function listMigrationFiles() {
  const dir = path.join(__dirname, "migrations");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith(".sql") && !name.endsWith(".down.sql"))
    .sort()
    .map((name) => path.join(dir, name));
}

async function ensureMigrated() {
  if (migrated) return;
  const files = listMigrationFiles();
  for (const file of files) {
    const sql = fs.readFileSync(file, "utf8");
    try {
      await pool.query(sql);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[chatbot] échec migration ${path.basename(file)} : ${err.message}`);
      throw err;
    }
  }
  migrated = true;
}

// Migration paresseuse : déclenchée au premier appel à un helper (et silencieuse
// si déjà passée). Évite de bloquer le boot si la DB est temporairement indispo.
async function withMigration(fn) {
  await ensureMigrated();
  return fn();
}

module.exports = {
  pool,
  run: (...args) => withMigration(() => run(...args)),
  get: (...args) => withMigration(() => get(...args)),
  all: (...args) => withMigration(() => all(...args)),
  ensureMigrated,
};
