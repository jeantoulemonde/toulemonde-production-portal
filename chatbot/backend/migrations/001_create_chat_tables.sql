-- Tables du module chatbot. Idempotent (CREATE IF NOT EXISTS).
-- Exécuté automatiquement au premier require de chatbot/backend/db.js.

CREATE TABLE IF NOT EXISTS chat_sessions (
  id              SERIAL PRIMARY KEY,
  client_id       INTEGER,
  user_id         INTEGER,
  status          TEXT NOT NULL DEFAULT 'open',
  title           TEXT,
  last_message_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  closed_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id              SERIAL PRIMARY KEY,
  session_id      INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL,
  metadata_json   TEXT,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_escalations (
  id              SERIAL PRIMARY KEY,
  session_id      INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  requested_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  handled_by      INTEGER,
  handled_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_client ON chat_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_escalations_status ON chat_escalations(status);
