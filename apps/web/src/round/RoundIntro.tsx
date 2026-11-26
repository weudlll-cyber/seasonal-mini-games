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
 *                 the cooldown, and the seconds until the round opens (the card's `opensAt` on
 *                 the server's clock, nothing until it is measured). The round bar above it
 *                 keeps the host's controls, the chat and the players (./FocusShell, O46). The
 *                 card fills the space under the bar without a page scrollbar on desktop and
 *                 phone, at the screen's scale where it has not the room (the kit's fit, O111;
 *                 the kit's `fit` option `afterFonts` fits it again after web fonts load, T423). A game
 *                 whose rounds show no season (O93) has its name as the heading, with no season
 *                 icon and no special block.
 * Depends on:     react, @seasonal/kit/react (StartCard), @smg/contracts,
 *                 @smg-game/registry/web (types), ../live/socket (the clock offset),
 *                 ../season/*, ./roundText, ./SeasonPill (ruleOf), ./roundIntro.css
 * Used by:        ./RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/03-seasonal-specials.md §2, §6
 */
import { StartCard } from '@seasonal/kit/react';
import type { GameWeb } from '@smg-game/registry/web';
import type { RoundStateView } from '@smg/contracts';
import type { ReactElement, ReactNode } from 'react';

import { useClockOffset } from '../live/socket.js';
import { SeasonIcon } from '../season/SeasonIcon.js';
import { NO_SPECIAL, SEASON_NAMES, SPECIALS } from '../season/season.js';
import { seconds } from './roundText.js';
import { ruleOf } from './SeasonPill.js';
import './roundIntro.css';

// The card fits again once web fonts have loaded (kit v0.16.0, K48; T404).
const FIT = { afterFonts: true } as const;

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
  // The game's name, for a game whose rounds show no season (O93); null shows the season.
  readonly noSeason?: string | null;
}): ReactElement {
  const { state } = p;
  const offsetMs = useClockOffset();
  const noSeason = p.noSeason ?? null;
  const secret =
    state.game === null ? null : (p.game?.text.intro?.(state.game, state.secretMode) ?? null);
  const facts = [
    secret === null ? null : <span data-testid="intro-secret">{secret}</span>,
    // A phased round has no cooldown (04 §4.8 rule 4).
    state.plan === undefined ? `Cooldown ${seconds(state.cooldownMs)} between guesses` : null,
  ].filter((fact) => fact !== null);
  return (
    <StartCard
      game="mini-games"
      season={noSeason === null ? state.season : null}
      title={noSeason ?? SEASON_NAMES[state.season]}
      icon={<SeasonIcon season={state.season} size="100%" />}
      badge={state.halving ? <span className="round-badge">Halving round</span> : undefined}
      special={noSeason === null ? special(state, p.game) : undefined}
      facts={facts}
      opensAt={{ at: state.opensAt, offsetMs }}
      // The card's content changes only with these.
      signature={`${state.roundId}|${String(secret)}|${String(noSeason)}`}
      fit={FIT}
    />
  );
}
