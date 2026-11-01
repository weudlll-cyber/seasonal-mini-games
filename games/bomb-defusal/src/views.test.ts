/**
 * @file   games/bomb-defusal/src/views.test.ts
 * @module games/bomb-defusal
 * @brief  Views per visibility, mode and Frost; the sentinel test; the result and closest miss.
 *
 * Responsibility: the player sees the bomb, their own sequences with answers and comments, and
 *                 the others' at the round's visibility (`own`: that someone cut; `numbers`:
 *                 the sequence; `full`: also the answer, explosion included, and the comment);
 *                 individual mode shows only that someone cut; Frost holds an answer, explosion
 *                 included, out of every view until delivered; the individual hint reaches only
 *                 its player, never a spectator; no player view, spectator view, room event or
 *                 rejection of a running round holds a secret sequence (sentinels, both modes);
 *                 the result reveals it with the closest miss (longest start, earlier on a tie,
 *                 none at 0, none without another wrong sequence); `reveal` words it; every
 *                 view validates against its schema.
 * Depends on:     vitest, fast-check, @smg/guess-engine, ./conformance, ./fakes, ./module,
 *                 ./views, ./wires
 * Spec:           docs/spec/02c-game-bomb-defusal.md §5.2, §6, §9, §10; docs/spec/05-security-threat-model.md §3.1
 */
import type { Secrets } from '@smg/guess-engine';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { bombDefusalConformance as kit } from './conformance.js';
import { input, Table } from './fakes.js';
import { bombDefusal } from './module.js';
import { closestMiss, reveal } from './views.js';
import type { Sequence } from './wires.js';

const all = { releasedBefore: Infinity };
const { views, viewSchemas } = bombDefusal;
const SECRET: Sequence = ['red', 'blue', 'yellow', 'white'];
const BOOM: Sequence = ['blue', 'red', 'yellow', 'white'];

function played(visibility: 'own' | 'numbers' | 'full', mode: 'shared' | 'individual' = 'shared') {
  const secrets: Secrets<Sequence> =
    mode === 'shared' ? { mode, value: SECRET } : { mode, byPlayer: { a: SECRET, b: BOOM } };
  const t = new Table(secrets, input(mode, ['a', 'b'], { feedbackVisibility: visibility }));
  t.play('a', ['red', 'blue', 'green', 'white'], 1_000);
  t.play('b', BOOM, 2_000);
  return t;
}

describe('player and spectator views (02c §6, §10)', () => {
  it('under `full` show the others’ sequences with the explosion and its comment', () => {
    const t = played('full');
    const v = views.player(t.state, 'a', all);
    expect(v).toMatchObject({
      wires: ['red', 'blue', 'yellow', 'green', 'white', 'black'],
      cuts: 4,
      penaltyS: 5,
      harmless: [],
      hint: null,
      guesses: [
        { value: ['red', 'blue', 'green', 'white'], feedback: { correct: 2 }, tier: 'burning' },
      ],
      log: [{ playerId: 'b', value: BOOM, feedback: { correct: 0 }, tier: 'wayOff' }],
    });
    expect(viewSchemas.player.safeParse(v).success).toBe(true);
    const s = views.spectator(t.state, all);
    expect(viewSchemas.spectator.safeParse(s).success).toBe(true);
    expect(JSON.stringify(s)).toContain('"correct":0');
  });

  it('under `numbers` show the sequences, under `own` only that someone cut', () => {
    const numbers = views.spectator(played('numbers').state, all);
    expect(numbers).toMatchObject({
      log: [
        { value: ['red', 'blue', 'green', 'white'], feedback: null, comment: null },
        { value: BOOM, feedback: null },
      ],
    });
    const own = views.player(played('own').state, 'a', all);
    expect(own).toMatchObject({
      log: [{ playerId: 'b', value: null, feedback: null, tier: null, comment: null }],
    });
  });

  it('in individual mode show only that someone cut, and each hint only to its player', () => {
    const t = played('full', 'individual');
    t.fold([{ event: { type: 'HintGiven', playerId: 'a', wire: 'red' } }]);
    expect(views.player(t.state, 'b', all)).toMatchObject({
      hint: null,
      log: [{ value: null, feedback: null }],
    });
    expect(views.player(t.state, 'a', all)).toMatchObject({ hint: 'red' });
    expect(views.spectator(t.state, all)).toMatchObject({ hint: null });
  });

  it('under Frost hold the answer and the explosion until delivered', () => {
    const t = played('full');
    const held = { releasedBefore: 2_000 };
    expect(views.player(t.state, 'b', held)).toMatchObject({
      guesses: [{ value: BOOM, feedback: null, tier: null, comment: null }],
      log: [{ playerId: 'a', feedback: { correct: 2 } }],
    });
    expect(JSON.stringify(views.spectator(t.state, held))).not.toContain('"correct":0');
  });
});

