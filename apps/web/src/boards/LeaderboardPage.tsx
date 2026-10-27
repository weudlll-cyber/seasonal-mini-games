/**
 * @file   apps/web/src/boards/LeaderboardPage.tsx
 * @module web/boards
 * @brief  The leaderboard: pick a board, see its players and, beside them, its teams.
 *
 * Responsibility: load the boards (all-time first, then the season boards newest first),
 *                 offer them in a picker by name ("Winter 2026"), and show the chosen one —
 *                 the one in the address, else the first — as the player board with the team
 *                 board beside it on wide screens and below it on a phone (./boards.css).
 *                 Choosing a board changes the address, so a board can be linked.
 * Depends on:     react, @smg/contracts (shapes), ../components/fields, ../shell/router,
 *                 ./PlayerBoard, ./TeamBoard, ./useApi, ./boardsText, ./boards.css,
 *                 ../round/result.css (tables)
 * Used by:        ../shell/AppShell
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/06-data-model-api-realtime.md §2.6, §3.1
 */
import type { LeaderboardPeriodView } from '@smg/contracts';
import type { ReactElement } from 'react';

import { ChoiceField, Problem } from '../components/fields.js';
import { navigate } from '../shell/router.js';
import { refusalText } from './boardsText.js';
import { PlayerBoard } from './PlayerBoard.js';
import { TeamBoard } from './TeamBoard.js';
import { useApi } from './useApi.js';
import '../round/result.css';
import './boards.css';

export function LeaderboardPage({ periodId }: { readonly periodId: string | null }): ReactElement {
  const { data, error } = useApi<{ periods: LeaderboardPeriodView[] }>('/leaderboards');
  const periods = data?.periods ?? [];
  const chosen = periods.find((p) => p.id === periodId) ?? periods[0] ?? null;
  return (
    <section className="smg-stack" aria-labelledby="boards-title" data-testid="leaderboard">
      <h1 id="boards-title">Leaderboard</h1>
      <Problem text={error === null ? null : refusalText(error)} />
      {data === null && error === null ? <p className="smg-muted">Loading the boards…</p> : null}
      {data !== null && chosen === null ? <p>There are no boards yet.</p> : null}
      {chosen === null ? null : (
        <>
          <ChoiceField
            label="Board"
            value={chosen.id}
            options={periods.map((p) => ({ value: p.id, label: p.name }))}
            testId="board-picker"
            onChange={(id) => {
              navigate({ name: 'leaderboard', periodId: id });
            }}
          />
          <div className="boards-grid">
            <section className="smg-panel" aria-label="Players">
              <PlayerBoard key={chosen.id} period={chosen} />
            </section>
            <section className="smg-panel" aria-label="Teams">
              <TeamBoard key={chosen.id} period={chosen} />
            </section>
          </div>
        </>
      )}
    </section>
  );
}
