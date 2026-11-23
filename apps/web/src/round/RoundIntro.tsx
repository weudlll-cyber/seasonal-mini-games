/**
 * @file   apps/web/src/round/RoundIntro.tsx
 * @module web/round
 * @brief  The round intro during the countdown: the season, its special, the secret, the time.
 *
 * Responsibility: the countdown is a full intro screen (O36) in the round's season colour, the
 *                 kit's `StartCard` filled with the game's parts: the season's token icon and
 *                 its name in large type (with the halving badge on a halving round), the
 *                 special's name and its one plain sentence, in the game's words where it has
 *                 its own (T119) ("No special this round." when it is off), the game's line on
 *                 the secret and its range ("Shared number between 1 and 100", "Hidden range"),
 *                 the cooldown, and the seconds until the round opens. The round bar above it
 *                 keeps the host's controls, the chat and the players (./FocusShell, O46). The
 *                 card fills the space under the bar without a page scrollbar on desktop and
 *                 phone, at the screen's scale where it has not the room (the kit's fit, O111;
 *                 a font load counted into its signature fits it again, O144, ./useFit). A game
 *                 whose rounds show no season (O93) has its name as the heading, with no season
 *                 icon and no special block.
 * Depends on:     react, @seasonal/kit/react (StartCard), @smg/contracts,
 *                 @smg-game/registry/web (types), ../season/*, ./roundText, ./SeasonPill
 *                 (ruleOf), ./useFit (useFontLoads), ./roundIntro.css
 * Used by:        ./RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/03-seasonal-specials.md §2, §6
 */
import { StartCard } from '@seasonal/kit/react';
import type { GameWeb } from '@smg-game/registry/web';
import type { RoundStateView } from '@smg/contracts';
import type { ReactElement, ReactNode } from 'react';

import { SeasonIcon } from '../season/SeasonIcon.js';
import { NO_SPECIAL, SEASON_NAMES, SPECIALS } from '../season/season.js';
import { seconds } from './roundText.js';
import { ruleOf } from './SeasonPill.js';
import { useFontLoads } from './useFit.js';
import './roundIntro.css';

// Seconds until the round opens.
function opensIn(state: RoundStateView, now: number): number {
  return state.opensAt === null ? 0 : (state.opensAt - now) / 1_000;
}

// The season's special and its sentence, or "No special this round.".
function special(state: RoundStateView, game: GameWeb | null): ReactNode {
  return state.specialOn ? (
    <>
      <h2>{SPECIALS[state.season].name}</h2>
      <p>{ruleOf(game, state.season)}</p>
    </>
  ) : (
    <p>{NO_SPECIAL}</p>
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
  const facts = [
    secret === null ? null : <span data-testid="intro-secret">{secret}</span>,
    // A phased round has no cooldown (04 §4.8 rule 4).
    state.plan === undefined ? `Cooldown ${seconds(state.cooldownMs)} between guesses` : null,
  ].filter((fact) => fact !== null);
  // The card's content changes only with these, and with a font load (O144).
  const loads = useFontLoads();
  return (
    <StartCard
      game="mini-games"
      season={noSeason === null ? state.season : null}
      title={noSeason ?? SEASON_NAMES[state.season]}
      icon={<SeasonIcon season={state.season} size="100%" />}
      badge={state.halving ? <span className="round-badge">Halving round</span> : undefined}
      special={noSeason === null ? special(state, p.game) : undefined}
      facts={facts}
      opensIn={opensIn(state, p.now)}
      signature={`${state.roundId}|${String(secret)}|${String(noSeason)}|${String(loads)}`}
    />
  );
}