describe('sentinels: no secret in a running round (05 §3.1, P2)', () => {
  const stream = fc.array(fc.tuple(fc.integer({ min: 0, max: 2 }), fc.integer()), {
    maxLength: 30,
  });
  for (const mode of ['shared', 'individual'] as const) {
    it(`holds in ${mode} mode for views, room events and rejections`, () => {
      fc.assert(
        fc.property(
          stream,
          fc.constantFrom('own' as const, 'numbers' as const, 'full' as const),
          (actions, visibility) => {
            const base = kit.input(mode, ['p1', 'p2', 'p3']);
            const inp = { ...base, config: { ...base.config, feedbackVisibility: visibility } };
            const { secrets, marks } = kit.sentinels(inp);
            const t = new Table(secrets, inp);
            const seen: unknown[] = [];
            actions.forEach(([p, n], k) => {
              const d = t.play(`p${String(p + 1)}`, kit.action(n).value, k * 1_000);
              seen.push(d.ok ? d.events.filter((e) => e.audience === 'room') : d);
              seen.push(
                views.spectator(t.state, all),
                ['p1', 'p2', 'p3'].map((id) => views.player(t.state, id, all)),
              );
            });
            const text = JSON.stringify(seen);
            for (const m of marks) expect(text).not.toContain(m);
            const result = JSON.stringify(views.result(t.state, secrets));
            for (const m of marks) expect(result).toContain(m);
          },
        ),
        { numRuns: 100 },
      );
    });
  }
});

describe('the result (02c §9)', () => {
  it('reveals the shared sequence with the closest miss, and words it for the chat', () => {
    const t = new Table({ mode: 'shared', value: SECRET }, input('shared', ['a', 'b', 'c']));
    t.play('b', ['red', 'blue', 'yellow', 'black'], 1_000);
    t.play('c', ['red', 'blue', 'yellow', 'green'], 2_000);
    t.play('a', SECRET, 3_000);
    const r = views.result(t.state, t.secrets);
    expect(viewSchemas.result.safeParse(r).success).toBe(true);
    expect(r).toMatchObject({
      secret: SECRET,
      secrets: null,
      closestMiss: { playerId: 'b', correct: 3 },
    });
    expect(reveal(r, 'a')).toBe('the sequence was red → blue → yellow → white');
  });

  it('has no closest miss at 0, without a winner, or without another wrong sequence', () => {
    const t = new Table({ mode: 'shared', value: SECRET }, input('shared', ['a', 'b']));
    t.play('b', BOOM);
    expect(closestMiss(t.state)).toBeNull();
    t.play('a', SECRET);
    expect(closestMiss(t.state)).toBeNull();
    const alone = new Table({ mode: 'shared', value: SECRET }, input('shared', ['a', 'b']));
    alone.play('a', BOOM);
    alone.play('a', SECRET);
    expect(closestMiss(alone.state)).toBeNull();
  });

  it('reveals every own sequence in individual mode', () => {
    const t = played('full', 'individual');
    const r = views.result(t.state, t.secrets);
    expect(r).toMatchObject({ secret: null, secrets: { a: SECRET, b: BOOM }, closestMiss: null });
    expect(reveal(r, 'b')).toBe('their sequence was blue → red → yellow → white');
    expect(reveal(r, null)).toBeNull();
  });
});
