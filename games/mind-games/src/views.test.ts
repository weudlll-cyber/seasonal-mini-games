/**
 * @file   games/mind-games/src/views.test.ts
 * @module games/mind-games
 * @brief  The views: the feed as of the cut, the viewer's own live choice, the result.
 *
 * Responsibility: a running round's views show the counts, the players in the round and the
 *                 lines only of choices received before `releasedBefore`, newest first and at
 *                 most 60, with no hidden switch; the viewer's own choice and box are live;
 *                 the result has every final choice with its points, the places, the winners
 *                 and every named line; every view fits its schema.
 * Depends on:     vitest, ./fakes, ./module, ./views
 * Spec:           docs/spec/02e-game-mind-games.md §6, §9; docs/spec/09-testing-strategy.md §4.2
 */
import { describe, expect, it } from 'vitest';

import { playAll, roundWith } from './fakes.js';
import { mindGames } from './module.js';
import { FEED_LINES, type PlayerView, type ResultView, type SpectatorView } from './views.js';

const { views, viewSchemas } = mindGames;

// anna at 0 s, bo at 1 s, anna switches with her box ticked at 2 s, cy at 3 s.
const round = playAll(roundWith(), [
  ['anna', 'summer'],
  ['bo', 'winter'],
  ['anna', 'autumn', true],
  ['cy', 'winter'],
]);

describe('Mind Games running views (02e §6)', () => {
  it('shows the others only as they were before the cut', () => {
    const v = views.spectator(round, { releasedBefore: 2_000 }) as SpectatorView;
    expect(v.counts).toEqual({ spring: 0, summer: 1, autumn: 0, winter: 1, all: 0 });
    expect(v.entrants).toBe(2);
    expect(v.lines.map((l) => [l.playerKey, l.from, l.choice, l.at])).toEqual([
      ['bo', null, 'winter', 1_000],
      ['anna', null, 'summer', 0],
    ]);
    const empty = views.spectator(round, { releasedBefore: 0 }) as SpectatorView;
    expect([empty.entrants, empty.lines]).toEqual([0, []]);
    expect(viewSchemas.spectator.safeParse(v).success).toBe(true);
  });

  it('changes only the counts for a hidden switch', () => {
    const v = views.spectator(round, { releasedBefore: Infinity }) as SpectatorView;
    expect(v.counts).toEqual({ spring: 0, summer: 0, autumn: 1, winter: 2, all: 0 });
    expect(v.lines.map((l) => l.playerKey)).toEqual(['cy', 'bo', 'anna']);
  });

  it('gives the viewer their own choice and box live', () => {
    const v = views.player(round, 'anna', { releasedBefore: 0 }) as PlayerView;
    expect(v.own).toEqual({ choice: 'autumn', hide: true });
    expect(v.entrants).toBe(0);
    const none = views.player(round, 'dee', { releasedBefore: 0 }) as PlayerView;
    expect(none.own).toEqual({ choice: null, hide: false });
    expect(viewSchemas.player.safeParse(v).success).toBe(true);
  });

  it('carries the newest 60 lines and the round’s rules and plan', () => {
    const many = playAll(
      roundWith({ switchVisibility: 'visible' }),
      Array.from({ length: 70 }, (_, i) => ['p', i % 2 === 0 ? 'spring' : 'summer'] as const),
    );
    const v = views.spectator(many, { releasedBefore: Infinity }) as SpectatorView;
    expect(v.lines).toHaveLength(FEED_LINES);
    expect(v.lines[0]?.at).toBe(69_000);
    expect(v.rules).toEqual({
      allOption: false,
      switchVisibility: 'visible',
      winnerPlace: 1,
      plan: { entryEndMs: 60_000, actionsEndMs: 90_000, endMs: 120_000, viewDelayMs: 30_000 },
    });
  });
});

describe('Mind Games result view (02e §9)', () => {
  it('shows every final choice with its points, the places and the winners', () => {
    const r = views.result(round, null) as ResultView;
    expect(r.places).toEqual({ spring: null, summer: null, autumn: 1, winter: 2, all: null });
    expect(r.winners).toEqual(['autumn']);
    expect(r.players).toEqual([
      { playerKey: 'anna', choice: 'autumn', points: 1 },
      { playerKey: 'bo', choice: 'winter', points: 0 },
      { playerKey: 'cy', choice: 'winter', points: 0 },
    ]);
    // Every named line, never the hidden switch.
    expect(r.lines).toHaveLength(3);
    expect(viewSchemas.result.safeParse(r).success).toBe(true);
  });
});
