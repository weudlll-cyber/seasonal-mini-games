/**
 * @file   games/seasonal-target/src/devBot.test.ts
 * @module games/seasonal-target
 * @brief  The development bot plays valid, sensible guesses from its own view and finds the target.
 *
 * Responsibility: every guess it makes is accepted (inside its area, not fallen, not tried),
 *                 it solves a round in both answer modes within a handful of guesses on a
 *                 20 × 20 grid, waits on answers Frost still holds, and stops once solved.
 * Depends on:     vitest, fast-check, @smg/game-sdk, ./devBot, ./fakes, ./module, ./views
 * Spec:           docs/spec/09-testing-strategy.md §5
 */
import { roundRng } from '@smg/game-sdk/crypto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { stDevBot } from './devBot.js';
import { input, Table } from './fakes.js';
import { FEEDBACK_MODES } from './geometry.js';
import { seasonalTarget } from './module.js';
import type { PlayerView } from './views.js';

const ALL = { releasedBefore: Infinity };
// The most guesses the bot needs per answer mode: the less an answer says, the more it takes.
const LIMITS = { direction: 8, distance: 40, closeness: 150 } as const;

describe('development bot', () => {
  for (const feedback of FEEDBACK_MODES) {
    it(`finds the target with valid guesses (${feedback})`, () => {
      fc.assert(
        fc.property(fc.uint8Array({ minLength: 32, maxLength: 32 }), (seed) => {
          const inp = input('individual', ['bot'], { feedback });
          const t = new Table(seasonalTarget.deriveSecrets(inp, roundRng(seed)), inp);
          const draw = roundRng(seed).child('bot');
          let guesses = 0;
          for (;;) {
            const action = stDevBot(seasonalTarget.views.player(t.state, 'bot', ALL), draw.nextInt);
            if (action === null) break;
            expect(t.play('bot', action.value).ok).toBe(true);
            guesses += 1;
          }
          const view = seasonalTarget.views.player(t.state, 'bot', ALL) as PlayerView;
          expect(view.guesses.at(-1)?.feedback).toEqual({ kind: 'correct' });
          expect(guesses).toBeLessThan(LIMITS[feedback]);
        }),
        { numRuns: 30 },
      );
    });
  }

  it('guesses anything open while its answers are held, and nothing in an empty area', () => {
    const view: PlayerView = {
      map: { width: 20, height: 20 },
      feedbackMode: 'direction',
      repeatRejected: true,
      area: { left: 1, right: 1, top: 1, bottom: 2 },
      hint: null,
      fallen: [{ x: 1, y: 2 }],
      guesses: [],
      log: [],
    };
    expect(stDevBot(view, () => 0)).toEqual({ value: { x: 1, y: 1 } });
    // A pick outside the list chooses nothing.
    expect(stDevBot(view, () => 5)).toBeNull();
    const tried = {
      ...view,
      guesses: [
        {
          receiveSeq: 1,
          receivedAt: 0,
          value: { x: 1, y: 1 },
          feedback: null,
          tier: null,
          comment: null,
        },
      ],
    };
    expect(stDevBot(tried, () => 0)).toBeNull();
  });
});
