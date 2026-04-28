const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Pool } = require("pg");
const { createSageSyncService } = require("./services/sageSyncService");
const { createSageScheduler } = require("./jobs/sageScheduler");

const app = express();
const PORT = process.env.PORT || 3010;
const JWT_SECRET = process.env.JWT_SECRET || "dev-change-me";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "dev-refresh-change-me";
const AGENT_API_KEY = process.env.AGENT_API_KEY || "dev-agent-key";
const TOKEN_TTL = "8h";
const REFRESH_TTL = "7d";

const roles = ["client", "commercial", "admin_portal", "production", "super_admin"];
const ADMIN_ROLES = ["admin_portal", "commercial", "production", "super_admin"];
const PENDING_APPROVAL_STATUSES = ["pending_approval"];

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(rateLimit({ windowMs: 60 * 1000, limit: 240 }));

const dbPath = path.join(__dirname, "data", "toulemonde-client.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("Erreur connexion SQLite :", err.message);
  else console.log("Connecté à SQLite :", dbPath);
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

app.get("/api/health/db", async (req, res) => {
  try {
    await get("SELECT 1 AS ok");
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("DB connection error:", error.message);
    res.status(500).json({
      status: "error",
      database: "disconnected",
    });
  }
});

app.get("/api/health/sage", async (req, res) => {
  try {
    await testSagePortalConnection();
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("SageSimu connection error:", error.message);
    res.status(500).json({
      status: "error",
      database: "disconnected",
    });
  }
});

async function addColumnIfMissing(tableName, columnName, definition) {
  const columns = await all(`PRAGMA table_info(${tableName})`);
  if (!columns.some((column) => column.name === columnName)) {
    await run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function auditLog({ userId = null, role = null, action, entityType = null, entityId = null, metadata = null, ip = null }) {
  await run(
    `
      INSERT INTO audit_logs (user_id, role, action, entity_type, entity_id, metadata_json, ip, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `,
    [userId, role, action, entityType, entityId, metadata ? JSON.stringify(metadata) : null, ip]
  ).catch((error) => console.error("Audit log error:", error.message));
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      clientCode: user.client_code || null,
      clientId: user.client_id || null,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user.id, tokenType: "refresh" }, REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      error: "Token invalide ou expiré",
      code: "TOKEN_INVALID",
    });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({
      error: "Token invalide ou expiré",
      code: "TOKEN_INVALID",
    });
  }
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Accès refusé" });
    }

    next();
  };
}

function requireAdmin(req, res, next) {
  return requireRoles(...ADMIN_ROLES)(req, res, next);
}

