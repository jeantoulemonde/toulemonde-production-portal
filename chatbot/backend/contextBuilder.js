// ============================================================================
// POC chatbot — module isolé, activé par CHATBOT_ENABLED.
// Retrait : voir chatbot/README.md → "Procédure de désactivation / retrait".
// ============================================================================
// Construit le contexte (system prompt + données) injecté dans chaque appel Claude.
// Cache en mémoire 5 minutes par clientId pour limiter la charge DB.

const db = require("./db");

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // clientId -> { fetchedAt, payload }

function clearContextCache(clientId = null) {
  if (clientId) cache.delete(clientId);
  else cache.clear();
}

async function loadClientFacts(clientId) {
  if (!clientId) return null;
  const client = await db.get(
    `SELECT id, company_name, customer_code, access_yarn, access_mercerie
     FROM portal_clients WHERE id = ?`,
    [clientId]
  );
  if (!client) return null;
  // Le catalogue n'est plus pré-fetché ici : le RAG (chat_documents source_type='catalogue')
  // retrouve les produits pertinents par embedding, c'est plus précis et plus léger qu'une
  // liste fixe injectée à chaque tour.
  const recentOrders = await db.all(
    `SELECT order_number, status, requested_delivery_date, quantity_kg, created_at
     FROM portal_orders
     WHERE client_id = ? OR customer_code = ?
     ORDER BY id DESC LIMIT 5`,
    [clientId, client.customer_code]
  );
  const recentMercerie = await db.all(
    `SELECT order_number, status, created_at
     FROM catalog_orders
     WHERE client_id = ?
     ORDER BY id DESC LIMIT 5`,
    [clientId]
  );
  return { client, recentOrders, recentMercerie };
}

function formatContextText(facts) {
  if (!facts) return "Aucune information client disponible.";
  const { client, recentOrders, recentMercerie } = facts;

  const modules = [];
  if (client.access_yarn) modules.push("fil industriel");
  if (client.access_mercerie) modules.push("mercerie");

  const parts = [];
  parts.push(`SOCIÉTÉ : ${client.company_name || client.customer_code}`);
  parts.push(`MODULES : ${modules.join(", ") || "(aucun)"}`);

  if (recentOrders.length > 0) {
    parts.push("\nCOMMANDES FIL RÉCENTES :");
    for (const o of recentOrders) {
      const qty = o.quantity_kg ? `${o.quantity_kg}kg` : "—";
      const date = o.created_at ? new Date(o.created_at).toLocaleDateString("fr-BE") : "?";
      parts.push(`  - ${o.order_number} (${date}) ${qty} — ${o.status}`);
    }
  }

  if (recentMercerie.length > 0) {
    parts.push("\nCOMMANDES MERCERIE RÉCENTES :");
    for (const o of recentMercerie) {
      const date = o.created_at ? new Date(o.created_at).toLocaleDateString("fr-BE") : "?";
      parts.push(`  - ${o.order_number} (${date}) — ${o.status}`);
    }
  }

  return parts.join("\n");
}

const SYSTEM_BASE = `Tu es Léon, assistant Toulemonde Production (textile belge — fil & mercerie).
Réponds en 1-2 phrases, ton professionnel chaleureux, en français.
Cite UNIQUEMENT le contexte ci-dessous — n'invente JAMAIS prix, stock, délai ou SKU.
Jamais de données d'autres clients. Si tu ne sais pas : propose "parler à quelqu'un".
Pour une action que tu ne peux pas faire (commande, modif compte) : indique où dans le portail.`;

async function buildSystemPrompt({ clientId }) {
  let cached = cache.get(clientId);
  const now = Date.now();
  if (!cached || now - cached.fetchedAt > CACHE_TTL_MS) {
    const facts = await loadClientFacts(clientId);
    cached = { fetchedAt: now, payload: facts };
    cache.set(clientId, cached);
  }
  const contextText = formatContextText(cached.payload);
  return `${SYSTEM_BASE}\n\n=== CONTEXTE CLIENT ACTUEL ===\n${contextText}\n=== FIN CONTEXTE ===`;
}

module.exports = { buildSystemPrompt, clearContextCache };