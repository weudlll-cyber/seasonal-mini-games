-- @file   apps/server/src/db/migrations/0015_drop_result_secret.sql
-- @brief  `round_results` loses its `secret` column, which nothing ever wrote (DECISIONS T265).
--
-- Responsibility: 0004 gave each result row an `int` for an individual player's secret. The
--                 server is game-agnostic, the game-module contract names no "secret of this
--                 player", and an `int` holds neither Safecracker's "0427" nor a Target tile,
--                 so the column stayed NULL in every row; the result view and the round's
--                 check derive every secret from the sealed seed instead. Dropping it makes
--                 05 §3's "no table has a secret column" true of the schema. Numbered 0015
--                 because `feat/website-mode` holds 0014; the two only add or drop their own
--                 parts, so either order of applying them gives the same schema.
-- Spec:           docs/spec/06-data-model-api-realtime.md §2.4; docs/spec/05-security-threat-model.md §3

ALTER TABLE smg.round_results DROP COLUMN secret;
