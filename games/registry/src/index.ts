/**
 * @file   games/registry/src/index.ts
 * @module games/registry
 * @brief  The registered game modules, for the server.
 *
 * Responsibility: one line per game (04 §4.6): its module, its conformance kit and its
 *                 development bot. The platform finds games only here; the
 *                 player client has the matching web half (games/registry/web). Each game
 *                 keeps its own state, action and config types: `use` hands its entry to a
 *                 function written for every game (the server's runner, the conformance
 *                 suite), so games of different types stay one list.
 * Depends on:     @smg/game-sdk (GameEntry), @smg-game/guess-the-number, @smg-game/safecracker,
 *                 @smg-game/bomb-defusal, @smg-game/seasonal-target, @smg-game/mind-games
 * Used by:        apps/server, ./conformance.test, ./testing
 * Spec:           docs/spec/04-software-architecture.md §4.6, docs/spec/10-repository-structure.md §1
 */
import { bombDefusal, bombDefusalConformance, bombDefusalDevBot } from '@smg-game/bomb-defusal';
import { gtnConformance, gtnDevBot, guessTheNumber } from '@smg-game/guess-the-number';
import { mindConformance, mindDevBot, mindGames } from '@smg-game/mind-games';
import { safecracker, safecrackerConformance, safecrackerDevBot } from '@smg-game/safecracker';
import {
  seasonalTarget,
  seasonalTargetConformance,
  seasonalTargetDevBot,
} from '@smg-game/seasonal-target';
import type { GameEntry } from '@smg/game-sdk';

// A function that works for the entry of any game, whatever its types.
export type ForAnyGame<R> = <S, A, E, Cfg, Sec>(entry: GameEntry<S, A, E, Cfg, Sec>) => R;

export interface InstalledGame {
  readonly id: string;
  readonly use: <R>(f: ForAnyGame<R>) => R;
}

// One entry as an installed game (also for the test entry ./testing).
export const install = <S, A, E, Cfg, Sec>(entry: GameEntry<S, A, E, Cfg, Sec>): InstalledGame => ({
  id: entry.module.meta.id,
  use: (f) => f(entry),
});

// Guess The Number first: forms preselect the first game.
export const GAMES: readonly InstalledGame[] = [
  install({ module: guessTheNumber, conformance: gtnConformance, devBot: gtnDevBot }),
  install({ module: safecracker, conformance: safecrackerConformance, devBot: safecrackerDevBot }),
  install({ module: bombDefusal, conformance: bombDefusalConformance, devBot: bombDefusalDevBot }),
  install({
    module: seasonalTarget,
    conformance: seasonalTargetConformance,
    devBot: seasonalTargetDevBot,
  }),
  install({ module: mindGames, conformance: mindConformance, devBot: mindDevBot }),
];
