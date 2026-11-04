/**
 * @file   apps/web/src/round/ResultScreen.tsx
 * @module web/round
 * @brief  The result of a round: its first screen, then the team result and the standings.
 *
 * Responsibility: the first part fits one screen on a desktop and a phone (T145, the slim bar
 *                 above it, ../match/ResultBar): the end in plain words ("Walter found it first
 *                 — after 9 guesses", at most two lines), the winning margin in shared mode
 *                 ("found it 0.4 s before Anna") or, without one, the game's closest miss or, on
 *                 a time-up result, its closest guess (O22, T145), the fairness proof's
 *                 disclosure, the game's reveal (the secret, a board game's grid as large as
 *                 the part allows), the top three placings with "All placings" to show every
 *                 one ("took part" in shared mode, "not solved" in individual mode; the viewer
 *                 by place like everyone, their line highlighted, "(you)" never cut), and one
 *                 team line ("Team Spring wins the round (+1 team point)"). Below it, where the
 *                 page may scroll: every player's guesses in full (the game's history, T150),
 *                 the team result and the match standings (O54). The proof: the
 *                 commitment published at creation, the seed revealed now, and the link to the
 *                 round's verification page (02 §9, §10; 03 §5).
 * Depends on:     react, @smg/contracts, @smg/game-sdk (formatNumber),
 *                 @smg-game/registry/web (types), ../season/*, ../shell/router,
 *                 ./MatchStandings, ./ResultParts, ./RoundSide, ./roundText, ./result.css
 * Used by:        ./RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §8, §9, §10; docs/spec/03-seasonal-specials.md §5
 */
import type { GameWeb } from '@smg-game/registry/web';
import type { MatchStandingView, RoundStateView } from '@smg/contracts';
import type { ReactElement } from 'react';

import { hrefOf } from '../shell/router.js';
import { MatchStandings } from './MatchStandings.js';
import { Placings, TeamLine, Teams } from './ResultParts.js';
import { colorsOf } from './RoundSide.js';
import { endHeadline, marginText } from './roundText.js';
import './result.css';

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

// One of the game's two parts of the result (T150), or nothing without the game's screens.
function GamePart(p: {
  readonly state: RoundStateView;
  readonly game: GameWeb | null;
  readonly viewerKey: string | null;
  readonly part: 'reveal' | 'history';
}): ReactElement | null {
  if (p.game === null) return null;
  const { state } = p;
  return (
    <p.game.Result
      view={state.game}
      names={state.names}
      colors={colorsOf(state)}
      viewerKey={p.viewerKey}
      part={p.part}
    />
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
  // Without a margin, the game's line about the closest miss or guess stands in its place (O22).
  const miss =
    margin === null
      ? (game?.text.runnerUp(state.game, state.names, state.winner !== null) ?? null)
      : null;
  const part = (which: 'reveal' | 'history') => (
    <GamePart state={state} game={game} viewerKey={viewerKey} part={which} />
  );
  return (
    <section
      className="round-result"
      data-testid="result"
      // A board game's grid gets the free height of the first part (./result.css).
      data-layout={game?.layout ?? 'list'}
    >
      <div className="smg-panel round-result-first" data-testid="result-first">
        <header className="round-result-head">
          <h1>{endHeadline(state)}</h1>
          {margin === null ? null : <p data-testid="margin">{margin}</p>}
          {miss === null ? null : <p data-testid="closest-miss">{miss}</p>}
          <Proof state={state} />
        </header>
        {/* The game's reveal (the secret, a board game's grid): the part that grows. */}
        <div className="round-result-game">{part('reveal')}</div>
        <div className="round-result-places">
          <Placings state={state} viewerKey={viewerKey} />
          <TeamLine state={state} />
        </div>
      </div>
      <section
        className="smg-panel round-result-history"
        aria-label="Every guess"
        data-testid="result-history"
      >
        {part('history')}
      </section>
      <div className="smg-panel round-result-more">
        <Teams state={state} />
        <MatchStandings standings={standings} viewerKey={viewerKey} />
      </div>
    </section>
  );
}