function requireClient(req, res, next) {
  return requireRoles("client")(req, res, next);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function sanitizeConnectorConfig(config = {}) {
  return {
    ...config,
    password: config.password ? "********" : "",
  };
}

function normalizeConnectorConfig(config = {}) {
  return {
    type: config.type || "postgres",
    host: config.host || "localhost",
    port: Number(config.port || 5432),
    database: config.database || "",
    user: config.user || undefined,
    password: config.password || undefined,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    inbound: config.inbound || {},
    outbound: config.outbound || {},
  };
}

async function getUserClient(user) {
  if (!user) return null;
  if (user.clientId) return get(`SELECT * FROM portal_clients WHERE id = ?`, [user.clientId]);
  if (user.clientCode) return get(`SELECT * FROM portal_clients WHERE customer_code = ?`, [user.clientCode]);
  return null;
}

function agentRequired(req, res, next) {
  const key = req.headers["x-agent-api-key"];
  if (!key || key !== AGENT_API_KEY) return res.status(401).json({ error: "Clé agent invalide" });
  next();
}

async function generateOrderNumber() {
  const year = new Date().getFullYear();
  const prefix = `TP-${year}-`;
  const row = await get(
    `SELECT order_number FROM portal_orders WHERE order_number LIKE ? ORDER BY order_number DESC LIMIT 1`,
    [`${prefix}%`]
  );
  const lastNumber = row?.order_number ? Number(String(row.order_number).replace(prefix, "")) : 0;
  return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
}

function requireFields(body, fields) {
  const missing = fields.filter((field) => body[field] === undefined || body[field] === null || body[field] === "");
  return missing;
}

async function createPendingAction(actionType, payload) {
  const result = await run(
    `
      INSERT INTO erp_pending_actions (action_type, entity_type, entity_id, payload_json, status, retry_count, created_at)
      VALUES (?, ?, ?, ?, 'pending', 0, CURRENT_TIMESTAMP)
    `,
    [actionType, payload.entityType || "portal_order", payload.portalOrderId || payload.entityId || null, JSON.stringify(payload)]
  );
  return result.id;
}

function normalizeOrderLine(line = {}) {
  const countValue = line.count_system === "dtex"
    ? line.dtex
    : line.count_system === "numéro spécial / autre"
      ? line.custom_count
      : line.yarn_count_nm === "Autre"
        ? line.custom_count
        : line.yarn_count_nm || line.yarn_count;

  return {
    ...line,
    application_type: line.application_type || null,
    material_family: line.material_family || line.material || null,
    material_quality: line.material_quality || null,
    count_system: line.count_system || "Nm",
    yarn_count_nm: line.yarn_count_nm || countValue || null,
    dtex: line.dtex || null,
    custom_count: line.custom_count || null,
    ply_number: line.ply_number !== undefined ? String(line.ply_number) : null,
    twist_type: line.twist_type || line.twist || null,
    twist_direction: line.twist_direction || null,
    finish: line.finish || null,
    color_mode: line.color_mode || null,
    color_name: line.color_name || line.color || null,
    color_reference: line.color_reference || null,
    dyeing_required: line.dyeing_required ? 1 : 0,
    dyeing_comment: line.dyeing_comment || null,
    packaging: line.packaging || line.conditioning || null,
    quantity_kg: line.quantity_kg !== undefined && line.quantity_kg !== "" ? Number(line.quantity_kg) : null,
    meterage_per_unit: line.meterage_per_unit || null,
    tolerance_percent: line.tolerance_percent !== undefined && line.tolerance_percent !== "" ? Number(line.tolerance_percent) : null,
    partial_delivery_allowed: line.partial_delivery_allowed ? 1 : 0,
    production_comment: line.production_comment || line.comment || null,
    count_value: countValue || null,
  };
}

function lineValidationErrors(line) {
  const errors = [];
  if (!line.application_type) errors.push("application_type");
  if (!line.material_family) errors.push("material_family");
  if (!line.count_system) errors.push("count_system");
  if (line.count_system === "Nm" && !line.yarn_count_nm) errors.push("yarn_count_nm");
  if (line.count_system === "dtex" && !line.dtex) errors.push("dtex");
  if (line.count_system === "numéro spécial / autre" && !line.custom_count) errors.push("custom_count");
  if (!line.ply_number) errors.push("ply_number");
  if (!line.packaging) errors.push("packaging");
  if (!line.quantity_kg || Number(line.quantity_kg) <= 0) errors.push("quantity_kg");
  return errors;
}

function preparePortalOrderPayload(body = {}, { allowEmptyLines = false } = {}) {
  const bodyLines = Array.isArray(body.lines) ? body.lines : [];
  const normalizedLines = bodyLines.length
    ? bodyLines.map(normalizeOrderLine)
    : allowEmptyLines
      ? []
      : [normalizeOrderLine(body)];
  const general = {
    client_reference: body.client_reference || body.customer_reference || null,
    requested_delivery_date: body.requested_delivery_date || body.requested_date || null,
    delivery_address_choice: body.delivery_address_choice || "profile",
    delivery_address: body.delivery_address || null,
    urgent: Boolean(body.urgent || body.urgency === "urgent"),
    general_comment: body.general_comment || body.comment || null,
    delivery_comment: body.delivery_comment || null,
    technical_file_name: body.technical_file_name || null,
  };
  const firstLine = normalizedLines[0] || {};
  const totalQuantity = normalizedLines.reduce((sum, line) => sum + Number(line.quantity_kg || 0), 0);
  return { general, normalizedLines, firstLine, totalQuantity };
}

function validateSubmittedPortalOrder(general, normalizedLines) {
  const generalMissing = requireFields(general, ["client_reference", "requested_delivery_date"]);
  if (generalMissing.length) return { error: `Champs manquants : ${generalMissing.join(", ")}` };
  if (!normalizedLines.length) return { error: "Ajoutez au moins une configuration fil." };
  const lineErrors = normalizedLines
    .map((line, index) => ({ index: index + 1, missing: lineValidationErrors(line) }))
    .filter((item) => item.missing.length);
  if (lineErrors.length) return { error: "Ligne de demande incomplète", lineErrors };
  return null;
}

async function insertPortalOrderLine(orderId, line, index) {
  const normalized = normalizeOrderLine(line);
  await run(
    `
      INSERT INTO portal_order_lines (
        portal_order_id, line_number, application_type, material_family, material_quality,
        count_system, yarn_count_nm, dtex, custom_count, ply_number,
        twist_type, twist_direction, finish, color_mode, color_name,
        color_reference, dyeing_required, dyeing_comment, packaging, quantity_kg,
        meterage_per_unit, tolerance_percent, partial_delivery_allowed, production_comment,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [
      orderId,
      index + 1,
      normalized.application_type,
      normalized.material_family,
      normalized.material_quality,
      normalized.count_system,
      normalized.yarn_count_nm,
      normalized.dtex,
      normalized.custom_count,
      normalized.ply_number,
      normalized.twist_type,
      normalized.twist_direction,
      normalized.finish,
      normalized.color_mode,
      normalized.color_name,
      normalized.color_reference,
      normalized.dyeing_required,
      normalized.dyeing_comment,
      normalized.packaging,
      normalized.quantity_kg,
      normalized.meterage_per_unit,
      normalized.tolerance_percent,
      normalized.partial_delivery_allowed,
      normalized.production_comment,
    ]
  );
}

async function replacePortalOrderLines(orderId, lines) {
  await run(`DELETE FROM portal_order_lines WHERE portal_order_id = ?`, [orderId]);
  for (const [index, line] of lines.entries()) {
    await insertPortalOrderLine(orderId, line, index);
  }
}

async function updatePortalOrderRecord(orderId, general, firstLine = {}, totalQuantity = 0, status, userId) {
  await run(
    `
      UPDATE portal_orders
      SET
        client_reference = ?,
        material = ?,
        yarn_count = ?,
        ply_number = ?,
        twist = ?,
        color = ?,
        color_reference = ?,
        dyeing_required = ?,
        conditioning = ?,
        quantity_kg = ?,
        requested_date = ?,
        requested_delivery_date = ?,
        urgency = ?,
        destination_usage = ?,
        tolerance = ?,
        tolerance_percent = ?,
        comment = ?,
        partial_delivery_allowed = ?,
        application_type = ?,
        material_family = ?,
        material_quality = ?,
        count_system = ?,
        dtex = ?,
        custom_count = ?,
        twist_type = ?,
        twist_direction = ?,
        finish = ?,
        color_mode = ?,
        dyeing_comment = ?,
        packaging = ?,
        meterage_per_unit = ?,
        production_comment = ?,
        delivery_address_choice = ?,
        delivery_address = ?,
        delivery_comment = ?,
        technical_file_name = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND created_by = ?
    `,
    [
      general.client_reference,
      firstLine.material_family || null,
      firstLine.count_value || null,
      firstLine.ply_number || null,
      firstLine.twist_type || null,
      firstLine.color_name || firstLine.color_mode || null,
      firstLine.color_reference || null,
      firstLine.dyeing_required || 0,
      firstLine.packaging || null,
      totalQuantity,
      general.requested_delivery_date,
      general.requested_delivery_date,
      general.urgent ? "urgent" : "normal",
      firstLine.application_type || null,
      firstLine.tolerance_percent !== null && firstLine.tolerance_percent !== undefined ? String(firstLine.tolerance_percent) : null,
      firstLine.tolerance_percent || null,
      general.general_comment,
      firstLine.partial_delivery_allowed || 0,
      firstLine.application_type || null,
      firstLine.material_family || null,
      firstLine.material_quality || null,
      firstLine.count_system || null,
      firstLine.dtex || null,
      firstLine.custom_count || null,
      firstLine.twist_type || null,
      firstLine.twist_direction || null,
      firstLine.finish || null,
      firstLine.color_mode || null,
      firstLine.dyeing_comment || null,
      firstLine.packaging || null,
      firstLine.meterage_per_unit || null,
      firstLine.production_comment || null,
      general.delivery_address_choice,
      general.delivery_address,
      general.delivery_comment,
      general.technical_file_name,
      status,
      orderId,
      userId,
    ]
  );
}

async function getSagePortalConnector() {
  const row = await get(`SELECT * FROM connector_settings WHERE connector_key = 'sage_portal'`);
  const config = row ? normalizeConnectorConfig(JSON.parse(row.config_json || "{}")) : normalizeConnectorConfig();
  return { row, config, enabled: Boolean(row?.enabled) };
}

function assertSageConfig(connector) {
  if (!connector.enabled) throw new Error("Connecteur Sage désactivé");
  if (connector.config.type !== "postgres") throw new Error("Seul le mode PostgreSQL SageSimu est supporté pour ce flux");
  if (!connector.config.host || !connector.config.database) throw new Error("Configuration SageSimu incomplète");
}

async function withSagePool(callback) {
  const connector = await getSagePortalConnector();
  assertSageConfig(connector);
  const pool = new Pool({
    host: connector.config.host,
    port: connector.config.port,
    database: connector.config.database,
    user: connector.config.user,
    password: connector.config.password,
    ssl: connector.config.ssl,
  });

  try {
    return await callback(pool, connector.config);
  } finally {
    await pool.end();
  }
}

async function testSagePortalConnection() {
  return withSagePool(async (pool) => {
    const result = await pool.query("SELECT 1 AS ok");
    return { ok: result.rows[0]?.ok === 1 };
  });
}

function sageDocumentPiece(order) {
  return order.sage_order_number || order.order_number || `TP-${order.id}`;
}

function sageCustomerCode(order, client) {
  return client?.sage_customer_code || client?.customer_code || order.customer_code;
}

function orderLineLabel(order) {
  return [
    order.material,
    order.yarn_count,
    order.ply_number ? `${order.ply_number} plis` : null,
    order.color,
  ].filter(Boolean).join(" - ") || "Commande filature";
}

function legacyOrderAsLine(order) {
  if (!order) return null;
  return {
    id: null,
    portal_order_id: order.id,
    line_number: 1,
    application_type: order.application_type || order.destination_usage || null,
    material_family: order.material_family || order.material || null,
    material_quality: order.material_quality || null,
    count_system: order.count_system || (order.dtex ? "dtex" : "Nm"),
    yarn_count_nm: order.count_system === "dtex" ? null : order.yarn_count || null,
    dtex: order.dtex || null,
    custom_count: order.custom_count || null,
    ply_number: order.ply_number || null,
    twist_type: order.twist_type || order.twist || null,
    twist_direction: order.twist_direction || null,
    finish: order.finish || null,
    color_mode: order.color_mode || null,
    color_name: order.color || null,
    color_reference: order.color_reference || null,
    dyeing_required: order.dyeing_required || 0,
    dyeing_comment: order.dyeing_comment || null,
    packaging: order.packaging || order.conditioning || null,
    quantity_kg: order.quantity_kg || null,
    meterage_per_unit: order.meterage_per_unit || null,
    tolerance_percent: order.tolerance_percent || null,
    partial_delivery_allowed: order.partial_delivery_allowed || 0,
    production_comment: order.production_comment || order.comment || null,
  };
}

async function getPortalOrderLines(order) {
  const lines = await all(
    `SELECT * FROM portal_order_lines WHERE portal_order_id = ? ORDER BY line_number ASC, id ASC`,
    [order.id]
  );
  if (lines.length) return lines;
  const legacyLine = legacyOrderAsLine(order);
  return legacyLine && (legacyLine.material_family || legacyLine.quantity_kg || legacyLine.application_type) ? [legacyLine] : [];
}

function orderLineLabelFromLine(line) {
  const count = line.count_system === "dtex"
    ? line.dtex && `${line.dtex} dtex`
    : line.yarn_count_nm || line.custom_count;
  return [
    line.material_family,
    count,
    line.ply_number ? `${line.ply_number} plis` : null,
    line.color_name || line.color_mode,
  ].filter(Boolean).join(" - ") || "Configuration fil";
}

function quotePgIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

async function getPgTableColumns(db, tableName) {
  const result = await db.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
    `,
    [tableName]
  );
  return new Set(result.rows.map((row) => row.column_name));
}

function filterPgValues(columns, valuesByColumn) {
  return Object.entries(valuesByColumn).filter(([column]) => columns.has(column));
}

async function insertPgRow(db, tableName, valuesByColumn, options = {}) {
  const columns = await getPgTableColumns(db, tableName);
  const entries = filterPgValues(columns, valuesByColumn);
  if (!entries.length) throw new Error(`Aucune colonne compatible trouvée pour ${tableName}`);

  const columnSql = entries.map(([column]) => quotePgIdentifier(column)).join(", ");
  const placeholders = entries.map((_, index) => `$${index + 1}`).join(", ");
  const values = entries.map(([, value]) => value);
  let conflictSql = "";

  if (options.conflictColumn && columns.has(options.conflictColumn)) {
    const updateColumns = (options.updateColumns || [])
      .filter((column) => columns.has(column) && column !== options.conflictColumn && entries.some(([entryColumn]) => entryColumn === column));
    conflictSql = updateColumns.length
      ? ` ON CONFLICT (${quotePgIdentifier(options.conflictColumn)}) DO UPDATE SET ${updateColumns
        .map((column) => `${quotePgIdentifier(column)} = EXCLUDED.${quotePgIdentifier(column)}`)
        .join(", ")}`
      : ` ON CONFLICT (${quotePgIdentifier(options.conflictColumn)}) DO NOTHING`;
  }

  await db.query(
    `INSERT INTO ${quotePgIdentifier(tableName)} (${columnSql}) VALUES (${placeholders})${conflictSql}`,
    values
  );
}

async function updatePgRows(db, tableName, valuesByColumn, whereColumn, whereValue) {
  const columns = await getPgTableColumns(db, tableName);
  if (!columns.has(whereColumn)) return false;
  const entries = filterPgValues(columns, valuesByColumn).filter(([column]) => column !== whereColumn);
  if (!entries.length) return false;

  const assignments = entries.map(([column], index) => `${quotePgIdentifier(column)} = $${index + 1}`).join(", ");
  const values = entries.map(([, value]) => value);
  values.push(whereValue);

  const result = await db.query(
    `UPDATE ${quotePgIdentifier(tableName)} SET ${assignments} WHERE ${quotePgIdentifier(whereColumn)} = $${values.length}`,
    values
  );
  return result.rowCount > 0;
}

async function ensureGenericSageArticle(db) {
  const columns = await getPgTableColumns(db, "F_ARTICLE");
  if (!columns.has("AR_Ref")) return;

  await insertPgRow(
    db,
    "F_ARTICLE",
    {
      AR_Ref: "FIL-SPECIFIQUE",
      AR_Design: "Fil spécifique portail client",
      PORTAL_GENERIC: true,
    },
    {
      conflictColumn: "AR_Ref",
      updateColumns: ["AR_Design", "PORTAL_GENERIC"],
    }
  );
}

async function upsertSageCustomer(pool, client, config) {
  const customerCode = client.sage_customer_code || client.customer_code;
  if (!customerCode) throw new Error("Code client Sage manquant");
  const columns = await getPgTableColumns(pool, "F_COMPTET");

  const customerValues = {
    CT_Num: customerCode,
    CT_Intitule: client.company_name,
    CT_Adresse: client.billing_address || client.shipping_address || null,
    CT_CodePostal: client.billing_postal_code || client.shipping_postal_code || null,
    CT_Ville: client.billing_city || client.shipping_city || null,
    CT_Pays: client.billing_country || client.shipping_country || null,
    CT_Email: client.email || client.contact_email || null,
    CT_Telephone: client.phone || client.contact_phone || null,
    CT_NumTVA: client.vat_number || null,
    CT_Type: 0,
    PORTAL_CLIENT_ID: client.id || null,
    PORTAL_CLIENT_EMAIL: client.email || client.contact_email || null,
    PORTAL_VAT_NUMBER: client.vat_number || null,
  };

  if (columns.has("CT_Num")) {
    const existing = await pool.query(`SELECT "CT_Num" FROM "F_COMPTET" WHERE "CT_Num" = $1`, [customerCode]);
    if (existing.rowCount > 0) {
      await updatePgRows(pool, "F_COMPTET", customerValues, "CT_Num", customerCode);
      return customerCode;
    }
  } else if (columns.has("PORTAL_CLIENT_ID") && client.id) {
    const existing = await pool.query(`SELECT "PORTAL_CLIENT_ID" FROM "F_COMPTET" WHERE "PORTAL_CLIENT_ID" = $1`, [client.id]);
    if (existing.rowCount > 0) {
      await updatePgRows(pool, "F_COMPTET", customerValues, "PORTAL_CLIENT_ID", client.id);
      return customerCode;
    }
  }

  if (config.outbound?.createCustomerEnabled === false) {
    throw new Error(`Client ${customerCode} absent dans SageSimu et création client désactivée`);
  }

  await insertPgRow(pool, "F_COMPTET", customerValues, {
    conflictColumn: "CT_Num",
    updateColumns: [
      "CT_Intitule",
      "CT_Adresse",
      "CT_CodePostal",
      "CT_Ville",
      "CT_Pays",
      "CT_Email",
      "CT_Telephone",
      "CT_NumTVA",
      "PORTAL_CLIENT_ID",
      "PORTAL_CLIENT_EMAIL",
      "PORTAL_VAT_NUMBER",
    ],
  });

  return customerCode;
}

async function createSageOrderForPortalOrder(pool, actionPayload, config) {
  if (config.outbound?.createOrderEnabled === false) throw new Error("Création commande Sage désactivée");

  const order = await get(`SELECT * FROM portal_orders WHERE id = ?`, [actionPayload.portalOrderId || actionPayload.entityId]);
  if (!order) throw new Error("Commande portail introuvable");
  if (order.status !== "approved") throw new Error("Seule une commande approuvée peut être envoyée vers SageSimu");
  if (order.sage_order_number) {
    return { sageOrderNumber: order.sage_order_number, alreadySent: true };
  }

  const client = await get(`SELECT * FROM portal_clients WHERE id = ? OR customer_code = ?`, [order.client_id || -1, order.customer_code]);
  if (!client) throw new Error("Client portail introuvable");

  const piece = sageDocumentPiece(order);
  const customerCode = await upsertSageCustomer(pool, client, config);
  const docColumns = await getPgTableColumns(pool, "F_DOCENTETE");
  if (docColumns.has("DO_Piece")) {
    const existing = await pool.query(`SELECT "DO_Piece" FROM "F_DOCENTETE" WHERE "DO_Piece" = $1`, [piece]);
    if (existing.rowCount > 0) {
      return { sageOrderNumber: piece, alreadySent: true };
    }
  } else if (docColumns.has("PORTAL_ORDER_ID")) {
    const existing = await pool.query(`SELECT "PORTAL_ORDER_ID" FROM "F_DOCENTETE" WHERE "PORTAL_ORDER_ID" = $1`, [order.id]);
    if (existing.rowCount > 0) {
      return { sageOrderNumber: piece, alreadySent: true };
    }
  }

  const sageClient = await pool.connect();
  try {
    await sageClient.query("BEGIN");
    await ensureGenericSageArticle(sageClient);
    await insertPgRow(
      sageClient,
      "F_DOCENTETE",
      {
        DO_Piece: piece,
        DO_Type: 1,
        DO_Date: new Date().toISOString().slice(0, 10),
        DO_Tiers: customerCode,
        DO_Ref: order.client_reference || order.order_number,
        DO_Statut: 2,
        DO_TotalHT: null,
        DO_TotalTTC: null,
        DO_DateLivr: order.requested_delivery_date || null,
        PORTAL_ORDER_ID: order.id,
        PORTAL_ORDER_NUMBER: order.order_number || null,
        PORTAL_CUSTOMER_REFERENCE: order.client_reference || null,
        PORTAL_STATUS: order.status || null,
        PORTAL_URGENT: order.urgency === "urgent",
        PORTAL_GENERAL_COMMENT: order.general_comment || order.comment || null,
        PORTAL_CREATED_AT: order.created_at || null,
      },
      {
        conflictColumn: "DO_Piece",
        updateColumns: [
          "DO_Tiers",
          "DO_Ref",
          "DO_Statut",
          "DO_DateLivr",
          "PORTAL_ORDER_ID",
          "PORTAL_ORDER_NUMBER",
          "PORTAL_CUSTOMER_REFERENCE",
          "PORTAL_STATUS",
          "PORTAL_URGENT",
          "PORTAL_GENERAL_COMMENT",
          "PORTAL_CREATED_AT",
        ],
      }
    );

    const orderLines = await getPortalOrderLines(order);
    const linesToSend = orderLines.length ? orderLines : [legacyOrderAsLine(order)];
    for (const line of linesToSend.filter(Boolean)) {
      await insertPgRow(sageClient, "F_DOCLIGNE", {
        DO_Piece: piece,
        DO_Type: 1,
        AR_Ref: "FIL-SPECIFIQUE",
        DL_Design: orderLineLabelFromLine(line) || orderLineLabel(order),
        DL_Qte: line.quantity_kg || 0,
        DL_PrixUnitaire: null,
        DL_MontantHT: null,
        DL_Largeur: null,
        DL_Longueur: null,
        DL_Couleur: line.color_name || line.color_mode || order.color || null,
        DL_Lot: `${order.client_reference || order.order_number}-L${line.line_number || 1}`,
        PORTAL_LINE_ID: line.id || null,
        PORTAL_ORDER_ID: order.id,
        PORTAL_LINE_NUMBER: line.line_number || null,
        PORTAL_APPLICATION_TYPE: line.application_type || null,
        PORTAL_MATERIAL_FAMILY: line.material_family || null,
        PORTAL_MATERIAL_QUALITY: line.material_quality || null,
        PORTAL_COUNT_SYSTEM: line.count_system || null,
        PORTAL_YARN_COUNT_NM: line.yarn_count_nm || null,
        PORTAL_DTEX: line.dtex || null,
        PORTAL_PLY_NUMBER: line.ply_number || null,
        PORTAL_TWIST_TYPE: line.twist_type || null,
        PORTAL_TWIST_DIRECTION: line.twist_direction || null,
        PORTAL_FINISH: line.finish || null,
        PORTAL_COLOR_MODE: line.color_mode || null,
        PORTAL_COLOR_NAME: line.color_name || null,
        PORTAL_COLOR_REFERENCE: line.color_reference || null,
        PORTAL_DYEING_REQUIRED: Boolean(line.dyeing_required),
        PORTAL_PACKAGING: line.packaging || null,
        PORTAL_QUANTITY_KG: line.quantity_kg || null,
        PORTAL_TOLERANCE_PERCENT: line.tolerance_percent || null,
        PORTAL_PRODUCTION_COMMENT: line.production_comment || null,
      });
    }

    await sageClient.query("COMMIT");
    return { sageOrderNumber: piece, alreadySent: false };
  } catch (error) {
    await sageClient.query("ROLLBACK");
    throw error;
  } finally {
    sageClient.release();
  }
}

async function insertStatusHistory(orderId, oldStatus, newStatus, source, message) {
  await run(
    `INSERT INTO portal_order_status_history (portal_order_id, old_status, new_status, source, message) VALUES (?, ?, ?, ?, ?)`,
    [orderId, oldStatus, newStatus, source, message]
  );
}

async function insertSyncLog(system, direction, status, message, entityType = null, entityId = null) {
  await run(
    `INSERT INTO sync_logs (system, direction, status, message, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [system, direction, status, message, entityType, entityId]
  );
}

async function scheduleSageOrderAction(order, reason = "Commande validée") {
  if (order.sage_order_number) return { actionId: null, skipped: true, reason: "Commande déjà envoyée vers Sage" };
  if (order.status === "draft") return { actionId: null, skipped: true, reason: "Brouillon non transmissible vers Sage" };
  if (order.status !== "approved") return { actionId: null, skipped: true, reason: "Commande non approuvée" };

  const existing = await get(
    `
      SELECT id FROM erp_pending_actions
      WHERE action_type = 'CREATE_SAGE_ORDER'
        AND entity_type = 'portal_order'
        AND entity_id = ?
        AND status IN ('pending', 'PENDING', 'processing')
      ORDER BY id DESC
      LIMIT 1
    `,
    [String(order.id)]
  );

  if (existing) return { actionId: existing.id, skipped: true, reason: "Action Sage déjà en attente" };

  const actionId = await createPendingAction("CREATE_SAGE_ORDER", {
    portalOrderId: order.id,
    entityType: "portal_order",
    entityId: order.id,
    orderNumber: order.order_number,
    customerCode: order.customer_code,
    reason,
  });

  await run(
    `UPDATE portal_orders SET sage_status = 'pending', sage_error_message = NULL, sync_status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [order.id]
  );
  return { actionId, skipped: false };
}

async function processPendingSageActions() {
  const actions = await all(
    `
      SELECT * FROM erp_pending_actions
      WHERE action_type = 'CREATE_SAGE_ORDER'
        AND status IN ('pending', 'PENDING', 'failed', 'ERROR')
      ORDER BY id ASC
      LIMIT 20
    `
  );
  const results = [];

  for (const action of actions) {
    const payload = JSON.parse(action.payload_json || "{}");
    await run(`UPDATE erp_pending_actions SET status = 'processing', locked_at = CURRENT_TIMESTAMP WHERE id = ?`, [action.id]);

    try {
      const result = await withSagePool((pool, config) => createSageOrderForPortalOrder(pool, payload, config));
      const order = await get(`SELECT * FROM portal_orders WHERE id = ?`, [payload.portalOrderId]);
      await run(
        `
          UPDATE erp_pending_actions
          SET status = 'DONE', result_json = ?, processed_at = CURRENT_TIMESTAMP, error_message = NULL
          WHERE id = ?
        `,
        [JSON.stringify(result), action.id]
      );
      await run(
        `
          UPDATE portal_orders
          SET sage_order_number = ?,
              sage_status = 'sent',
              sage_error_message = NULL,
              sage_sent_at = CURRENT_TIMESTAMP,
              sync_status = 'success',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [result.sageOrderNumber, payload.portalOrderId]
      );
      await insertDocumentIfMissing(payload.portalOrderId, "order_confirmation", `confirmation-${result.sageOrderNumber}.pdf`, "sage", result.sageOrderNumber);
      await insertSyncLog("SAGE_PORTAL", "website_to_sage", "success", `Commande ${payload.orderNumber || payload.portalOrderId} envoyée vers SageSimu`, "portal_order", String(payload.portalOrderId));
      results.push({ actionId: action.id, success: true, result });
    } catch (error) {
      await run(
        `
          UPDATE erp_pending_actions
          SET status = 'ERROR', error_message = ?, processed_at = CURRENT_TIMESTAMP, retry_count = retry_count + 1
          WHERE id = ?
        `,
        [error.message, action.id]
      );
      const order = await get(`SELECT * FROM portal_orders WHERE id = ?`, [payload.portalOrderId]);
      if (order) {
        await run(
          `UPDATE portal_orders SET sage_status = 'error', sage_error_message = ?, sync_status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [error.message, order.id]
        );
      }
      await insertSyncLog("SAGE_PORTAL", "website_to_sage", "error", error.message, "portal_order", String(payload.portalOrderId || ""));
      results.push({ actionId: action.id, success: false, error: error.message });
    }
  }

  return {
    checked: actions.length,
    processed: results.filter((item) => item.success).length,
    failed: results.filter((item) => !item.success).length,
    results,
  };
}

