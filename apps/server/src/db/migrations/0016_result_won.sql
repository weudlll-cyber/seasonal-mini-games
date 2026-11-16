-- @file   apps/server/src/db/migrations/0016_result_won.sql
-- @brief  `round_results.won`: a round win, written by the round's own rule (DECISIONS T287).
--
-- Responsibility: a phased round (Seasonal Mind Games, spec/04 §4.8 rule 6) has several winners
--                 who share one win, so a win can no longer be read as `place = 1`, and the
--                 unique place per round stays as it is. Every row written before this is a
--                 guess game's, whose win is its place 1, so the existing rows get exactly that
--                 and every standing and board computed from them stays the same. Safe to run
--                 again: the column is added once and the update sets the same values.
-- Spec:           docs/spec/06-data-model-api-realtime.md §2.4; docs/spec/04-software-architecture.md §4.8

ALTER TABLE smg.round_results ADD COLUMN IF NOT EXISTS won boolean NOT NULL DEFAULT false;

UPDATE smg.round_results SET won = true WHERE place = 1 AND NOT won;
