-- @file   apps/server/src/db/migrations/0012_team_match.sql
-- @brief  Whether a match is a team match, chosen by the host when opening it.
--
-- Responsibility: owner decision O34: the host chooses per match whether the season teams
--                 play, default on (the behaviour of every match so far, so existing matches
--                 keep it). Without teams the server ignores team choices and its rounds run
--                 with teams off, so no team result, standing or league points arise.
-- Spec:           docs/spec/06-data-model-api-realtime.md §2.2; docs/spec/03-seasonal-specials.md §5

ALTER TABLE smg.matches ADD COLUMN team_match bool NOT NULL DEFAULT true;
