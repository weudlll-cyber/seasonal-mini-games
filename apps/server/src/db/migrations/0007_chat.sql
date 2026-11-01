-- @file   apps/server/src/db/migrations/0007_chat.sql
-- @brief  The builtin chat: rooms, messages, reports, sanctions, word lists, permissions.
--
-- Responsibility: the tables of Bingo 04 §3.5 for the `builtin` chat provider (07 §2): one
--                 lobby room and one room per match (created with its first message or
--                 join), messages of at most 300 characters with the shown (masked) text and
--                 filter flags, soft deletion by staff, reports with one per reporter and
--                 message, mutes and bans with reason, actor, expiry and lifting, and the
--                 three word lists (block, mask, flag). System lines (a round's end) have no
--                 author. Permissions: `chat.send` for accounts that play or host (guests only
--                 read), `chat.moderate` for moderators and game admins; super_admin holds both.
-- Spec:           docs/spec/07-integration.md §2; Bingo 04 §3.5, Bingo 03 §12, Bingo 06 §7

CREATE TABLE smg.chat_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind text NOT NULL CHECK (kind IN ('lobby', 'match')),
    match_id uuid UNIQUE REFERENCES smg.matches (id),
    slow_mode_seconds int NOT NULL DEFAULT 0 CHECK (slow_mode_seconds BETWEEN 0 AND 3600),
    locked bool NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((kind = 'match') = (match_id IS NOT NULL))
);
CREATE UNIQUE INDEX chat_rooms_one_lobby ON smg.chat_rooms (kind) WHERE kind = 'lobby';
INSERT INTO smg.chat_rooms (kind) VALUES ('lobby');

CREATE TABLE smg.chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL REFERENCES smg.chat_rooms (id),
    -- NULL for a system line; a deleted account leaves its messages without author.
    account_id uuid REFERENCES smg.accounts (id) ON DELETE SET NULL,
    kind text NOT NULL CHECK (kind IN ('player', 'system')),
    body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 300),
    body_shown text NOT NULL,
    flags text[] NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid REFERENCES smg.accounts (id) ON DELETE SET NULL
);
CREATE INDEX chat_messages_room ON smg.chat_messages (room_id, created_at DESC);

CREATE TABLE smg.chat_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL REFERENCES smg.chat_messages (id),
    reporter_id uuid REFERENCES smg.accounts (id) ON DELETE SET NULL,
    reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 300),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed')),
    handled_by uuid REFERENCES smg.accounts (id) ON DELETE SET NULL,
    handled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (message_id, reporter_id)
);
CREATE INDEX chat_reports_open ON smg.chat_reports (created_at) WHERE status = 'open';

CREATE TABLE smg.chat_sanctions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES smg.accounts (id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('mute', 'ban')),
    -- 'global', or the id of one room.
    scope text NOT NULL,
    reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
    created_by uuid REFERENCES smg.accounts (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,
    lifted_at timestamptz,
    lifted_by uuid REFERENCES smg.accounts (id) ON DELETE SET NULL,
    -- A ban has no end; a mute always has one.
    CHECK ((kind = 'ban') = (expires_at IS NULL))
);
CREATE INDEX chat_sanctions_active ON smg.chat_sanctions (account_id) WHERE lifted_at IS NULL;

CREATE TABLE smg.profanity_lists (
    id text PRIMARY KEY CHECK (id IN ('block', 'mask', 'flag')),
    terms text[] NOT NULL DEFAULT '{}',
    updated_by uuid REFERENCES smg.accounts (id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO smg.profanity_lists (id) VALUES ('block'), ('mask'), ('flag');

INSERT INTO smg.role_permissions (role_id, permission) VALUES
    ('player', 'chat.send'), ('organizer', 'chat.send'), ('moderator', 'chat.send'),
    ('game_admin', 'chat.send'), ('super_admin', 'chat.send'),
    ('moderator', 'chat.moderate'), ('game_admin', 'chat.moderate'), ('super_admin', 'chat.moderate');
