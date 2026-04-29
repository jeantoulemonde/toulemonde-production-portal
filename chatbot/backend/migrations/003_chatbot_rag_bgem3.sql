-- ============================================================================
-- POC chatbot — bascule embedding nomic-embed-text (768D) → bge-m3 (1024D).
-- Migration idempotente : peut être rejouée sans risque.
-- Retrait : voir 003_chatbot_rag_bgem3.down.sql (revient en 768D).
-- ============================================================================
-- ATTENTION : la dimension d'une colonne vector ne peut pas être modifiée
-- via ALTER. On droppe l'index puis la colonne, on la recrée en 1024D, on
-- recrée l'index HNSW. Toutes les valeurs existantes sont effacées — c'est
-- voulu, elles sont de toute façon issues d'un autre modèle d'embedding.
-- Re-ingest : `node chatbot/scripts/syncProductCatalog.js` + ingestDocuments.

DO $$
BEGIN
  -- Si la colonne existe déjà en 1024D, on ne fait rien (idempotence).
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_documents' AND column_name = 'embedding'
      AND udt_name = 'vector'
  ) THEN
    -- Vérifier la dimension via pg_attribute typmod (vector(N) stocké en typmod).
    IF (
      SELECT a.atttypmod
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      WHERE c.relname = 'chat_documents' AND a.attname = 'embedding'
    ) <> 1024 THEN
      DROP INDEX IF EXISTS idx_chat_documents_embedding_hnsw;
      ALTER TABLE chat_documents DROP COLUMN embedding;
      ALTER TABLE chat_documents ADD COLUMN embedding vector(1024);
    END IF;
  END IF;
END$$;

-- Recrée l'index HNSW (no-op s'il existe).
CREATE INDEX IF NOT EXISTS idx_chat_documents_embedding_hnsw
  ON chat_documents
  USING hnsw (embedding vector_cosine_ops);
