-- @file   apps/server/src/db/migrations/0013_target_tiles.sql
-- @brief  Seasonal Target's map size becomes its tile grid's size (owner decision O45).
--
-- Responsibility: the fine 50 × 50 map with its two settings `map.width` and `map.height`
--                 (20–100 cells) gives way to one square grid of large tiles, `target.size`
--                 (8–30 per side, default 20). A stored default or narrowed bounds of the old
--                 keys has no meaning for the new one (no old value of 31–100 fits, and a
--                 width and a height do not make one side), so where the current version of
--                 document `game.seasonal-target` holds either key, a new version without them
--                 is written, as every settings save does (a new version row, the document
--                 moving on), and the grid starts at its default of 20. Earlier versions stay
--                 as they were: the history is kept. Rounds already played keep the map size
--                 frozen in their own state.
-- Spec:           docs/spec/08-admin-settings.md §3.3; docs/spec/02d-game-seasonal-target.md §3

WITH current_doc AS (
    SELECT d.id, d.current_version, v.document
    FROM smg.settings_documents d
    JOIN smg.settings_versions v ON v.document_id = d.id AND v.version = d.current_version
    WHERE d.id = 'game.seasonal-target'
      AND (v.document ? 'map.width' OR v.document ? 'map.height')
), next_version AS (
    INSERT INTO smg.settings_versions (document_id, version, document, created_by, comment)
    SELECT id, current_version + 1, document - 'map.width' - 'map.height', NULL,
           'Migration 0013: the map size gave way to the tile grid''s size (O45).'
    FROM current_doc
    RETURNING document_id, version
)
UPDATE smg.settings_documents d
SET current_version = n.version, updated_at = now()
FROM next_version n
WHERE d.id = n.document_id;
