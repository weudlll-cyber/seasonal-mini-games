/**
 * @file   apps/web/src/boards/ProfilePage.tsx
 * @module web/boards
 * @brief  A player's public profile: numbers, boards, last rounds, staff adjustments.
 *
 * Responsibility: the display name and member-since date; matches and rounds played, round
 *                 wins, solves and best place; each board the player is on (name, rank,
 *                 points, linking to that board); the last rounds (match, place or "took
 *                 part", points, a link to the round's verification page); and every staff
 *                 adjustment with its reason, public by design (Bingo 03 §11). An unknown
 *                 name says "No player with that name."
 * Depends on:     react, @smg/contracts (PlayerProfileView), ../components/fields,
 *                 ../shell/router, ./useApi, ./boardsText, ./boards.css, ../round/result.css
 * Used by:        ../shell/AppShell
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/06-data-model-api-realtime.md §3.1
 */
import type { PlayerProfileView } from '@smg/contracts';
import type { ReactElement } from 'react';

import { Problem } from '../components/fields.js';
import { hrefOf } from '../shell/router.js';
import { dateText, deltaText, placeText, pointsText, refusalText } from './boardsText.js';
import { useApi } from './useApi.js';
import '../round/result.css';
import './boards.css';

function Facts({ p }: { readonly p: PlayerProfileView }): ReactElement {
  const facts: readonly (readonly [string, string | number])[] = [
    ['Matches played', p.matchesPlayed],
    ['Rounds played', p.roundsPlayed],
    ['Round wins', p.wins],
    ['Solves', p.solves],
    ['Best place', p.bestPlace ?? 'none yet'],
  ];
  return (
    <dl className="boards-facts" data-testid="profile-facts">
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Boards({ p }: { readonly p: PlayerProfileView }): ReactElement {
  return (
    <section className="smg-panel smg-stack" aria-labelledby="profile-boards">
      <h2 id="profile-boards">Boards</h2>
      {p.boards.length === 0 ? (
        <p>Not on a board yet.</p>
      ) : (
        <ul className="boards-list" data-testid="profile-boards">
          {p.boards.map((b) => (
            <li key={b.period.id}>
              <a href={hrefOf({ name: 'leaderboard', periodId: b.period.id })}>{b.period.name}</a>:{' '}
              {b.rank === null ? 'no rank yet' : `rank ${String(b.rank)}`}, {pointsText(b.points)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Recent({ p }: { readonly p: PlayerProfileView }): ReactElement {
  return (
    <section className="smg-panel smg-stack" aria-labelledby="profile-recent">
      <h2 id="profile-recent">Last rounds</h2>
      {p.recent.length === 0 ? (
        <p>No rounds yet.</p>
      ) : (
        <div className="round-table-wrap">
          <table className="round-table" data-testid="profile-recent">
            <caption className="smg-visually-hidden">Last rounds</caption>
            <thead>
              <tr>
                <th scope="col">Match</th>
                <th scope="col">Place</th>
                <th scope="col">Points</th>
                <th scope="col">Proof</th>
              </tr>
            </thead>
            <tbody>
              {p.recent.map((r) => (
                <tr key={r.roundId}>
                  <td>
                    <a href={hrefOf({ name: 'match', code: r.matchCode })}>{r.matchTitle}</a>
                    <br />
                    <small className="smg-muted">{dateText(r.endedAt)}</small>
                  </td>
                  <td>{placeText(r.place, r.secretMode)}</td>
                  <td>{r.points}</td>
                  <td>
                    <a href={hrefOf({ name: 'verify', roundId: r.roundId })}>Verify</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Adjustments({ p }: { readonly p: PlayerProfileView }): ReactElement {
  return (
    <section className="smg-panel smg-stack" aria-labelledby="profile-adjustments">
      <h2 id="profile-adjustments">Staff adjustments</h2>
      {p.adjustments.length === 0 ? (
        <p>No staff adjustments.</p>
      ) : (
        <ul className="boards-list" data-testid="profile-adjustments">
          {p.adjustments.map((a) => (
            <li key={`${String(a.at)}/${a.periodName}`}>
              {a.periodName}: {deltaText(a.delta)} on {dateText(a.at)} — {a.reason}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ProfilePage({ displayName }: { readonly displayName: string }): ReactElement {
  const { data, error } = useApi<PlayerProfileView>(`/players/${encodeURIComponent(displayName)}`);
  if (error?.status === 404) {
    return (
      <section className="smg-panel" data-testid="profile-missing">
        <h1>No player with that name.</h1>
      </section>
    );
  }
  if (error !== null) return <Problem text={refusalText(error)} />;
  if (data === null) return <p className="smg-muted">Loading the profile…</p>;
  return (
    <div className="smg-stack boards-page" data-testid="profile">
      <header className="smg-panel smg-stack">
        <h1>{data.displayName}</h1>
        <p className="smg-muted">Member since {dateText(data.memberSince)}</p>
        <Facts p={data} />
      </header>
      <Boards p={data} />
      <Recent p={data} />
      <Adjustments p={data} />
    </div>
  );
}
