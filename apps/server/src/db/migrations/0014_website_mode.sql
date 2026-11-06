-- @file   apps/server/src/db/migrations/0014_website_mode.sql
-- @brief  Website mode (O66): the website as a `proxy_header` provider, the members' Discord
--         steps, and the account-changes feed's cursor.
--
-- Responsibility: smg.identity_providers takes the kind `proxy_header` (the Seasonal
--                 Entertainment website, issuer = the site origin, created at its first
--                 sign-in, Bingo D37); its key check applies to `jwt_handoff` only, since the
--                 website signs no token. smg.accounts keeps the steps the website sent at the
--                 last sign-in (at most three, a JSON array; standalone accounts keep `[]`).
--                 smg.website_feed is one row: the cursor of the website's account-changes
--                 feed, the last successful poll (`smg status` reads it through /readyz) and
--                 the last failure's time.
-- Spec:           docs/spec/07-integration.md §7; docs/spec/06-data-model-api-realtime.md §1, §2.9;
--                 Bingo 07 §2.3

ALTER TABLE smg.identity_providers DROP CONSTRAINT identity_providers_kind_check;
ALTER TABLE smg.identity_providers
    ADD CONSTRAINT identity_providers_kind_check CHECK (kind IN ('jwt_handoff', 'proxy_header'));
ALTER TABLE smg.identity_providers DROP CONSTRAINT identity_providers_check;
ALTER TABLE smg.identity_providers
    ADD CONSTRAINT identity_providers_key_check
    CHECK (kind <> 'jwt_handoff' OR jwks_url IS NOT NULL OR pinned_public_key IS NOT NULL);

ALTER TABLE smg.accounts
    ADD COLUMN steps jsonb NOT NULL DEFAULT '[]'
    CHECK (jsonb_typeof(steps) = 'array' AND jsonb_array_length(steps) <= 3);

CREATE TABLE smg.website_feed (
    id bool PRIMARY KEY DEFAULT true CHECK (id),
    cursor text NOT NULL DEFAULT '0' CHECK (char_length(cursor) BETWEEN 1 AND 128),
    last_success_at timestamptz,
    last_failure_at timestamptz
);
INSERT INTO smg.website_feed DEFAULT VALUES;
