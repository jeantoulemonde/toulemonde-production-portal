#!/usr/bin/env node
/**
 * Migration one-shot SQLite -> PostgreSQL pour le portail Toulemonde.
 *
 * Pré-requis :
 *   - Postgres tourne et la base cible existe avec le schéma chargé
 *     (psql -d <db> -f backend/sql/init_postgres.sql)
 *   - Les variables d'env POSTGRES_* sont définies (ou défauts localhost)
 *   - Le fichier SQLite source existe (par défaut backend/data/toulemonde-client.db)
 *
 * Usage :
 *   node backend/scripts/migrate_sqlite_to_postgres.js [--truncate|--upsert|--dry-run] [--ignore-orphans]
 *
 * Flags :
 *   --truncate        Vide toutes les tables PG cibles avant import (TRUNCATE ... RESTART IDENTITY CASCADE).
 *   --upsert          INSERT ... ON CONFLICT (id) DO NOTHING : ne touche pas les lignes existantes.
 *   --dry-run         Lit la SQLite et compte ce qui serait inséré, sans écrire en PG.
 *   --ignore-orphans  Continue même si l'audit FK détecte des orphelins en SQLite.
 *
 * Sans flag : refuse de tourner si une table cible est non vide (sécurité).
 */

const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { Pool } = require("pg");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const TRUNCATE = args.includes("--truncate");
const UPSERT = args.includes("--upsert");
const IGNORE_ORPHANS = args.includes("--ignore-orphans");

const SQLITE_PATH = process.env.SQLITE_PATH
  || path.join(__dirname, "..", "data", "toulemonde-client.db");

const PG_CONFIG = {
  host: process.env.POSTGRES_HOST || "localhost",
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB || "toulemonde_portal",
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : false,
};

// Tables à migrer dans l'ordre des dépendances FK.
// Les tables legacy (client_*) et la table morte catalog_product_color_variants
// sont volontairement absentes (cf. inventaire Phase 0).
const TABLES = [
  "portal_clients",
  "portal_users",
  "portal_orders",
  "portal_order_lines",
  "portal_order_specs",
  "portal_order_status_history",
  "portal_documents",
  "portal_messages",
  "audit_logs",
  "agent_status_logs",
  "sync_logs",
  "erp_pending_actions",
  "connector_settings",
  "catalog_categories",
  "catalog_products",
  "catalog_product_images",
  "product_variants",
  "catalog_articles",
  "catalog_materials",
  "catalog_yarn_counts",
  "catalog_colors",
  "catalog_conditionings",
  "catalog_orders",
  "catalog_order_lines",
];

// Couples (FK source -> cible) à vérifier en pré-vol (intégrité référentielle SQLite).
const FK_CHECKS = [
  { from: "portal_order_lines", fromCol: "portal_order_id", to: "portal_orders", toCol: "id" },
  { from: "portal_order_specs", fromCol: "order_id", to: "portal_orders", toCol: "id" },
  { from: "portal_order_status_history", fromCol: "portal_order_id", to: "portal_orders", toCol: "id" },
  { from: "portal_documents", fromCol: "order_id", to: "portal_orders", toCol: "id" },
  { from: "portal_messages", fromCol: "order_id", to: "portal_orders", toCol: "id" },
  { from: "catalog_products", fromCol: "category_id", to: "catalog_categories", toCol: "id" },
  { from: "catalog_product_images", fromCol: "product_id", to: "catalog_products", toCol: "id" },
  { from: "product_variants", fromCol: "product_id", to: "catalog_products", toCol: "id" },
  { from: "catalog_orders", fromCol: "client_id", to: "portal_clients", toCol: "id" },
  { from: "catalog_order_lines", fromCol: "catalog_order_id", to: "catalog_orders", toCol: "id" },
  { from: "catalog_order_lines", fromCol: "product_id", to: "catalog_products", toCol: "id" },
];

function sqliteAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function sqliteGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

async function checkSqliteTable(db, table) {
  const row = await sqliteGet(
    db,
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    [table]
  );
  return Boolean(row);
}

async function getSqliteColumns(db, table) {
  const rows = await sqliteAll(db, `PRAGMA table_info(${table})`);
  return rows.map((r) => r.name);
}

