/**
 * @file   apps/web/src/round/RoundIntro.tsx
 * @module web/round
 * @brief  The round intro during the countdown: the season, its special, the secret, the time.
 *
 * Responsibility: the countdown is a full intro screen (O36) in the round's season colour: the
 *                 season's token icon and its name in large type (with the halving badge on a
 *                 halving round), the special's name and its one plain sentence, in the game's
 *                 words where it has its own (T119) ("No special this round." when it is off), the game's line on the secret and its range
 *                 ("Shared number between 1 and 100", "Hidden range"), the cooldown, and the
 *                 seconds until the round opens. The round bar above it keeps the host's
 *                 controls, the chat and the players (./FocusShell, O46). It fills the space
 *                 under the bar without a page scrollbar on desktop and phone (./roundIntro.css).
 *                 A game whose rounds show no season (O93) has its name as the heading, with
 *                 no season icon and no special block.
 * Depends on:     react, @smg/contracts, @smg-game/registry/web (types), ../season/*,
 *                 ./roundText, ./SeasonPill (ruleOf), ./roundIntro.css
 * Used by:        ./RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/03-seasonal-specials.md §2, §6
 */
import type { GameWeb } from '@smg-game/registry/web';
import type { RoundStateView } from '@smg/contracts';
import type { ReactElement } from 'react';

import { SeasonIcon } from '../season/SeasonIcon.js';
import { NO_SPECIAL, SEASON_NAMES, SPECIALS } from '../season/season.js';
import { seconds } from './roundText.js';
import { ruleOf } from './SeasonPill.js';
import './roundIntro.css';

// Whole seconds until the round opens, never below 0.
export function opensIn(state: RoundStateView, now: number): number {
  return state.opensAt === null ? 0 : Math.max(0, Math.ceil((state.opensAt - now) / 1_000));
}

// The intro's head: the season's icon and name, or a seasonless game's name (O93), and the
// halving badge.
function IntroHead(p: { readonly state: RoundStateView; readonly noSeason: string | null }) {
  const { state } = p;
  return (
    <header className="round-intro-head">
      {p.noSeason === null ? (
        <span className="round-intro-icon" aria-hidden="true">
          <SeasonIcon season={state.season} size="100%" />
        </span>
      ) : null}
      <h1 id="round-intro-season">{p.noSeason ?? SEASON_NAMES[state.season]}</h1>
      {state.halving ? <span className="round-badge">Halving round</span> : null}
    </header>
  );
}

// The season's special and its sentence, or "No special this round.".
function IntroSpecial(p: { readonly state: RoundStateView; readonly game: GameWeb | null }) {
  const { state } = p;
  return (
    <div className="round-intro-special" data-testid="intro-special">
      {state.specialOn ? (
        <>
          <h2>{SPECIALS[state.season].name}</h2>
          <p>{ruleOf(p.game, state.season)}</p>
        </>
      ) : (
        <p>{NO_SPECIAL}</p>
      )}
    </div>
  );
}

export function RoundIntro(p: {
  readonly state: RoundStateView;
  readonly game: GameWeb | null;
  readonly now: number;
  // The game's name, for a game whose rounds show no season (O93); null shows the season.
  readonly noSeason?: string | null;
}): ReactElement {
  const { state } = p;
  const noSeason = p.noSeason ?? null;
  const secret =
    state.game === null ? null : (p.game?.text.intro?.(state.game, state.secretMode) ?? null);
  const left = opensIn(state, p.now);
  return (
    <section
      className="round-intro"
      data-season={noSeason === null ? state.season : undefined}
      aria-labelledby="round-intro-season"
      data-testid="round-intro"
    >
      <IntroHead state={state} noSeason={noSeason} />
      {noSeason === null ? <IntroSpecial state={state} game={p.game} /> : null}
      <ul className="round-intro-facts">
        {secret === null ? null : <li data-testid="intro-secret">{secret}</li>}
        {/* A phased round has no cooldown (04 §4.8 rule 4). */}
        {state.plan === undefined ? (
          <li>Cooldown {seconds(state.cooldownMs)} between guesses</li>
        ) : null}
      </ul>
      <p className="round-intro-count" role="timer" aria-live="off" data-testid="countdown">
        Opens in <strong>{left}</strong> s
      </p>
    </section>
  );
}