function mapSageStatusToPortal(status) {
  const numeric = Number(status);
  if (numeric >= 5) return "delivered";
  if (numeric === 4) return "ready";
  if (numeric === 3) return "in_production";
  if (numeric === 2) return "sent_to_sage";
  return "pending_sage_sync";
}

async function insertDocumentIfMissing(orderId, documentType, fileName, source, sageReference) {
  const existing = await get(
    `SELECT id FROM portal_documents WHERE order_id = ? AND document_type = ? AND COALESCE(sage_reference, '') = COALESCE(?, '')`,
    [orderId, documentType, sageReference || ""]
  );
  if (existing) return null;
  const result = await run(
    `
      INSERT INTO portal_documents (order_id, filename, document_type, storage_url, source, sage_reference, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `,
    [orderId, fileName, documentType, null, source, sageReference || null]
  );
  return result.id;
}

async function syncSageInboundStatuses() {
  const orders = await all(
    `
      SELECT * FROM portal_orders
      WHERE sage_order_number IS NOT NULL
        AND sage_order_number <> ''
        AND status NOT IN ('delivered', 'cancelled')
      ORDER BY id ASC
    `
  );
  const results = [];

  await withSagePool(async (pool) => {
    for (const order of orders) {
      try {
        const sage = await pool.query(
          `
            SELECT "DO_Piece", "DO_Statut", "DO_TotalHT", "DO_TotalTTC", "DO_DateLivr", "DO_Ref"
            FROM "F_DOCENTETE"
            WHERE "DO_Piece" = $1
          `,
          [order.sage_order_number]
        );
        const row = sage.rows[0];
        if (!row) {
          results.push({ orderId: order.id, updated: false, reason: "Commande absente de SageSimu" });
          continue;
        }

        const nextStatus = mapSageStatusToPortal(row.DO_Statut ?? row.do_statut);
        const updateFields = nextStatus === "sent_to_sage"
          ? [
            "sage_status = 'sent'",
            "sync_status = 'synced'",
            "updated_at = CURRENT_TIMESTAMP",
          ]
          : [
            "status = ?",
            "sync_status = 'synced'",
            "updated_at = CURRENT_TIMESTAMP",
          ];
        const updateValues = nextStatus === "sent_to_sage" ? [] : [nextStatus];

        if (row.DO_TotalHT !== undefined || row.do_totalht !== undefined) {
          updateFields.push("invoice_total_ht = ?");
          updateValues.push(row.DO_TotalHT ?? row.do_totalht);
        }
        if (row.DO_TotalTTC !== undefined || row.do_totalttc !== undefined) {
          updateFields.push("invoice_total_ttc = ?");
          updateValues.push(row.DO_TotalTTC ?? row.do_totalttc);
        }
        updateValues.push(order.id);
        await run(`UPDATE portal_orders SET ${updateFields.join(", ")} WHERE id = ?`, updateValues);

        if (nextStatus !== "sent_to_sage" && order.status !== nextStatus) {
          await insertStatusHistory(order.id, order.status, nextStatus, "sage", "Statut synchronisé depuis SageSimu");
        }

        await insertDocumentIfMissing(order.id, "order_confirmation", `confirmation-${order.sage_order_number}.pdf`, "sage", order.sage_order_number);
        if (["ready", "delivered"].includes(nextStatus)) {
          await insertDocumentIfMissing(order.id, "delivery_note", `bon-livraison-${order.sage_order_number}.pdf`, "sage", order.sage_order_number);
        }
        if (nextStatus === "delivered") {
          await insertDocumentIfMissing(order.id, "invoice", `facture-${order.sage_order_number}.pdf`, "sage", order.sage_order_number);
        }

        results.push({ orderId: order.id, sageOrderNumber: order.sage_order_number, updated: order.status !== nextStatus, status: nextStatus });
      } catch (error) {
        results.push({ orderId: order.id, updated: false, error: error.message });
        await insertSyncLog("SAGE_PORTAL", "sage_to_website", "error", error.message, "portal_order", String(order.id));
      }
    }
  });

  const updated = results.filter((item) => item.updated).length;
  await insertSyncLog("SAGE_PORTAL", "sage_to_website", "success", `${updated} statut(s) mis à jour depuis SageSimu`, null, null);
  return { checked: orders.length, updated, results };
}

const sageSyncService = createSageSyncService({
  run,
  insertSyncLog,
  syncSageInboundStatuses,
  processPendingSageActions,
});

const sageScheduler = createSageScheduler({
  getConnectorConfig: getSagePortalConnector,
  runSageImport: sageSyncService.runSageImport,
  runSageExport: sageSyncService.runSageExport,
});

