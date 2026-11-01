-- @file   apps/server/src/db/migrations/0008_admin.sql
-- @brief  Two-factor sign-in for staff (TOTP and recovery codes) and staff removal of a
--         round result.
--
-- Responsibility: one TOTP factor per account (Bingo 04 §3.1): its secret sealed at rest
--                 like round seeds, confirmed once the first code is right, and the last time
--                 step used so a code works only once; ten single-use recovery codes, stored as
--                 hashes. A removed round result (06 §3.2, `POST /admin/rounds/:id/results/
--                 :playerKey/remove`, reason required) is a row here: the result row stays,
--                 placings and standings leave it out, and the step is audited. A session's
--                 last check (`sessions.last_2fa_at`, 0002) is the step-up.
-- Spec:           docs/spec/06-data-model-api-realtime.md §1, §3.2; Bingo 04 §3.1, Bingo 03 §2, Bingo 11 §1

CREATE TABLE smg.totp_factors (
    account_id uuid PRIMARY KEY REFERENCES smg.accounts (id) ON DELETE CASCADE,
    secret_enc bytea NOT NULL,
    confirmed_at timestamptz,
    last_step bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE smg.recovery_codes (
    account_id uuid NOT NULL REFERENCES smg.accounts (id) ON DELETE CASCADE,
    code_hash bytea NOT NULL,
    used_at timestamptz,
    PRIMARY KEY (account_id, code_hash)
);

CREATE TABLE smg.round_result_removals (
    round_id uuid NOT NULL REFERENCES smg.rounds (id),
    player_key text NOT NULL,
    reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
    removed_by uuid REFERENCES smg.accounts (id) ON DELETE SET NULL,
    removed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (round_id, player_key)
);
