/**
 * @file   games/bomb-defusal/src/conformance.test.ts
 * @module games/bomb-defusal
 * @brief  The conformance kit: valid actions that never hit a sentinel, and the solving action.
 *
 * Responsibility: every action is a valid sequence of the kit's round and equals no sentinel
 *                 secret; the sentinels are distinct per player; `solve` defuses a player's own
 *                 bomb (shared and individual); the bot has nothing to send when no sequence
 *                 fits its answers; a view of a player off the roster holds no hint.
 * Depends on:     vitest, fast-check, ./conformance, ./devBot, ./fakes, ./module
 * Spec:           docs/spec/09-testing-strategy.md §3 P2, §4.1
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { bombDefusalConformance as kit } from './conformance.js';
import { bombDefusalDevBot } from './devBot.js';
import { Table } from './fakes.js';
import { bombDefusal } from './module.js';

const PLAYERS = ['p1', 'p2', 'p3'];

describe('the conformance kit', () => {
  it('sends only valid sequences that hit no sentinel', () => {
    const inp = kit.input('individual', PLAYERS);
    const { secrets, marks } = kit.sentinels(inp);
    expect(new Set(marks).size).toBe(PLAYERS.length);
    const state = bombDefusal.createRound(inp);
    fc.assert(
      fc.property(fc.integer(), (n) => {
        const action = kit.action(n);
        expect(bombDefusal.validate(state, 'p1', action)).toBeNull();
        expect(marks).not.toContain(JSON.stringify(action.value));
        expect(secrets.mode === 'individual' && Object.keys(secrets.byPlayer)).toEqual(PLAYERS);
      }),
      { numRuns: 1_000 },
    );
  });

  it('solves a player’s own bomb in both modes', () => {
    for (const mode of ['shared', 'individual'] as const) {
      const inp = kit.input(mode, PLAYERS);
      const { secrets } = kit.sentinels(inp);
      const t = new Table(secrets, inp);
      const d = t.play('p2', kit.solve?.(secrets, 'p2').value ?? []);
      expect(d).toMatchObject({ ok: true, signals: [{ type: 'Solved', playerId: 'p2' }] });
    }
  });
});

describe('edges', () => {
  it('the bot has nothing to send when no sequence fits, and an unknown viewer gets no hint', () => {
    const inp = kit.input('individual', PLAYERS);
    const state = bombDefusal.createRound(inp);
    const view = bombDefusal.views.player(state, 'nobody', { releasedBefore: Infinity });
    expect(view).toMatchObject({ hint: null, guesses: [] });
    const all = { ...(view as object), harmless: ['red', 'blue', 'yellow'] };
    expect(bombDefusalDevBot(all, () => 0)).toBeNull();
  });
});
