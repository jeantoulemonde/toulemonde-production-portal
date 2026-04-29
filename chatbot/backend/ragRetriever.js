// ============================================================================
// POC chatbot — module isolé, activé par CHATBOT_ENABLED.
// Retrait : voir chatbot/README.md → "Procédure de désactivation / retrait".
// ============================================================================
// Recherche vectorielle dans chat_documents (pgvector + HNSW cosinus).
// API best-effort : si Ollama est indisponible ou si pgvector n'est pas
// installé, retourne un résultat vide plutôt que de propager l'erreur — la
// conversation continue sans RAG, ce qui est moins grave qu'un chat cassé.

const { embed, callClaude } = require("./ollamaService");
const db = require("./db");
const logger = require("./logger");

const DEFAULT_TOP_K = 4;
const DEFAULT_MIN_SCORE = 0.5;   // similarité cosinus en [0,1] (1 = identique)
const DEFAULT_QUERY_MAX_LEN = 500; // tronquer pour les analytics

// Convertit un Float[] en littéral pgvector "[0.1,0.2,...]".
function vectorLiteral(vec) {
  return "[" + vec.join(",") + "]";
}

// Normalise sourceTypes en array ou null.
function normalizeSourceTypes(sourceTypes) {
  if (!sourceTypes) return null;
  if (Array.isArray(sourceTypes)) return sourceTypes.length ? sourceTypes : null;
  return [String(sourceTypes)];
}

