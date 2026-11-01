/**
 * @file   apps/web/src/round/RoundIntro.tsx
 * @module web/round
 * @brief  The round intro during the countdown: the season, its special, the secret, the time.
 *
 * Responsibility: the countdown is a full intro screen (O36) in the round's season colour: the
 *                 season's token icon and its name in large type (with the halving badge on a
 *                 halving round), the special's name and its one plain sentence ("No special
 *                 this round." when it is off), the game's line on the secret and its range
 *                 ("Shared number between 1 and 100", "Hidden range"), the cooldown, and the
 *                 seconds until the round opens; the host menu stays in its corner. It fills
 *                 the round's space without a page scrollbar on desktop and phone
 *                 (./roundIntro.css).
 * Depends on:     react, @smg/contracts, @smg-game/registry/web (types), ../season/*,
 *                 ./roundText, ./roundIntro.css
 * Used by:        ./RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/03-seasonal-specials.md §2, §6
 */
import type { GameWeb } from '@smg-game/registry/web';
import type { RoundStateView } from '@smg/contracts';
import type { ReactElement, ReactNode } from 'react';

import { SeasonIcon } from '../season/SeasonIcon.js';
import { NO_SPECIAL, SEASON_NAMES, SPECIALS } from '../season/season.js';
import { seconds } from './roundText.js';
import './roundIntro.css';

// Whole seconds until the round opens, never below 0.
export function opensIn(state: RoundStateView, now: number): number {
  return state.opensAt === null ? 0 : Math.max(0, Math.ceil((state.opensAt - now) / 1_000));
}

export function RoundIntro(p: {
  readonly state: RoundStateView;
  readonly game: GameWeb | null;
  readonly now: number;
  readonly hostMenu: ReactNode;
}): ReactElement {
  const { state } = p;
  const special = SPECIALS[state.season];
  const secret =
    state.game === null ? null : (p.game?.text.intro?.(state.game, state.secretMode) ?? null);
  const left = opensIn(state, p.now);
  return (
    <section
      className="round-intro"
      data-season={state.season}
      aria-labelledby="round-intro-season"
      data-testid="round-intro"
    >
      {p.hostMenu === null ? null : <div className="round-intro-host">{p.hostMenu}</div>}
      <header className="round-intro-head">
        <span className="round-intro-icon" aria-hidden="true">
          <SeasonIcon season={state.season} size="100%" />
        </span>
        <h1 id="round-intro-season">{SEASON_NAMES[state.season]}</h1>
        {state.halving ? <span className="round-badge">Halving round</span> : null}
      </header>
      <div className="round-intro-special" data-testid="intro-special">
        {state.specialOn ? (
          <>
            <h2>{special.name}</h2>
            <p>{special.rule}</p>
          </>
        ) : (
          <p>{NO_SPECIAL}</p>
        )}
      </div>
      <ul className="round-intro-facts">
        {secret === null ? null : <li data-testid="intro-secret">{secret}</li>}
        <li>Cooldown {seconds(state.cooldownMs)} between guesses</li>
      </ul>
      <p className="round-intro-count" role="timer" aria-live="off" data-testid="countdown">
        Opens in <strong>{left}</strong> s
      </p>
    </section>
  );
}
