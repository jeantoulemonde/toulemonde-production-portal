# Migration SQLite → PostgreSQL — portail Toulemonde

Procédure de bascule de la base SQLite (`backend/data/toulemonde-client.db`)
vers PostgreSQL. POC : minimum de changements de logique métier, code JS
inchangé sur tous les sites d'appel grâce aux wrappers `run/get/all`.

---

## Pré-requis

- PostgreSQL ≥ 12 (testé en 16) accessible.
- Node 18+ et les deps backend installées (`cd backend && npm install`).
  - `pg` est utilisé en runtime ; `sqlite3` est utilisé **uniquement** par le
    script de migration et peut être retiré une fois la bascule validée.

---

## Étape 1 — créer la base et charger le schéma

```bash
createdb -E UTF8 toulemonde_portal
psql -d toulemonde_portal -f backend/sql/init_postgres.sql
```

Vérification :

```bash
psql -d toulemonde_portal -c "\dt"   # doit lister 24 tables
```

---

## Étape 2 — configurer l'env

```bash
cp backend/.env.example backend/.env
# puis éditer backend/.env :
#   POSTGRES_USER, POSTGRES_PASSWORD selon ton install (Homebrew = login macOS, Docker = postgres/<mdp>)
#   JWT_SECRET, REFRESH_SECRET, AGENT_API_KEY : générer avec `openssl rand -hex 64`
```

`backend/.env` est git-ignored (cf. `.gitignore` racine).

---

## Étape 3 — importer les données SQLite

Vérifier d'abord en simulation :

```bash
cd backend
node scripts/migrate_sqlite_to_postgres.js --dry-run
```

Lecture seule, aucune écriture. Compte les lignes par table et vérifie
l'intégrité référentielle source.

Puis import réel — deux modes au choix :

```bash
# Mode propre (recommandé pour un premier import) :
node scripts/migrate_sqlite_to_postgres.js --truncate

# Mode incrémental (skip les ids déjà présents en PG) :
node scripts/migrate_sqlite_to_postgres.js --upsert
```

Sans flag, le script refuse de tourner si une table cible est non vide
(garde-fou).

Le script :

- préserve les `id` SQLite (pas de remap)
- ré-aligne les séquences PG après import (`setval` sur la valeur max)
- transactionne tout l'import (rollback global si erreur sur une table)
- ignore les tables legacy `client_*` et la table morte `catalog_product_color_variants`
  (cf. décisions de migration Phase 0)

---

## Étape 4 — démarrer le backend

```bash
cd backend
npm start
```

Tu dois voir :

```
Toulemonde client portal backend running on http://localhost:3010
[SAGE SCHEDULER] (démarré ou non selon connector_settings)
```

Health-check :

```bash
curl http://localhost:3010/api/health/db
# {"status":"ok","database":"connected"}
```

---

## Étape 5 — smoke test (manuel)

Coche au fur et à mesure :

- [ ] Login client (`client@demo.local` / `Client123!`) — backend renvoie un JWT,
      `audit_logs` reçoit une ligne `AUTH_LOGIN`.
- [ ] Login admin (`admin@toulemonde.local` / `Admin123!`) — idem.
- [ ] `GET /api/client/orders` (avec token client) — renvoie les commandes migrées.
- [ ] `GET /api/admin/dashboard` (avec token admin) — métriques cohérentes
      (clients, users, orders, pendingActions, syncErrors, pendingApproval).
- [ ] Catalogue : `GET /api/client/catalog/products` — liste les produits migrés
      avec leurs variantes couleurs.
- [ ] Création d'une commande draft via le frontend (`/client/orders/new`),
      sauvegarde puis soumission. La commande apparaît dans `/api/client/orders`
      et dans `portal_order_status_history`.
- [ ] Validation admin de la commande → ligne dans `erp_pending_actions` avec
      `action_type='CREATE_SAGE_ORDER'`, `status='pending'`.
- [ ] Connecteur Sage : depuis l'écran admin, **Tester la connexion** — répond
      OK ou KO selon la config (sans crasher le backend).
- [ ] Frontend complet : login client, naviguer entre Demandes, Documents,
      Profil, Mercerie. Aucune table vide non attendue.

---

## Étape 6 — nettoyage post-bascule

Quand le smoke test est OK et que la prod tourne :

```bash
# 1. Sortir backend/data/ du tracking git (déjà fait via .gitignore + git rm --cached)
git rm -r --cached backend/data/ 2>/dev/null
git commit -m "chore: drop SQLite DB from tracking, switched to Postgres"

# 2. Optionnel : retirer la dépendance sqlite3 (le runtime ne l'utilise plus,
#    seul le script de migration l'utilise — à laisser tant qu'on peut avoir
#    besoin de relancer la migration)
# npm uninstall sqlite3
```

⚠ La DB SQLite reste dans **l'historique git** (commits passés). Pour la purger
complètement, faire un `git filter-repo` et force-push — opération destructive
qui réécrit l'historique, à coordonner avec l'équipe.

---

## Rollback

Si la bascule pose problème :

1. Revenir au commit avant la migration côté `server.js`
   (`git checkout <sha>~ backend/server.js`).
2. La DB SQLite est toujours sur disque (`backend/data/toulemonde-client.db`).
3. Le runtime SQLite redémarre sans modification.

La DB Postgres peut être supprimée :

```bash
dropdb toulemonde_portal
```

---

## Limites connues du POC (non bloquantes)

- Les colonnes `*_json` restent en `TEXT` (pas `JSONB`) pour ne pas casser les
  `JSON.parse()` existants.
- Les booléens restent en `SMALLINT 0/1` pour préserver la convention frontend
  (`is_active === false ? 0 : 1`).
- Les FK SQLite n'étaient pas appliquées à l'exécution. Elles le sont en PG.
  Si la SQLite contient des orphelins, le pré-vol du script de migration les
  signalera.
- `LIKE` est case-sensitive en PG. Seule la recherche catalog
  (`listCatalogProducts`) a été passée en `ILIKE`. Les autres `LIKE` (génération
  de numéro de commande) opèrent sur des valeurs en majuscule, OK.
- Le connecteur SageSimu (autre base Postgres, pilotée par `connector_settings`)
  est inchangé. Il continue à utiliser un pool dédié (`withSagePool`).