async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS portal_clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_code TEXT UNIQUE NOT NULL,
      company_name TEXT NOT NULL,
      contact_email TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS portal_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      role TEXT NOT NULL,
      client_id INTEGER,
      client_code TEXT,
      is_active INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS portal_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE,
      client_id INTEGER,
      customer_code TEXT NOT NULL,
      client_reference TEXT,
      material TEXT,
      yarn_count TEXT,
      twist TEXT,
      color TEXT,
      dyeing_required INTEGER DEFAULT 0,
      conditioning TEXT,
      quantity_kg REAL,
      requested_date TEXT,
      urgency TEXT,
      destination_usage TEXT,
      tolerance TEXT,
      comment TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS portal_order_specs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      specs_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES portal_orders(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS portal_order_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      portal_order_id INTEGER NOT NULL,
      line_number INTEGER NOT NULL,
      application_type TEXT,
      material_family TEXT,
      material_quality TEXT,
      count_system TEXT,
      yarn_count_nm TEXT,
      dtex TEXT,
      custom_count TEXT,
      ply_number TEXT,
      twist_type TEXT,
      twist_direction TEXT,
      finish TEXT,
      color_mode TEXT,
      color_name TEXT,
      color_reference TEXT,
      dyeing_required INTEGER DEFAULT 0,
      dyeing_comment TEXT,
      packaging TEXT,
      quantity_kg REAL,
      meterage_per_unit TEXT,
      tolerance_percent REAL,
      partial_delivery_allowed INTEGER DEFAULT 0,
      production_comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(portal_order_id) REFERENCES portal_orders(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS portal_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      document_type TEXT,
      storage_url TEXT,
      uploaded_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES portal_orders(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS portal_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      author_id INTEGER,
      body TEXT NOT NULL,
      visibility TEXT DEFAULT 'client_admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES portal_orders(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS erp_pending_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      result_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME,
      retry_count INTEGER DEFAULT 0,
      locked_at DATETIME
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS agent_status_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT,
      status TEXT NOT NULL,
      sage_connectivity TEXT,
      leon_connectivity TEXT,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      system TEXT NOT NULL,
      direction TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      entity_type TEXT,
      entity_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS connector_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connector_key TEXT UNIQUE NOT NULL,
      config_json TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER DEFAULT 0,
      last_check_at DATETIME,
      last_inbound_sync_at DATETIME,
      last_outbound_sync_at DATETIME,
      last_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS portal_order_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      portal_order_id INTEGER NOT NULL,
      old_status TEXT,
      new_status TEXT,
      source TEXT,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(portal_order_id) REFERENCES portal_orders(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      metadata_json TEXT,
      ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS catalog_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      family TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS catalog_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS catalog_yarn_counts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT UNIQUE NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS catalog_colors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT UNIQUE NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS catalog_conditionings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT UNIQUE NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`CREATE INDEX IF NOT EXISTS idx_portal_orders_customer ON portal_orders(customer_code)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_portal_orders_status ON portal_orders(status)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_portal_order_lines_order ON portal_order_lines(portal_order_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_erp_pending_status ON erp_pending_actions(status)`);

  await addColumnIfMissing("erp_pending_actions", "locked_at", "DATETIME");
  await addColumnIfMissing("erp_pending_actions", "entity_type", "TEXT");
  await addColumnIfMissing("erp_pending_actions", "entity_id", "TEXT");
  await addColumnIfMissing("erp_pending_actions", "error_message", "TEXT");
  await addColumnIfMissing("portal_clients", "vat_number", "TEXT");
  await addColumnIfMissing("portal_clients", "email", "TEXT");
  await addColumnIfMissing("portal_clients", "phone", "TEXT");
  await addColumnIfMissing("portal_clients", "billing_address", "TEXT");
  await addColumnIfMissing("portal_clients", "billing_postal_code", "TEXT");
  await addColumnIfMissing("portal_clients", "billing_city", "TEXT");
  await addColumnIfMissing("portal_clients", "billing_country", "TEXT");
  await addColumnIfMissing("portal_clients", "shipping_address", "TEXT");
  await addColumnIfMissing("portal_clients", "shipping_postal_code", "TEXT");
  await addColumnIfMissing("portal_clients", "shipping_city", "TEXT");
  await addColumnIfMissing("portal_clients", "shipping_country", "TEXT");
  await addColumnIfMissing("portal_clients", "contact_name", "TEXT");
  await addColumnIfMissing("portal_clients", "contact_phone", "TEXT");
  await addColumnIfMissing("portal_clients", "sage_customer_code", "TEXT");
  await addColumnIfMissing("portal_clients", "status", "TEXT DEFAULT 'active'");
  await addColumnIfMissing("portal_clients", "last_sync_status", "TEXT");
  await addColumnIfMissing("portal_clients", "last_sync_at", "DATETIME");
  await addColumnIfMissing("portal_orders", "client_id", "INTEGER");
  await addColumnIfMissing("portal_orders", "sage_order_number", "TEXT");
  await addColumnIfMissing("portal_orders", "approval_comment", "TEXT");
  await addColumnIfMissing("portal_orders", "approved_by", "INTEGER");
  await addColumnIfMissing("portal_orders", "approved_at", "DATETIME");
  await addColumnIfMissing("portal_orders", "sage_status", "TEXT DEFAULT 'not_sent'");
  await addColumnIfMissing("portal_orders", "sage_error_message", "TEXT");
  await addColumnIfMissing("portal_orders", "sage_sent_at", "DATETIME");
  await addColumnIfMissing("portal_orders", "requested_delivery_date", "TEXT");
  await addColumnIfMissing("portal_orders", "sync_status", "TEXT");
  await addColumnIfMissing("portal_orders", "internal_comment", "TEXT");
  await addColumnIfMissing("portal_orders", "ply_number", "TEXT");
  await addColumnIfMissing("portal_orders", "color_reference", "TEXT");
  await addColumnIfMissing("portal_orders", "tolerance_percent", "REAL");
  await addColumnIfMissing("portal_orders", "partial_delivery_allowed", "INTEGER DEFAULT 0");
  await addColumnIfMissing("portal_orders", "application_type", "TEXT");
  await addColumnIfMissing("portal_orders", "material_family", "TEXT");
  await addColumnIfMissing("portal_orders", "material_quality", "TEXT");
  await addColumnIfMissing("portal_orders", "count_system", "TEXT");
  await addColumnIfMissing("portal_orders", "dtex", "TEXT");
  await addColumnIfMissing("portal_orders", "custom_count", "TEXT");
  await addColumnIfMissing("portal_orders", "twist_type", "TEXT");
  await addColumnIfMissing("portal_orders", "twist_direction", "TEXT");
  await addColumnIfMissing("portal_orders", "finish", "TEXT");
  await addColumnIfMissing("portal_orders", "color_mode", "TEXT");
  await addColumnIfMissing("portal_orders", "dyeing_comment", "TEXT");
  await addColumnIfMissing("portal_orders", "packaging", "TEXT");
  await addColumnIfMissing("portal_orders", "meterage_per_unit", "TEXT");
  await addColumnIfMissing("portal_orders", "production_comment", "TEXT");
  await addColumnIfMissing("portal_orders", "delivery_address_choice", "TEXT");
  await addColumnIfMissing("portal_orders", "delivery_address", "TEXT");
  await addColumnIfMissing("portal_orders", "delivery_comment", "TEXT");
  await addColumnIfMissing("portal_orders", "technical_file_name", "TEXT");
  await run(`UPDATE portal_orders SET sage_status = 'not_sent' WHERE sage_status IS NULL OR sage_status = ''`);
  await run(`UPDATE portal_orders SET status = 'pending_approval' WHERE status = 'submitted'`);
  await addColumnIfMissing("portal_orders", "invoice_number", "TEXT");
  await addColumnIfMissing("portal_orders", "invoice_date", "TEXT");
  await addColumnIfMissing("portal_orders", "invoice_total_ht", "REAL");
  await addColumnIfMissing("portal_orders", "invoice_total_ttc", "REAL");
  await addColumnIfMissing("portal_users", "status", "TEXT DEFAULT 'active'");
  await addColumnIfMissing("portal_users", "client_id", "INTEGER");
  await addColumnIfMissing("portal_users", "last_login_at", "DATETIME");
  await addColumnIfMissing("portal_users", "reset_token_hash", "TEXT");
  await addColumnIfMissing("portal_users", "reset_token_expires_at", "DATETIME");
  await addColumnIfMissing("portal_users", "last_password_reset_at", "DATETIME");
  await addColumnIfMissing("sync_logs", "entity_type", "TEXT");
  await addColumnIfMissing("sync_logs", "entity_id", "TEXT");
  await addColumnIfMissing("portal_documents", "source", "TEXT");
  await addColumnIfMissing("portal_documents", "sage_reference", "TEXT");

  await run(
    `INSERT OR IGNORE INTO portal_clients (customer_code, company_name, contact_email) VALUES (?, ?, ?)`,
    ["CLI-DEMO", "Maison Dupont", "client@demo.local"]
  );
  const demoClient = await get(`SELECT id FROM portal_clients WHERE customer_code = ?`, ["CLI-DEMO"]);

  const adminExists = await get(`SELECT id FROM portal_users WHERE email = ?`, ["admin@toulemonde.local"]);
  if (!adminExists) {
    await run(
      `
        INSERT INTO portal_users (email, password_hash, full_name, role, client_code, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `,
      [
        "admin@toulemonde.local",
        await bcrypt.hash("Admin123!", 12),
        "Admin Toulemonde",
        "super_admin",
        null,
      ]
    );
  }

  const clientExists = await get(`SELECT id FROM portal_users WHERE email = ?`, ["client@demo.local"]);
  if (!clientExists) {
    await run(
      `
        INSERT INTO portal_users (email, password_hash, full_name, role, client_code, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `,
      [
        "client@demo.local",
        await bcrypt.hash("Client123!", 12),
        "Client Demo",
        "client",
        "CLI-DEMO",
      ]
    );
  }
  if (demoClient) {
    await run(`UPDATE portal_users SET client_id = ? WHERE client_code = ? AND client_id IS NULL`, [demoClient.id, "CLI-DEMO"]);
    await run(`UPDATE portal_orders SET client_id = ? WHERE customer_code = ? AND client_id IS NULL`, [demoClient.id, "CLI-DEMO"]);
  }
}

initDb()
  .then(() => sageScheduler.startSageScheduler())
  .catch((error) => {
    console.error("Erreur init DB portail :", error);
  });

app.get("/api/health", (req, res) => {
  res.json({ ok: true, app: "toulemonde-client-portal" });
});

async function loginWithRoles(req, res, allowedRoles, redirectTo) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email et password requis" });

    const user = await get(`SELECT * FROM portal_users WHERE email = ? AND is_active = 1 AND COALESCE(status, 'active') = 'active'`, [email]);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      await auditLog({ action: "AUTH_LOGIN_FAILED", metadata: { email }, ip: req.ip });
      return res.status(401).json({ error: "Identifiants invalides" });
    }
    if (!allowedRoles.includes(user.role)) {
      await auditLog({ userId: user.id, role: user.role, action: "AUTH_LOGIN_FORBIDDEN_ROLE", metadata: { email, redirectTo }, ip: req.ip });
      return res.status(403).json({ error: "Ce compte n'est pas autorisé sur cet espace." });
    }

    const publicUser = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      clientId: user.client_id,
      clientCode: user.client_code,
    };

    await auditLog({ userId: user.id, role: user.role, action: "AUTH_LOGIN", ip: req.ip });
    await run(`UPDATE portal_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?`, [user.id]);

    res.json({
      accessToken: signAccessToken(user),
      refreshToken: signRefreshToken(user),
      user: publicUser,
      redirectTo,
    });
  } catch (error) {
    console.error("Erreur login :", error.message);
    res.status(500).json({ error: "Erreur authentification" });
  }
}

app.post("/api/auth/client/login", async (req, res) => {
  return loginWithRoles(req, res, ["client"], "/client");
});

app.post("/api/auth/admin/login", async (req, res) => {
  return loginWithRoles(req, res, ADMIN_ROLES, "/admin");
});

app.post("/api/auth/login", async (req, res) => {
  return loginWithRoles(req, res, roles, "/client");
});

app.get("/api/auth/me", authRequired, async (req, res) => {
  const user = await get(`SELECT id, email, full_name, role, client_id, client_code, is_active, status FROM portal_users WHERE id = ?`, [req.user.sub]);
  if (!user || !user.is_active || user.status === "disabled") return res.status(401).json({ error: "Session invalide" });
  res.json({ id: user.id, email: user.email, fullName: user.full_name, role: user.role, clientId: user.client_id, clientCode: user.client_code });
});

async function forgotPasswordForRoles(req, res, allowedRoles, resetPrefix) {
  try {
    const { email } = req.body || {};
    const generic = { success: true, message: "Si le compte existe, un lien de réinitialisation a été préparé." };
    if (!email) return res.json(generic);

    const user = await get(`SELECT * FROM portal_users WHERE email = ? AND is_active = 1 AND COALESCE(status, 'active') = 'active'`, [email]);
    if (!user || !allowedRoles.includes(user.role)) return res.json(generic);

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await run(
      `UPDATE portal_users SET reset_token_hash = ?, reset_token_expires_at = ? WHERE id = ?`,
      [hashToken(token), expiresAt, user.id]
    );
    await auditLog({ userId: user.id, role: user.role, action: "AUTH_PASSWORD_RESET_REQUEST", entityType: "portal_user", entityId: String(user.id), ip: req.ip });

    res.json({
      ...generic,
      resetLink: process.env.NODE_ENV === "production" ? undefined : `${resetPrefix}/${token}`,
    });
  } catch (error) {
    console.error("Erreur forgot password :", error.message);
    res.json({ success: true, message: "Si le compte existe, un lien de réinitialisation a été préparé." });
  }
}

