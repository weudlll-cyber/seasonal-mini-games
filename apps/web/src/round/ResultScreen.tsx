/**
 * @file   apps/web/src/round/ResultScreen.tsx
 * @module web/round
 * @brief  The result of a round: headline, margin, placings, teams, the secret and the proof.
 *
 * Responsibility: the end in plain words ("Walter found it first — after 9 guesses"), the
 *                 winning margin in shared mode ("found it 0.4 s before Anna") or, without one,
 *                 the game's closest miss ("Closest miss besides the winner: bot-01, missed by
 *                 just 1 (92).", O22), placings with
 *                 points (the viewer's line highlighted; "took part" in shared mode, "not
 *                 solved" in individual mode), the team result when teams played, the match
 *                 standings, the game's result panel with the secret(s), and the fairness
 *                 proof: the commitment published at creation, the seed revealed now, and the
 *                 link to the round's verification page (02 §9, §10; 03 §5). On a desktop the
 *                 result fits one screen (./result.css): the headline, the margin or closest
 *                 miss and the proof's disclosure across the top, the game's result on the left
 *                 and the tables on the right, a part scrolling inside itself only if it must.
 * Depends on:     react, @smg/contracts, @smg/game-sdk (formatNumber),
 *                 @smg-game/registry/web (types), ../season/SeasonIcon,
 *                 ../shell/router, ./MatchStandings, ./PlayerName, ./roundText, ./result.css
 * Used by:        ./RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §8, §9, §10; docs/spec/03-seasonal-specials.md §5
 */
import type { GameWeb } from '@smg-game/registry/web';
import type { MatchStandingView, RoundStateView } from '@smg/contracts';
import { formatNumber } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { SeasonIcon } from '../season/SeasonIcon.js';
import { teamName } from '../season/season.js';
import { hrefOf } from '../shell/router.js';
import { MatchStandings } from './MatchStandings.js';
import { PlayerName } from './PlayerName.js';
import { colorsOf } from './RoundSide.js';
import { endHeadline, marginText } from './roundText.js';
import './result.css';

function placeText(state: RoundStateView, place: number | null): string {
  if (place !== null) return formatNumber(place);
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
            <th scope="col" className="round-col-place">
              Place
            </th>
            <th scope="col">Player</th>
            <th scope="col" className="round-col-num">
              Guesses
            </th>
            <th scope="col" className="round-col-num">
              Points
            </th>
          </tr>
        </thead>
        <tbody>
          {(state.results ?? []).map((r) => (
            <tr key={r.playerId} className={r.playerId === viewerKey ? 'round-you' : undefined}>
              <td>{placeText(state, r.place)}</td>
              <td>
                <span className="round-player">
                  {r.team === null ? null : <SeasonIcon season={r.team} size="1rem" />}{' '}
                  <PlayerName name={state.names[r.playerId] ?? r.playerId} />
                  {r.playerId === viewerKey ? <span> (you)</span> : null}
                </span>
              </td>
              <td>{formatNumber(r.guesses)}</td>
              <td>{formatNumber(r.points)}</td>
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
            <SeasonIcon season={t.team} size="1rem" /> {teamName(t.team)}: {formatNumber(t.points)}{' '}
            {t.points === 1 ? 'point' : 'points'}
            {t.won ? ' — the winner’s team' : ''} ({formatNumber(t.members)}{' '}
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
          <a href={hrefOf({ name: 'verify', roundId: state.roundId })}>Verify this round</a>
        </p>
      )}
    </details>
  );
}

export function ResultScreen({
  state,
  game,
  viewerKey,
  standings,
}: {
  readonly state: RoundStateView;
  readonly game: GameWeb | null;
  readonly viewerKey: string | null;
  readonly standings: readonly MatchStandingView[];
}): ReactElement {
  const margin = marginText(state);
  // Without a margin, the game's line about the closest miss stands in its place (O22).
  const miss = margin === null ? (game?.text.runnerUp(state.game, state.names) ?? null) : null;
  return (
    <section
      className="smg-panel round-result"
      data-testid="result"
      // A board game's grid gets an even share of a desktop's width (./result.css).
      data-layout={game?.layout ?? 'list'}
    >
      <header className="round-result-head">
        <h1>{endHeadline(state)}</h1>
        {margin === null ? null : <p data-testid="margin">{margin}</p>}
        {miss === null ? null : <p data-testid="closest-miss">{miss}</p>}
        <Proof state={state} />
      </header>
      {/* The game's own result (the secret, a board game's grid): the part that grows. */}
      <div className="round-result-game">
        {game === null ? null : (
          <game.Result
            view={state.game}
            names={state.names}
            colors={colorsOf(state)}
            viewerKey={viewerKey}
          />
        )}
      </div>
      <div className="round-result-tables">
        <Placings state={state} viewerKey={viewerKey} />
        <Teams state={state} />
        <MatchStandings standings={standings} viewerKey={viewerKey} />
      </div>
    </section>
  );
}
