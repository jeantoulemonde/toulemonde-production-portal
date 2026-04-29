// ============================================================================
// POC chatbot — module isolé, activé par CHATBOT_ENABLED.
// Retrait : voir chatbot/README.md → "Procédure de désactivation / retrait".
// ============================================================================
// Wrapper HTTP vers Ollama (LLM local + embeddings).
// Remplace l'ancien claudeService.js. Garde la signature `callClaude` pour
// ne pas modifier chatController.js (juste le `require` qui change).

const axios = require("axios");
const logger = require("./logger");

function ollamaHost() {
  return process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
}

function defaultModel() {
  return process.env.OLLAMA_GENERATION_MODEL || "mistral:7b-instruct-v0.3-q4_K_M";
}

function defaultEmbeddingModel() {
  return process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text";
}

function defaultTimeoutMs() {
  return Number(process.env.OLLAMA_TIMEOUT_MS || 60000);
}

function defaultMaxTokens() {
  return Number(process.env.CHATBOT_MAX_TOKENS || 256);
}

// keep_alive est passé à chaque appel Ollama : tant que la valeur est non
// vide, le modèle reste chargé en RAM pour cette durée après le dernier
// appel. "24h" élimine le cold-start de ~10 s qui survient sinon après
// 5 min d'inactivité (timeout par défaut d'Ollama).
function defaultKeepAlive() {
  const v = process.env.OLLAMA_KEEP_ALIVE;
  return v === undefined ? "24h" : v; // chaîne vide = laisser Ollama décider
}