async function resetPasswordForRoles(req, res, allowedRoles) {
  try {
    const { token, password } = req.body || {};
    if (!token || !password || password.length < 10) {
      return res.status(400).json({ error: "Mot de passe invalide. Minimum 10 caractères." });
    }

    const tokenHash = hashToken(token);
    const user = await get(
      `SELECT * FROM portal_users WHERE reset_token_hash = ? AND reset_token_expires_at > ? AND is_active = 1`,
      [tokenHash, new Date().toISOString()]
    );
    if (!user || !allowedRoles.includes(user.role)) return res.status(400).json({ error: "Lien invalide ou expiré" });

    await run(
      `
        UPDATE portal_users
        SET password_hash = ?, reset_token_hash = NULL, reset_token_expires_at = NULL, last_password_reset_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [await bcrypt.hash(password, 12), user.id]
    );
    await auditLog({ userId: user.id, role: user.role, action: "AUTH_PASSWORD_RESET_DONE", entityType: "portal_user", entityId: String(user.id), ip: req.ip });
    res.json({ success: true });
  } catch (error) {
    console.error("Erreur reset password :", error.message);
    res.status(500).json({ error: "Erreur réinitialisation mot de passe" });
  }
}

app.post("/api/auth/client/forgot-password", async (req, res) => {
  return forgotPasswordForRoles(req, res, ["client"], "/client/reset-password");
});

app.post("/api/auth/admin/forgot-password", async (req, res) => {
  return forgotPasswordForRoles(req, res, ADMIN_ROLES, "/admin/reset-password");
});

app.post("/api/auth/forgot-password", async (req, res) => {
  return forgotPasswordForRoles(req, res, roles, "/reset-password");
});

app.post("/api/auth/client/reset-password", async (req, res) => {
  return resetPasswordForRoles(req, res, ["client"]);
});

app.post("/api/auth/admin/reset-password", async (req, res) => {
  return resetPasswordForRoles(req, res, ADMIN_ROLES);
});

app.post("/api/auth/reset-password", async (req, res) => {
  return resetPasswordForRoles(req, res, roles);
});

app.post("/api/auth/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);
    const user = await get(`SELECT * FROM portal_users WHERE id = ? AND is_active = 1`, [payload.sub]);
    if (!user) return res.status(401).json({ error: "Session invalide" });
    res.json({ accessToken: signAccessToken(user) });
  } catch {
    res.status(401).json({ error: "Refresh token invalide" });
  }
});

app.post("/api/auth/logout", authRequired, async (req, res) => {
  await auditLog({ userId: req.user.sub, role: req.user.role, action: "AUTH_LOGOUT", ip: req.ip });
  res.json({ success: true });
});

async function listClientOrders(req, res) {
  try {
    const client = await getUserClient(req.user);
    if (!client) return res.status(404).json({ error: "Client introuvable" });
    const orders = await all(
      `
        SELECT
          o.*,
          COALESCE(line_stats.line_count, CASE WHEN o.quantity_kg IS NOT NULL THEN 1 ELSE 0 END) AS line_count,
          COALESCE(line_stats.total_quantity_kg, o.quantity_kg, 0) AS total_quantity_kg,
          first_line.application_type AS first_application_type,
          first_line.material_family AS first_material_family,
          first_line.material_quality AS first_material_quality,
          first_line.yarn_count_nm AS first_yarn_count_nm,
          first_line.dtex AS first_dtex,
          first_line.custom_count AS first_custom_count,
          first_line.color_name AS first_color_name,
          first_line.packaging AS first_packaging
        FROM portal_orders o
        LEFT JOIN (
          SELECT portal_order_id, COUNT(*) AS line_count, SUM(quantity_kg) AS total_quantity_kg
          FROM portal_order_lines
          GROUP BY portal_order_id
        ) line_stats ON line_stats.portal_order_id = o.id
        LEFT JOIN portal_order_lines first_line ON first_line.portal_order_id = o.id AND first_line.line_number = 1
        WHERE o.client_id = ? OR o.customer_code = ?
        ORDER BY o.id DESC
      `,
      [client.id, client.customer_code]
    );
    res.json(orders);
  } catch (error) {
    console.error("Erreur lecture commandes :", error.message);
    res.status(500).json({ error: "Erreur lecture commandes" });
  }
}

app.get("/api/client/orders", authRequired, requireClient, listClientOrders);
app.get("/api/orders", authRequired, listClientOrders);

async function createPortalOrder(req, res) {
  try {
    const body = req.body || {};
    const status = body.status === "draft" ? "draft" : "pending_approval";
    const { general, normalizedLines, firstLine, totalQuantity } = preparePortalOrderPayload(body, { allowEmptyLines: status === "draft" });
    const validationError = status === "pending_approval" ? validateSubmittedPortalOrder(general, normalizedLines) : null;
    if (validationError) return res.status(400).json(validationError);

    const client = req.user.role === "client" ? await getUserClient(req.user) : null;
    const customerCode = client?.customer_code || body.customer_code;
    const clientId = client?.id || body.client_id || null;
    if (!customerCode) return res.status(400).json({ error: "customer_code requis" });

    const orderNumber = await generateOrderNumber();
    const result = await run(
      `
        INSERT INTO portal_orders (
          order_number,
          client_id,
          customer_code,
          client_reference,
          material,
          yarn_count,
          ply_number,
          twist,
          color,
          color_reference,
          dyeing_required,
          conditioning,
          quantity_kg,
          requested_date,
          requested_delivery_date,
          urgency,
          destination_usage,
          tolerance,
          tolerance_percent,
          comment,
          partial_delivery_allowed,
          application_type,
          material_family,
          material_quality,
          count_system,
          dtex,
          custom_count,
          twist_type,
          twist_direction,
          finish,
          color_mode,
          dyeing_comment,
          packaging,
          meterage_per_unit,
          production_comment,
          delivery_address_choice,
          delivery_address,
          delivery_comment,
          technical_file_name,
          sage_status,
          status,
          created_by,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      [
        orderNumber,
        clientId,
        customerCode,
        general.client_reference,
        firstLine.material_family || null,
        firstLine.count_value || null,
        firstLine.ply_number || null,
        firstLine.twist_type || null,
        firstLine.color_name || firstLine.color_mode || null,
        firstLine.color_reference || null,
        firstLine.dyeing_required || 0,
        firstLine.packaging || null,
        totalQuantity,
        general.requested_delivery_date,
        general.requested_delivery_date,
        general.urgent ? "urgent" : "normal",
        firstLine.application_type || null,
        firstLine.tolerance_percent !== null && firstLine.tolerance_percent !== undefined ? String(firstLine.tolerance_percent) : null,
        firstLine.tolerance_percent || null,
        general.general_comment,
        firstLine.partial_delivery_allowed || 0,
        firstLine.application_type || null,
        firstLine.material_family || null,
        firstLine.material_quality || null,
        firstLine.count_system || null,
        firstLine.dtex || null,
        firstLine.custom_count || null,
        firstLine.twist_type || null,
        firstLine.twist_direction || null,
        firstLine.finish || null,
        firstLine.color_mode || null,
        firstLine.dyeing_comment || null,
        firstLine.packaging || null,
        firstLine.meterage_per_unit || null,
        firstLine.production_comment || null,
        general.delivery_address_choice,
        general.delivery_address,
        general.delivery_comment,
        general.technical_file_name,
        "not_sent",
        status,
        req.user.sub,
      ]
    );

    for (const [index, line] of normalizedLines.entries()) {
      await insertPortalOrderLine(result.id, line, index);
    }

    await run(
      `INSERT INTO portal_order_specs (order_id, specs_json) VALUES (?, ?)`,
      [result.id, JSON.stringify({ ...general, lines: normalizedLines, raw_payload: body })]
    );
    await run(
      `INSERT INTO portal_order_status_history (portal_order_id, old_status, new_status, source, message) VALUES (?, ?, ?, ?, ?)`,
      [result.id, null, status, "portal", status === "draft" ? "Brouillon enregistré depuis le portail" : "Demande envoyée depuis le portail"]
    );

    await auditLog({
      userId: req.user.sub,
      role: req.user.role,
      action: status === "draft" ? "PORTAL_ORDER_DRAFT_CREATE" : "PORTAL_ORDER_CREATE",
      entityType: "portal_order",
      entityId: String(result.id),
      metadata: { orderNumber },
      ip: req.ip,
    });

    const order = await get(`SELECT * FROM portal_orders WHERE id = ?`, [result.id]);
    res.status(201).json({ order, lines: normalizedLines });
  } catch (error) {
    console.error("Erreur création commande portail :", error.message);
    res.status(500).json({ error: "Erreur création commande" });
  }
}

app.post("/api/orders", authRequired, createPortalOrder);
app.post("/api/portal/orders", authRequired, createPortalOrder);
app.post("/api/client/orders", authRequired, requireClient, createPortalOrder);

async function getClientProfile(req, res) {
  try {
    const client = await getUserClient(req.user);
    if (!client) return res.status(404).json({ error: "Profil client introuvable" });

    res.json({
      company_name: client.company_name || "",
      vat_number: client.vat_number || "",
      email: client.email || client.contact_email || "",
      phone: client.phone || "",
      billing_address: client.billing_address || "",
      billing_postal_code: client.billing_postal_code || "",
      billing_city: client.billing_city || "",
      billing_country: client.billing_country || "",
      shipping_address: client.shipping_address || "",
      shipping_postal_code: client.shipping_postal_code || "",
      shipping_city: client.shipping_city || "",
      shipping_country: client.shipping_country || "",
      contact_name: client.contact_name || "",
      contact_email: client.contact_email || "",
      contact_phone: client.contact_phone || "",
    });
  } catch (error) {
    console.error("Erreur profil client :", error.message);
    res.status(500).json({ error: "Erreur lecture profil client" });
  }
}

app.get("/api/client/profile", authRequired, requireClient, getClientProfile);
app.get("/api/portal/profile", authRequired, requireClient, getClientProfile);

async function updateClientProfile(req, res) {
  try {
    const client = await getUserClient(req.user);
    if (!client) return res.status(404).json({ error: "Profil client introuvable" });
    const body = req.body || {};
    const profile = {
      company_name: body.company_name || "",
      vat_number: body.vat_number || "",
      contact_email: body.contact_email || body.email || "",
      phone: body.phone || "",
      billing_address: body.billing_address || "",
      billing_postal_code: body.billing_postal_code || body.postal_code || "",
      billing_city: body.billing_city || body.city || "",
      billing_country: body.billing_country || body.country || "",
      shipping_address: body.shipping_address || "",
      shipping_postal_code: body.shipping_postal_code || "",
      shipping_city: body.shipping_city || "",
      shipping_country: body.shipping_country || "",
      contact_name: body.contact_name || "",
      contact_phone: body.contact_phone || "",
    };

    await run(
      `
        UPDATE portal_clients
        SET
          company_name = ?,
          vat_number = ?,
          email = ?,
          contact_email = ?,
          phone = ?,
          billing_address = ?,
          billing_postal_code = ?,
          billing_city = ?,
          billing_country = ?,
          shipping_address = ?,
          shipping_postal_code = ?,
          shipping_city = ?,
          shipping_country = ?,
          contact_name = ?,
          contact_phone = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        profile.company_name,
        profile.vat_number,
        profile.contact_email,
        profile.contact_email,
        profile.phone,
        profile.billing_address,
        profile.billing_postal_code,
        profile.billing_city,
        profile.billing_country,
        profile.shipping_address,
        profile.shipping_postal_code,
        profile.shipping_city,
        profile.shipping_country,
        profile.contact_name,
        profile.contact_phone,
        client.id,
      ]
    );

    await auditLog({
      userId: req.user.sub,
      role: req.user.role,
      action: "PORTAL_PROFILE_UPDATE",
      entityType: "portal_client",
      entityId: String(client.id),
      ip: req.ip,
    });

    res.json({
      success: true,
      profile: {
        ...profile,
        email: profile.contact_email,
        contact_email: profile.contact_email,
      },
    });
  } catch (error) {
    console.error("Erreur mise à jour profil client :", error.message);
    res.status(500).json({ error: "Erreur mise à jour profil client" });
  }
}

app.put("/api/client/profile", authRequired, requireClient, updateClientProfile);
app.put("/api/portal/profile", authRequired, requireClient, updateClientProfile);

async function getClientOrderDetail(req, res) {
  try {
    const order = await get(`SELECT * FROM portal_orders WHERE id = ?`, [req.params.id]);
    if (!order) return res.status(404).json({ error: "Commande introuvable" });
    const client = await getUserClient(req.user);
    if (!client || (order.client_id && order.client_id !== client.id) || (!order.client_id && order.customer_code !== client.customer_code)) {
      return res.status(403).json({ error: "Accès refusé" });
    }

    const specs = await all(`SELECT * FROM portal_order_specs WHERE order_id = ? ORDER BY id DESC`, [order.id]);
    const lines = await getPortalOrderLines(order);
    const documents = await all(`SELECT * FROM portal_documents WHERE order_id = ? ORDER BY id DESC`, [order.id]);
    const messages = await all(`SELECT * FROM portal_messages WHERE order_id = ? ORDER BY id ASC`, [order.id]);
    res.json({ order, lines, specs, documents, messages });
  } catch (error) {
    res.status(500).json({ error: "Erreur lecture commande" });
  }
}

app.get("/api/client/orders/:id", authRequired, requireClient, getClientOrderDetail);
app.get("/api/orders/pending-count", authRequired, requireAdmin, getPendingOrderCount);
app.get("/api/orders/:id", authRequired, getClientOrderDetail);

async function getOwnedClientOrder(req, res) {
  const order = await get(`SELECT * FROM portal_orders WHERE id = ?`, [req.params.id]);
  if (!order) {
    res.status(404).json({ error: "Demande introuvable" });
    return null;
  }
  const client = await getUserClient(req.user);
  if (!client || (order.client_id && order.client_id !== client.id) || (!order.client_id && order.customer_code !== client.customer_code)) {
    res.status(403).json({ error: "Accès refusé" });
    return null;
  }
  return { order, client };
}

app.put("/api/client/orders/:id", authRequired, requireClient, async (req, res) => {
  try {
    const owned = await getOwnedClientOrder(req, res);
    if (!owned) return;
    const { order } = owned;
    if (order.status !== "draft") {
      return res.status(403).json({ error: "Seuls les brouillons peuvent être modifiés." });
    }

    const nextStatus = req.body?.status === "submitted" ? "pending_approval" : "draft";
    const { general, normalizedLines, firstLine, totalQuantity } = preparePortalOrderPayload(req.body || {}, { allowEmptyLines: nextStatus === "draft" });
    const validationError = nextStatus === "submitted" ? validateSubmittedPortalOrder(general, normalizedLines) : null;
    if (validationError) return res.status(400).json(validationError);

    await updatePortalOrderRecord(order.id, general, firstLine, totalQuantity, nextStatus, req.user.sub);
    await replacePortalOrderLines(order.id, normalizedLines);
    await run(`INSERT INTO portal_order_specs (order_id, specs_json) VALUES (?, ?)`, [order.id, JSON.stringify({ ...general, lines: normalizedLines, raw_payload: req.body || {} })]);

    if (nextStatus !== order.status) {
      await insertStatusHistory(order.id, order.status, nextStatus, "portal", "Brouillon soumis depuis le portail");
    }
    await auditLog({
      userId: req.user.sub,
      role: req.user.role,
      action: nextStatus === "pending_approval" ? "PORTAL_ORDER_DRAFT_SUBMIT" : "PORTAL_ORDER_DRAFT_UPDATE",
      entityType: "portal_order",
      entityId: String(order.id),
      ip: req.ip,
    });

    res.json({ success: true, order: await get(`SELECT * FROM portal_orders WHERE id = ?`, [order.id]), lines: await getPortalOrderLines({ id: order.id }) });
  } catch (error) {
    console.error("Erreur mise à jour brouillon :", error.message);
    res.status(500).json({ error: "Erreur mise à jour brouillon" });
  }
});

app.post("/api/client/orders/:id/submit", authRequired, requireClient, async (req, res) => {
  try {
    const owned = await getOwnedClientOrder(req, res);
    if (!owned) return;
    const { order } = owned;
    if (order.status !== "draft") {
      return res.status(403).json({ error: "Seuls les brouillons peuvent être soumis depuis cette route." });
    }

    const lines = await getPortalOrderLines(order);
    const general = {
      client_reference: order.client_reference || null,
      requested_delivery_date: order.requested_delivery_date || order.requested_date || null,
      delivery_address_choice: order.delivery_address_choice || "profile",
      delivery_address: order.delivery_address || null,
      urgent: order.urgency === "urgent",
      general_comment: order.comment || null,
      delivery_comment: order.delivery_comment || null,
      technical_file_name: order.technical_file_name || null,
    };
    const normalizedLines = lines.map(normalizeOrderLine);
    const validationError = validateSubmittedPortalOrder(general, normalizedLines);
    if (validationError) return res.status(400).json(validationError);

    await run(`UPDATE portal_orders SET status = 'pending_approval', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [order.id]);
    await insertStatusHistory(order.id, order.status, "pending_approval", "portal", "Brouillon soumis depuis le portail");
    await auditLog({ userId: req.user.sub, role: req.user.role, action: "PORTAL_ORDER_DRAFT_SUBMIT", entityType: "portal_order", entityId: String(order.id), ip: req.ip });
    res.json({ success: true, order: await get(`SELECT * FROM portal_orders WHERE id = ?`, [order.id]) });
  } catch (error) {
    console.error("Erreur soumission brouillon :", error.message);
    res.status(500).json({ error: "Erreur soumission brouillon" });
  }
});

