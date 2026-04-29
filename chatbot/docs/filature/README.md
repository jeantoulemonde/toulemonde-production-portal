# chatbot/docs — Documentation RAG Toulemonde

Ce dossier contient tous les documents qui alimentent 
la base de connaissances du chatbot Léon.

## Structure
technique/   → fiches produits et glossaire
commercial/  → histoire, engagements, coloris
faq/         → questions fréquentes clients

## Indexer ces documents
node chatbot/scripts/ingestDocuments.js \
  --source filature \
  --dir chatbot/docs/filature/

## Mettre à jour
1. Modifier ou ajouter un fichier .md
2. Relancer le script (idempotent)
3. Le bot utilise immédiatement les nouvelles infos
