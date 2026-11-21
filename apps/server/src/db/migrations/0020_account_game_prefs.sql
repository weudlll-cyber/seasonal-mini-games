-- @file   apps/server/src/db/migrations/0020_account_game_prefs.sql
-- @brief  The part of a phased game's player value that holds per account, across matches.
--
-- Responsibility: one small value per account and game: the keys of the game's value it names
--                 as the player's own across matches (Seasonal Mind Games' "Hide my switches",
--                 owner decision O116). Checked against the game's schema and at most 2 KiB
--                 before it is written, like the match's value (0018). Only the account itself
--                 and the round engine at a round's opening read it; it goes with the account.
-- Spec:           docs/spec/06-data-model-api-realtime.md §2.2; docs/spec/04-software-architecture.md §4.8

CREATE TABLE IF NOT EXISTS smg.account_game_prefs (
    account_id uuid NOT NULL REFERENCES smg.accounts (id) ON DELETE CASCADE,
    game_id text NOT NULL,
    prefs jsonb NOT NULL CHECK (octet_length(prefs::text) <= 2048),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, game_id)
);
