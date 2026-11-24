/**
 * @file   apps/web/src/round/ResultScreen.tsx
 * @module web/round
 * @brief  The result of a round: its first screen, then the team result and the standings.
 *
 * Responsibility: the kit's ResultFrame draws the screen (T424): its first part fits one screen on a desktop and a phone (T145, the slim bar
 *                 above it, ../match/ResultBar): the end in plain words ("Walter found it first
 *                 — after 9 guesses", at most two lines), the winning margin in shared mode
 *                 ("found it 0.4 s before Anna") or, without one, the game's closest miss or, on
 *                 a time-up result, its closest guess (O22, T145), the fairness proof's
 *                 disclosure, the game's reveal (the secret, a board game's grid as large as
 *                 the part allows), the top three placings with "All placings" to show every
 *                 one ("took part" in shared mode, "not solved" in individual mode; the viewer
 *                 by place like everyone, their line highlighted, "(you)" never cut), and one
 *                 team line ("Team Spring wins the round (+1 team point)"). Between it and
 *                 the rest, the frame's middle part: "Closest to winning" for a game that names best guesses,
 *                 every guess behind its "All guesses" (./ClosestToWinning, O110; the
 *                 first part then compact, ./resultClosest.css, both whole on the screen at its
 *                 scale, the kit's useFitScale, O111), else every player's guesses
 *                 in full (the game's history, T150),
 *                 the team result and the match standings (O54). The proof: the
 *                 commitment published at creation, the seed revealed now, and the link to the
 *                 round's verification page (02 §9, §10; 03 §5).
 * Depends on:     react, @seasonal/kit/react (ResultFrame, useFitScale), @smg/contracts,
 *                 @smg/game-sdk (formatNumber),
 *                 @smg-game/registry/web (types), ../season/*, ../shell/router,
 *                 ./ClosestToWinning, ./MatchStandings, ./ResultParts, ./RoundSide,
 *                 ./RoundStandings, ./roundText, ./result.css, ./resultBoard.css,
 *                 ./resultOwn.css, ./resultClosest.css
 *                 A game that draws its own first part (`ownResult`, O97, T352) gets its
 *                 reveal (a headline row, the winners, the cards) with every line behind a
 *                 disclosure at the right, the match standings (./RoundStandings) under it and
 *                 the page's next-round box (`next`) beside them (MG-N8).
 * Used by:        ./RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §8, §9, §10; docs/spec/03-seasonal-specials.md §5
 */
import { ResultFrame, useFitScale } from '@seasonal/kit/react';
import type { GameWeb } from '@smg-game/registry/web';
import type { MatchStandingView, RoundStateView } from '@smg/contracts';
import type { ReactElement, ReactNode } from 'react';

import { hrefOf } from '../shell/router.js';
import { MatchStandings } from './MatchStandings.js';
import { roundMarks } from './playerMarks.js';
import { Placings, TeamLine, Teams } from './ResultParts.js';
import { ClosestToWinning } from './ClosestToWinning.js';
import { colorsOf } from './RoundSide.js';
import { RoundStandings } from './RoundStandings.js';
import { endHeadline, marginText } from './roundText.js';
import './result.css';
import './resultBoard.css';
import './resultOwn.css';
import './resultClosest.css';

// The kit fits again once web fonts have loaded (T404; a WebKit wrap that ran 32 px over).
const AFTER_FONTS = { afterFonts: true } as const;

// The fairness proof's disclosure: only a round with a commitment has one (the caller checks).
function Proof({ state }: { readonly state: RoundStateView }): ReactElement {
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
      // A game with player tags: the round's marks on its grid too (O62, T211).
      marks={roundMarks(state, p.game, p.viewerKey)}
      part={p.part}
    />
  );
}

interface ResultProps {
  readonly state: RoundStateView;
  readonly game: GameWeb | null;
  readonly viewerKey: string | null;
  readonly standings: readonly MatchStandingView[];
  // The page's box for the next round, beside the standings (the docked page, O97), if any.
  readonly next?: ReactNode;
  // The round just ended, by its number in the match (a series'), for the standings' title.
  readonly roundNo?: number | null;
}

