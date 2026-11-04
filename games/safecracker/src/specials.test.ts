/**
 * @file   games/safecracker/src/specials.test.ts
 * @module games/safecracker
 * @brief  Spring Herald's hint and Leaf Fall's candidates (O37), step by step and as properties.
 *
 * Responsibility: the shared hint (one position, its true digit, to the room) and the
 *                 individual ones (each player their own, the room only "everyone"); Leaf
 *                 Fall's steps 1–4 for each visibility and mode, Frost's cut, fewer candidates
 *                 than `digitsPerFall`, the empty end; and as properties: no fallen digit is in
 *                 any secret; under shared `full` every fallen digit was a candidate given the
 *                 delivered answers, otherwise none is in an accepted guess; the same seed and
 *                 guesses give the same falls.
 * Depends on:     vitest, fast-check, ./fakes, ./leafFall
 * Spec:           docs/spec/02b-game-safecracker.md §7.1, §7.3; docs/spec/09-testing-strategy.md §4.1
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { individual, input, shared, Table } from './fakes.js';
import { candidatesOf } from './leafFall.js';

describe('Spring Herald', () => {
  it('reveals one true digit of the shared code to the room', () => {
    const t = new Table(shared('1123'), input('shared', ['a', 'b']));
    const events = t.spring();
    expect(events).toHaveLength(1);
    expect(events[0]?.audience).toBe('room');
    const hint = t.state.hint;
    if (hint === null) throw new Error('no hint');
    expect(String(hint.digit)).toBe('1123'[hint.position]);
  });

  it('gives each player a digit of their own code and the room only a line', () => {
    const codes = { a: '0123', b: '4567', c: '8989' };
    const t = new Table(individual(codes), input('individual', ['a', 'b', 'c']));
    const events = t.spring();
    expect(events.map((e) => e.audience)).toEqual(['player:a', 'player:b', 'player:c', 'room']);
    expect(events[3]?.event).toEqual({ type: 'HintGiven', playerId: null, hint: null });
    for (const [id, own] of Object.entries(codes)) {
      const hint = t.state.players[id]?.hint;
      expect(hint && String(hint.digit)).toBe(hint && own[hint.position]);
    }
    expect(t.state.hint).toBeNull();
  });
});

describe('Leaf Fall candidates', () => {
  it('drops the digits in no secret, the fallen and the publicly ruled-out under shared full', () => {
    const t = new Table(shared('1123'), input('shared', ['a', 'b']));
    t.play('a', '4567', 1_000);
    t.play('b', '1890', 2_000);
    t.play('a', '0000', 3_000);
    t.state = { ...t.state, fallen: [9] };
    // 1, 2, 3 are the secret's; 9 fell; 4–7 and 0 answered 0/0; 8 sits only in a 1/0 guess.
    expect(candidatesOf(t.state, t.secrets, Infinity)).toEqual([8]);
    // 0/0 answers Frost still holds do not count yet.
    expect(candidatesOf(t.state, t.secrets, 1_000)).toEqual([0, 4, 5, 6, 7, 8]);
  });

  it('drops every guessed digit under own and numbers and in individual mode', () => {
    for (const visibility of ['own', 'numbers'] as const) {
      const t = new Table(
        shared('1123'),
        input('shared', ['a'], { feedbackVisibility: visibility }),
      );
      t.play('a', '1890');
      expect(candidatesOf(t.state, t.secrets, Infinity)).toEqual([4, 5, 6, 7]);
    }
    const t = new Table(individual({ a: '1123', b: '4444' }), input('individual', ['a', 'b']));
    t.play('a', '5550');
    expect(candidatesOf(t.state, t.secrets, Infinity)).toEqual([6, 7, 8, 9]);
  });

  it('drops digitsPerFall, all that are left when fewer, then ends', () => {
    const t = new Table(
      shared('0123'),
      input('shared', ['a'], { codeDigits: 7, digitsPerFall: 2 }),
    );
    const first = t.fall(1);
    expect(first).toHaveLength(1);
    expect(first[0]?.audience).toBe('room');
    expect(t.state.fallen).toHaveLength(2);
    t.fall(2);
    expect(t.state.fallen).toEqual([4, 5, 6]);
    expect(t.fall(3)).toEqual([]);
    expect(t.play('a', '0456').ok).toBe(false);
  });
});

const round = fc.record({
  seed: fc.integer({ min: 0, max: 255 }),
  mode: fc.constantFrom('shared', 'individual'),
  visibility: fc.constantFrom('own', 'numbers', 'full'),
  perFall: fc.integer({ min: 1, max: 3 }),
  secrets: fc.array(fc.stringMatching(/^[0-9]{4}$/), { minLength: 2, maxLength: 2 }),
  guesses: fc.array(fc.tuple(fc.boolean(), fc.stringMatching(/^[0-9]{4}$/)), { maxLength: 12 }),
  cut: fc.integer({ min: 0, max: 12_000 }),
});

type Round = typeof round extends fc.Arbitrary<infer R> ? R : never;

function playRound(r: Round) {
  const [sa = '0000', sb = '1111'] = r.secrets;
  const secrets = r.mode === 'shared' ? shared(sa) : individual({ a: sa, b: sb });
  const cfg = { feedbackVisibility: r.visibility, digitsPerFall: r.perFall };
  const t = new Table(secrets, input(r.mode, ['a', 'b'], cfg), r.seed);
  for (const [who, value] of r.guesses) t.play(who ? 'a' : 'b', value);
  const before = candidatesOf(t.state, secrets, r.cut);
  const fell = t
    .fall(1, r.cut)
    .flatMap((e) => (e.event.type === 'DigitsFallen' ? e.event.digits : []));
  return { t, before, fell, secrets: [sa, ...(r.mode === 'shared' ? [] : [sb])] };
}

describe('Leaf Fall properties', () => {
  it('never drops a secret digit and only drops candidates', () => {
    fc.assert(
      fc.property(round, (r) => {
        const { t, before, fell, secrets } = playRound(r);
        expect(fell.length).toBe(Math.min(r.perFall, before.length));
        for (const d of fell) {
          expect(before).toContain(d);
          expect(secrets.join('')).not.toContain(String(d));
          const guessed = Object.values(t.state.players).flatMap((p) => p.guesses);
          if (r.mode === 'shared' && r.visibility === 'full') {
            // Only a delivered 0/0 answer may rule a guessed digit out.
            const proven = guessed.filter(
              (g) => g.receivedAt < r.cut && g.feedback.exact + g.feedback.near === 0,
            );
            expect(proven.some((g) => g.value.includes(String(d)))).toBe(false);
          } else {
            expect(guessed.some((g) => g.value.includes(String(d)))).toBe(false);
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  it('gives the same falls for the same seed and guesses', () => {
    fc.assert(
      fc.property(round, (r) => {
        expect(playRound(r).fell).toEqual(playRound(r).fell);
      }),
      { numRuns: 100 },
    );
  });
});