app.delete("/api/client/orders/:id", authRequired, requireClient, async (req, res) => {
  try {
    const owned = await getOwnedClientOrder(req, res);
    if (!owned) return;
    const { order } = owned;
    if (order.status !== "draft") return res.status(403).json({ error: "Seuls les brouillons peuvent être supprimés." });
    await run(`DELETE FROM portal_order_lines WHERE portal_order_id = ?`, [order.id]);
    await run(`DELETE FROM portal_order_specs WHERE order_id = ?`, [order.id]);
    await run(`DELETE FROM portal_order_status_history WHERE portal_order_id = ?`, [order.id]);
    await run(`DELETE FROM portal_orders WHERE id = ?`, [order.id]);
    await auditLog({ userId: req.user.sub, role: req.user.role, action: "PORTAL_ORDER_DRAFT_DELETE", entityType: "portal_order", entityId: String(order.id), ip: req.ip });
    res.json({ success: true });
  } catch (error) {
    console.error("Erreur suppression brouillon :", error.message);
    res.status(500).json({ error: "Erreur suppression brouillon" });
  }
});

app.get("/api/client/documents", authRequired, requireClient, async (req, res) => {
  try {
    const client = await getUserClient(req.user);
    if (!client) return res.status(404).json({ error: "Client introuvable" });
    const documents = await all(
      `
        SELECT d.*, o.order_number, o.client_reference, o.status
        FROM portal_documents d
        JOIN portal_orders o ON o.id = d.order_id
        WHERE o.client_id = ? OR o.customer_code = ?
        ORDER BY d.id DESC
      `,
      [client.id, client.customer_code]
    );
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: "Erreur lecture documents" });
  }
});

app.post("/api/orders/:id/document", authRequired, async (req, res) => {
  try {
    const { filename, document_type, storage_url } = req.body || {};
    if (!filename) return res.status(400).json({ error: "filename requis" });
    const result = await run(
      `
        INSERT INTO portal_documents (order_id, filename, document_type, storage_url, uploaded_by)
        VALUES (?, ?, ?, ?, ?)
      `,
      [req.params.id, filename, document_type || null, storage_url || null, req.user.sub]
    );
    res.status(201).json({ id: result.id });
  } catch (error) {
    res.status(500).json({ error: "Erreur document" });
  }
});

app.post("/api/orders/:id/messages", authRequired, async (req, res) => {
  try {
    const { body } = req.body || {};
    if (!body) return res.status(400).json({ error: "message requis" });
    const result = await run(
      `INSERT INTO portal_messages (order_id, author_id, body) VALUES (?, ?, ?)`,
      [req.params.id, req.user.sub, body]
    );
    res.status(201).json({ id: result.id });
  } catch (error) {
    res.status(500).json({ error: "Erreur message" });
  }
});

app.get("/api/admin/dashboard", authRequired, requireAdmin, async (req, res) => {
  const [clients, users, orders, pending, errors, pendingApproval] = await Promise.all([
    get(`SELECT COUNT(*) AS count FROM portal_clients`),
    get(`SELECT COUNT(*) AS count FROM portal_users`),
    get(`SELECT COUNT(*) AS count FROM portal_orders`),
    get(`SELECT COUNT(*) AS count FROM erp_pending_actions WHERE status IN ('pending', 'PENDING', 'processing', 'IN_PROGRESS')`),
    get(`SELECT COUNT(*) AS count FROM sync_logs WHERE status IN ('error', 'ERROR', 'failed')`),
    get(`SELECT COUNT(*) AS count FROM portal_orders WHERE status IN (${PENDING_APPROVAL_STATUSES.map(() => "?").join(",")})`, PENDING_APPROVAL_STATUSES),
  ]);
  res.json({
    clients: clients?.count || 0,
    users: users?.count || 0,
    orders: orders?.count || 0,
    pendingActions: pending?.count || 0,
    syncErrors: errors?.count || 0,
    pendingApproval: pendingApproval?.count || 0,
  });
});

async function getPendingOrderCount(req, res) {
  const row = await get(
    `SELECT COUNT(*) AS count FROM portal_orders WHERE status IN (${PENDING_APPROVAL_STATUSES.map(() => "?").join(",")})`,
    PENDING_APPROVAL_STATUSES
  );
  res.json({ count: row?.count || 0 });
}

app.get("/api/admin/orders/pending-count", authRequired, requireAdmin, getPendingOrderCount);

app.get("/api/admin/clients", authRequired, requireAdmin, async (req, res) => {
  const clients = await all(`
    SELECT
      portal_clients.*,
      portal_users.id AS user_id,
      portal_users.full_name AS user_name,
      portal_users.email AS user_email,
      portal_users.status AS user_status,
      portal_users.last_login_at AS last_login_at
    FROM portal_clients
    LEFT JOIN portal_users ON portal_users.client_id = portal_clients.id
    GROUP BY portal_clients.id
    ORDER BY portal_clients.id DESC
  `);
  res.json(clients);
});

app.post("/api/admin/clients", authRequired, requireAdmin, async (req, res) => {
  try {
    const payload = req.body || {};
    const body = payload.client || payload;
    const userPayload = payload.user || {};
    if (!body.company_name) return res.status(400).json({ error: "company_name requis" });
    const customerCode = body.customer_code || body.sage_customer_code || `CLI-${Date.now().toString().slice(-6)}`;
    const clientResult = await run(
      `
        INSERT INTO portal_clients (
          customer_code, company_name, vat_number, email, contact_email, phone,
          billing_address, billing_postal_code, billing_city, billing_country,
          shipping_address, shipping_postal_code, shipping_city, shipping_country,
          contact_name, contact_phone, sage_customer_code, status, is_active, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      [
        customerCode,
        body.company_name,
        body.vat_number || null,
        body.email || body.contact_email || null,
        body.contact_email || body.email || null,
        body.phone || null,
        body.billing_address || null,
        body.billing_postal_code || null,
        body.billing_city || null,
        body.billing_country || null,
        body.shipping_address || null,
        body.shipping_postal_code || null,
        body.shipping_city || null,
        body.shipping_country || null,
        body.contact_name || null,
        body.contact_phone || null,
        body.sage_customer_code || null,
      ]
    );

    let invitationLink = null;
    const shouldCreateUser = userPayload.create_user === true || Boolean(userPayload.email || body.contact_email || body.email);
    const userEmail = userPayload.email || body.contact_email || body.email;
    if (shouldCreateUser && userEmail) {
      const token = crypto.randomBytes(32).toString("hex");
      const initialPassword = userPayload.password || crypto.randomBytes(18).toString("base64url");
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const userResult = await run(
        `
          INSERT INTO portal_users (
            email, password_hash, full_name, role, client_id, client_code, is_active, status,
            reset_token_hash, reset_token_expires_at, created_at, updated_at
          )
          VALUES (?, ?, ?, 'client', ?, ?, 1, 'active', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        [
          userEmail,
          await bcrypt.hash(initialPassword, 12),
          userPayload.name || body.contact_name || body.company_name,
          clientResult.id,
          customerCode,
          hashToken(token),
          expiresAt,
        ]
      );
      invitationLink = `/client/reset-password/${token}`;
      await auditLog({ userId: req.user.sub, role: req.user.role, action: "ADMIN_USER_CREATE", entityType: "portal_user", entityId: String(userResult.id), ip: req.ip });
    }

    await auditLog({ userId: req.user.sub, role: req.user.role, action: "ADMIN_CLIENT_CREATE", entityType: "portal_client", entityId: customerCode, ip: req.ip });
    const client = await get(`SELECT * FROM portal_clients WHERE id = ?`, [clientResult.id]);
    res.status(201).json({ client, invitationLink });
  } catch (error) {
    console.error("Erreur création client admin :", error.message);
    res.status(500).json({ error: "Erreur création client" });
  }
});

