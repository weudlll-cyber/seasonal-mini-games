/**
 * @file   games/safecracker/src/devBot.test.ts
 * @module games/safecracker
 * @brief  The development bot cracks a code from its own answers and then stops; the kit's moves.
 *
 * Responsibility: playing only from its player view, the bot opens default and six-digit safes
 *                 within a few guesses, with every code accepted (no repeats, no fallen digit,
 *                 the hint used); it has nothing to do once solved or with no digit left. The
 *                 conformance kit's actions are valid codes that never hold a sentinel, its
 *                 sentinels are distinct, and `solve` opens each player's own safe.
 * Depends on:     vitest, ./conformance, ./devBot, ./fakes, ./module, ./views
 * Spec:           docs/spec/09-testing-strategy.md §3 P2, §4.1, §5
 */
import { describe, expect, it } from 'vitest';

import { scConformance as kit } from './conformance.js';
import { scDevBot } from './devBot.js';
import { individual, input, shared, Table } from './fakes.js';
import { safecracker } from './module.js';
import type { PlayerView } from './views.js';

const all = { releasedBefore: Infinity };
let seed = 11;
const pick = (n: number) => {
  seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
  return seed % n;
};

function crack(t: Table, limit: number): number {
  let guesses = 0;
  for (;;) {
    const action = scDevBot(safecracker.views.player(t.state, 'bot', all), pick);
    if (action === null) return guesses;
    expect(t.play('bot', action.value).ok).toBe(true);
    guesses += 1;
    expect(guesses).toBeLessThanOrEqual(limit);
  }
}

describe('the development bot', () => {
  it('cracks codes from its own answers and then stops', () => {
    for (const secret of ['1123', '0000', '9870', '4444']) {
      const t = new Table(shared(secret), input('shared', ['bot']));
      t.spring();
      t.fall(1);
      crack(t, 12);
      expect(t.state.players.bot?.guesses.at(-1)?.value).toBe(secret);
    }
  });

  // A six-digit safe scans a slice of a million codes per move: slow under coverage.
  it('cracks a six-digit code with its own hint', { timeout: 60_000 }, () => {
    const six = new Table(
      individual({ bot: '305112' }),
      input('individual', ['bot'], { codeLength: 6 }),
    );
    six.spring();
    crack(six, 20);
    expect(six.state.players.bot?.guesses.at(-1)?.value).toBe('305112');
  });
});

describe('the development bot with nothing left to try', () => {
  it('has nothing to do once solved or with every digit fallen', () => {
    const base = { length: 3, digits: 4, hint: null, log: [] };
    const solved = { exact: 3, near: 0, solved: true };
    const done = {
      receiveSeq: 1,
      receivedAt: 0,
      value: '123',
      feedback: solved,
      tier: null,
      comment: null,
    };
    expect(
      scDevBot({ ...base, fallen: [], guesses: [done] } satisfies PlayerView, pick),
    ).toBeNull();
    expect(
      scDevBot({ ...base, fallen: [0, 1, 2, 3], guesses: [] } satisfies PlayerView, pick),
    ).toBeNull();
  });

  it('falls back to an untried code when no sample fits, and gives up when all are tried', () => {
    // A held answer is ignored; a wrong delivered one rules out everything else.
    const wrong = { exact: 0, near: 0, solved: false };
    const g = (value: string, feedback: typeof wrong | null) => ({
      receiveSeq: 1,
      receivedAt: 0,
      value,
      feedback,
      tier: null,
      comment: null,
    });
    const v = { length: 3, digits: 4, hint: null, log: [], fallen: [1, 2, 3] };
    expect(scDevBot({ ...v, guesses: [g('000', wrong)] }, pick)).toBeNull();
    const fits = scDevBot(
      { ...v, fallen: [2, 3], guesses: [g('000', null), g('111', wrong)] },
      pick,
    );
    expect(fits?.value).toMatch(/^[01]{3}$/);
  });
});

describe('the conformance kit', () => {
  it('moves with valid codes that never hold a sentinel', () => {
    for (const mode of ['shared', 'individual'] as const) {
      const round = kit.input(mode, ['p1', 'p2', 'p3']);
      const { secrets, marks } = kit.sentinels(round);
      expect(new Set(marks).size).toBe(marks.length);
      const t = new Table(secrets, round);
      for (const n of [0, 1, -7, 15_624, 15_625, 2 ** 40, 1.5]) {
        const { value } = kit.action(n);
        expect(safecracker.actionSchema.safeParse({ value }).success).toBe(true);
        for (const m of marks) expect(value).not.toContain(m);
      }
      expect(t.play('p1', kit.solve?.(secrets, 'p1').value ?? '').ok).toBe(true);
      expect(t.state.players.p1?.guesses[0]?.feedback.solved).toBe(true);
    }
  });
});
