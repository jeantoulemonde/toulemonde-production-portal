const sql = require("mssql");

const PORTAL_API_URL = process.env.PORTAL_API_URL || "http://localhost:3010";
const AGENT_API_KEY = process.env.AGENT_API_KEY || "dev-agent-key";
const AGENT_ID = process.env.AGENT_ID || "sage-local-agent";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 10000);

const sageConfig = {
  server: process.env.SAGE_SQL_HOST || "localhost",
  port: Number(process.env.SAGE_SQL_PORT || 1433),
  database: process.env.SAGE_SQL_DATABASE,
  user: process.env.SAGE_SQL_USER,
  password: process.env.SAGE_SQL_PASSWORD,
  options: {
    encrypt: process.env.SAGE_SQL_ENCRYPT === "true",
    trustServerCertificate: process.env.SAGE_SQL_TRUST_CERT !== "false",
  },
};

async function portalFetch(path, options = {}) {
  const response = await fetch(`${PORTAL_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-agent-api-key": AGENT_API_KEY,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Erreur portail ${response.status}`);
  return data;
}

async function createSageOrder(action) {
  const payload = action.payload || {};
  const order = payload.order || {};

  if (!sageConfig.database) {
    return {
      simulated: true,
      message: "SAGE_SQL_DATABASE absent : action simulée",
      portalOrderId: payload.portalOrderId,
    };
  }

  const pool = await sql.connect(sageConfig);
  try {
    await pool.request()
      .input("piece", sql.NVarChar, payload.orderNumber)
      .input("tiers", sql.NVarChar, payload.customerCode)
      .input("ref", sql.NVarChar, order.client_reference || payload.orderNumber)
      .query(`
        INSERT INTO F_DOCENTETE (DO_Piece, DO_Type, DO_Date, DO_Tiers, DO_Ref, DO_Statut)
        VALUES (@piece, 1, GETDATE(), @tiers, @ref, 2)
      `);

    await pool.request()
      .input("piece", sql.NVarChar, payload.orderNumber)
      .input("design", sql.NVarChar, `${order.material || "Fil"} ${order.yarn_count || ""}`.trim())
      .input("qty", sql.Decimal(18, 3), Number(order.quantity_kg || 0))
      .query(`
        INSERT INTO F_DOCLIGNE (DO_Piece, DO_Type, DL_Design, DL_Qte)
        VALUES (@piece, 1, @design, @qty)
      `);

    return { created: true, sageOrderNumber: payload.orderNumber };
  } finally {
    await pool.close();
  }
}

async function executeAction(action) {
  switch (action.actionType) {
    case "CREATE_SAGE_ORDER":
      return createSageOrder(action);
    case "UPDATE_SAGE_ORDER":
      return { simulated: true, message: "UPDATE_SAGE_ORDER prêt à brancher" };
    case "SYNC_CUSTOMERS":
    case "SYNC_ARTICLES":
      return { simulated: true, message: `${action.actionType} prêt à brancher` };
    default:
      throw new Error(`Action inconnue : ${action.actionType}`);
  }
}

async function pollOnce() {
  const actions = await portalFetch("/api/agent/actions");

  for (const action of actions) {
    try {
      const result = await executeAction(action);
      await portalFetch("/api/agent/actions/result", {
        method: "POST",
        body: JSON.stringify({
          actionId: action.id,
          success: true,
          result,
          agentId: AGENT_ID,
          sageConnectivity: "ok",
          leonConnectivity: "pending",
        }),
      });
    } catch (error) {
      await portalFetch("/api/agent/actions/result", {
        method: "POST",
        body: JSON.stringify({
          actionId: action.id,
          success: false,
          error: error.message,
          agentId: AGENT_ID,
          sageConnectivity: "error",
          leonConnectivity: "unknown",
        }),
      });
    }
  }

  await portalFetch("/api/agent/status", {
    method: "POST",
    body: JSON.stringify({
      agentId: AGENT_ID,
      status: "online",
      sageConnectivity: sageConfig.database ? "configured" : "simulated",
      leonConnectivity: "pending",
    }),
  });
}

setInterval(() => {
  pollOnce().catch((error) => console.error("[leon-agent]", error.message));
}, POLL_INTERVAL_MS);

pollOnce().catch((error) => console.error("[leon-agent]", error.message));
