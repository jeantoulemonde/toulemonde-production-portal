const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3010;
const JWT_SECRET = process.env.JWT_SECRET || "dev-change-me";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "dev-refresh-change-me";
const AGENT_API_KEY = process.env.AGENT_API_KEY || "dev-agent-key";
const TOKEN_TTL = "30m";
const REFRESH_TTL = "7d";

const roles = ["client", "commercial", "admin_portal", "production", "super_admin"];
const ADMIN_ROLES = ["admin_portal", "commercial", "production", "super_admin"];

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

  if (!token) return res.status(401).json({ error: "Authentification requise" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token invalide" });
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

function generateOrderNumber() {
  return `FIL-${new Date().getFullYear()}-${Date.now().toString().slice(-7)}`;
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
  await addColumnIfMissing("portal_orders", "requested_delivery_date", "TEXT");
  await addColumnIfMissing("portal_orders", "sync_status", "TEXT");
  await addColumnIfMissing("portal_orders", "internal_comment", "TEXT");
  await addColumnIfMissing("portal_users", "status", "TEXT DEFAULT 'active'");
  await addColumnIfMissing("portal_users", "client_id", "INTEGER");
  await addColumnIfMissing("portal_users", "last_login_at", "DATETIME");
  await addColumnIfMissing("portal_users", "reset_token_hash", "TEXT");
  await addColumnIfMissing("portal_users", "reset_token_expires_at", "DATETIME");
  await addColumnIfMissing("portal_users", "last_password_reset_at", "DATETIME");
  await addColumnIfMissing("sync_logs", "entity_type", "TEXT");
  await addColumnIfMissing("sync_logs", "entity_id", "TEXT");

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

initDb().catch((error) => {
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
    const orders = await all(`SELECT * FROM portal_orders WHERE client_id = ? OR customer_code = ? ORDER BY id DESC`, [client.id, client.customer_code]);
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
    const normalized = {
      ...body,
      client_reference: body.client_reference || body.customer_reference || null,
      yarn_count: body.yarn_count || body.yarn_count_nm || null,
      urgency: body.urgency || (body.urgent ? "urgent" : "normal"),
      tolerance: body.tolerance || (body.tolerance_percent !== undefined ? String(body.tolerance_percent) : null),
      comment: body.comment || body.commentaire_technique || null,
      requested_date: body.requested_date || body.requested_delivery_date || null,
    };
    const missing = requireFields(normalized, ["material", "yarn_count", "quantity_kg"]);
    if (missing.length) return res.status(400).json({ error: `Champs manquants : ${missing.join(", ")}` });

    const client = req.user.role === "client" ? await getUserClient(req.user) : null;
    const customerCode = client?.customer_code || normalized.customer_code;
    const clientId = client?.id || normalized.client_id || null;
    if (!customerCode) return res.status(400).json({ error: "customer_code requis" });

    const status = normalized.status || "submitted";
    const orderNumber = generateOrderNumber();
    const result = await run(
      `
        INSERT INTO portal_orders (
          order_number,
          client_id,
          customer_code,
          client_reference,
          material,
          yarn_count,
          twist,
          color,
          dyeing_required,
          conditioning,
          quantity_kg,
          requested_date,
          requested_delivery_date,
          urgency,
          destination_usage,
          tolerance,
          comment,
          status,
          created_by,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      [
        orderNumber,
        clientId,
        customerCode,
        normalized.client_reference || null,
        normalized.material,
        normalized.yarn_count,
        normalized.twist || null,
        normalized.color || null,
        normalized.dyeing_required ? 1 : 0,
        normalized.conditioning || null,
        Number(normalized.quantity_kg),
        normalized.requested_date || null,
        body.requested_delivery_date || null,
        normalized.urgency || "normal",
        normalized.destination_usage || null,
        normalized.tolerance || null,
        normalized.comment || null,
        status,
        req.user.sub,
      ]
    );

    await run(
      `INSERT INTO portal_order_specs (order_id, specs_json) VALUES (?, ?)`,
      [result.id, JSON.stringify({ ...normalized, raw_payload: body })]
    );
    await run(
      `INSERT INTO portal_order_status_history (portal_order_id, old_status, new_status, source, message) VALUES (?, ?, ?, ?, ?)`,
      [result.id, null, status, "portal", "Commande créée depuis le portail"]
    );

    let actionId = null;
    if (status !== "draft") {
      await run(`UPDATE portal_orders SET status = 'pending_sage_sync' WHERE id = ?`, [result.id]);
      actionId = await createPendingAction("CREATE_SAGE_ORDER", {
        portalOrderId: result.id,
        entityType: "portal_order",
        entityId: result.id,
        orderNumber,
        customerCode,
        order: normalized,
      });
      await run(
        `INSERT INTO portal_order_status_history (portal_order_id, old_status, new_status, source, message) VALUES (?, ?, ?, ?, ?)`,
        [result.id, status, "pending_sage_sync", "portal", "Commande préparée pour traitement"]
      );
      await run(
        `INSERT INTO sync_logs (system, direction, status, message) VALUES (?, ?, ?, ?)`,
        ["SAGE", "OUTBOUND", "PENDING", `Action ERP ${actionId} créée pour ${orderNumber}`]
      );
    }

    await auditLog({
      userId: req.user.sub,
      role: req.user.role,
      action: "PORTAL_ORDER_CREATE",
      entityType: "portal_order",
      entityId: String(result.id),
      metadata: { orderNumber, actionId },
      ip: req.ip,
    });

    const order = await get(`SELECT * FROM portal_orders WHERE id = ?`, [result.id]);
    res.status(201).json({ order, actionId });
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
    const documents = await all(`SELECT * FROM portal_documents WHERE order_id = ? ORDER BY id DESC`, [order.id]);
    const messages = await all(`SELECT * FROM portal_messages WHERE order_id = ? ORDER BY id ASC`, [order.id]);
    res.json({ order, specs, documents, messages });
  } catch (error) {
    res.status(500).json({ error: "Erreur lecture commande" });
  }
}

app.get("/api/client/orders/:id", authRequired, requireClient, getClientOrderDetail);
app.get("/api/orders/:id", authRequired, getClientOrderDetail);

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
  const [clients, users, orders, pending, errors] = await Promise.all([
    get(`SELECT COUNT(*) AS count FROM portal_clients`),
    get(`SELECT COUNT(*) AS count FROM portal_users`),
    get(`SELECT COUNT(*) AS count FROM portal_orders`),
    get(`SELECT COUNT(*) AS count FROM erp_pending_actions WHERE status IN ('pending', 'PENDING', 'processing', 'IN_PROGRESS')`),
    get(`SELECT COUNT(*) AS count FROM sync_logs WHERE status IN ('error', 'ERROR', 'failed')`),
  ]);
  res.json({
    clients: clients?.count || 0,
    users: users?.count || 0,
    orders: orders?.count || 0,
    pendingActions: pending?.count || 0,
    syncErrors: errors?.count || 0,
  });
});

app.get("/api/admin/clients", authRequired, requireAdmin, async (req, res) => {
  const clients = await all(`SELECT * FROM portal_clients ORDER BY id DESC`);
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
  const client = await get(`SELECT * FROM portal_clients WHERE id = ?`, [req.params.id]);
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

app.get("/api/admin/orders/:id", authRequired, requireAdmin, async (req, res) => {
  const order = await get(`SELECT o.*, c.company_name, c.contact_email FROM portal_orders o LEFT JOIN portal_clients c ON c.customer_code = o.customer_code WHERE o.id = ?`, [req.params.id]);
  if (!order) return res.status(404).json({ error: "Commande introuvable" });
  const specs = await all(`SELECT * FROM portal_order_specs WHERE order_id = ? ORDER BY id DESC`, [order.id]);
  const history = await all(`SELECT * FROM portal_order_status_history WHERE portal_order_id = ? ORDER BY id DESC`, [order.id]);
  const logs = await all(`SELECT * FROM sync_logs WHERE entity_type = 'portal_order' AND entity_id = ? ORDER BY id DESC`, [String(order.id)]);
  const documents = await all(`SELECT * FROM portal_documents WHERE order_id = ? ORDER BY id DESC`, [order.id]);
  res.json({ order, specs, history, logs, documents });
});

app.post("/api/admin/orders/:id/force-sync", authRequired, requireAdmin, async (req, res) => {
  const order = await get(`SELECT * FROM portal_orders WHERE id = ?`, [req.params.id]);
  if (!order) return res.status(404).json({ error: "Commande introuvable" });
  const actionId = await createPendingAction("CREATE_SAGE_ORDER", { portalOrderId: order.id, entityType: "portal_order", entityId: order.id, orderNumber: order.order_number, customerCode: order.customer_code, order });
  await run(`UPDATE portal_orders SET sync_status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [order.id]);
  await auditLog({ userId: req.user.sub, role: req.user.role, action: "ADMIN_ORDER_FORCE_SYNC", entityType: "portal_order", entityId: String(order.id), metadata: { actionId }, ip: req.ip });
  res.json({ success: true, actionId });
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
    res.json({ success: true, config: sanitizeConnectorConfig(nextConfig), enabled: Boolean(enabled) });
  } catch (error) {
    res.status(500).json({ error: "Erreur sauvegarde connecteur" });
  }
});

app.post("/api/admin/connector-sage/test", authRequired, requireRoles("super_admin"), async (req, res) => {
  const row = await get(`SELECT * FROM connector_settings WHERE connector_key = 'sage_portal'`);
  const config = row ? JSON.parse(row.config_json || "{}") : {};
  const connected = Boolean(row?.enabled && config.host && config.database);
  await run(`UPDATE connector_settings SET last_check_at = CURRENT_TIMESTAMP, last_error = ? WHERE connector_key = 'sage_portal'`, [connected ? null : "Configuration incomplète"]);
  res.json({
    connected,
    status: connected ? "connected" : "disconnected",
    checked_at: new Date().toISOString(),
    message: connected ? "Connexion configurée" : "Configuration incomplète",
  });
});

app.post("/api/admin/connector-sage/sync-inbound", authRequired, requireRoles("super_admin"), async (req, res) => {
  await run(`UPDATE connector_settings SET last_inbound_sync_at = CURRENT_TIMESTAMP WHERE connector_key = 'sage_portal'`);
  await run(`INSERT INTO sync_logs (system, direction, status, message) VALUES (?, ?, ?, ?)`, ["SAGE_PORTAL", "sage_to_website", "success", "Synchronisation entrante manuelle déclenchée"]);
  await auditLog({ userId: req.user.sub, role: req.user.role, action: "ADMIN_CONNECTOR_SAGE_INBOUND_SYNC", entityType: "connector_settings", entityId: "sage_portal", ip: req.ip });
  res.json({ success: true, checked: 0, updated: 0 });
});

app.post("/api/admin/connector-sage/sync-outbound", authRequired, requireRoles("super_admin"), async (req, res) => {
  await run(`UPDATE connector_settings SET last_outbound_sync_at = CURRENT_TIMESTAMP WHERE connector_key = 'sage_portal'`);
  await run(`INSERT INTO sync_logs (system, direction, status, message) VALUES (?, ?, ?, ?)`, ["SAGE_PORTAL", "website_to_sage", "success", "Synchronisation sortante manuelle déclenchée"]);
  await auditLog({ userId: req.user.sub, role: req.user.role, action: "ADMIN_CONNECTOR_SAGE_OUTBOUND_SYNC", entityType: "connector_settings", entityId: "sage_portal", ip: req.ip });
  res.json({ success: true, processed: 0 });
});

app.get("/api/admin/orders", authRequired, requireAdmin, async (req, res) => {
  const orders = await all(
    `
      SELECT o.*, c.company_name
      FROM portal_orders o
      LEFT JOIN portal_clients c ON c.customer_code = o.customer_code
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
        `UPDATE portal_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [success ? "sent_to_sage" : "sage_sync_failed", payload.portalOrderId]
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
