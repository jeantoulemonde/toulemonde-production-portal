#!/usr/bin/env node
// ============================================================================
// POC chatbot — module isolé, activé par CHATBOT_ENABLED.
// Retrait : voir chatbot/README.md → "Procédure de désactivation / retrait".
// ============================================================================
// CLI d'ingestion : indexe les fichiers .md / .txt d'un dossier dans
// chat_documents. Chunking par paragraphe (double saut de ligne), embed via
// Ollama, UPSERT idempotent — re-jouable autant de fois qu'on veut.
//
// Usage :
//   node chatbot/scripts/ingestDocuments.js --source filature --dir ./chatbot/docs/filature
//   node chatbot/scripts/ingestDocuments.js --source faq --dir ./chatbot/docs/faq --reset
//
// Options :
//   --source <type>   source_type stocké dans chat_documents (obligatoire)
//   --dir <path>      dossier à scanner récursivement (obligatoire)
//   --reset           supprime tous les rows de ce source_type avant ingest
//   --max-chars <n>   taille max d'un chunk (défaut 1500)
//   --min-chars <n>   un chunk plus court que ça est mergé avec le suivant (défaut 100)
//   --dry             ne fait que parser et chunker, n'écrit rien

const fs = require("fs");
const path = require("path");

// Charge l'env du backend principal pour POSTGRES_* et OLLAMA_*.
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

// ────────────────────────────────────────────────────────────────────────────
// Parsing des arguments
// ────────────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { reset: false, dry: false, maxChars: 1500, minChars: 100 };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--source") out.source = argv[++i];
    else if (a === "--dir") out.dir = argv[++i];
    else if (a === "--reset") out.reset = true;
    else if (a === "--dry") out.dry = true;
    else if (a === "--max-chars") out.maxChars = Number(argv[++i]);
    else if (a === "--min-chars") out.minChars = Number(argv[++i]);
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function printHelp() {
  console.log(`Usage: node chatbot/scripts/ingestDocuments.js --source <type> --dir <path> [options]

Options:
  --source <type>     source_type pour chat_documents (ex: filature, faq)
  --dir <path>        dossier à scanner récursivement
  --reset             supprime les rows existants de ce source_type avant ingest
  --max-chars <n>     taille max d'un chunk (défaut 1500)
  --min-chars <n>     un chunk plus court est mergé avec le suivant (défaut 100)
  --dry               parse + chunk seulement, n'écrit rien
  --help, -h          affiche ceci`);
}

// ────────────────────────────────────────────────────────────────────────────
// Walk + chunking
// ────────────────────────────────────────────────────────────────────────────
function walkDir(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkDir(full));
    else if (/\.(md|txt)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

// Chunking : par paragraphes (double newline), agrégés tant qu'on dépasse pas
// maxChars ; un paragraphe trop court est gardé avec le suivant.
function chunkText(text, { maxChars, minChars }) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+$/g, "").trim())
    .filter(Boolean);

  const chunks = [];
  let buffer = "";
  for (const p of paragraphs) {
    if (!buffer) {
      buffer = p;
      continue;
    }
    if (buffer.length < minChars || (buffer.length + p.length + 2) <= maxChars) {
      buffer = `${buffer}\n\n${p}`;
    } else {
      chunks.push(buffer);
      buffer = p;
    }
    // Si un seul paragraphe dépasse, on le coupe en sous-blocs au caractère.
    if (buffer.length > maxChars) {
      while (buffer.length > maxChars) {
        chunks.push(buffer.slice(0, maxChars));
        buffer = buffer.slice(maxChars);
      }
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

// source_id stable basé sur le chemin relatif sans extension.
function sourceIdFor(file, baseDir) {
  const rel = path.relative(baseDir, file);
  return rel.replace(/\\/g, "/").replace(/\.(md|txt)$/i, "");
}

// ────────────────────────────────────────────────────────────────────────────
// Ingest
// ────────────────────────────────────────────────────────────────────────────
async function upsertChunk({ sourceType, sourceId, chunkIndex, content, metadata, vector }) {
  const vecLit = "[" + vector.join(",") + "]";
  // ON CONFLICT s'appuie sur la contrainte unique (source_type, source_id, chunk_index).
  await db.run(
    `INSERT INTO chat_documents (source_type, source_id, chunk_index, content, metadata, embedding)
     VALUES (?, ?, ?, ?, ?::jsonb, ?::vector)
     ON CONFLICT (source_type, source_id, chunk_index)
     DO UPDATE SET content = EXCLUDED.content,
                   metadata = EXCLUDED.metadata,
                   embedding = EXCLUDED.embedding,
                   updated_at = CURRENT_TIMESTAMP`,
    [sourceType, sourceId, chunkIndex, content, JSON.stringify(metadata), vecLit]
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); process.exit(0); }
  if (!args.source || !args.dir) {
    printHelp();
    console.error("\n✗ --source et --dir sont obligatoires.");
    process.exit(1);
  }
  const dir = path.resolve(args.dir);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    console.error(`✗ Dossier introuvable : ${dir}`);
    process.exit(1);
  }

  console.log(`→ Source : ${args.source}`);
  console.log(`→ Dossier : ${dir}`);
  console.log(`→ Chunking : min=${args.minChars} max=${args.maxChars} chars`);
  if (args.dry) console.log("→ Mode --dry : aucune écriture en base.");

  const files = walkDir(dir);
  if (files.length === 0) {
    console.log("⚠ Aucun fichier .md ou .txt trouvé.");
    return;
  }
  console.log(`→ ${files.length} fichier(s) trouvé(s).`);

  if (!args.dry) {
    await db.ensureMigrated();
    if (args.reset) {
      const r = await db.run(`DELETE FROM chat_documents WHERE source_type = ?`, [args.source]);
      console.log(`→ Reset : ${r.changes} row(s) supprimé(s).`);
    }
  }

  let totalChunks = 0;
  let totalEmbeds = 0;
  const t0 = Date.now();

  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    const sourceId = sourceIdFor(file, dir);
    const chunks = chunkText(raw, { maxChars: args.maxChars, minChars: args.minChars });
    console.log(`  • ${sourceId} → ${chunks.length} chunk(s)`);

    for (let i = 0; i < chunks.length; i += 1) {
      const content = chunks[i];
      const metadata = {
        title: sourceId,
        file: path.relative(process.cwd(), file),
        chunk: i,
        totalChunks: chunks.length,
      };
      if (args.dry) {
        totalChunks += 1;
        continue;
      }
      let vector;
      try {
        vector = await embed(content);
        totalEmbeds += 1;
      } catch (err) {
        console.error(`    ✗ embed échec pour ${sourceId}#${i} : ${err.message}`);
        continue;
      }
      try {
        await upsertChunk({
          sourceType: args.source,
          sourceId,
          chunkIndex: i,
          content,
          metadata,
          vector,
        });
        totalChunks += 1;
      } catch (err) {
        console.error(`    ✗ upsert échec pour ${sourceId}#${i} : ${err.message}`);
      }
    }
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✓ Terminé en ${dt}s — ${totalChunks} chunk(s), ${totalEmbeds} embed(s).`);
  if (!args.dry) await db.pool.end();
}

main().catch((e) => {
  console.error("✗ Erreur fatale :", e);
  process.exit(1);
});
