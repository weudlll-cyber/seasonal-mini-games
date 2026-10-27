-- @file   apps/server/src/db/migrations/0006_leaderboards.sql
-- @brief  Leaderboard periods, league awards and entries, adjustments, and the team league.
--
-- Responsibility: the tables of 06 §2.6 (Bingo 04 §3.4, with wins and solves instead of
--                 season completes). A match awards once per period and account
--                 (`league_awards`, replaced as its rounds end, removed when the match is
--                 aborted, DECISIONS T70); `league_entries` is the sum of a period's awards and
--                 adjustments, recomputed in the same transaction. Adjustments need a reason
--                 and are append-only, like the audit log. One all-time period exists from the
--                 start; season periods (one calendar quarter each) are created when their
--                 first match awards points.
-- Spec:           docs/spec/06-data-model-api-realtime.md §2.6; Bingo 04 §3.4, Bingo 03 §11

CREATE TABLE smg.leaderboard_periods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind text NOT NULL CHECK (kind IN ('season', 'all_time')),
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
    starts_at timestamptz NOT NULL,
    ends_at timestamptz,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    config jsonb NOT NULL DEFAULT '{}',
    CHECK ((kind = 'all_time') = (ends_at IS NULL))
);
-- One all-time board, and one season board per quarter.
CREATE UNIQUE INDEX leaderboard_periods_one_all_time ON smg.leaderboard_periods (kind)
    WHERE kind = 'all_time';
CREATE UNIQUE INDEX leaderboard_periods_one_per_start ON smg.leaderboard_periods (kind, starts_at);
INSERT INTO smg.leaderboard_periods (kind, name, starts_at) VALUES ('all_time', 'All time', now());

CREATE TABLE smg.league_awards (
    period_id uuid NOT NULL REFERENCES smg.leaderboard_periods (id),
    account_id uuid NOT NULL REFERENCES smg.accounts (id) ON DELETE CASCADE,
    match_id uuid NOT NULL REFERENCES smg.matches (id),
    points int NOT NULL,
    wins int NOT NULL,
    solves int NOT NULL,
    place int NOT NULL CHECK (place > 0),
    PRIMARY KEY (period_id, account_id, match_id)
);
CREATE INDEX league_awards_match ON smg.league_awards (match_id);

CREATE TABLE smg.league_entries (
    period_id uuid NOT NULL REFERENCES smg.leaderboard_periods (id),
    account_id uuid NOT NULL REFERENCES smg.accounts (id) ON DELETE CASCADE,
    points int NOT NULL,
    wins int NOT NULL,
    solves int NOT NULL,
    matches int NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (period_id, account_id)
);
CREATE INDEX league_entries_rank ON smg.league_entries (period_id, points DESC, wins DESC, solves DESC);

CREATE TABLE smg.leaderboard_adjustments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id uuid NOT NULL REFERENCES smg.leaderboard_periods (id),
    account_id uuid NOT NULL REFERENCES smg.accounts (id) ON DELETE CASCADE,
    delta int NOT NULL CHECK (delta <> 0),
    reason text NOT NULL CHECK (length(reason) BETWEEN 3 AND 500),
    actor_account_id uuid REFERENCES smg.accounts (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leaderboard_adjustments_account ON smg.leaderboard_adjustments (account_id, created_at);
CREATE TRIGGER leaderboard_adjustments_append_only BEFORE UPDATE OR DELETE ON smg.leaderboard_adjustments
    FOR EACH ROW EXECUTE FUNCTION smg.reject_change();

CREATE TABLE smg.team_league_awards (
    period_id uuid NOT NULL REFERENCES smg.leaderboard_periods (id),
    team text NOT NULL CHECK (team IN ('spring', 'summer', 'autumn', 'winter')),
    match_id uuid NOT NULL REFERENCES smg.matches (id),
    points int NOT NULL,
    wins int NOT NULL,
    PRIMARY KEY (period_id, team, match_id)
);
CREATE INDEX team_league_awards_match ON smg.team_league_awards (match_id);

CREATE TABLE smg.team_league_entries (
    period_id uuid NOT NULL REFERENCES smg.leaderboard_periods (id),
    team text NOT NULL CHECK (team IN ('spring', 'summer', 'autumn', 'winter')),
    points int NOT NULL,
    wins int NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (period_id, team)
);
