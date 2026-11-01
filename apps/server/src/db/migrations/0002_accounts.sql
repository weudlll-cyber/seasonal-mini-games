-- @file   apps/server/src/db/migrations/0002_accounts.sql
-- @brief  Local accounts, sessions and role assignments (taken over from Bingo).
--
-- Responsibility: accounts, sessions and role_assignments of Bingo 04 §3.1. E-mail
--                 verification and 2FA tables arrive when those features leave their flags.
-- Spec:           docs/spec/06-data-model-api-realtime.md §1; Bingo 04 §3.1; Bingo 03 §2.1, §3, §5

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE smg.accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email citext UNIQUE,
    email_verified_at timestamptz,
    password_hash text,
    display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 3 AND 24),
    display_name_key citext NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz
);

-- The cookie carries a random 256-bit id; only its SHA-256 is stored (03 §3). Guest
-- sessions have no account. csrf_token is the per-session synchronizer token (03 §8).
CREATE TABLE smg.sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid REFERENCES smg.accounts (id) ON DELETE CASCADE,
    token_hash bytea NOT NULL UNIQUE,
    csrf_token text NOT NULL,
    kind text NOT NULL CHECK (kind IN ('player', 'admin', 'guest')),
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    idle_expires_at timestamptz NOT NULL,
    last_2fa_at timestamptz,
    user_agent text,
    ip_prefix inet,
    revoked_at timestamptz
);
CREATE INDEX sessions_account_active ON smg.sessions (account_id) WHERE revoked_at IS NULL;

CREATE TABLE smg.role_assignments (
    account_id uuid NOT NULL REFERENCES smg.accounts (id) ON DELETE CASCADE,
    role_id text NOT NULL REFERENCES smg.roles (id),
    granted_by uuid,
    granted_at timestamptz NOT NULL DEFAULT now(),
    source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'idp_mapping')),
    PRIMARY KEY (account_id, role_id)
);