// Insertion analytics — silencieuse en cas d'échec, pas d'await côté caller.
function logQueryAnalytics({ sessionId, queryText, topScore, resultCount, sourceTypes, durationMs }) {
  return db.run(
    `INSERT INTO chat_rag_queries
       (session_id, query_text, top_score, result_count, source_types, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      sessionId || null,
      queryText.slice(0, DEFAULT_QUERY_MAX_LEN),
      topScore,
      resultCount,
      sourceTypes ? sourceTypes.join(",") : null,
      durationMs,
    ]
  ).catch((err) => {
    logger.warn("[chatbot/rag] échec insert analytics", { error: err.message });
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Recherche principale
// ────────────────────────────────────────────────────────────────────────────
//
// Renvoie { results, topScore, durationMs }.
// `results` : Array<{ id, source_type, source_id, chunk_index, content, metadata, score }>
// `score`   : similarité cosinus dans [0,1] (= 1 - distance).
async function searchSimilar(query, opts = {}) {
  const {
    sourceTypes = null,
    topK = DEFAULT_TOP_K,
    minScore = DEFAULT_MIN_SCORE,
    sessionId = null,
  } = opts;

  if (!query || typeof query !== "string" || !query.trim()) {
    return { results: [], topScore: null, durationMs: 0 };
  }

  // 1. Embed la requête. Si Ollama tombe, on dégrade silencieusement.
  let queryVector;
  try {
    queryVector = await embed(query);
  } catch (err) {
    logger.warn("[chatbot/rag] embed indisponible, RAG désactivé pour ce tour", {
      error: err.message,
    });
    return { results: [], topScore: null, durationMs: 0 };
  }

  const vecLit = vectorLiteral(queryVector);
  const sources = normalizeSourceTypes(sourceTypes);
  const start = Date.now();

  // 2. Recherche vectorielle. Idem : si pgvector n'est pas dispo ou la table
  // n'existe pas encore, on dégrade.
  let rows = [];
  try {
    if (sources) {
      rows = await db.all(
        `SELECT id, source_type, source_id, chunk_index, content, metadata,
                1 - (embedding <=> ?::vector) AS score
         FROM chat_documents
         WHERE embedding IS NOT NULL
           AND source_type = ANY(?)
         ORDER BY embedding <=> ?::vector
         LIMIT ?`,
        [vecLit, sources, vecLit, topK]
      );
    } else {
      rows = await db.all(
        `SELECT id, source_type, source_id, chunk_index, content, metadata,
                1 - (embedding <=> ?::vector) AS score
         FROM chat_documents
         WHERE embedding IS NOT NULL
         ORDER BY embedding <=> ?::vector
         LIMIT ?`,
        [vecLit, vecLit, topK]
      );
    }
  } catch (err) {
    logger.warn("[chatbot/rag] échec recherche vectorielle", { error: err.message });
    return { results: [], topScore: null, durationMs: Date.now() - start };
  }

  const durationMs = Date.now() - start;

  // 3. Filtre sur le seuil minimal de pertinence.
  const filtered = rows
    .map((r) => ({ ...r, score: Number(r.score) }))
    .filter((r) => Number.isFinite(r.score) && r.score >= minScore);

  const topScore = filtered.length > 0 ? filtered[0].score : (rows[0] ? Number(rows[0].score) : null);

  logger.info("[chatbot/rag] recherche terminée", {
    durationMs,
    candidates: rows.length,
    kept: filtered.length,
    topScore,
    sources,
  });

  // 4. Analytics best-effort (fire-and-forget).
  logQueryAnalytics({
    sessionId,
    queryText: query,
    topScore,
    resultCount: filtered.length,
    sourceTypes: sources,
    durationMs,
  });

  return { results: filtered, topScore, durationMs };
}

// ────────────────────────────────────────────────────────────────────────────
// Formatage pour injection dans le system prompt
// ────────────────────────────────────────────────────────────────────────────
//
// Concatène les chunks pertinents dans une chaîne lisible, en respectant un
// budget de caractères pour ne pas exploser le contexte du LLM.
function formatResults(results, opts = {}) {
  const { maxChars = 2000, header = "DOCUMENTS PERTINENTS" } = opts;
  if (!results || results.length === 0) return null;

  const parts = [`=== ${header} ===`];
  let used = parts[0].length;

  for (const r of results) {
    let meta = r.metadata;
    if (typeof meta === "string") {
      try { meta = JSON.parse(meta); } catch { meta = {}; }
    }
    meta = meta || {};
    const label = meta.title || `${r.source_type}/${r.source_id}`;
    const block = `\n[${label}]\n${(r.content || "").trim()}`;
    if (used + block.length > maxChars) break;
    parts.push(block);
    used += block.length;
  }

  if (parts.length === 1) return null; // header seul, rien à injecter
  parts.push("\n=== FIN DOCUMENTS ===");
  return parts.join("");
}

// ────────────────────────────────────────────────────────────────────────────
// Rerankers
// ────────────────────────────────────────────────────────────────────────────
//
// Deux modes :
//   "keyword" — boost gratuit basé sur les tokens de la requête présents dans
//               le content/sku/title du candidat. Sub-ms, aucune dépendance.
//   "llm"     — re-scoring via le LLM principal (qwen). +2-5 s par tour,
//               à utiliser uniquement si la qualité prime sur la latence.
//
// Le score final est `score * (1 + boost)` où boost ∈ [0, 1].

const STOPWORDS_FR = new Set(["le", "la", "les", "un", "une", "des", "de", "du",
  "et", "ou", "à", "au", "aux", "en", "dans", "sur", "par", "pour", "avec",
  "sans", "que", "qui", "quoi", "est", "ce", "cet", "cette", "ces", "tu", "vous",
  "je", "il", "elle", "nous", "ils", "elles", "mon", "ton", "son", "ma", "ta",
  "sa", "mes", "tes", "ses", "y", "ne", "pas", "plus", "très", "bien", "aussi",
  "j'ai", "besoin", "cherche", "voudrais", "avez", "y a", "il y", "comment"]);

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // dé-accentuation (combining marks)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS_FR.has(w));
}

function rerankKeyword(query, candidates) {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return candidates;
  return candidates.map((c) => {
    const haystack = `${c.content || ""} ${c.source_id || ""} ${c.metadata?.title || ""} ${c.metadata?.sku || ""}`;
    const docTokens = new Set(tokenize(haystack));
    let hits = 0;
    for (const t of queryTokens) if (docTokens.has(t)) hits += 1;
    const boost = hits / queryTokens.size; // ∈ [0,1]
    return { ...c, score: c.score * (1 + boost), keyword_boost: boost };
  }).sort((a, b) => b.score - a.score);
}

async function rerankLLM(query, candidates, { keep = 2 } = {}) {
  if (candidates.length === 0) return [];
  const list = candidates.map((c, i) => {
    const title = c.metadata?.title || c.source_id;
    const snippet = (c.content || "").slice(0, 200).replace(/\s+/g, " ");
    return `[${i}] ${title}: ${snippet}`;
  }).join("\n");

  const prompt = `Tu reçois une question d'un client et une liste de documents candidats.
Pour chaque candidat, donne une note de pertinence de 0 à 10 (10 = parfaitement pertinent).
Réponds UNIQUEMENT en JSON valide, sans texte autour, format :
{"scores":[{"i":0,"s":8},{"i":1,"s":3},...]}

QUESTION : ${query}

CANDIDATS :
${list}`;

  try {
    const result = await callClaude({
      systemPrompt: "Tu évalues la pertinence de documents par rapport à une requête. Réponds toujours en JSON pur.",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 400,
      temperature: 0.1,
    });
    if (result.error) throw new Error(result.error);
    const match = (result.content || "").match(/\{[\s\S]*\}/);
    if (!match) throw new Error("réponse non-JSON");
    const json = JSON.parse(match[0]);
    const map = new Map((json.scores || []).map((s) => [s.i, s.s]));
    return candidates
      .map((c, i) => ({ ...c, llm_score: map.get(i) ?? 0 }))
      .sort((a, b) => (b.llm_score - a.llm_score) || (b.score - a.score))
      .slice(0, keep);
  } catch (err) {
    logger.warn("[chatbot/rerank] LLM rerank a échoué, fallback cosinus", { error: err.message });
    return candidates.slice(0, keep);
  }
}

// Wrapper opt-in : recherche large + rerank selon CHATBOT_RERANK_MODE.
async function searchAndRerank(query, opts = {}) {
  const mode = (process.env.CHATBOT_RERANK_MODE || "keyword").toLowerCase();
  const keep = opts.topK ?? DEFAULT_TOP_K;

  if (mode === "off") {
    return searchSimilar(query, opts);
  }

  // Pool large pour donner du grain au reranker.
  const poolMultiplier = mode === "llm" ? 4 : 3;
  const wide = await searchSimilar(query, { ...opts, topK: keep * poolMultiplier });
  if (wide.results.length === 0) return wide;

  let reranked;
  if (mode === "llm") {
    reranked = await rerankLLM(query, wide.results, { keep });
  } else {
    reranked = rerankKeyword(query, wide.results).slice(0, keep);
  }

  return {
    results: reranked,
    topScore: reranked[0]?.score ?? null,
    durationMs: wide.durationMs,
    mode,
  };
}

module.exports = {
  searchSimilar,
  searchAndRerank,
  formatResults,
  rerankKeyword,
  rerankLLM,
  // exposés pour tests
  _internals: { vectorLiteral, normalizeSourceTypes, tokenize },
};
