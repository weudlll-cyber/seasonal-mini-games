-- @file   apps/server/src/db/migrations/0022_open_rounds.sql
-- @brief  A match's "Show on the website" and whether it is the development quick round's (O124).
--
-- Responsibility: `show_on_website`: the match is listed in the public open-rounds answer while
--                 it is open for joining (the website's sign-up status, spec/07 §8); a new match
--                 is opened with it on (O125), the host may switch it while the match is open;
--                 matches opened before this migration keep it off. `quick_test`: the match of the
--                 development quick round, which is never listed whatever the option says.
-- Spec:           docs/spec/07-integration.md §8; docs/spec/06-data-model-api-realtime.md §2.1

ALTER TABLE smg.matches ADD COLUMN IF NOT EXISTS show_on_website bool NOT NULL DEFAULT false;
ALTER TABLE smg.matches ADD COLUMN IF NOT EXISTS quick_test bool NOT NULL DEFAULT false;
