# Module Chatbot — Toulemonde Production

**POC isolé**, activable/désactivable par flags. Stack 100 % locale et gratuite :
Mistral 7B via Ollama + RAG vectoriel via pgvector. Le module pré-fetch les
commandes du client connecté et interroge un index RAG (filature, catalogue
mercerie) construit à partir de documents et du catalogue Postgres.

Le module est **complètement isolé** : 4 points d'intégration documentés au
portail principal (tous derrière des flags d'env). Trois conditions activent
ses fonctionnalités :

1. `CHATBOT_ENABLED=true` côté backend (`backend/.env`)
2. `VITE_CHATBOT_ENABLED=true` côté frontend (`frontend/.env`)
3. Ollama joignable sur `OLLAMA_HOST` (par défaut `http://127.0.0.1:11434`)
   avec les 2 modèles `mistral:7b-instruct-v0.3-q4_K_M` et `nomic-embed-text`

Si l'une de ces conditions n'est pas remplie, le module n'est ni chargé ni
exécuté — zéro impact sur le reste de l'application.

---

## Pré-requis système : Ollama + pgvector

### Sur Linux (VPS de prod)

```bash
# Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama pull mistral:7b-instruct-v0.3-q4_K_M    # ~4 GB
ollama pull nomic-embed-text                    # ~280 MB

# Configuration systemd : keep-alive 24h, écoute uniquement localhost
sudo systemctl edit ollama
# Ajouter dans le fichier :
#   [Service]
#   Environment="OLLAMA_HOST=127.0.0.1:11434"
#   Environment="OLLAMA_KEEP_ALIVE=24h"
#   Environment="OLLAMA_NUM_PARALLEL=2"
#   Environment="OLLAMA_MAX_LOADED_MODELS=2"
sudo systemctl daemon-reload
sudo systemctl restart ollama

# Validation
curl http://127.0.0.1:11434/api/tags

# pgvector
sudo apt install postgresql-16-pgvector       # ou la version Postgres installée
```

### Sur macOS (dev local)

```bash
# Ollama (CLI + service launchd)
brew install ollama
brew services start ollama
ollama pull mistral:7b-instruct-v0.3-q4_K_M
ollama pull nomic-embed-text

# pgvector — la bottle officielle ne supporte que pg17/18.
# Pour postgresql@16, recompilation depuis source :
git clone --depth 1 --branch v0.8.0 https://github.com/pgvector/pgvector.git /tmp/pgvector
cd /tmp/pgvector
PG_CONFIG=/opt/homebrew/opt/postgresql@16/bin/pg_config make
PG_CONFIG=/opt/homebrew/opt/postgresql@16/bin/pg_config make install
brew services restart postgresql@16
```

L'extension elle-même est activée automatiquement par la migration
`002_chatbot_rag.sql` au premier boot avec `CHATBOT_ENABLED=true`.

---

## Installation Node

```bash
cd chatbot
npm install
```

Cela installe `axios`, `express`, `pg` et `jsonwebtoken` dans
`chatbot/node_modules/`, indépendamment du `node_modules/` du backend principal.

## Configuration

### Côté backend — dans `backend/.env`

```
CHATBOT_ENABLED=true
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_GENERATION_MODEL=mistral:7b-instruct-v0.3-q4_K_M
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
OLLAMA_TIMEOUT_MS=60000
CHATBOT_RATE_LIMIT_PER_HOUR=30
```

### Côté frontend — dans `frontend/.env` (à créer si absent)

```
VITE_CHATBOT_ENABLED=true
```

### Démarrage

```bash
# Terminal 1
cd backend && npm start

# Terminal 2
cd frontend && npm run dev
```

Au boot du backend, le module exécute automatiquement toutes les migrations
`chatbot/backend/migrations/*.sql` (sauf les `*.down.sql`), triées par nom.
Cinq tables sont créées :

- `chat_sessions` — une session par conversation
- `chat_messages` — messages user/assistant/admin/system
- `chat_escalations` — demandes de prise en charge humaine
- `chat_documents` — documents indexés pour la recherche vectorielle (RAG)
- `chat_rag_queries` — analytics RAG (best effort)

### Indexation des connaissances (RAG)

Une fois Ollama et la migration en place :

```bash
# Catalogue mercerie : crée un embedding par produit actif
node chatbot/scripts/syncProductCatalog.js

# Documents filature : ingère les .md et .txt déposés dans chatbot/docs/filature/
node chatbot/scripts/ingestDocuments.js --source filature --dir ./chatbot/docs/filature
```

Le catalogue peut être re-synchronisé périodiquement via cron quotidien
(voir le commentaire en bas du script).

---

## Structure

```
chatbot/
├── backend/
│   ├── chatRoutes.js        Router Express, monté sur /api/chat
│   ├── chatController.js    Logique métier (conversations, escalades, RAG)
│   ├── ollamaService.js     Wrapper HTTP vers Ollama (callClaude + embed)
│   ├── ragRetriever.js      Recherche vectorielle dans chat_documents
│   ├── contextBuilder.js    Pré-fetch données client + injection RAG
│   ├── db.js                Pool PG dédié + auto-migration
│   ├── auth.js              Vérif JWT autonome
│   ├── logger.js            Proxy vers le logger principal si dispo
│   └── migrations/
│       ├── 001_create_chat_tables.sql       + .down.sql
│       └── 002_chatbot_rag.sql              + .down.sql
│
├── scripts/
│   ├── ingestDocuments.js   CLI : indexe les docs filature dans chat_documents
│   └── syncProductCatalog.js CLI : re-synchronise le catalogue dans chat_documents
│
├── docs/filature/           Documents métier à indexer (.md, .txt)
│
└── frontend/
    ├── ChatWidget.jsx        Point d'entrée (dispatch client/admin)
    ├── ChatBubbleClient.jsx  Bulle flottante côté client
    ├── AdminChatPage.jsx     Page complète accessible via /admin/chat
    ├── ChatMessage.jsx       Rendu d'un message
    ├── useChat.js            Hook état/fetch (client + admin)
    ├── apiClient.js          Wrapper fetch avec auth
    └── chatStyles.js         Styles isolés (réutilise theme.js du portail)
```

---

## Coût et performance

**Coût** : 0 € (modèle local, gratuit, Apache 2.0). Pas d'appel cloud.

**Latence** : 8-15 s par réponse sur VPS 8 vCores / 24 Go RAM. Le modèle reste
chargé en RAM (~6 Go) tant que `OLLAMA_KEEP_ALIVE=24h` est configuré, donc
seul le premier appel paie le coût de chargement (~10 s supplémentaires).

**RAM** : prévoir ~7 Go libres pour Mistral 7B q4. Si serré, basculer sur
`mistral:7b-instruct-v0.3-q3_K_M` (~3.3 Go) ou `phi3:mini` (~2.3 Go) en
adaptant `OLLAMA_GENERATION_MODEL`.

---

## Sécurité

- Le bot reçoit uniquement le contexte du client connecté (filtré par `client_id`
  du JWT). Impossible d'accéder aux données d'un autre client.
- Le system prompt rappelle au modèle qu'il ne doit jamais évoquer
  d'informations relatives à d'autres clients ni de secrets techniques.
- Pas de `tool use` (function calling) en V1 → le bot ne peut pas exécuter
  d'action sur la base de données.
- Aucun appel sortant : tout reste sur le serveur, le LLM est local.
- Rate-limit par client : `CHATBOT_RATE_LIMIT_PER_HOUR` (30 par défaut).
- Auth : JWT Bearer obligatoire sur toutes les routes `/api/chat/*`.

---

## Procédure de désactivation / retrait

Trois niveaux selon ce que tu veux faire. **Niveau 1** est instantané et sans
perte de données ; **Niveau 3** retire tout, y compris les conversations.

### Niveau 1 — Désactivation immédiate (10 secondes, 0 perte de données)

```bash
# Dans backend/.env :
CHATBOT_ENABLED=false

# Dans frontend/.env :
VITE_CHATBOT_ENABLED=false

# Redémarrer
pm2 restart toulemonde-backend
# Rebuild frontend
cd frontend && npm run build
```

Effet : la bulle disparaît côté client, l'item « Conversations » disparaît du
menu admin, les routes `/api/chat/*` retournent 404. Les conversations restent
en base, réactivables à tout moment en remettant les flags à `true`.

### Niveau 2 — Retrait du module sans purger les données (5 minutes)

```bash
# 1. Couper Ollama (libère ~6 Go de RAM si le modèle était chargé)
sudo systemctl stop ollama
sudo systemctl disable ollama
# (sur macOS dev local : brew services stop ollama)

# 2. Retirer les 4 points d'intégration au portail.
#    Chacun est marqué par "// === MODULE CHATBOT (POC, retirable) ===".
#    Fichiers à éditer manuellement :
#      - backend/server.js               → supprimer le bloc CHATBOT_ENABLED
#      - frontend/src/App.jsx            → retirer l'import + le rendu <ChatWidget />
#      - frontend/src/layouts/AdminLayout.jsx → retirer l'import + nav + Route
#      - frontend/vite.config.js         → retirer fs: { allow: [".."] } si non utilisé ailleurs

# 3. Rebuild
cd frontend && npm run build
pm2 restart toulemonde-backend
```

Effet : le code chatbot reste sur disque dans `chatbot/`, les tables `chat_*`
et le contenu indexé restent en base, mais plus aucun lien depuis le portail.
Réactivation possible en remettant les 4 blocs.

### Niveau 3 — Suppression totale (10 minutes, données chatbot perdues)

```bash
# 1. Niveau 2 (retrait des points d'intégration)

# 2. Désinstallation Ollama
sudo systemctl stop ollama && sudo systemctl disable ollama
sudo rm /usr/local/bin/ollama
sudo userdel ollama
sudo rm -rf /usr/share/ollama         # supprime les modèles téléchargés
# (sur macOS dev : brew uninstall ollama && rm -rf ~/.ollama)

# 3. Suppression des tables chatbot en base (ATTENTION : irréversible)
psql $DATABASE_URL -f chatbot/backend/migrations/002_chatbot_rag.down.sql
psql $DATABASE_URL -f chatbot/backend/migrations/001_create_chat_tables.down.sql
# (extension pgvector laissée en place — peut servir ailleurs)

# 4. Suppression du dossier
rm -rf chatbot/

# 5. Vérifier que rien ne référence "chatbot/" ou "ChatWidget"
grep -r "chatbot/" backend/ frontend/src/
grep -r "ChatWidget\|AdminChatPage" frontend/src/
# Devrait ne RIEN retourner.
```

Effet : portail retrouvé tel qu'avant le POC, à l'octet près.

### Garantie de non-régression

Après chaque niveau, lancer la suite de tests existante du portail :

```bash
cd backend && npm test
cd frontend && npm test
cd frontend && npm run build
```

Ces tests doivent tous passer **sans modification**. Si l'un échoue après le
retrait, c'est qu'une dépendance cachée a été introduite — à corriger avant
validation.
