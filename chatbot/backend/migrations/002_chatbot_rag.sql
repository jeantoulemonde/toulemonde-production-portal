-- ============================================================================
-- POC chatbot — RAG (pgvector + index HNSW)
-- Migration idempotente : peut être rejouée sans risque.
-- Retrait : voir 002_chatbot_rag.down.sql
-- ============================================================================

-- 1. Extension pgvector (le paquet pgvector doit être installé au niveau OS).
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Documents indexés pour la recherche vectorielle.
--    Un document = un chunk de texte (extrait filature, fiche produit, etc.).
--    source_type   : 'filature' | 'catalogue' | 'faq' | ...
--    source_id     : identifiant stable du document source (ex: 'PROD-1234' ou 'intro_filature')
--    chunk_index   : position du chunk dans le document source (0 si document court)
--    content       : texte original du chunk
--    metadata      : libre (titre, prix, catégorie, url...)
--    embedding     : vecteur 768D produit par nomic-embed-text
CREATE TABLE IF NOT EXISTS chat_documents (
  id            SERIAL PRIMARY KEY,
  source_type   TEXT NOT NULL,
  source_id     TEXT NOT NULL,
  chunk_index   INTEGER NOT NULL DEFAULT 0,
  content       TEXT NOT NULL,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding     vector(768),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Une combinaison (source_type, source_id, chunk_index) ne peut exister qu'une fois.
-- Permet l'UPSERT propre lors des re-ingests.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_documents_source_unique'
  ) THEN
    ALTER TABLE chat_documents
      ADD CONSTRAINT chat_documents_source_unique
      UNIQUE (source_type, source_id, chunk_index);
  END IF;
END$$;

-- 3. Index HNSW pour la recherche par cosinus (utilisé par <=>).
--    HNSW est plus rapide qu'IVFFlat sur petits volumes et ne nécessite pas
--    de re-clustering après chaque insertion.
CREATE INDEX IF NOT EXISTS idx_chat_documents_embedding_hnsw
  ON chat_documents
  USING hnsw (embedding vector_cosine_ops);

-- Index sur source_type pour filtrer (ex: limiter à 'catalogue' pour une question produit)
CREATE INDEX IF NOT EXISTS idx_chat_documents_source_type
  ON chat_documents(source_type);

-- 4. Trigger updated_at automatique (idempotent).
CREATE OR REPLACE FUNCTION chat_documents_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_documents_updated_at ON chat_documents;
CREATE TRIGGER trg_chat_documents_updated_at
  BEFORE UPDATE ON chat_documents
  FOR EACH ROW
  EXECUTE FUNCTION chat_documents_set_updated_at();

-- 5. Analytics RAG (optionnel, utile pour mesurer la qualité des réponses).
--    Best-effort : l'écriture ne doit jamais bloquer une requête utilisateur.
CREATE TABLE IF NOT EXISTS chat_rag_queries (
  id            SERIAL PRIMARY KEY,
  session_id    INTEGER REFERENCES chat_sessions(id) ON DELETE SET NULL,
  query_text    TEXT NOT NULL,
  top_score     DOUBLE PRECISION,
  result_count  INTEGER NOT NULL DEFAULT 0,
  source_types  TEXT,
  duration_ms   INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_rag_queries_session
  ON chat_rag_queries(session_id);
