-- @file   apps/server/src/db/migrations/0009_integration.sql
-- @brief  Integration: identity providers for the JWT handoff, linked identities, the replay
--         cache, the embed allowlist, and outbound webhooks with their deliveries.
--
-- Responsibility: the tables of Bingo 04 §3.1, §3.2, §3.6 for 07 §1: a `jwt_handoff`
--                 provider holds the host's issuer, audience (`seasonal-mini-games`), allowed
--                 algorithms and its pinned public key (PEM) or JWKS address, and the role
--                 mapping, which can never grant security_admin or super_admin (checked by
--                 the code that applies it); an account is linked by (provider, subject) only,
--                 never by e-mail, and keeps the last claims it needs (name, `links`, 07 §4);
--                 a token's `jti` is spent once (cleaned after it expires); `embed_origins`
--                 drives frame-ancestors, the postMessage, socket and CORS checks; a webhook
--                 endpoint has its HTTPS address, its HMAC secret (sealed) and its events, and
--                 every delivery attempt is kept for a while for the admin.
-- Spec:           docs/spec/07-integration.md §1, §3.2, §4; Bingo 04 §3.1, §3.2, §3.6, Bingo 07 §2.2, §3.4, §5

CREATE TABLE smg.identity_providers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind text NOT NULL CHECK (kind IN ('jwt_handoff')),
    name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    issuer text NOT NULL UNIQUE,
    audience text NOT NULL DEFAULT 'seasonal-mini-games',
    allowed_algs text[] NOT NULL DEFAULT '{EdDSA}',
    jwks_url text,
    pinned_public_key text,
    role_mapping jsonb NOT NULL DEFAULT '{}',
    enabled bool NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (jwks_url IS NOT NULL OR pinned_public_key IS NOT NULL)
);

CREATE TABLE smg.external_identities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES smg.accounts (id) ON DELETE CASCADE,
    provider_id uuid NOT NULL REFERENCES smg.identity_providers (id) ON DELETE CASCADE,
    subject text NOT NULL,
    last_claims jsonb NOT NULL DEFAULT '{}',
    linked_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider_id, subject)
);
CREATE INDEX external_identities_account ON smg.external_identities (account_id);

CREATE TABLE smg.jwt_replay_cache (
    issuer text NOT NULL,
    jti text NOT NULL,
    expires_at timestamptz NOT NULL,
    PRIMARY KEY (issuer, jti)
);
CREATE INDEX jwt_replay_cache_expiry ON smg.jwt_replay_cache (expires_at);

CREATE TABLE smg.embed_origins (
    origin text PRIMARY KEY CHECK (origin ~ '^https?://[^/]+$'),
    label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
    allow_auth_handoff bool NOT NULL DEFAULT false,
    created_by uuid REFERENCES smg.accounts (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE smg.webhook_endpoints (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    url text NOT NULL CHECK (url ~ '^https://'),
    secret_enc bytea NOT NULL,
    events text[] NOT NULL CHECK (cardinality(events) > 0),
    enabled bool NOT NULL DEFAULT true,
    created_by uuid REFERENCES smg.accounts (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE smg.webhook_deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id uuid NOT NULL REFERENCES smg.webhook_endpoints (id) ON DELETE CASCADE,
    event text NOT NULL,
    payload jsonb NOT NULL,
    attempts int NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
    last_error text,
    next_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    delivered_at timestamptz
);
CREATE INDEX webhook_deliveries_due ON smg.webhook_deliveries (next_at) WHERE status = 'pending';
