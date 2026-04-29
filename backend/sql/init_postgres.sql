-- backend/sql/init_postgres.sql
-- Schéma PostgreSQL du portail Toulemonde Production.
--
-- Ce fichier remplace l'init SQLite intégré (server.js initDb()).
-- Convention de typage (cf. plan de migration Phase 1) :
--   * INTEGER PRIMARY KEY AUTOINCREMENT  -> SERIAL PRIMARY KEY
--   * INTEGER (compteur)                 -> INTEGER
--   * INTEGER DEFAULT 0/1 (booléen)      -> SMALLINT DEFAULT 0/1
--                                          (le code JS envoie 0/1, on garde
--                                           SMALLINT pour zéro changement métier)
--   * TEXT                               -> TEXT
--   * REAL                               -> DOUBLE PRECISION
--   * DATETIME DEFAULT CURRENT_TIMESTAMP -> TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
--   * *_json TEXT                        -> TEXT (et non JSONB, pour ne pas
--                                          casser les JSON.parse() existants)
--
-- Toutes les contraintes sont IF NOT EXISTS / ON CONFLICT-friendly.
-- Aucun DROP. Rejouable.
--
-- Encodage : la base cible doit être UTF-8 (createdb --encoding=UTF8).

-- =====================================================================
-- 1. RACINES
-- =====================================================================

