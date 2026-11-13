/**
 * @file   games/mind-games/web/fixtures.ts
 * @module games/mind-games/web
 * @brief  Test fixtures: real views of a round played through the game's own rules.
 *
 * Responsibility: the screens' tests render views the module itself builds (never hand-made
 *                 ones), from rounds played with the game's test helpers, and the props the
 *                 platform hands a panel.
 * Depends on:     @smg-game/mind-games (module, settings, views), ../src/fakes
 * Used by:        the tests of games/mind-games/web
 * Spec:           docs/spec/09-testing-strategy.md §4.2
 */
import {
  mindGames,
  type PlayerView,
  type ResultView,
  type SpectatorView,
} from '@smg-game/mind-games';
import { vi } from 'vitest';

import { playAll, roundWith } from '../src/fakes.js';

type Moves = Parameters<typeof playAll>[1];
type Cfg = Parameters<typeof roundWith>[0];

export const names = { anna: 'Anna', bo: 'Bo', cy: 'Cy', me: 'Me' };

export const playerView = (moves: Moves, cut: number, cfg?: Cfg, viewer = 'me'): PlayerView =>
  mindGames.views.player(playAll(roundWith(cfg), moves), viewer, {
    releasedBefore: cut,
  }) as PlayerView;

export const spectatorView = (moves: Moves, cut: number, cfg?: Cfg): SpectatorView =>
  mindGames.views.spectator(playAll(roundWith(cfg), moves), {
    releasedBefore: cut,
  }) as SpectatorView;

export const resultView = (moves: Moves, cfg?: Cfg): ResultView =>
  mindGames.views.result(playAll(roundWith(cfg), moves), null) as ResultView;

// What the platform hands the player's input.
export const inputProps = (view: PlayerView, act = vi.fn(() => Promise.resolve({ ok: true }))) => ({
  view,
  act,
  canAct: true,
  frostDelayMs: null,
  now: () => 0,
  season: 'winter' as const,
  specialOn: false,
  waitS: null,
  names,
  colors: {},
});
