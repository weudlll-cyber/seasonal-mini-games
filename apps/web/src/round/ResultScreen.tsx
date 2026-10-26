/**
 * @file   apps/web/src/round/ResultScreen.tsx
 * @module web/round
 * @brief  The result of a round: headline, margin, placings, teams, the secret and the proof.
 *
 * Responsibility: the end in plain words ("Walter found it first — after 9 guesses"), the
 *                 winning margin in shared mode ("found it 0.4 s before Anna"), placings with
 *                 points (the viewer's line highlighted; "took part" in shared mode, "not
 *                 solved" in individual mode), the team result when teams played, the game's
 *                 result panel with the secret(s), and the fairness proof: the commitment
 *                 published at creation, the seed revealed now, and the link to check them
 *                 (02 §9, §10; 03 §5).
 * Depends on:     react, @smg/contracts, @smg-game/registry/web (types), ../season/SeasonIcon,
 *                 ../shell/http, ./PlayerName, ./roundText, ./result.css
 * Used by:        ./RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §8, §9, §10; docs/spec/03-seasonal-specials.md §5
 */
import type { GameWeb } from '@smg-game/registry/web';
import type { RoundStateView } from '@smg/contracts';
import type { ReactElement } from 'react';

import { SeasonIcon } from '../season/SeasonIcon.js';
import { SEASON_NAMES } from '../season/season.js';
import { BASE_PATH } from '../shell/http.js';
import { PlayerName } from './PlayerName.js';
import { endHeadline, marginText } from './roundText.js';
import './result.css';

function placeText(state: RoundStateView, place: number | null): string {
  if (place !== null) return String(place);
  return state.secretMode === 'shared' ? 'took part' : 'not solved';
}

function Placings({
  state,
  viewerKey,
}: {
  readonly state: RoundStateView;
  readonly viewerKey: string | null;
}): ReactElement {
  return (
    <div className="round-table-wrap">
      <table className="round-table" data-testid="placings">
        <caption className="smg-visually-hidden">Placings</caption>
        <thead>
          <tr>
            <th scope="col">Place</th>
            <th scope="col">Player</th>
            <th scope="col">Guesses</th>
            <th scope="col">Points</th>
          </tr>
        </thead>
        <tbody>
          {(state.results ?? []).map((r) => (
            <tr key={r.playerId} className={r.playerId === viewerKey ? 'round-you' : undefined}>
              <td>{placeText(state, r.place)}</td>
              <td>
                {r.team === null ? null : <SeasonIcon season={r.team} size="1rem" />}{' '}
                <PlayerName name={state.names[r.playerId] ?? r.playerId} />
                {r.playerId === viewerKey ? ' (you)' : ''}
              </td>
              <td>{r.guesses}</td>
              <td>{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Teams({ state }: { readonly state: RoundStateView }): ReactElement | null {
  const teams = state.teams ?? [];
  if (teams.length === 0) return null;
  return (
    <section aria-labelledby="teams-title">
      <h2 id="teams-title">Team result</h2>
      <ul className="round-teams-result" data-testid="team-result">
        {teams.map((t) => (
          <li key={t.team}>
            <SeasonIcon season={t.team} size="1rem" /> {SEASON_NAMES[t.team]}: {t.points}{' '}
            {t.points === 1 ? 'point' : 'points'}
            {t.won ? ' — the winner’s team' : ''} ({t.members}{' '}
            {t.members === 1 ? 'player' : 'players'})
          </li>
        ))}
      </ul>
    </section>
  );
}

function Proof({ state }: { readonly state: RoundStateView }): ReactElement | null {
  if (state.commitment === null) return null;
  return (
    <details className="round-proof" data-testid="proof">
      <summary>Fairness proof</summary>
      <p>
        Before the round, the server published <code>sha256(seed)</code> ={' '}
        <code className="round-hex">{state.commitment}</code>.
      </p>
      {state.seed == null ? null : (
        <p>
          The seed is <code className="round-hex">{state.seed}</code>. Hash it to check the
          commitment; the seed gives every secret of the round.{' '}
          <a href={`${BASE_PATH}api/v1/rounds/${state.roundId}/verify`}>Check this round</a>
        </p>
      )}
    </details>
  );
}

export function ResultScreen({
  state,
  game,
  viewerKey,
}: {
  readonly state: RoundStateView;
  readonly game: GameWeb | null;
  readonly viewerKey: string | null;
}): ReactElement {
  const margin = marginText(state);
  return (
    <section className="smg-panel round-result" data-testid="result">
      <h1>{endHeadline(state)}</h1>
      {margin === null ? null : <p data-testid="margin">{margin}</p>}
      {game === null ? null : (
        <game.Result view={state.game} names={state.names} viewerKey={viewerKey} />
      )}
      <Placings state={state} viewerKey={viewerKey} />
      <Teams state={state} />
      <Proof state={state} />
    </section>
  );
}
