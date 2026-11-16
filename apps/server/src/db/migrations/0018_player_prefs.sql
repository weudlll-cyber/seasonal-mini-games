-- @file   apps/server/src/db/migrations/0018_player_prefs.sql
-- @brief  One small value per player per match for a phased game: its pre-picks (spec/04 §4.8 rule 8).
--
-- Responsibility: the value is the game's own shape, checked against its schema and at most
--                 2 KiB before it is written (spec/06 §2.2). Only its player and the round
--                 engine at a round's opening read it; the row goes when the player leaves the
--                 match or is removed (the use case deletes it, ../../match/prefs).
-- Spec:           docs/spec/06-data-model-api-realtime.md §2.2; docs/spec/04-software-architecture.md §4.8

CREATE TABLE IF NOT EXISTS smg.match_player_prefs (
    match_id uuid NOT NULL,
    player_key text NOT NULL,
    prefs jsonb NOT NULL CHECK (octet_length(prefs::text) <= 2048),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (match_id, player_key),
    FOREIGN KEY (match_id, player_key) REFERENCES smg.match_players (match_id, player_key)
);
