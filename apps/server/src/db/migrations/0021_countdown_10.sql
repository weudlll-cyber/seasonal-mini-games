-- @file   apps/server/src/db/migrations/0021_countdown_10.sql
-- @brief  The countdown before a round: 10 s where a game's document still holds the old 5 s.
--
-- Responsibility: owner decision O118 makes 10 s the default of `round.countdownS` (range
--                 3–30 s unchanged). Where the current version of a game's document still
--                 stores the old default, 5, a new version with 10 is written, as every settings
--                 save does (a new version row, the document moving on); any other stored value
--                 is the admin's own choice and stays. Earlier versions are kept as they were.
-- Spec:           docs/spec/08-admin-settings.md §3

WITH current_doc AS (
    SELECT d.id, d.current_version, v.document
    FROM smg.settings_documents d
    JOIN smg.settings_versions v ON v.document_id = d.id AND v.version = d.current_version
    WHERE d.id LIKE 'game.%'
      AND v.document -> 'round.countdownS' ->> 'value' = '5'
), next_version AS (
    INSERT INTO smg.settings_versions (document_id, version, document, created_by, comment)
    SELECT id, current_version + 1,
           jsonb_set(document, '{round.countdownS,value}', '10'::jsonb), NULL,
           'Migration 0021: the countdown''s default became 10 s (O118).'
    FROM current_doc
    RETURNING document_id, version
)
UPDATE smg.settings_documents d
SET current_version = n.version, updated_at = now()
FROM next_version n
WHERE d.id = n.document_id;
