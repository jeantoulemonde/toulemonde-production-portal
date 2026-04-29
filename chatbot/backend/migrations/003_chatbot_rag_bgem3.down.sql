-- ============================================================================
-- Rollback : repasse l'embedding en 768D (nomic-embed-text). Idempotent.
-- ============================================================================
DO $$
BEGIN
  IF (
    SELECT a.atttypmod
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'chat_documents' AND a.attname = 'embedding'
  ) <> 768 THEN
    DROP INDEX IF EXISTS idx_chat_documents_embedding_hnsw;
    ALTER TABLE chat_documents DROP COLUMN embedding;
    ALTER TABLE chat_documents ADD COLUMN embedding vector(768);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_chat_documents_embedding_hnsw
  ON chat_documents
  USING hnsw (embedding vector_cosine_ops);
