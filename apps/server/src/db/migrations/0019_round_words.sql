-- @file   apps/server/src/db/migrations/0019_round_words.sql
-- @brief  A phased round's outcome in its game's words, for the match summary (spec/02e §9).
--
-- Responsibility: written once when a phased round ends: the game's words for what won
--                 ("Winter was the least chosen (3 players)", its `reveal`), or an empty text
--                 when nobody won. NULL for every guess round, whose summary is unchanged
--                 (DECISIONS T333).
-- Spec:           docs/spec/02e-game-mind-games.md §9; docs/spec/06-data-model-api-realtime.md §2.3

ALTER TABLE smg.rounds ADD COLUMN IF NOT EXISTS outcome_words text NULL;
