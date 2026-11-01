-- @file   apps/server/src/db/migrations/0011_meteorological_seasons.sql
-- @brief  Season boards by meteorological season: the awards of quarter boards move over.
--
-- Responsibility: owner decision O30 replaces the calendar quarters of 0006 with the
--                 meteorological seasons (spring March–May, summer June–August, autumn
--                 September–November, winter December–February, in UTC). Every award on a
--                 quarter board moves to the season board of the season in which its match's
--                 first round ended, as the server now awards (DECISIONS T107); the season
--                 boards it needs are created; the entries of every season board are
--                 recomputed as the sum of awards and adjustments, as the server does. A
--                 quarter board left without adjustments is deleted; one that still holds
--                 adjustments (append-only, never moved) is kept, closed and renamed
--                 "Q4 2026 (quarter)", so no staff correction is lost or rewritten. Quarter
--                 boards start in January, April, July or October and season boards in March,
--                 June, September or December, so the two never share a start.
-- Spec:           docs/spec/06-data-model-api-realtime.md §2.6; docs/DECISIONS.md O30, T107

-- Every season board whose start is a quarter's first day, and where its awards go.
CREATE TEMPORARY TABLE quarter_moves ON COMMIT DROP AS
SELECT a.match_id, a.period_id AS old_id,
       (date_trunc('month', f.first_end AT TIME ZONE 'UTC')
        - make_interval(months => extract(month FROM f.first_end AT TIME ZONE 'UTC')::int % 3))
         AT TIME ZONE 'UTC' AS starts_at
FROM (SELECT match_id, period_id FROM smg.league_awards
      UNION SELECT match_id, period_id FROM smg.team_league_awards) a
JOIN smg.leaderboard_periods p ON p.id = a.period_id
CROSS JOIN LATERAL (
    SELECT coalesce(min(r.ended_at), p.starts_at) AS first_end
    FROM smg.rounds r WHERE r.match_id = a.match_id AND r.status = 'ended'
) f
WHERE p.kind = 'season'
  AND extract(month FROM p.starts_at AT TIME ZONE 'UTC')::int IN (1, 4, 7, 10);

-- The season boards those awards need, named as the server names them ("Winter 2026/27").
INSERT INTO smg.leaderboard_periods (kind, name, starts_at, ends_at)
SELECT DISTINCT 'season',
       CASE extract(month FROM m.starts_at AT TIME ZONE 'UTC')::int
           WHEN 12 THEN 'Winter ' || y || '/' || lpad(((y + 1) % 100)::text, 2, '0')
           WHEN 3 THEN 'Spring ' || y
           WHEN 6 THEN 'Summer ' || y
           ELSE 'Autumn ' || y
       END,
       m.starts_at, m.starts_at + interval '3 months'
FROM quarter_moves m
CROSS JOIN LATERAL (SELECT extract(year FROM m.starts_at AT TIME ZONE 'UTC')::int AS y) yr
ON CONFLICT (kind, starts_at) DO NOTHING;

-- A match awards to one season board, so a moved award never meets one already there.
UPDATE smg.league_awards a SET period_id = p.id
FROM quarter_moves m JOIN smg.leaderboard_periods p
    ON p.kind = 'season' AND p.starts_at = m.starts_at
WHERE a.match_id = m.match_id AND a.period_id = m.old_id;

UPDATE smg.team_league_awards a SET period_id = p.id
FROM quarter_moves m JOIN smg.leaderboard_periods p
    ON p.kind = 'season' AND p.starts_at = m.starts_at
WHERE a.match_id = m.match_id AND a.period_id = m.old_id;

-- Every season board's entries again: the sum of its awards and adjustments.
DELETE FROM smg.league_entries e USING smg.leaderboard_periods p
WHERE p.id = e.period_id AND p.kind = 'season';
INSERT INTO smg.league_entries (period_id, account_id, points, wins, solves, matches)
SELECT x.period_id, x.account_id, sum(x.points), sum(x.wins), sum(x.solves), sum(x.matches)
FROM (
    SELECT period_id, account_id, points, wins, solves, 1 AS matches FROM smg.league_awards
    UNION ALL
    SELECT period_id, account_id, delta, 0, 0, 0 FROM smg.leaderboard_adjustments
) x JOIN smg.leaderboard_periods p ON p.id = x.period_id AND p.kind = 'season'
GROUP BY x.period_id, x.account_id;

DELETE FROM smg.team_league_entries e USING smg.leaderboard_periods p
WHERE p.id = e.period_id AND p.kind = 'season';
INSERT INTO smg.team_league_entries (period_id, team, points, wins)
SELECT a.period_id, a.team, sum(a.points), sum(a.wins)
FROM smg.team_league_awards a JOIN smg.leaderboard_periods p ON p.id = a.period_id
WHERE p.kind = 'season'
GROUP BY a.period_id, a.team;

-- The quarter boards: gone when nothing is left on them, else closed under a quarter name.
DELETE FROM smg.leaderboard_periods p
WHERE p.kind = 'season'
  AND extract(month FROM p.starts_at AT TIME ZONE 'UTC')::int IN (1, 4, 7, 10)
  AND NOT EXISTS (SELECT 1 FROM smg.leaderboard_adjustments j WHERE j.period_id = p.id);
UPDATE smg.leaderboard_periods p
SET status = 'closed',
    name = 'Q' || (extract(month FROM p.starts_at AT TIME ZONE 'UTC')::int + 2) / 3
           || ' ' || extract(year FROM p.starts_at AT TIME ZONE 'UTC')::int || ' (quarter)'
WHERE p.kind = 'season'
  AND extract(month FROM p.starts_at AT TIME ZONE 'UTC')::int IN (1, 4, 7, 10);