// Traduit une erreur axios/node en message lisible pour l'utilisateur.
// Renvoie { error, technical } sans throw.
function describeError(err, modelHint) {
  const code = err?.code;
  const status = err?.response?.status;
  const data = err?.response?.data;
  if (code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ENOTFOUND") {
    return {
      error: "Service IA local indisponible (Ollama). Vérifiez qu'il tourne et qu'OLLAMA_HOST est correct.",
      technical: `${code}: ${err.message}`,
    };
  }
  if (code === "ERR_CANCELED" || err?.name === "CanceledError" || err?.name === "AbortError") {
    return { error: "Génération annulée.", technical: "client aborted" };
  }
  if (code === "ECONNABORTED" || /timeout/i.test(err?.message || "")) {
    return {
      error: "Délai dépassé pour le service IA local, réessayez.",
      technical: err.message,
    };
  }
  // Ollama renvoie 404 quand le modèle n'est pas pull
  const msg = String(data?.error || err?.message || "");
  if (status === 404 || /model.*not found|pull.*model/i.test(msg)) {
    return {
      error: `Modèle Ollama non installé : ${modelHint || "?"}. Lancez "ollama pull ${modelHint || "<modèle>"}".`,
      technical: msg,
    };
  }
  return {
    error: "Erreur du service IA local.",
    technical: msg || err.message,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Génération de texte
// ────────────────────────────────────────────────────────────────────────────
//
// Signature gardée compatible avec l'ancien claudeService :
//   callClaude({ systemPrompt, messages, model, maxTokens })
//   -> { content, usage, stopReason, model }  ou  { error, technical }
//
// Extensions :
//   - `system` accepté en alias de `systemPrompt`
//   - `temperature` (défaut 0.4)
//   - `onToken(text)` callback pour le streaming (V2). Si fourni, parse NDJSON
//     et appelle onToken pour chaque chunk reçu.
async function callClaude({
  systemPrompt,
  system,
  messages,
  model,
  maxTokens,
  temperature = 0.4,
  onToken = null,
  abortSignal = null,
}) {
  const useModel = model || defaultModel();
  const useMaxTokens = maxTokens || defaultMaxTokens();
  const sys = systemPrompt || system || "";

  // Format Ollama : la liste de messages inclut le system en premier (role:'system').
  const fullMessages = [
    ...(sys ? [{ role: "system", content: sys }] : []),
    ...(messages || []),
  ];

  const body = {
    model: useModel,
    messages: fullMessages,
    options: {
      temperature,
      num_predict: useMaxTokens,
    },
    keep_alive: defaultKeepAlive(),
    stream: Boolean(onToken),
  };

  const start = Date.now();
  try {
    if (!onToken) {
      // Mode synchrone (par défaut)
      const response = await axios.post(`${ollamaHost()}/api/chat`, body, {
        timeout: defaultTimeoutMs(),
        ...(abortSignal ? { signal: abortSignal } : {}),
      });
      const data = response.data || {};
      const content = data.message?.content || "";
      const duration = Date.now() - start;
      logger.info(`Appel Ollama ${useModel} terminé en ${duration} ms`, {
        model: useModel,
        inputTokens: data.prompt_eval_count,
        outputTokens: data.eval_count,
        stopReason: data.done_reason,
        duration,
      });
      return {
        content: content.trim() || "(réponse vide)",
        usage: {
          inputTokens: data.prompt_eval_count,
          outputTokens: data.eval_count,
        },
        stopReason: data.done_reason || (data.done ? "stop" : "unknown"),
        model: useModel,
      };
    }

    // Mode streaming (NDJSON)
    const response = await axios.post(`${ollamaHost()}/api/chat`, body, {
      responseType: "stream",
      timeout: defaultTimeoutMs(),
      ...(abortSignal ? { signal: abortSignal } : {}),
    });
    let full = "";
    let lastChunk = null;
    let buffer = "";
    await new Promise((resolve, reject) => {
      response.data.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            const piece = parsed.message?.content || "";
            if (piece) {
              full += piece;
              try { onToken(piece); } catch { /* ignore */ }
            }
            if (parsed.done) lastChunk = parsed;
          } catch {
            // ligne non parseable, on l'ignore
          }
        }
      });
      response.data.on("end", resolve);
      response.data.on("error", reject);
    });
    const duration = Date.now() - start;
    logger.info(`Appel Ollama (stream) ${useModel} terminé en ${duration} ms`, {
      model: useModel,
      duration,
    });
    return {
      content: full.trim() || "(réponse vide)",
      usage: {
        inputTokens: lastChunk?.prompt_eval_count,
        outputTokens: lastChunk?.eval_count,
      },
      stopReason: lastChunk?.done_reason || "stop",
      model: useModel,
    };
  } catch (err) {
    logger.error("Échec de l'appel Ollama (génération)", { error: err, model: useModel });
    return describeError(err, useModel);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Embeddings
// ────────────────────────────────────────────────────────────────────────────
//
// Renvoie un Float[] (longueur 768 pour nomic-embed-text).
// Lève une Error en cas d'échec — les callers (ingest, retriever) doivent
// catcher et décider quoi faire.
async function embed(text) {
  if (!text || typeof text !== "string") {
    throw new Error("embed: texte requis");
  }
  const useModel = defaultEmbeddingModel();
  try {
    const response = await axios.post(
      `${ollamaHost()}/api/embed`,
      { model: useModel, input: text, keep_alive: defaultKeepAlive() },
      { timeout: defaultTimeoutMs() }
    );
    const data = response.data || {};
    const vector = (data.embeddings && data.embeddings[0]) || data.embedding || null;
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error("Réponse Ollama embed sans vecteur");
    }
    return vector;
  } catch (err) {
    const desc = describeError(err, useModel);
    const e = new Error(desc.error);
    e.technical = desc.technical;
    throw e;
  }
}

// Embeddings batch — séquentiel pour rester simple et éviter de surcharger
// Ollama (un GPU local n'aime pas trop le parallélisme massif).
async function embedBatch(texts) {
  if (!Array.isArray(texts)) throw new Error("embedBatch: tableau requis");
  const out = [];
  for (let i = 0; i < texts.length; i += 1) {
    out.push(await embed(texts[i]));
  }
  return out;
}

// Warmup : déclenche un mini-call à la génération + un mini-call à l'embed
// pour charger les 2 modèles en RAM. Idempotent, silencieux en cas d'échec
// (Ollama peut être démarré après le backend).
async function warmupModel() {
  const start = Date.now();
  try {
    await callClaude({
      systemPrompt: "Réponds 'ok'.",
      messages: [{ role: "user", content: "ping" }],
      maxTokens: 4,
      temperature: 0,
    });
    logger.info(`[chatbot] warmup génération ${defaultModel()} OK en ${Date.now() - start} ms`);
  } catch (err) {
    logger.warn("[chatbot] warmup génération échec (non bloquant)", { error: err.message });
  }
  try {
    await embed("warmup");
    logger.info(`[chatbot] warmup embed ${defaultEmbeddingModel()} OK`);
  } catch (err) {
    logger.warn("[chatbot] warmup embed échec (non bloquant)", { error: err.message });
  }
}

module.exports = { callClaude, embed, embedBatch, defaultModel, defaultEmbeddingModel, warmupModel };
