-- @file   apps/server/src/db/migrations/0001_initial.sql
-- @brief  Create the smg schema, the role catalogue and the settings tables.
--
-- Responsibility: roles and role_permissions (Bingo 04 §3.1) with the permissions of
--                 05 §1, and the versioned settings documents (Bingo 04 §3.2). A document
--                 row is created the first time an admin saves it; until then its defaults
--                 come from the catalogue (packages/contracts, games/*/src/settings).
-- Spec:           docs/spec/06-data-model-api-realtime.md §1; docs/spec/05-security-threat-model.md §1

CREATE SCHEMA IF NOT EXISTS smg;

CREATE TABLE smg.roles (
    id text PRIMARY KEY,
    description text NOT NULL
);

CREATE TABLE smg.role_permissions (
    role_id text NOT NULL REFERENCES smg.roles (id) ON DELETE CASCADE,
    permission text NOT NULL,
    PRIMARY KEY (role_id, permission)
);

CREATE TABLE smg.settings_documents (
    id text PRIMARY KEY,
    current_version integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE smg.settings_versions (
    document_id text NOT NULL REFERENCES smg.settings_documents (id) ON DELETE CASCADE,
    version integer NOT NULL,
    document jsonb NOT NULL,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    comment text,
    PRIMARY KEY (document_id, version)
);

INSERT INTO smg.roles (id, description) VALUES
    ('super_admin', 'Full access, assigns roles.'),
    ('security_admin', 'Security, rate limits, integrations, audit log, account suspension.'),
    ('game_admin', 'Game and match settings, seasons and halving days, matches.'),
    ('moderator', 'Abuse signals, round results and kicks.'),
    ('organizer', 'Hosts matches and runs their rounds.'),
    ('player', 'Default role for registered users.'),
    ('guest', 'Watches rounds.');

-- Code checks permissions, never role names (Bingo 03 §5.2).
INSERT INTO smg.role_permissions (role_id, permission) VALUES
    ('guest', 'match.watch'),
    ('player', 'match.watch'), ('player', 'match.join'),
    ('organizer', 'match.watch'), ('organizer', 'match.join'), ('organizer', 'match.create'),
    ('organizer', 'match.manage'), ('organizer', 'round.manage'),
    ('moderator', 'match.watch'), ('moderator', 'admin.view'), ('moderator', 'abuse.view'),
    ('moderator', 'account.view'), ('moderator', 'match.abort'), ('moderator', 'leaderboard.adjust'),
    ('game_admin', 'match.watch'), ('game_admin', 'match.create'), ('game_admin', 'match.manage'),
    ('game_admin', 'round.manage'), ('game_admin', 'match.abort'), ('game_admin', 'admin.view'),
    ('game_admin', 'settings.game.edit'), ('game_admin', 'season.manage'),
    ('game_admin', 'account.view'),
    ('security_admin', 'admin.view'), ('security_admin', 'settings.security.edit'),
    ('security_admin', 'audit.read'), ('security_admin', 'account.view'),
    ('security_admin', 'account.suspend'), ('security_admin', 'abuse.view');

-- super_admin holds every permission above plus role assignment.
INSERT INTO smg.role_permissions (role_id, permission)
SELECT DISTINCT 'super_admin', permission FROM smg.role_permissions
UNION SELECT 'super_admin', 'role.assign';
