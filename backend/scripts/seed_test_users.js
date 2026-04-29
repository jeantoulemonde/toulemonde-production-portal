#!/usr/bin/env node
/**
 * Seed de comptes de test pour valider les 3 personas client + 1 commercial.
 *
 * Idempotent : rejouable sans danger (INSERT ... ON CONFLICT DO NOTHING).
 *
 *   node backend/scripts/seed_test_users.js
 */

const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB || "toulemonde_portal",
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

const CLIENTS = [
  {
    customer_code: "CLI-YARN",
    company_name: "Atelier Industriel Test",
    contact_email: "yarn@toulemonde-demo.local",
    access_yarn: 1,
    access_mercerie: 0,
  },
  {
    customer_code: "CLI-MERC",
    company_name: "Boutique Mercerie Test",
    contact_email: "mercerie@toulemonde-demo.local",
    access_yarn: 0,
    access_mercerie: 1,
  },
  {
    customer_code: "CLI-MIX",
    company_name: "Textile Mixte Test",
    contact_email: "mixte@toulemonde-demo.local",
    access_yarn: 1,
    access_mercerie: 1,
  },
];

const USERS = [
  { email: "yarn@toulemonde-demo.local",     password: "Yarn123!",      full_name: "Client Yarn",     role: "client",      client_code: "CLI-YARN" },
  { email: "mercerie@toulemonde-demo.local", password: "Mercerie123!",  full_name: "Client Mercerie", role: "client",      client_code: "CLI-MERC" },
  { email: "mixte@toulemonde-demo.local",    password: "Mixte123!",     full_name: "Client Mixte",    role: "client",      client_code: "CLI-MIX" },
  { email: "commercial@toulemonde.local",    password: "Commercial123!", full_name: "Commercial Test", role: "commercial", client_code: null      },
];

async function upsertClient(c) {
  const result = await pool.query(
    `INSERT INTO portal_clients (customer_code, company_name, contact_email, email, access_yarn, access_mercerie, is_active, status)
     VALUES ($1, $2, $3, $3, $4, $5, 1, 'active')
     ON CONFLICT (customer_code) DO UPDATE SET
       company_name = EXCLUDED.company_name,
       contact_email = EXCLUDED.contact_email,
       email = EXCLUDED.email,
       access_yarn = EXCLUDED.access_yarn,
       access_mercerie = EXCLUDED.access_mercerie,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id, customer_code, access_yarn, access_mercerie`,
    [c.customer_code, c.company_name, c.contact_email, c.access_yarn, c.access_mercerie]
  );
  return result.rows[0];
}

async function upsertUser(u, clientId) {
  const hash = await bcrypt.hash(u.password, 12);
  await pool.query(
    `INSERT INTO portal_users (email, password_hash, full_name, role, client_code, client_id, is_active, status)
     VALUES ($1, $2, $3, $4, $5, $6, 1, 'active')
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       full_name = EXCLUDED.full_name,
       role = EXCLUDED.role,
       client_code = EXCLUDED.client_code,
       client_id = EXCLUDED.client_id,
       is_active = 1,
       status = 'active',
       updated_at = CURRENT_TIMESTAMP`,
    [u.email, hash, u.full_name, u.role, u.client_code, clientId]
  );
}

async function main() {
  console.log("Seed comptes de test :\n");

  const clientIds = {};
  for (const c of CLIENTS) {
    const row = await upsertClient(c);
    clientIds[row.customer_code] = row.id;
    const tag = row.access_yarn && row.access_mercerie ? "MIXTE" : row.access_yarn ? "YARN" : "MERC";
    console.log(`  client  [${tag.padEnd(5)}] ${row.customer_code.padEnd(10)} → ${c.company_name}`);
  }

  console.log("");
  for (const u of USERS) {
    const clientId = u.client_code ? clientIds[u.client_code] : null;
    await upsertUser(u, clientId);
    console.log(`  user    [${u.role.padEnd(11)}] ${u.email.padEnd(36)} → mdp: ${u.password}`);
  }

  console.log("\n✓ Seed terminé.");
  await pool.end();
}

main().catch((err) => {
  console.error("[ERREUR]", err.message);
  process.exitCode = 1;
});
