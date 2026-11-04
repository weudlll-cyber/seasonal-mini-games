/**
 * @file   games/bomb-defusal/src/devBot.test.ts
 * @module games/bomb-defusal
 * @brief  The development bot defuses from its own answers and then stops.
 *
 * Responsibility: playing only from its player view, the bot sends only valid sequences
 *                 (never a repeat, never a harmless wire, the hint first when there is one),
 *                 defuses an 8-wire, 6-cut bomb and a default one, and has nothing to do once
 *                 defused; a Frost-held sequence is not sent again.
 * Depends on:     vitest, fast-check, @smg/game-sdk/crypto, ./devBot, ./fakes, ./module
 * Spec:           docs/spec/02c-game-bomb-defusal.md §2; docs/spec/09-testing-strategy.md §4.1, §5
 */
import { roundRng } from '@smg/game-sdk/crypto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { bombDefusalDevBot as bot } from './devBot.js';
import { input, Table } from './fakes.js';
import { bombDefusal } from './module.js';

const all = { releasedBefore: Infinity };

function playOut(t: Table, pick: (n: number) => number): number {
  let cuts = 0;
  for (;;) {
    const action = bot(bombDefusal.views.player(t.state, 'bot', all), pick);
    if (action === null) return cuts;
    expect(t.play('bot', action.value).ok).toBe(true);
    cuts += 1;
  }
}

describe('the development bot', () => {
  it('defuses from its own answers with valid sequences only, then stops', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        fc.boolean(),
        fc.integer(),
        (seed, big, salt) => {
          const inp = input('shared', ['bot'], big ? { wires: 8, cuts: 6 } : {});
          const t = new Table(bombDefusal.deriveSecrets(inp, roundRng(seed)), inp);
          let state = salt >>> 0;
          const pick = (n: number) => {
            state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
            return state % n;
          };
          const cuts = playOut(t, pick);
          expect(t.state.players.bot?.guesses.at(-1)?.feedback.defused).toBe(true);
          expect(cuts).toBeLessThanOrEqual(big ? 40 : 20);
        },
      ),
      { numRuns: 30 },
    );
    // Whole rounds of up to 40 cuts each: more than the default 5 s under coverage.
  }, 30_000);

  it('starts with the hint, avoids harmless wires and does not resend a held sequence', () => {
    const t = new Table(
      { mode: 'shared', value: ['blue', 'red', 'yellow', 'white'] },
      input('shared', ['bot']),
    );
    t.state = { ...t.state, hint: 'blue', harmless: ['green'] };
    const first = bot(bombDefusal.views.player(t.state, 'bot', all), () => 0);
    expect(first?.value[0]).toBe('blue');
    expect(first?.value).not.toContain('green');
    t.play('bot', first?.value ?? []);
    const held = bombDefusal.views.player(t.state, 'bot', { releasedBefore: -Infinity });
    expect(bot(held, () => 0)?.value).not.toEqual(first?.value);
  });
});
