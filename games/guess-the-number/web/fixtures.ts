/**
 * @file   games/guess-the-number/web/fixtures.ts
 * @module games/guess-the-number/web
 * @brief  The screens' tests' shared views: the platform's per-player props, a player view.
 *
 * Responsibility: the props the platform hands every panel (no cooldown, the list's names and
 *                 colours), an answered and a held guess, and a player view of the range 1–1,000
 *                 with two fallen numbers, two own guesses, one of another player and a hint.
 *                 Split out of ./panels.test with the input row's tests (./input.test, night 7).
 * Used by:        ./panels.test, ./input.test
 * Spec:           docs/spec/09-testing-strategy.md §2
 */
// The platform's per-player props: no cooldown running, and the names and colours of the list.
export const who = { waitS: null, names: { p1: 'Anna' }, colors: { p1: 'var(--color-spring)' } };
export const answered = { feedback: 'higher' as const, tier: 'cool' as const, comment: 'Mild.' };
export const held = { feedback: null, tier: null, comment: null };
export const view = {
  range: { low: 1, high: 1_000 },
  removed: [5, 6],
  guesses: [
    { receiveSeq: 1, receivedAt: 1_000, value: 300, ...answered },
    { receiveSeq: 3, receivedAt: 5_000, value: 700, ...held },
  ],
  // Another player's guess whose answer Frost still holds (`held`, T150).
  log: [{ receiveSeq: 2, receivedAt: 2_000, playerId: 'p2', value: 40, ...held, held: true }],
  hint: { kind: 'parity' as const, odd: true },
};
