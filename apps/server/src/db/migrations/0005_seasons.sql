-- @file   apps/server/src/db/migrations/0005_seasons.sql
-- @brief  The In Season feed's last answer and the halving days.
--
-- Responsibility: season_feed_state holds one row: the last good answer of the feed and the
--                 last error (07 §5); halving_days lists the real halving days, from the feed
--                 or entered by a season admin; admin entries are never overwritten by the
--                 feed (06 §2.6). Edits of halving days are audited by the routes.
-- Spec:           docs/spec/06-data-model-api-realtime.md §2.6; docs/spec/07-integration.md §5

CREATE TABLE smg.season_feed_state (
    id int PRIMARY KEY CHECK (id = 1),
    season text CHECK (season IN ('spring', 'summer', 'autumn', 'winter')),
    token text,
    since timestamptz,
    fetched_at timestamptz,
    last_error text
);
INSERT INTO smg.season_feed_state (id) VALUES (1);

CREATE TABLE smg.halving_days (
    day date NOT NULL,
    token text NOT NULL CHECK (length(token) BETWEEN 1 AND 40),
    source text NOT NULL CHECK (source IN ('feed', 'admin')),
    created_by uuid REFERENCES smg.accounts (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (day, token)
);