app.get("/api/admin/clients/:id", authRequired, requireAdmin, async (req, res) => {
  const client = await get(
    `
      SELECT
        portal_clients.*,
        portal_users.id AS user_id,
        portal_users.full_name AS user_name,
        portal_users.email AS user_email,
        portal_users.status AS user_status,
        portal_users.last_login_at AS last_login_at
      FROM portal_clients
      LEFT JOIN portal_users ON portal_users.client_id = portal_clients.id
      WHERE portal_clients.id = ?
      GROUP BY portal_clients.id
    `,
    [req.params.id]
  );
  if (!client) return res.status(404).json({ error: "Client introuvable" });
  const orders = await all(`SELECT * FROM portal_orders WHERE client_id = ? OR customer_code = ? ORDER BY id DESC`, [client.id, client.customer_code]);
  const users = await all(`SELECT id, email, full_name, role, client_id, client_code, is_active, status, last_login_at, created_at FROM portal_users WHERE client_id = ? OR client_code = ? ORDER BY id DESC`, [client.id, client.customer_code]);
  res.json({ client, orders, users });
});

app.put("/api/admin/clients/:id", authRequired, requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const client = await get(`SELECT * FROM portal_clients WHERE id = ?`, [req.params.id]);
    if (!client) return res.status(404).json({ error: "Client introuvable" });
    await run(
      `
        UPDATE portal_clients
        SET company_name = ?, vat_number = ?, email = ?, contact_email = ?, phone = ?,
            billing_address = ?, billing_postal_code = ?, billing_city = ?, billing_country = ?,
            shipping_address = ?, shipping_postal_code = ?, shipping_city = ?, shipping_country = ?,
            contact_name = ?, contact_phone = ?, sage_customer_code = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        body.company_name || "",
        body.vat_number || "",
        body.email || body.contact_email || "",
        body.contact_email || body.email || "",
        body.phone || "",
        body.billing_address || "",
        body.billing_postal_code || "",
        body.billing_city || "",
        body.billing_country || "",
        body.shipping_address || "",
        body.shipping_postal_code || "",
        body.shipping_city || "",
        body.shipping_country || "",
        body.contact_name || "",
        body.contact_phone || "",
        body.sage_customer_code || "",
        req.params.id,
      ]
    );
    await auditLog({ userId: req.user.sub, role: req.user.role, action: "ADMIN_CLIENT_UPDATE", entityType: "portal_client", entityId: String(req.params.id), ip: req.ip });
    res.json({ success: true, client: await get(`SELECT * FROM portal_clients WHERE id = ?`, [req.params.id]) });
  } catch (error) {
    res.status(500).json({ error: "Erreur mise à jour client" });
  }
});

app.patch("/api/admin/clients/:id/status", authRequired, requireAdmin, async (req, res) => {
  const active = req.body?.is_active === false || req.body?.status === "disabled" ? 0 : 1;
  await run(`UPDATE portal_clients SET is_active = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [active, active ? "active" : "disabled", req.params.id]);
  await auditLog({ userId: req.user.sub, role: req.user.role, action: "ADMIN_CLIENT_STATUS", entityType: "portal_client", entityId: String(req.params.id), metadata: { active }, ip: req.ip });
  res.json({ success: true });
});

app.get("/api/admin/users", authRequired, requireAdmin, async (req, res) => {
  const users = await all(
    `
      SELECT u.id, u.email, u.full_name, u.role, u.client_id, u.client_code, u.is_active, u.status, u.last_login_at, u.created_at,
             c.company_name AS client_name
      FROM portal_users u
      LEFT JOIN portal_clients c ON c.id = u.client_id OR c.customer_code = u.client_code
      ORDER BY u.id DESC
    `
  );
  res.json(users);
});

app.post("/api/admin/users", authRequired, requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.email || !body.role) return res.status(400).json({ error: "email et role requis" });
    if (!roles.includes(body.role)) return res.status(400).json({ error: "role invalide" });
    if (body.role === "super_admin" && req.user.role !== "super_admin") return res.status(403).json({ error: "Seul un super admin peut créer un super admin" });
    const linkedClient = body.client_id
      ? await get(`SELECT * FROM portal_clients WHERE id = ?`, [body.client_id])
      : body.client_code
        ? await get(`SELECT * FROM portal_clients WHERE customer_code = ?`, [body.client_code])
        : null;
    const token = crypto.randomBytes(32).toString("hex");
    const tempPassword = body.password || crypto.randomBytes(18).toString("base64url");
    const result = await run(
      `
        INSERT INTO portal_users (
          email, password_hash, full_name, role, client_id, client_code, is_active, status,
          reset_token_hash, reset_token_expires_at, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 1, 'active', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      [
        body.email,
        await bcrypt.hash(tempPassword, 12),
        body.full_name || body.name || "",
        body.role,
        linkedClient?.id || body.client_id || null,
        linkedClient?.customer_code || body.client_code || null,
        hashToken(token),
        new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      ]
    );
    await auditLog({ userId: req.user.sub, role: req.user.role, action: "ADMIN_USER_CREATE", entityType: "portal_user", entityId: String(result.id), ip: req.ip });
    res.status(201).json({ success: true, id: result.id, invitationLink: body.role === "client" ? `/client/reset-password/${token}` : `/admin/reset-password/${token}` });
  } catch (error) {
    res.status(500).json({ error: "Erreur création utilisateur" });
  }
});

app.put("/api/admin/users/:id", authRequired, requireAdmin, async (req, res) => {
  const body = req.body || {};
  if (body.role && !roles.includes(body.role)) return res.status(400).json({ error: "role invalide" });
  if (body.role === "super_admin" && req.user.role !== "super_admin") return res.status(403).json({ error: "Seul un super admin peut attribuer ce rôle" });
  const linkedClient = body.client_id
    ? await get(`SELECT * FROM portal_clients WHERE id = ?`, [body.client_id])
    : body.client_code
      ? await get(`SELECT * FROM portal_clients WHERE customer_code = ?`, [body.client_code])
      : null;
  await run(
    `UPDATE portal_users SET full_name = ?, role = ?, client_id = ?, client_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [body.full_name || body.name || "", body.role || "client", linkedClient?.id || body.client_id || null, linkedClient?.customer_code || body.client_code || null, req.params.id]
  );
  await auditLog({ userId: req.user.sub, role: req.user.role, action: "ADMIN_USER_UPDATE", entityType: "portal_user", entityId: String(req.params.id), ip: req.ip });
  res.json({ success: true });
});

app.patch("/api/admin/users/:id/status", authRequired, requireAdmin, async (req, res) => {
  const active = req.body?.is_active === false || req.body?.status === "disabled" ? 0 : 1;
  await run(`UPDATE portal_users SET is_active = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [active, active ? "active" : "disabled", req.params.id]);
  await auditLog({ userId: req.user.sub, role: req.user.role, action: "ADMIN_USER_STATUS", entityType: "portal_user", entityId: String(req.params.id), metadata: { active }, ip: req.ip });
  res.json({ success: true });
});

app.post("/api/admin/users/:id/reset-password", authRequired, requireAdmin, async (req, res) => {
  const user = await get(`SELECT * FROM portal_users WHERE id = ?`, [req.params.id]);
  if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });
  const token = crypto.randomBytes(32).toString("hex");
  await run(
    `UPDATE portal_users SET reset_token_hash = ?, reset_token_expires_at = ? WHERE id = ?`,
    [hashToken(token), new Date(Date.now() + 30 * 60 * 1000).toISOString(), req.params.id]
  );
  await auditLog({ userId: req.user.sub, role: req.user.role, action: "ADMIN_USER_RESET_PASSWORD", entityType: "portal_user", entityId: String(req.params.id), ip: req.ip });
  res.json({ success: true, resetLink: user.role === "client" ? `/client/reset-password/${token}` : `/admin/reset-password/${token}` });
});

async function approvePortalOrder(req, res) {
  try {
    const { comment = "" } = req.body || {};
    const order = await get(`SELECT * FROM portal_orders WHERE id = ?`, [req.params.id]);
    if (!order) return res.status(404).json({ error: "Commande introuvable" });
    if (order.status === "draft") return res.status(400).json({ error: "Un brouillon ne peut pas être approuvé." });
    if (order.status === "cancelled") return res.status(400).json({ error: "Une commande annulée ne peut pas être approuvée." });

    await run(
      `
        UPDATE portal_orders
        SET status = 'approved',
            approval_comment = ?,
            approved_by = ?,
            approved_at = CURRENT_TIMESTAMP,
            sage_status = COALESCE(NULLIF(sage_status, ''), 'not_sent'),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [comment || null, req.user.sub, order.id]
    );

    await insertStatusHistory(order.id, order.status, "approved", "admin", comment || "Commande approuvée");

    const approvedOrder = await get(`SELECT * FROM portal_orders WHERE id = ?`, [order.id]);
    const sageAction = await scheduleSageOrderAction(approvedOrder, "Commande approuvée par l'administration");

    await auditLog({
      userId: req.user.sub,
      role: req.user.role,
      action: "ADMIN_ORDER_APPROVE",
      entityType: "portal_order",
      entityId: String(order.id),
      metadata: { comment, sageAction },
      ip: req.ip,
    });

    console.log(`[ORDER APPROVAL] order ${order.id} approved by user ${req.user.sub}`);
    res.json({ success: true, sageAction, order: await get(`SELECT * FROM portal_orders WHERE id = ?`, [order.id]) });
  } catch (error) {
    console.error("Erreur approbation commande :", error.message);
    res.status(500).json({ error: "Erreur approbation commande" });
  }
}

app.post("/api/orders/:id/approve", authRequired, requireAdmin, approvePortalOrder);
app.post("/api/admin/orders/:id/approve", authRequired, requireAdmin, approvePortalOrder);

app.get("/api/admin/orders/:id", authRequired, requireAdmin, async (req, res) => {
  const order = await get(`SELECT o.*, c.company_name, c.contact_email FROM portal_orders o LEFT JOIN portal_clients c ON c.customer_code = o.customer_code WHERE o.id = ?`, [req.params.id]);
  if (!order) return res.status(404).json({ error: "Commande introuvable" });
  const lines = await getPortalOrderLines(order);
  const specs = await all(`SELECT * FROM portal_order_specs WHERE order_id = ? ORDER BY id DESC`, [order.id]);
  const history = await all(`SELECT * FROM portal_order_status_history WHERE portal_order_id = ? ORDER BY id DESC`, [order.id]);
  const logs = await all(`SELECT * FROM sync_logs WHERE entity_type = 'portal_order' AND entity_id = ? ORDER BY id DESC`, [String(order.id)]);
  const documents = await all(`SELECT * FROM portal_documents WHERE order_id = ? ORDER BY id DESC`, [order.id]);
  res.json({ order, lines, specs, history, logs, documents });
});

app.patch("/api/admin/orders/:id/status", authRequired, requireAdmin, async (req, res) => {
  try {
    const { status, message, internal_comment: internalComment } = req.body || {};
    const allowedStatuses = [
      "submitted",
      "pending_approval",
      "pending_validation",
      "approved",
      "rejected",
      "in_production",
      "ready",
      "delivered",
      "cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Statut invalide" });
    }

    const order = await get(`SELECT * FROM portal_orders WHERE id = ?`, [req.params.id]);
    if (!order) return res.status(404).json({ error: "Commande introuvable" });

    await run(
      `
        UPDATE portal_orders
        SET status = ?, internal_comment = COALESCE(?, internal_comment), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [status, internalComment || message || null, order.id]
    );

    await run(
      `
        INSERT INTO portal_order_status_history (portal_order_id, old_status, new_status, source, message)
        VALUES (?, ?, ?, ?, ?)
      `,
      [order.id, order.status, status, "admin", message || internalComment || null]
    );

    await auditLog({
      userId: req.user.sub,
      role: req.user.role,
      action: "ADMIN_ORDER_STATUS_UPDATE",
      entityType: "portal_order",
      entityId: String(order.id),
      metadata: { oldStatus: order.status, newStatus: status, message: message || internalComment || null },
      ip: req.ip,
    });

    res.json({ success: true, order: await get(`SELECT * FROM portal_orders WHERE id = ?`, [order.id]) });
  } catch (error) {
    console.error("Erreur changement statut commande :", error.message);
    res.status(500).json({ error: "Erreur changement statut commande" });
  }
});

app.post("/api/admin/orders/:id/force-sync", authRequired, requireAdmin, async (req, res) => {
  try {
    const order = await get(`SELECT * FROM portal_orders WHERE id = ?`, [req.params.id]);
    if (!order) return res.status(404).json({ error: "Commande introuvable" });
    if (order.status === "draft") return res.status(400).json({ error: "Un brouillon ne peut pas être envoyé vers Sage." });
    if (order.status !== "approved") return res.status(400).json({ error: "Seule une commande approuvée peut être envoyée vers Sage." });
    const action = await scheduleSageOrderAction(order, "Envoi Sage manuel");
    const sync = await processPendingSageActions();
    await auditLog({ userId: req.user.sub, role: req.user.role, action: "ADMIN_ORDER_FORCE_SYNC", entityType: "portal_order", entityId: String(order.id), metadata: { action, sync }, ip: req.ip });
    res.json({ success: true, actionId: action.actionId, sync });
  } catch (error) {
    res.status(500).json({ error: error.message || "Erreur envoi Sage" });
  }
});

app.post("/api/admin/orders/:id/internal-comment", authRequired, requireAdmin, async (req, res) => {
  await run(`UPDATE portal_orders SET internal_comment = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [req.body?.comment || "", req.params.id]);
  res.json({ success: true });
});