CREATE TABLE IF NOT EXISTS portal_clients (
  id                    SERIAL PRIMARY KEY,
  customer_code         TEXT UNIQUE NOT NULL,
  company_name          TEXT NOT NULL,
  contact_email         TEXT,
  is_active             SMALLINT DEFAULT 1,
  vat_number            TEXT,
  phone                 TEXT,
  billing_address       TEXT,
  billing_postal_code   TEXT,
  billing_city          TEXT,
  billing_country       TEXT,
  shipping_address      TEXT,
  shipping_postal_code  TEXT,
  shipping_city         TEXT,
  shipping_country      TEXT,
  contact_name          TEXT,
  contact_phone         TEXT,
  sage_customer_code    TEXT,
  last_sync_status      TEXT,
  last_sync_at          TIMESTAMPTZ,
  email                 TEXT,
  status                TEXT DEFAULT 'active',
  access_yarn           SMALLINT DEFAULT 1,
  access_mercerie       SMALLINT DEFAULT 1,
  created_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- 2. AUTH + COMMANDES INDUSTRIELLES
-- =====================================================================

CREATE TABLE IF NOT EXISTS portal_users (
  id                       SERIAL PRIMARY KEY,
  email                    TEXT UNIQUE NOT NULL,
  password_hash            TEXT NOT NULL,
  full_name                TEXT,
  role                     TEXT NOT NULL,
  client_code              TEXT,
  client_id                INTEGER,
  is_active                SMALLINT DEFAULT 1,
  status                   TEXT DEFAULT 'active',
  last_login_at            TIMESTAMPTZ,
  reset_token_hash         TEXT,
  reset_token_expires_at   TIMESTAMPTZ,
  last_password_reset_at   TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portal_orders (
  id                        SERIAL PRIMARY KEY,
  order_number              TEXT UNIQUE,
  client_id                 INTEGER,
  customer_code             TEXT NOT NULL,
  client_reference          TEXT,
  material                  TEXT,
  yarn_count                TEXT,
  twist                     TEXT,
  color                     TEXT,
  color_reference           TEXT,
  dyeing_required           SMALLINT DEFAULT 0,
  conditioning              TEXT,
  quantity_kg               DOUBLE PRECISION,
  requested_date            TEXT,
  requested_delivery_date   TEXT,
  urgency                   TEXT,
  destination_usage         TEXT,
  tolerance                 TEXT,
  tolerance_percent         DOUBLE PRECISION,
  partial_delivery_allowed  SMALLINT DEFAULT 0,
  comment                   TEXT,
  internal_comment          TEXT,
  status                    TEXT NOT NULL DEFAULT 'draft',
  created_by                INTEGER,
  application_type          TEXT,
  material_family           TEXT,
  material_quality          TEXT,
  count_system              TEXT,
  ply_number                TEXT,
  dtex                      TEXT,
  custom_count              TEXT,
  twist_type                TEXT,
  twist_direction           TEXT,
  finish                    TEXT,
  color_mode                TEXT,
  dyeing_comment            TEXT,
  packaging                 TEXT,
  meterage_per_unit         TEXT,
  production_comment        TEXT,
  delivery_address_choice   TEXT,
  delivery_address          TEXT,
  delivery_comment          TEXT,
  technical_file_name       TEXT,
  approval_comment          TEXT,
  approved_by               INTEGER,
  approved_at               TIMESTAMPTZ,
  sage_order_number         TEXT,
  sage_status               TEXT DEFAULT 'not_sent',
  sage_error_message        TEXT,
  sage_sent_at              TIMESTAMPTZ,
  sync_status               TEXT,
  invoice_number            TEXT,
  invoice_date              TEXT,
  invoice_total_ht          DOUBLE PRECISION,
  invoice_total_ttc         DOUBLE PRECISION,
  created_at                TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portal_order_lines (
  id                        SERIAL PRIMARY KEY,
  portal_order_id           INTEGER NOT NULL REFERENCES portal_orders(id),
  line_number               INTEGER NOT NULL,
  application_type          TEXT,
  material_family           TEXT,
  material_quality          TEXT,
  count_system              TEXT,
  yarn_count_nm             TEXT,
  dtex                      TEXT,
  custom_count              TEXT,
  ply_number                TEXT,
  twist_type                TEXT,
  twist_direction           TEXT,
  finish                    TEXT,
  color_mode                TEXT,
  color_name                TEXT,
  color_reference           TEXT,
  dyeing_required           SMALLINT DEFAULT 0,
  dyeing_comment            TEXT,
  packaging                 TEXT,
  quantity_kg               DOUBLE PRECISION,
  meterage_per_unit         TEXT,
  tolerance_percent         DOUBLE PRECISION,
  partial_delivery_allowed  SMALLINT DEFAULT 0,
  production_comment        TEXT,
  created_at                TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portal_order_specs (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER NOT NULL REFERENCES portal_orders(id),
  specs_json  TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portal_order_status_history (
  id                SERIAL PRIMARY KEY,
  portal_order_id   INTEGER NOT NULL REFERENCES portal_orders(id),
  old_status        TEXT,
  new_status        TEXT,
  source            TEXT,
  message           TEXT,
  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portal_documents (
  id              SERIAL PRIMARY KEY,
  order_id        INTEGER NOT NULL REFERENCES portal_orders(id),
  filename        TEXT NOT NULL,
  document_type   TEXT,
  storage_url     TEXT,
  source          TEXT,
  sage_reference  TEXT,
  uploaded_by     INTEGER,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portal_messages (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER NOT NULL REFERENCES portal_orders(id),
  author_id   INTEGER,
  body        TEXT NOT NULL,
  visibility  TEXT DEFAULT 'client_admin',
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- 3. AUDIT + SYNC + AGENT
-- =====================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER,
  role           TEXT,
  action         TEXT NOT NULL,
  entity_type    TEXT,
  entity_id      TEXT,
  metadata_json  TEXT,
  ip             TEXT,
  created_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_status_logs (
  id                  SERIAL PRIMARY KEY,
  agent_id            TEXT,
  status              TEXT NOT NULL,
  sage_connectivity   TEXT,
  leon_connectivity   TEXT,
  message             TEXT,
  created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_logs (
  id           SERIAL PRIMARY KEY,
  system       TEXT NOT NULL,
  direction    TEXT NOT NULL,
  status       TEXT NOT NULL,
  message      TEXT,
  entity_type  TEXT,
  entity_id    TEXT,
  created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS erp_pending_actions (
  id              SERIAL PRIMARY KEY,
  action_type     TEXT NOT NULL,
  entity_type     TEXT,
  entity_id       TEXT,
  payload_json    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING',
  result_json     TEXT,
  error_message   TEXT,
  retry_count     INTEGER DEFAULT 0,
  locked_at       TIMESTAMPTZ,
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS connector_settings (
  id                       SERIAL PRIMARY KEY,
  connector_key            TEXT UNIQUE NOT NULL,
  config_json              TEXT NOT NULL DEFAULT '{}',
  enabled                  SMALLINT DEFAULT 0,
  last_check_at            TIMESTAMPTZ,
  last_inbound_sync_at     TIMESTAMPTZ,
  last_outbound_sync_at    TIMESTAMPTZ,
  last_error               TEXT,
  created_at               TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- 4. CATALOGUE MERCERIE
-- =====================================================================

CREATE TABLE IF NOT EXISTS catalog_categories (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  description     TEXT,
  display_order   INTEGER DEFAULT 0,
  is_active       SMALLINT DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS catalog_products (
  id                  SERIAL PRIMARY KEY,
  category_id         INTEGER REFERENCES catalog_categories(id),
  sku                 TEXT UNIQUE NOT NULL,
  name                TEXT NOT NULL,
  short_description   TEXT,
  description         TEXT,
  default_image_url   TEXT,
  unit_label          TEXT DEFAULT 'pièce',
  price               DOUBLE PRECISION,
  currency            TEXT DEFAULT 'EUR',
  stock_quantity      DOUBLE PRECISION,
  is_active           SMALLINT DEFAULT 1,
  is_featured         SMALLINT DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS catalog_product_images (
  id              SERIAL PRIMARY KEY,
  product_id      INTEGER NOT NULL REFERENCES catalog_products(id),
  image_url       TEXT,
  storage_path    TEXT,
  alt_text        TEXT,
  display_order   INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_variants (
  id                    SERIAL PRIMARY KEY,
  product_id            INTEGER NOT NULL REFERENCES catalog_products(id),
  reference             TEXT UNIQUE NOT NULL,
  color_name            TEXT NOT NULL,
  color_hex             TEXT,
  image_url             TEXT,
  availability_status   TEXT DEFAULT 'available',
  created_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS catalog_articles (
  id          SERIAL PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,
  label       TEXT NOT NULL,
  family      TEXT,
  is_active   SMALLINT DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS catalog_materials (
  id          SERIAL PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,
  label       TEXT NOT NULL,
  is_active   SMALLINT DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS catalog_yarn_counts (
  id          SERIAL PRIMARY KEY,
  label       TEXT UNIQUE NOT NULL,
  is_active   SMALLINT DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS catalog_colors (
  id          SERIAL PRIMARY KEY,
  label       TEXT UNIQUE NOT NULL,
  is_active   SMALLINT DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS catalog_conditionings (
  id          SERIAL PRIMARY KEY,
  label       TEXT UNIQUE NOT NULL,
  is_active   SMALLINT DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS catalog_orders (
  id                        SERIAL PRIMARY KEY,
  client_id                 INTEGER NOT NULL REFERENCES portal_clients(id),
  order_number              TEXT UNIQUE NOT NULL,
  customer_reference        TEXT,
  status                    TEXT NOT NULL DEFAULT 'submitted',
  comment                   TEXT,
  internal_comment          TEXT,
  requested_delivery_date   TEXT,
  created_at                TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS catalog_order_lines (
  id                  SERIAL PRIMARY KEY,
  catalog_order_id    INTEGER NOT NULL REFERENCES catalog_orders(id),
  product_id          INTEGER REFERENCES catalog_products(id),
  sku                 TEXT NOT NULL,
  product_name        TEXT NOT NULL,
  quantity            DOUBLE PRECISION NOT NULL,
  unit_label          TEXT,
  unit_price          DOUBLE PRECISION,
  line_total          DOUBLE PRECISION,
  color_variant_id    INTEGER,
  variant_reference   TEXT,
  color_name          TEXT,
  color_hex           TEXT,
  created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- 5. INDEXES
-- =====================================================================

-- Repris à l'identique de la base SQLite (9 indexes utilisés en runtime)
CREATE INDEX IF NOT EXISTS idx_portal_orders_customer
  ON portal_orders(customer_code);

CREATE INDEX IF NOT EXISTS idx_portal_orders_status
  ON portal_orders(status);

CREATE INDEX IF NOT EXISTS idx_portal_order_lines_order
  ON portal_order_lines(portal_order_id);

CREATE INDEX IF NOT EXISTS idx_erp_pending_status
  ON erp_pending_actions(status);

CREATE INDEX IF NOT EXISTS idx_catalog_products_category
  ON catalog_products(category_id);

CREATE INDEX IF NOT EXISTS idx_catalog_products_active
  ON catalog_products(is_active);

CREATE INDEX IF NOT EXISTS idx_catalog_orders_client
  ON catalog_orders(client_id);

CREATE INDEX IF NOT EXISTS idx_catalog_order_lines_order
  ON catalog_order_lines(catalog_order_id);

CREATE INDEX IF NOT EXISTS idx_product_variants_product
  ON product_variants(product_id);

-- Ajouts (utiles vu les volumes : 132 audit + 709 sync + couverture client_id)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
  ON audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at
  ON sync_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_portal_orders_client_id
  ON portal_orders(client_id);

CREATE INDEX IF NOT EXISTS idx_portal_users_client_id
  ON portal_users(client_id);

-- =====================================================================
-- 6. MIGRATIONS IDEMPOTENTES (pour bases déjà créées par une version antérieure)
-- =====================================================================

-- Modules accessibles par client (yarn industriel / mercerie). Cf. README_postgres.md.
ALTER TABLE portal_clients ADD COLUMN IF NOT EXISTS access_yarn SMALLINT DEFAULT 1;
ALTER TABLE portal_clients ADD COLUMN IF NOT EXISTS access_mercerie SMALLINT DEFAULT 1;
