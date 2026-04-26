# SageSimu - adaptation portail Toulemonde Production

## Objectif

`sage_simu` simule une base Sage 100 simplifiee pour valider le flux portail client -> SageSimu -> suivi admin. La V1 ne cherche pas a reproduire tout Sage : elle conserve les tables existantes et ajoute seulement des colonnes de liaison `PORTAL_*`.

## Mapping V1

| Portail | SageSimu |
| --- | --- |
| `portal_clients` | `"F_COMPTET"` |
| `portal_orders` | `"F_DOCENTETE"` |
| `portal_order_lines` | `"F_DOCLIGNE"` |
| Configuration technique fil | Article generique `"FIL-SPECIFIQUE"` + colonnes `PORTAL_*` |

En V1, toutes les lignes de demande utilisent l'article generique :

```txt
FIL-SPECIFIQUE - Fil spécifique portail client
```

Les details techniques de chaque configuration fil sont conserves dans `"F_DOCLIGNE"` via les colonnes `PORTAL_APPLICATION_TYPE`, `PORTAL_MATERIAL_FAMILY`, `PORTAL_YARN_COUNT_NM`, `PORTAL_PACKAGING`, `PORTAL_QUANTITY_KG`, etc.

## Audit avant migration

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('F_ARTICLE', 'F_COMPTET', 'F_DOCENTETE', 'F_DOCLIGNE')
ORDER BY table_name, ordinal_position;
```

## Execution du script

Depuis la racine du projet :

```bash
psql -d sage_simu -f backend/sql/sage_simu_portal_adaptation.sql
```

Le script est non destructif :

- pas de `DROP TABLE`
- pas de suppression de colonne
- pas de suppression de donnees
- uniquement `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` et insertion conditionnelle de l'article generique

## Tests SQL

```sql
SELECT *
FROM "F_ARTICLE"
WHERE "AR_Ref" = 'FIL-SPECIFIQUE';

SELECT column_name
FROM information_schema.columns
WHERE table_name = 'F_DOCENTETE'
  AND column_name LIKE 'PORTAL_%'
ORDER BY column_name;

SELECT column_name
FROM information_schema.columns
WHERE table_name = 'F_DOCLIGNE'
  AND column_name LIKE 'PORTAL_%'
ORDER BY column_name;
```

## Notes connecteur

Le connecteur sortant du portail detecte les colonnes presentes dans SageSimu avant insertion. Si les colonnes `PORTAL_*` existent, elles sont renseignees. Si certaines colonnes standard SageSimu sont absentes, le connecteur ignore les colonnes absentes au lieu d'ecrire en dur dans un schema suppose.
