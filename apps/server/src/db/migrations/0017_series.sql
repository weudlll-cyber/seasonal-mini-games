-- @file   apps/server/src/db/migrations/0017_series.sql
-- @brief  A series of rounds (spec/04 §4.8 rule 7): the next round's settings and its start.
--
-- Responsibility: `matches.next_settings` holds the round settings the host saved for a
--                 series' next round (the last round's until the host changes them, spec/06
--                 §2.1). `scheduled_actions.kind` gains `match_autostart`, which spec/06 §2.5
--                 names and the table's CHECK never listed: the next round of a series, or its
--                 close after the last one, is a restart-safe row like every timed command.
--                 The CHECK is replaced by one with the same kinds plus that one, in the same
--                 transaction, so no other value ever gets in (DECISIONS T296). Safe to run again.
-- Spec:           docs/spec/06-data-model-api-realtime.md §2.1, §2.5; docs/spec/04-software-architecture.md §4.8

ALTER TABLE smg.matches ADD COLUMN IF NOT EXISTS next_settings jsonb;

ALTER TABLE smg.scheduled_actions DROP CONSTRAINT IF EXISTS scheduled_actions_kind_check;
ALTER TABLE smg.scheduled_actions ADD CONSTRAINT scheduled_actions_kind_check
    CHECK (kind IN ('round_open', 'special', 'round_time_up', 'match_autostart'));