async function getPgColumns(client, table) {
  const result = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1`,
    [table]
  );
  return result.rows.map((r) => r.column_name);
}

async function pgTableExists(client, table) {
  const result = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
    [table]
  );
  return result.rowCount > 0;
}

async function preflightPgSchema(client) {
  console.log("[preflight] Vérification du schéma cible...");
  const missing = [];
  for (const table of TABLES) {
    if (!(await pgTableExists(client, table))) missing.push(table);
  }
  if (missing.length) {
    throw new Error(
      `Tables manquantes en PG : ${missing.join(", ")}. `
      + `Lancez d'abord : psql -d ${PG_CONFIG.database} -f backend/sql/init_postgres.sql`
    );
  }
  console.log(`[preflight] ✓ ${TABLES.length} tables présentes en PG`);
}

async function preflightPgEmpty(client) {
  if (TRUNCATE || UPSERT || DRY_RUN) return;
  console.log("[preflight] Vérification que les tables PG sont vides...");
  const nonEmpty = [];
  for (const table of TABLES) {
    const result = await client.query(`SELECT COUNT(*)::int AS c FROM "${table}"`);
    if (result.rows[0].c > 0) nonEmpty.push({ table, count: result.rows[0].c });
  }
  if (nonEmpty.length) {
    const lines = nonEmpty.map((x) => `  - ${x.table} : ${x.count} ligne(s)`).join("\n");
    throw new Error(
      `Tables non vides détectées :\n${lines}\n\n`
      + `Options :\n`
      + `  --truncate  vider toutes les tables avant import\n`
      + `  --upsert    skip conflicts, garder l'existant\n`
      + `  --dry-run   simulation uniquement\n`
    );
  }
  console.log("[preflight] ✓ toutes les tables PG sont vides");
}

async function preflightSqliteOrphans(sqliteDb) {
  console.log("[preflight] Audit intégrité référentielle SQLite...");
  const orphans = [];
  for (const fk of FK_CHECKS) {
    if (!(await checkSqliteTable(sqliteDb, fk.from))) continue;
    if (!(await checkSqliteTable(sqliteDb, fk.to))) continue;
    const rows = await sqliteAll(
      sqliteDb,
      `SELECT s.${fk.fromCol} AS missing_id, COUNT(*) AS occurrences
       FROM ${fk.from} s
       LEFT JOIN ${fk.to} t ON t.${fk.toCol} = s.${fk.fromCol}
       WHERE s.${fk.fromCol} IS NOT NULL AND t.${fk.toCol} IS NULL
       GROUP BY s.${fk.fromCol}`
    );
    if (rows.length > 0) {
      orphans.push({
        relation: `${fk.from}.${fk.fromCol} -> ${fk.to}.${fk.toCol}`,
        rows,
      });
    }
  }
  if (orphans.length === 0) {
    console.log("[preflight] ✓ aucun orphelin FK détecté");
    return;
  }
  console.log("[preflight] ⚠ orphelins détectés :");
  for (const o of orphans) {
    console.log(`  ${o.relation} :`);
    for (const r of o.rows.slice(0, 5)) {
      console.log(`    - id manquant ${r.missing_id} (${r.occurrences} ligne(s) source(s))`);
    }
    if (o.rows.length > 5) console.log(`    ... et ${o.rows.length - 5} autre(s)`);
  }
  if (!IGNORE_ORPHANS) {
    throw new Error(
      `Orphelins FK détectés en SQLite. PG va rejeter ces lignes.\n`
      + `Options : corrigez la SQLite, ou relancez avec --ignore-orphans (les lignes orphelines feront échouer leur INSERT individuel).`
    );
  }
  console.log("[preflight] ⚠ --ignore-orphans actif, on continue malgré tout");
}

async function truncateAllTables(client) {
  console.log("[truncate] TRUNCATE de toutes les tables avec CASCADE...");
  // L'ordre n'importe pas avec CASCADE, mais on liste tout en une seule commande pour atomicité.
  const tableList = TABLES.map((t) => `"${t}"`).join(", ");
  await client.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
  console.log("[truncate] ✓ tables vidées, séquences réinitialisées");
}

