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
  const catalog = client.access_mercerie
    ? await db.all(
      `SELECT sku, name, COALESCE(price, 0) AS price, unit_label
       FROM catalog_products
       WHERE is_active = 1
       ORDER BY is_featured DESC, name ASC
       LIMIT 5`
    )
    : [];
  const categories = client.access_mercerie
    ? await db.all(
      `SELECT name FROM catalog_categories WHERE is_active = 1 ORDER BY display_order ASC LIMIT 10`
    )
    : [];
  return { client, recentOrders, recentMercerie, catalog, categories };
}

function formatContextText(facts) {
  if (!facts) return "Aucune information client disponible.";
  const { client, recentOrders, recentMercerie, catalog, categories } = facts;

  const modules = [];
  if (client.access_yarn) modules.push("fil industriel (yarn)");
  if (client.access_mercerie) modules.push("mercerie");

  const parts = [];
  parts.push(`SOCIÉTÉ : ${client.company_name || client.customer_code}`);
  parts.push(`MODULES ACCESSIBLES : ${modules.join(", ") || "(aucun)"}`);

  if (recentOrders.length > 0) {
    parts.push("\nDERNIÈRES COMMANDES FIL :");
    for (const o of recentOrders) {
      const qty = o.quantity_kg ? `${o.quantity_kg} kg` : "—";
      const date = o.created_at ? new Date(o.created_at).toLocaleDateString("fr-BE") : "?";
      parts.push(`  - ${o.order_number} (${date}) — ${qty} — statut : ${o.status}`);
    }
  }

  if (recentMercerie.length > 0) {
    parts.push("\nDERNIÈRES COMMANDES MERCERIE :");
    for (const o of recentMercerie) {
      const date = o.created_at ? new Date(o.created_at).toLocaleDateString("fr-BE") : "?";
      parts.push(`  - ${o.order_number} (${date}) — statut : ${o.status}`);
    }
  }

  if (catalog.length > 0) {
    parts.push("\nCATALOGUE MERCERIE (20 produits) :");
    for (const p of catalog) {
      const price = p.price ? `${Number(p.price).toFixed(2)}€/${p.unit_label || "pièce"}` : "prix sur demande";
      parts.push(`  - ${p.sku} : ${p.name} — ${price}`);
    }
    if (categories.length > 0) {
      parts.push(`\nCATÉGORIES : ${categories.map((c) => c.name).join(", ")}`);
    }
  }

  return parts.join("\n");
}

const SYSTEM_BASE = `Tu es l'assistant virtuel du portail client Toulemonde Production,
un fabricant textile belge spécialisé dans le fil industriel et la mercerie.

Ton rôle est d'aider le client connecté pour :
- rechercher un article dans le catalogue mercerie en langage naturel ;
- l'aider à pré-remplir une nouvelle commande de fil industriel ;
- répondre à une question sur le statut d'une de ses commandes ;
- fournir des informations générales sur les produits.

Règles strictes :
1. Ne parle JAMAIS de comptes, commandes ou données d'autres clients.
2. Si tu ne connais pas une information, dis-le honnêtement et propose
   au client de demander à parler à un humain via le bouton dédié.
3. Réponds court : 1-2 phrases. Plus seulement si l'utilisateur le demande
   explicitement ("explique-moi", "détaille", "raconte"). Pas de répétitions,
   pas de formules de politesse en ouverture/clôture.
4. Tu écris en français, ton professionnel mais chaleureux.
5. Tu n'inventes JAMAIS de prix, de stock, de délai ou de référence produit.
   Tu cites uniquement les informations présentes dans le contexte ci-dessous.
6. Si le client demande une action que tu ne peux pas effectuer (passer une
   commande, modifier ses coordonnées, valider un brouillon), explique-lui
   où la faire dans le portail.`;

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