app.get("/api/admin/sync-logs", authRequired, requireAdmin, async (req, res) => {
  const logs = await all(`SELECT * FROM sync_logs ORDER BY id DESC LIMIT 200`);
  res.json(logs);
});

app.get("/api/admin/connector-sage", authRequired, requireRoles("super_admin"), async (req, res) => {
  const row = await get(`SELECT * FROM connector_settings WHERE connector_key = 'sage_portal'`);
  const config = row ? JSON.parse(row.config_json || "{}") : {};
  res.json({
    enabled: Boolean(row?.enabled),
    config: sanitizeConnectorConfig(config),
    status: row?.enabled ? "configured" : "disabled",
    last_check_at: row?.last_check_at || null,
    last_inbound_sync_at: row?.last_inbound_sync_at || null,
    last_outbound_sync_at: row?.last_outbound_sync_at || null,
    last_error: row?.last_error || null,
  });
});

app.put("/api/admin/connector-sage", authRequired, requireRoles("super_admin"), async (req, res) => {
  try {
    const existing = await get(`SELECT * FROM connector_settings WHERE connector_key = 'sage_portal'`);
    const existingConfig = existing ? JSON.parse(existing.config_json || "{}") : {};
    const nextConfig = { ...(req.body?.config || {}) };
    if (!nextConfig.password || nextConfig.password === "********") nextConfig.password = existingConfig.password || "";
    const enabled = req.body?.enabled === true ? 1 : 0;
    await run(
      `
        INSERT INTO connector_settings (connector_key, config_json, enabled, updated_at)
        VALUES ('sage_portal', ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(connector_key) DO UPDATE SET config_json = excluded.config_json, enabled = excluded.enabled, updated_at = CURRENT_TIMESTAMP
      `,
      [JSON.stringify(nextConfig), enabled]
    );
    await auditLog({ userId: req.user.sub, role: req.user.role, action: "ADMIN_CONNECTOR_SAGE_UPDATE", entityType: "connector_settings", entityId: "sage_portal", ip: req.ip });
    await sageScheduler.startSageScheduler().catch((error) => {
      console.error("[SAGE SCHEDULER] redémarrage impossible :", error.message);
    });
    res.json({ success: true, config: sanitizeConnectorConfig(nextConfig), enabled: Boolean(enabled) });
  } catch (error) {
    res.status(500).json({ error: "Erreur sauvegarde connecteur" });
  }
});

app.post("/api/admin/connector-sage/test", authRequired, requireRoles("super_admin"), async (req, res) => {
  try {
    const details = await testSagePortalConnection();
    await run(`UPDATE connector_settings SET last_check_at = CURRENT_TIMESTAMP, last_error = NULL WHERE connector_key = 'sage_portal'`);
    res.json({
      connected: true,
      status: "connected",
      checked_at: new Date().toISOString(),
      message: "Connexion SageSimu active",
      details,
    });
  } catch (error) {
    await run(`UPDATE connector_settings SET last_check_at = CURRENT_TIMESTAMP, last_error = ? WHERE connector_key = 'sage_portal'`, [error.message]).catch(() => {});
    res.status(200).json({
      connected: false,
      status: "disconnected",
      checked_at: new Date().toISOString(),
      message: error.message || "Connexion SageSimu indisponible",
    });
  }
});

app.post("/api/admin/connector-sage/sync-inbound", authRequired, requireRoles("super_admin"), async (req, res) => {
  try {
    const result = await sageSyncService.runSageImport();
    await auditLog({ userId: req.user.sub, role: req.user.role, action: "ADMIN_CONNECTOR_SAGE_INBOUND_SYNC", entityType: "connector_settings", entityId: "sage_portal", metadata: result, ip: req.ip });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message || "Erreur synchronisation entrante" });
  }
});

app.post("/api/admin/connector-sage/sync-outbound", authRequired, requireRoles("super_admin"), async (req, res) => {
  try {
    const result = await sageSyncService.runSageExport();
    await auditLog({ userId: req.user.sub, role: req.user.role, action: "ADMIN_CONNECTOR_SAGE_OUTBOUND_SYNC", entityType: "connector_settings", entityId: "sage_portal", metadata: result, ip: req.ip });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message || "Erreur synchronisation sortante" });
  }
});

app.get("/api/admin/orders", authRequired, requireAdmin, async (req, res) => {
  const orders = await all(
    `
      SELECT
        o.*,
        c.company_name,
        COALESCE(line_stats.line_count, CASE WHEN o.quantity_kg IS NOT NULL THEN 1 ELSE 0 END) AS line_count,
        COALESCE(line_stats.total_quantity_kg, o.quantity_kg, 0) AS total_quantity_kg,
        first_line.application_type AS first_application_type,
        first_line.material_family AS first_material_family,
        first_line.material_quality AS first_material_quality,
        first_line.yarn_count_nm AS first_yarn_count_nm,
        first_line.dtex AS first_dtex,
        first_line.custom_count AS first_custom_count,
        first_line.color_name AS first_color_name,
        first_line.packaging AS first_packaging
      FROM portal_orders o
      LEFT JOIN portal_clients c ON c.customer_code = o.customer_code
      LEFT JOIN (
        SELECT portal_order_id, COUNT(*) AS line_count, SUM(quantity_kg) AS total_quantity_kg
        FROM portal_order_lines
        GROUP BY portal_order_id
      ) line_stats ON line_stats.portal_order_id = o.id
      LEFT JOIN portal_order_lines first_line ON first_line.portal_order_id = o.id AND first_line.line_number = 1
      ORDER BY o.id DESC
    `
  );
  res.json(orders);
});

app.get("/api/admin/sync/status", authRequired, requireAdmin, async (req, res) => {
  const [pendingActions, syncErrors, lastAgent, lastSync] = await Promise.all([
    get(`SELECT COUNT(*) AS count FROM erp_pending_actions WHERE status IN ('pending', 'PENDING', 'failed', 'ERROR')`),
    all(`SELECT * FROM sync_logs WHERE status = 'ERROR' ORDER BY id DESC LIMIT 20`),
    get(`SELECT * FROM agent_status_logs ORDER BY id DESC LIMIT 1`),
    get(`SELECT * FROM sync_logs ORDER BY id DESC LIMIT 1`),
  ]);

  res.json({
    agentStatus: lastAgent?.status || "unknown",
    lastSync: lastSync?.created_at || null,
    pendingActions: pendingActions?.count || 0,
    syncErrors,
    sageConnectivity: lastAgent?.sage_connectivity || "unknown",
    leonConnectivity: lastAgent?.leon_connectivity || "unknown",
  });
});

app.post("/api/admin/catalog/articles", authRequired, requireAdmin, async (req, res) => {
  const { code, label, family, is_active = true } = req.body || {};
  if (!code || !label) return res.status(400).json({ error: "code et label requis" });
  await run(
    `
      INSERT INTO catalog_articles (code, label, family, is_active, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(code) DO UPDATE SET label = excluded.label, family = excluded.family, is_active = excluded.is_active, updated_at = CURRENT_TIMESTAMP
    `,
    [code, label, family || null, is_active ? 1 : 0]
  );
  res.json({ success: true });
});

app.post("/api/admin/catalog/materials", authRequired, requireAdmin, async (req, res) => {
  const { code, label, is_active = true } = req.body || {};
  if (!code || !label) return res.status(400).json({ error: "code et label requis" });
  await run(
    `
      INSERT INTO catalog_materials (code, label, is_active, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(code) DO UPDATE SET label = excluded.label, is_active = excluded.is_active, updated_at = CURRENT_TIMESTAMP
    `,
    [code, label, is_active ? 1 : 0]
  );
  res.json({ success: true });
});

app.get("/api/catalog", authRequired, async (req, res) => {
  const [articles, materials, yarnCounts, colors, conditionings] = await Promise.all([
    all(`SELECT * FROM catalog_articles WHERE is_active = 1 ORDER BY label`),
    all(`SELECT * FROM catalog_materials WHERE is_active = 1 ORDER BY label`),
    all(`SELECT * FROM catalog_yarn_counts WHERE is_active = 1 ORDER BY label`),
    all(`SELECT * FROM catalog_colors WHERE is_active = 1 ORDER BY label`),
    all(`SELECT * FROM catalog_conditionings WHERE is_active = 1 ORDER BY label`),
  ]);
  res.json({ articles, materials, yarnCounts, colors, conditionings });
});

app.get("/api/agent/actions", agentRequired, async (req, res) => {
  const actions = await all(
    `
      SELECT * FROM erp_pending_actions
      WHERE status IN ('pending', 'PENDING', 'failed', 'ERROR')
      ORDER BY id ASC
      LIMIT 10
    `
  );

  for (const action of actions) {
    await run(`UPDATE erp_pending_actions SET status = 'processing', locked_at = CURRENT_TIMESTAMP WHERE id = ?`, [action.id]);
  }

  res.json(actions.map((action) => ({
    id: action.id,
    actionType: action.action_type,
    payload: JSON.parse(action.payload_json || "{}"),
    retryCount: action.retry_count,
  })));
});

app.post("/api/agent/actions/result", agentRequired, async (req, res) => {
  const { actionId, success, result, error, agentId, sageConnectivity = "unknown", leonConnectivity = "unknown" } = req.body || {};
  if (!actionId) return res.status(400).json({ error: "actionId requis" });

  const status = success ? "DONE" : "ERROR";
  await run(
    `
      UPDATE erp_pending_actions
      SET status = ?, result_json = ?, processed_at = CURRENT_TIMESTAMP, retry_count = retry_count + ?
      WHERE id = ?
    `,
    [status, JSON.stringify(result || { error }), success ? 0 : 1, actionId]
  );

  const action = await get(`SELECT * FROM erp_pending_actions WHERE id = ?`, [actionId]);
  if (action?.payload_json) {
    const payload = JSON.parse(action.payload_json);
    if (payload.portalOrderId) {
      await run(
        `UPDATE portal_orders
         SET sage_status = ?,
             sage_error_message = ?,
             sage_sent_at = CASE WHEN ? = 'sent' THEN CURRENT_TIMESTAMP ELSE sage_sent_at END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [success ? "sent" : "error", success ? null : error || null, success ? "sent" : "error", payload.portalOrderId]
      );
    }
  }

  await run(
    `INSERT INTO agent_status_logs (agent_id, status, sage_connectivity, leon_connectivity, message) VALUES (?, ?, ?, ?, ?)`,
    [agentId || "local-agent", success ? "online" : "degraded", sageConnectivity, leonConnectivity, error || null]
  );
  await run(
    `INSERT INTO sync_logs (system, direction, status, message) VALUES (?, ?, ?, ?)`,
    ["SAGE", "OUTBOUND", success ? "SUCCESS" : "ERROR", success ? `Action ${actionId} traitée` : error || `Action ${actionId} en erreur`]
  );

  res.json({ success: true });
});

app.post("/api/agent/status", agentRequired, async (req, res) => {
  const { agentId, status, sageConnectivity, leonConnectivity, message } = req.body || {};
  await run(
    `INSERT INTO agent_status_logs (agent_id, status, sage_connectivity, leon_connectivity, message) VALUES (?, ?, ?, ?, ?)`,
    [agentId || "local-agent", status || "online", sageConnectivity || "unknown", leonConnectivity || "unknown", message || null]
  );
  res.json({ success: true });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Toulemonde client portal backend running on http://localhost:${PORT}`);
});
