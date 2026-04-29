#!/usr/bin/env node
// ============================================================================
// POC chatbot — module isolé, activé par CHATBOT_ENABLED.
// Retrait : voir chatbot/README.md → "Procédure de désactivation / retrait".
// ============================================================================
// CLI : re-synchronise le catalogue mercerie (table catalog_products) dans
// chat_documents (source_type='catalogue'). Idempotent — peut tourner via cron
// quotidien sans impact sur les autres sources indexées.
//
// Pour chaque produit actif :
//   1. construit un texte canonique (sku + nom + catégorie + descriptions + prix)
//   2. embed via Ollama (nomic-embed-text → 768D)
//   3. UPSERT dans chat_documents avec source_type='catalogue', source_id=sku
// Les produits désactivés (is_active=0) ou supprimés sont retirés de l'index.
//
// Usage :
//   node chatbot/scripts/syncProductCatalog.js
//   node chatbot/scripts/syncProductCatalog.js --only SKU-1234     # un seul SKU
//   node chatbot/scripts/syncProductCatalog.js --dry               # affiche, n'écrit pas
//
// Cron quotidien suggéré (VPS) :
//   30 3 * * * cd /opt/toulemonde && /usr/bin/node chatbot/scripts/syncProductCatalog.js >> /var/log/chatbot-sync.log 2>&1

const fs = require("fs");
const path = require("path");

function loadBackendEnv() {
  const envPath = path.resolve(__dirname, "..", "..", "backend", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadBackendEnv();

const db = require("../backend/db");
const { embed } = require("../backend/ollamaService");

const SOURCE_TYPE = "catalogue";

function parseArgs(argv) {
  const out = { dry: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--only") out.only = argv[++i];
    else if (a === "--dry") out.dry = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function printHelp() {
  console.log(`Usage: node chatbot/scripts/syncProductCatalog.js [options]

Options:
  --only <sku>   ne synchronise qu'un seul produit (debug)
  --dry          affiche le texte canonique sans rien écrire
  --help, -h     affiche ceci`);
}

// Texte canonique injecté dans l'embedding. Format pensé pour que le LLM
// retrouve le produit aussi bien par nom commercial que par référence.
function buildProductText(p) {
  const parts = [];
  parts.push(`SKU : ${p.sku}`);
  parts.push(`Nom : ${p.name}`);
  if (p.category_name) parts.push(`Catégorie : ${p.category_name}`);
  if (p.short_description) parts.push(`Résumé : ${p.short_description}`);
  if (p.description) parts.push(`Description : ${p.description}`);
  if (p.price !== null && p.price !== undefined) {
    const unit = p.unit_label || "pièce";
    const currency = p.currency || "EUR";
    parts.push(`Prix : ${Number(p.price).toFixed(2)} ${currency} / ${unit}`);
  }
  return parts.join("\n");
}

function buildMetadata(p) {
  return {
    id: p.id,
    title: p.name,
    sku: p.sku,
    category: p.category_name || null,
    price: p.price,
    currency: p.currency || "EUR",
    unit_label: p.unit_label || "pièce",
    image_url: p.default_image_url || null,
    is_featured: Boolean(p.is_featured),
  };
}

async function fetchProducts(only) {
  const where = only ? `AND p.sku = ?` : "";
  const params = only ? [only] : [];
  return db.all(
    `SELECT p.id, p.sku, p.name, p.short_description, p.description,
            p.default_image_url, p.unit_label, p.price, p.currency,
            p.is_active, p.is_featured,
            c.name AS category_name
     FROM catalog_products p
     LEFT JOIN catalog_categories c ON c.id = p.category_id
     WHERE p.is_active = 1 ${where}
     ORDER BY p.sku`,
    params
  );
}

async function fetchExistingSkus() {
  const rows = await db.all(
    `SELECT source_id FROM chat_documents WHERE source_type = ?`,
    [SOURCE_TYPE]
  );
  return new Set(rows.map((r) => r.source_id));
}

async function upsertProduct(p) {
  const text = buildProductText(p);
  const metadata = buildMetadata(p);
  const vector = await embed(text);
  const vecLit = "[" + vector.join(",") + "]";
  await db.run(
    `INSERT INTO chat_documents (source_type, source_id, chunk_index, content, metadata, embedding)
     VALUES (?, ?, 0, ?, ?::jsonb, ?::vector)
     ON CONFLICT (source_type, source_id, chunk_index)
     DO UPDATE SET content = EXCLUDED.content,
                   metadata = EXCLUDED.metadata,
                   embedding = EXCLUDED.embedding,
                   updated_at = CURRENT_TIMESTAMP`,
    [SOURCE_TYPE, p.sku, text, JSON.stringify(metadata), vecLit]
  );
}

async function deleteStaleSkus(activeSkus, existingSkus) {
  let deleted = 0;
  for (const sku of existingSkus) {
    if (!activeSkus.has(sku)) {
      await db.run(
        `DELETE FROM chat_documents WHERE source_type = ? AND source_id = ?`,
        [SOURCE_TYPE, sku]
      );
      deleted += 1;
    }
  }
  return deleted;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); process.exit(0); }

  console.log(`→ Sync catalogue mercerie → chat_documents (source_type='${SOURCE_TYPE}')`);
  if (args.only) console.log(`→ Limité au SKU : ${args.only}`);
  if (args.dry) console.log("→ Mode --dry : aucune écriture en base.");

  if (!args.dry) await db.ensureMigrated();

  const products = await fetchProducts(args.only);
  console.log(`→ ${products.length} produit(s) actif(s) à indexer.`);
  if (products.length === 0) {
    if (!args.dry) await db.pool.end();
    return;
  }

  if (args.dry) {
    for (const p of products) {
      console.log("\n--- " + p.sku + " ---");
      console.log(buildProductText(p));
    }
    return;
  }

  const t0 = Date.now();
  let ok = 0;
  let failed = 0;
  for (const p of products) {
    try {
      await upsertProduct(p);
      ok += 1;
      if (ok % 25 === 0) console.log(`  ${ok}/${products.length} traités…`);
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${p.sku} : ${err.message}`);
    }
  }

  // Retire les SKU qui ne sont plus actifs (sauf en mode --only où l'on ne
  // peut pas raisonner sur l'ensemble du catalogue).
  let pruned = 0;
  if (!args.only) {
    const existing = await fetchExistingSkus();
    const activeSkus = new Set(products.map((p) => p.sku));
    pruned = await deleteStaleSkus(activeSkus, existing);
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✓ Sync terminée en ${dt}s — ${ok} OK, ${failed} échec(s), ${pruned} obsolète(s) retiré(s).`);
  await db.pool.end();
}

main().catch((e) => {
  console.error("✗ Erreur fatale :", e);
  process.exit(1);
});
