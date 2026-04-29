-- Migration de retrait jumelle de 001_create_chat_tables.sql.
-- Non exécutée automatiquement. À lancer manuellement pour retirer le POC chatbot.
-- ATTENTION : supprime toutes les conversations enregistrées.

DROP TABLE IF EXISTS chat_escalations;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_sessions;
