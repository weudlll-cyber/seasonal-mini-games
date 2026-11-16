/**
 * @file   apps/web/src/round/RoundStandings.tsx
 * @module web/round
 * @brief  The match standings under a game's own result: a plain ranking by the match total.
 *
 * Responsibility: the owner's reference of 2026-11-15 (MG-N8, O99): "Standings after round 3"
 *                 with the number of players beside it, then every player in the server's rank
 *                 and order (02 §9; the client ranks nothing), each row the place, the name (cut
 *                 with an ellipsis, whole in its tooltip), this round's points ("+1", "0", "—"
 *                 for a player not in it) and the total; the viewer's row in amber, nothing in a
 *                 winner's colour. On a desktop the rows run in two columns in a panel that
 *                 scrolls inside itself when they do not fit, opening with the viewer's row in
 *                 view (./resultOwn.css). On a phone the panel is part of the page, without a
 *                 height or a scroll of its own, and starts with the viewer's own line ("You ·
 *                 place 37", T361) above every row. The full table with wins stays on the match
 *                 summary (./MatchStandings).
 * Depends on:     react, @smg/contracts (MatchStandingView, PlayerResultView),
 *                 @smg/game-sdk (formatNumber), ./PlayerName
 * Used by:        ./ResultScreen
 * Spec:           docs/spec/02e-game-mind-games.md §9; docs/spec/02-game-guess-the-number.md §9
 */
import type { MatchStandingView, PlayerResultView } from '@smg/contracts';
import { formatNumber } from '@smg/game-sdk';
import { useLayoutEffect, useRef, type ReactElement } from 'react';

import { PlayerName } from './PlayerName.js';

// This round's points as the reference writes them: "+1", "0", "—" when not in the round.
const roundText = (points: number | undefined): string =>
  points === undefined ? '—' : points > 0 ? `+${formatNumber(points)}` : '0';

function Row(p: {
  readonly s: MatchStandingView;
  readonly points: number | undefined;
  readonly you: boolean;
}): ReactElement {
  return (
    <li className="round-standing" data-own={p.you}>
      <span className="round-standing-place">{formatNumber(p.s.rank)}</span>
      <span className="round-standing-name" title={p.s.name}>
        {p.you ? 'You' : <PlayerName name={p.s.name} steps={p.s.steps} />}
      </span>
      <span className="round-standing-round">{roundText(p.points)}</span>
      <span className="round-standing-total">{formatNumber(p.s.points)}</span>
    </li>
  );
}

// The viewer's row in view once, when the standings first show (a desktop's panel scrolls).
function useOwnInView(shown: boolean) {
  const box = useRef<HTMLElement>(null);
  const done = useRef(false);
  useLayoutEffect(() => {
    const el = box.current;
    const own = el?.querySelector<HTMLElement>('.round-standing[data-own="true"]');
    if (!shown || done.current || el == null || own == null) return;
    done.current = true;
    if (el.scrollHeight <= el.clientHeight) return;
    // The panel scrolls, never the page: its own scrollTop, the row in the middle (the panel
    // is the row's offset parent, ./resultOwn.css).
    el.scrollTop = own.offsetTop - el.clientHeight / 2;
  }, [shown]);
  return box;
}

export function RoundStandings(p: {
  readonly standings: readonly MatchStandingView[];
  readonly results: readonly PlayerResultView[];
  readonly viewerKey: string | null;
  // The round just ended, by its number in the match; null outside a series.
  readonly round: number | null;
}): ReactElement | null {
  const box = useOwnInView(p.standings.length > 0);
  if (p.standings.length === 0) return null;
  const round = new Map(p.results.map((r) => [r.playerId, r.points]));
  const own = p.standings.find((s) => s.playerKey === p.viewerKey);
  const title = p.round === null ? 'Standings' : `Standings after round ${String(p.round)}`;
  const n = p.standings.length;
  return (
    <section
      ref={box}
      className="round-standings"
      aria-labelledby="round-standings-title"
      data-testid="round-standings"
    >
      <header className="round-standings-head">
        <h2 id="round-standings-title">{title}</h2>
        <span className="smg-muted">
          {formatNumber(n)} {n === 1 ? 'player' : 'players'}
        </span>
      </header>
      {/* The phone's own line above every row (T361); a desktop shows the row in place. */}
      {own === undefined ? null : (
        <p className="round-standings-own" data-testid="own-standing">
          <span className="round-standing-place">{formatNumber(own.rank)}</span>
          <span className="round-standing-name">You · place {formatNumber(own.rank)}</span>
          <span className="round-standing-round">{roundText(round.get(own.playerKey))}</span>
          <span className="round-standing-total">{formatNumber(own.points)}</span>
        </p>
      )}
      <ol className="round-standings-rows" aria-label={title} data-testid="match-standings">
        {p.standings.map((s) => (
          <Row
            key={s.playerKey}
            s={s}
            points={round.get(s.playerKey)}
            you={s.playerKey === p.viewerKey}
          />
        ))}
      </ol>
    </section>
  );
}