// A game that draws its whole first part (`ownResult`, T352): one grid (./resultOwn.css, the
// reference of MG-N8). The game's reveal is no box of its own: its first child, the headline
// row, spans the width with "Every line" at its right; its next two (the winners, the cards)
// and the standings make the left column; the page's next-round box is the right column.
function OwnResult(p: ResultProps & { readonly game: GameWeb }): ReactElement {
  const { state } = p;
  const part = (which: 'reveal' | 'history') => (
    <GamePart state={state} game={p.game} viewerKey={p.viewerKey} part={which} />
  );
  // The grid fills the height above the chat; its next-round box (the fixed part) shows whole
  // at the screen's scale (O111).
  const fit = useFitScale<HTMLElement>('mini-games', `${state.roundId}|own`, true, AFTER_FONTS);
  return (
    <section
      ref={fit}
      className="round-result round-result--own"
      data-testid="result"
      data-layout={p.game.layout ?? 'list'}
    >
      <div className="round-result-first" data-testid="result-first">
        {part('reveal')}
        <details className="round-result-lines" data-testid="result-history">
          <summary className="smg-btn">Every line</summary>
          <div className="round-result-lines-body">{part('history')}</div>
        </details>
      </div>
      <RoundStandings
        standings={p.standings}
        results={state.results ?? []}
        viewerKey={p.viewerKey}
        round={p.roundNo ?? null}
      />
      {p.next}
    </section>
  );
}

// The end in plain words (the frame's headline), and under it the margin or, without one, the
// game's closest miss or guess (O22; none in a game with "Closest to winning", whose rows say it,
// O111): the frame's `lines`.
function headlineOf(state: RoundStateView, game: GameWeb | null) {
  // The game's words for finding its secret, where it has its own (O137).
  const found = game?.text.found;
  const margin = marginText(state, found);
  const miss =
    margin === null
      ? (game?.text.runnerUp?.(state.game, state.names, state.winner !== null) ?? null)
      : null;
  return {
    headline: endHeadline(state, found),
    lines: (
      <>
        {margin === null ? null : <p data-testid="margin">{margin}</p>}
        {miss === null ? null : <p data-testid="closest-miss">{miss}</p>}
      </>
    ),
  };
}

// The frame's middle card: "Closest to winning" for a game that names best guesses (O110), with
// every guess behind "All guesses"; else every guess in full (T150). The frame draws its card.
function Guesses(p: {
  readonly state: RoundStateView;
  readonly closest: GameWeb | null;
  readonly history: ReactElement;
}): ReactElement {
  if (p.closest !== null) {
    return <ClosestToWinning state={p.state} game={p.closest} history={p.history} />;
  }
  return (
    <section aria-label="Every guess" data-testid="result-history">
      {p.history}
    </section>
  );
}

// The fitting option of the result frame, as the start card's (RoundIntro): fit again after fonts.
const FIT = { afterFonts: true } as const;

// The platform's result (T145) in the kit's `ResultFrame`: the first part one screen high (the
// end, the margin, the proof, the game's reveal, the top placings and the team line), "Closest to
// winning" or the full history as its middle card, fitted with the first part (O110, O111), and
// the team result and the standings after it.
export function ResultScreen(props: ResultProps): ReactElement {
  const { state, game, viewerKey, standings } = props;
  if (game?.ownResult === true) return <OwnResult {...props} game={game} />;
  const part = (which: 'reveal' | 'history') => (
    <GamePart state={state} game={game} viewerKey={viewerKey} part={which} />
  );
  // The game names best guesses (O110): "Closest to winning" stands for the full history.
  const closest = game?.text.best !== undefined && state.closest !== undefined ? game : null;
  const { headline, lines } = headlineOf(state, game);
  return (
    <ResultFrame
      game="mini-games"
      headline={headline}
      lines={lines}
      proof={state.commitment === null ? undefined : <Proof state={state} />}
      reveal={part('reveal')}
      placings={
        <Placings
          state={state}
          viewerKey={viewerKey}
          marks={roundMarks(state, game, viewerKey)}
          foot={<TeamLine state={state} />}
        />
      }
      middle={<Guesses state={state} closest={closest} history={part('history')} />}
      more={
        <>
          {props.next}
          <Teams state={state} />
          <MatchStandings standings={standings} viewerKey={viewerKey} />
        </>
      }
      // A board game's grid gets the free height of the first part (./resultBoard.css).
      layout={game?.layout === 'board' ? 'board' : 'list'}
      // A game with "Closest to winning" fits its first part and that card to the screen.
      fitted={closest !== null}
      // The fit again after web fonts have loaded is the kit's (v0.18.0, K55, T423 (3)).
      fit={FIT}
      signature={`${state.roundId}|${String(state.closest?.length)}`}
    />
  );
}
