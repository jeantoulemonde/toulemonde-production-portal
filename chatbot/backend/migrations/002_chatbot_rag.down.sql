-- Migration de retrait jumelle de 002_chatbot_rag.sql.
-- Non exécutée automatiquement. À lancer manuellement pour retirer le RAG.
-- ATTENTION : supprime tous les documents indexés et les analytics RAG.
-- L'extension pgvector elle-même est laissée en place (peut servir ailleurs).

DROP TABLE IF EXISTS chat_rag_queries;
DROP TRIGGER IF EXISTS trg_chat_documents_updated_at ON chat_documents;
DROP FUNCTION IF EXISTS chat_documents_set_updated_at();
DROP INDEX IF EXISTS idx_chat_documents_embedding_hnsw;
DROP INDEX IF EXISTS idx_chat_documents_source_type;
DROP TABLE IF EXISTS chat_documents;
-- DROP EXTENSION vector;  -- décommenter pour supprimer aussi l'extension
