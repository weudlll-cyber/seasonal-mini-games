/**
 * @file   apps/web/src/round/OthersLine.tsx
 * @module web/round
 * @brief  Individual mode on a phone: the other players' guess counts, one row above the list.
 *
 * Responsibility: "Others: bot-01: 8 guesses · bot-02: 5" (T150), the first count with its
 *                 unit, "timed out" beside a player out of time (O71), each name through
 *                 ./PlayerName with its Discord steps (07 §7); at most two lines, never cut: the
 *                 players that fit whole, then "+N more", which opens the Players panel with
 *                 every player and their count (./useFit, O110); a line breaks between two
 *                 players, never inside one, and on a short phone screen beside a board the
 *                 line has one line's room (../round.css, O141). The whole line is its title.
 *                 Moved out of ./RoundLog to keep each file under the size limit.
 * Depends on:     react, @smg/contracts, ./PlayerName, ./RoundSide (guessCount), ./useFit
 * Used by:        ./RoundLog
 * Spec:           docs/spec/02-game-guess-the-number.md §12
 */
import type { RoundStateView } from '@smg/contracts';
import { Fragment, type ReactElement } from 'react';

import { PlayerName } from './PlayerName.js';
import { guessCount } from './RoundSide.js';
import { useFit } from './useFit.js';

// Individual mode: the other players and their guess counts, the first with its unit
// ("8 guesses", then "5"), and "timed out" for a player out of the round (O71); empty when
// the viewer plays alone.
function othersOf(state: RoundStateView, viewerKey: string | null) {
  return state.roster
    .filter((r) => r.playerKey !== viewerKey)
    .map((r, i) => ({
      key: r.playerKey,
      name: state.names[r.playerKey] ?? r.playerKey,
      count: `${i === 0 ? guessCount(r.guesses) : String(r.guesses)}${r.timedOut ? ', timed out' : ''}`,
    }));
}

// The others' line as text, "Others: bot-01: 8 guesses · bot-02: 5" (its title); null alone.
export function othersLine(state: RoundStateView, viewerKey: string | null): string | null {
  const others = othersOf(state, viewerKey);
  if (others.length === 0) return null;
  return `Others: ${others.map((o) => `${o.name}: ${o.count}`).join(' · ')}`;
}

export function OthersLine(p: {
  readonly state: RoundStateView;
  readonly viewerKey: string | null;
  // Opens the Players panel, where every player stands with their count.
  readonly onMore?: (() => void) | undefined;
}): ReactElement | null {
  const title = othersLine(p.state, p.viewerKey);
  const others = othersOf(p.state, p.viewerKey);
  const fit = useFit<HTMLParagraphElement>(others.length, title ?? '');
  if (title === null) return null;
  const rest = others.length - fit.shown;
  return (
    <p ref={fit.ref} className="round-log-others" data-testid="others-line" title={title}>
      Others:{' '}
      {/* The separator stands outside a player's unbreakable span, so the line can break
          between two players and never inside one (O141). */}
      {others.slice(0, fit.shown).map((o, i) => (
        <Fragment key={o.key}>
          {i === 0 ? null : ' · '}
          <span className="round-log-other" data-fit="">
            <PlayerName name={o.name} steps={p.state.steps?.[o.key]} />
            {`: ${o.count}`}
          </span>
        </Fragment>
      ))}
      {rest === 0 ? null : (
        <>
          {fit.shown === 0 ? null : ' · '}
          <button type="button" className="round-log-more" onClick={p.onMore}>
            +{rest} more
          </button>
        </>
      )}
    </p>
  );
}
