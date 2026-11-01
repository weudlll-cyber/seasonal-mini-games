-- @file   apps/server/src/db/migrations/0004_matches_rounds.sql
-- @brief  Matches, their players, rounds with the append-only event log, results, standings
--         and the scheduled actions that drive round timing.
--
-- Responsibility: the tables of 06 §2.1–§2.5. Players are keyed by `player_key` (the
--                 account id, or `bot-NN` for development bots). `round_events` is
--                 append-only by trigger, like the audit log; snapshots hold no secret
--                 (secrets are derived from the sealed seed again on load). Results and
--                 standings are written in the transaction that appends `RoundEnded`.
--                 Accounts may be deleted: references to them become NULL, history stays.
-- Spec:           docs/spec/06-data-model-api-realtime.md §2.1–§2.5; docs/spec/04-software-architecture.md §5.3–§5.5

CREATE TABLE smg.matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    game_id text NOT NULL,
    title text NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
    status text NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'open', 'closed', 'aborted')),
    visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted')),
    max_players int NOT NULL CHECK (max_players BETWEEN 2 AND 1000),
    counts_for_leaderboard bool NOT NULL DEFAULT true,
    created_by uuid REFERENCES smg.accounts (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz,
    aborted_reason text,
    aborted_by text CHECK (aborted_by IN ('host', 'system')),
    version bigint NOT NULL DEFAULT 1
);
CREATE INDEX matches_status ON smg.matches (status, created_at DESC);

CREATE TABLE smg.match_players (
    match_id uuid NOT NULL REFERENCES smg.matches (id),
    player_key text NOT NULL,
    account_id uuid REFERENCES smg.accounts (id) ON DELETE SET NULL,
    joined_at timestamptz NOT NULL DEFAULT now(),
    left_at timestamptz,
    state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'left', 'kicked')),
    team text CHECK (team IN ('spring', 'summer', 'autumn', 'winter')),
    team_chosen_at timestamptz,
    PRIMARY KEY (match_id, player_key)
);
CREATE INDEX match_players_account ON smg.match_players (account_id, match_id);

CREATE TABLE smg.rounds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid NOT NULL REFERENCES smg.matches (id),
    round_index int NOT NULL,
    game_id text NOT NULL,
    status text NOT NULL DEFAULT 'created'
        CHECK (status IN ('created', 'countdown', 'open', 'ended', 'aborted')),
    secret_mode text NOT NULL CHECK (secret_mode IN ('shared', 'individual')),
    season text NOT NULL CHECK (season IN ('spring', 'summer', 'autumn', 'winter')),
    season_source text NOT NULL CHECK (season_source IN ('inSeason', 'manual')),
    special_on bool NOT NULL,
    halving bool NOT NULL,
    teams_on bool NOT NULL CHECK (NOT teams_on OR secret_mode = 'shared'),
    cooldown_ms int NOT NULL CHECK (cooldown_ms BETWEEN 3000 AND 60000),
    settings jsonb NOT NULL,
    seed_commitment bytea,
    seed_enc bytea NOT NULL,
    opens_at timestamptz,
    ended_at timestamptz,
    end_reason text CHECK (end_reason IN ('solved', 'allSolved', 'timeUp', 'host', 'noPlayers', 'game')),
    aborted_reason text,
    aborted_by text,
    created_by uuid REFERENCES smg.accounts (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (match_id, round_index)
);
-- At most one round per match runs at a time (06 §3.1 ROUND_RUNNING).
CREATE UNIQUE INDEX rounds_one_running ON smg.rounds (match_id)
    WHERE status IN ('created', 'countdown', 'open');

CREATE TABLE smg.round_events (
    round_id uuid NOT NULL REFERENCES smg.rounds (id),
    seq bigint NOT NULL CHECK (seq > 0),
    type text NOT NULL,
    payload jsonb NOT NULL,
    occurred_at timestamptz NOT NULL,
    actor_account_id uuid,
    PRIMARY KEY (round_id, seq)
);
CREATE TRIGGER round_events_append_only BEFORE UPDATE OR DELETE ON smg.round_events
    FOR EACH ROW EXECUTE FUNCTION smg.reject_change();
CREATE TRIGGER round_events_no_truncate BEFORE TRUNCATE ON smg.round_events
    FOR EACH STATEMENT EXECUTE FUNCTION smg.reject_change();

CREATE TABLE smg.round_snapshots (
    round_id uuid NOT NULL REFERENCES smg.rounds (id),
    seq bigint NOT NULL,
    state jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (round_id, seq)
);

CREATE TABLE smg.round_results (
    round_id uuid NOT NULL REFERENCES smg.rounds (id),
    player_key text NOT NULL,
    place int CHECK (place > 0),
    solved bool NOT NULL,
    solve_receive_seq bigint,
    solve_at timestamptz,
    guesses int NOT NULL,
    team text,
    points int NOT NULL,
    secret int,
    PRIMARY KEY (round_id, player_key)
);
-- Two players can never share a place (09 §3 G4).
CREATE UNIQUE INDEX round_results_place ON smg.round_results (round_id, place)
    WHERE place IS NOT NULL;

CREATE TABLE smg.round_team_results (
    round_id uuid NOT NULL REFERENCES smg.rounds (id),
    team text NOT NULL,
    members int NOT NULL,
    points int NOT NULL,
    won bool NOT NULL,
    PRIMARY KEY (round_id, team)
);

CREATE TABLE smg.match_standings (
    match_id uuid NOT NULL REFERENCES smg.matches (id),
    player_key text NOT NULL,
    points int NOT NULL,
    wins int NOT NULL,
    first_win_at timestamptz,
    rank int NOT NULL,
    PRIMARY KEY (match_id, player_key)
);

CREATE TABLE smg.match_team_standings (
    match_id uuid NOT NULL REFERENCES smg.matches (id),
    team text NOT NULL,
    points int NOT NULL,
    wins int NOT NULL,
    first_win_at timestamptz,
    rank int NOT NULL,
    PRIMARY KEY (match_id, team)
);

-- Timed round commands with leases (Bingo 04 §3.3), so a restarted server continues them.
CREATE TABLE smg.scheduled_actions (
    id bigserial PRIMARY KEY,
    round_id uuid NOT NULL REFERENCES smg.rounds (id),
    kind text NOT NULL CHECK (kind IN ('round_open', 'special', 'round_time_up')),
    payload jsonb NOT NULL DEFAULT '{}',
    due_at timestamptz NOT NULL,
    lease_owner text,
    lease_until timestamptz,
    attempts int NOT NULL DEFAULT 0,
    done_at timestamptz
);
CREATE INDEX scheduled_actions_due ON smg.scheduled_actions (due_at) WHERE done_at IS NULL;