async function migrateTable(sqliteDb, client, table) {
  if (!(await checkSqliteTable(sqliteDb, table))) {
    console.log(`  ${table.padEnd(36)} (absent en SQLite, ignoré)`);
    return { table, source: 0, inserted: 0, skipped: 0 };
  }

  const sqliteCols = new Set(await getSqliteColumns(sqliteDb, table));
  const pgCols = new Set(await getPgColumns(client, table));
  const sharedCols = [...pgCols].filter((c) => sqliteCols.has(c));
  const droppedCols = [...sqliteCols].filter((c) => !pgCols.has(c));

  if (sharedCols.length === 0) {
    throw new Error(`Aucune colonne commune entre SQLite et PG pour ${table}`);
  }
  if (droppedCols.length > 0) {
    console.log(`  ${table} : colonnes SQLite ignorées (absentes du schéma PG) : ${droppedCols.join(", ")}`);
  }

  const colList = sharedCols.map((c) => `"${c}"`).join(", ");
  const rows = await sqliteAll(sqliteDb, `SELECT ${colList} FROM ${table}`);

  if (rows.length === 0) {
    console.log(`  ${table.padEnd(36)} 0 lignes`);
    return { table, source: 0, inserted: 0, skipped: 0 };
  }

  const placeholders = sharedCols.map((_, i) => `$${i + 1}`).join(", ");
  const onConflict = UPSERT && sharedCols.includes("id") ? " ON CONFLICT (id) DO NOTHING" : "";
  const sql = `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})${onConflict}`;

  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const values = sharedCols.map((c) => row[c]);
    if (DRY_RUN) {
      inserted += 1;
      continue;
    }
    try {
      const result = await client.query(sql, values);
      if (result.rowCount > 0) inserted += 1;
      else skipped += 1;
    } catch (err) {
      throw new Error(
        `Erreur INSERT dans ${table} (id=${row.id ?? "?"}) : ${err.message}\n`
        + `SQL : ${sql}\nValeurs : ${JSON.stringify(values)}`
      );
    }
  }

  // Reset de la séquence pour que le prochain INSERT auto-id ne collisionne pas.
  if (sharedCols.includes("id") && !DRY_RUN) {
    await client.query(
      `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM "${table}"`,
      [table]
    );
  }

  console.log(`  ${table.padEnd(36)} ${rows.length} source -> ${inserted} OK${skipped ? ` / ${skipped} skip` : ""}`);
  return { table, source: rows.length, inserted, skipped };
}

async function main() {
  console.log("====================================================");
  console.log("  Migration SQLite -> PostgreSQL (portail Toulemonde)");
  console.log("====================================================");
  console.log(`  Source SQLite : ${SQLITE_PATH}`);
  console.log(`  Cible Postgres: ${PG_CONFIG.user || "(default)"}@${PG_CONFIG.host}:${PG_CONFIG.port}/${PG_CONFIG.database}`);
  console.log(`  Mode          : ${DRY_RUN ? "DRY-RUN " : ""}${TRUNCATE ? "TRUNCATE " : ""}${UPSERT ? "UPSERT " : ""}${!DRY_RUN && !TRUNCATE && !UPSERT ? "STRICT (refus si non vide)" : ""}`);
  console.log("");

  const sqliteDb = new sqlite3.Database(SQLITE_PATH, sqlite3.OPEN_READONLY);
  const pool = new Pool(PG_CONFIG);
  const client = await pool.connect();

  try {
    await preflightPgSchema(client);
    await preflightPgEmpty(client);
    await preflightSqliteOrphans(sqliteDb);

    if (DRY_RUN) {
      console.log("\n[dry-run] aucune écriture ne sera effectuée");
    } else {
      await client.query("BEGIN");
      if (TRUNCATE) await truncateAllTables(client);
    }

    console.log("\n[migration] Import des tables :");
    const summary = [];
    for (const table of TABLES) {
      const stat = await migrateTable(sqliteDb, client, table);
      summary.push(stat);
    }

    if (!DRY_RUN) {
      await client.query("COMMIT");
    }

    const totalSource = summary.reduce((s, x) => s + x.source, 0);
    const totalInserted = summary.reduce((s, x) => s + x.inserted, 0);
    const totalSkipped = summary.reduce((s, x) => s + x.skipped, 0);

    console.log("\n====================================================");
    console.log(`  Total source   : ${totalSource} lignes`);
    console.log(`  Total inséré   : ${totalInserted} lignes`);
    if (totalSkipped) console.log(`  Total skipé    : ${totalSkipped} lignes (UPSERT)`);
    console.log(`  Mode           : ${DRY_RUN ? "DRY-RUN" : "ÉCRITURE EFFECTIVE"}`);
    console.log("====================================================");
  } catch (err) {
    if (!DRY_RUN) {
      try { await client.query("ROLLBACK"); } catch (_) {}
    }
    console.error("\n[ERREUR]", err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
    sqliteDb.close();
  }
}

main();
