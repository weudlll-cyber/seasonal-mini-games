-- @file   apps/server/src/db/migrations/0003_audit_abuse.sql
-- @brief  The append-only audit log with its hash chain, and the abuse signals for moderators.
--
-- Responsibility: smg.audit_log as Bingo 04 §3.6 (no FK to accounts, so history outlives a
--                 deleted account); a trigger rejects every UPDATE and DELETE. smg.abuse_signals
--                 records each signal (cooldown refusals, bot-like timing, rate limits, …) with
--                 a weight; an account's abuse score is the sum of the last 7 days (05 §2, §7).
--                 Signals never sanction by themselves (DECISIONS S5).
-- Spec:           docs/spec/05-security-threat-model.md §2, §7, §8; Bingo 03 §13, §16

CREATE TABLE smg.audit_log (
    id bigserial PRIMARY KEY,
    occurred_at timestamptz NOT NULL,
    actor_account_id uuid,
    actor_roles text[] NOT NULL DEFAULT '{}',
    ip inet,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id text,
    diff jsonb NOT NULL DEFAULT '{}'::jsonb,
    request_id text,
    prev_hash bytea,
    hash bytea NOT NULL
);
CREATE INDEX audit_log_action ON smg.audit_log (action, id DESC);
CREATE INDEX audit_log_actor ON smg.audit_log (actor_account_id, id DESC);

CREATE FUNCTION smg.reject_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON smg.audit_log
    FOR EACH ROW EXECUTE FUNCTION smg.reject_change();
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON smg.audit_log
    FOR EACH STATEMENT EXECUTE FUNCTION smg.reject_change();

CREATE TABLE smg.abuse_signals (
    id bigserial PRIMARY KEY,
    account_id uuid NOT NULL REFERENCES smg.accounts (id) ON DELETE CASCADE,
    kind text NOT NULL,
    detail text NOT NULL DEFAULT '',
    weight integer NOT NULL CHECK (weight > 0),
    at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX abuse_signals_account ON smg.abuse_signals (account_id, at DESC);
