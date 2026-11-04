/**
 * @file   games/safecracker/src/views.test.ts
 * @module games/safecracker
 * @brief  The views per visibility and Frost, the sentinel test, the closest miss and the reveal.
 *
 * Responsibility: others' codes only under `numbers` and `full`, answers and comments only
 *                 under `full` in shared mode, Frost-held answers in no view; the board (length,
 *                 digits, fallen digits, shared hint) for players and spectators, an individual
 *                 hint only for its player; the sentinel test that no secret reaches a player
 *                 or spectator view or an event of a running round in either mode, while the
 *                 result shows it; the closest miss (exact, then near, then earlier; the winner
 *                 excluded; none) only in the result; the chat's reveal clause; every view
 *                 valid against its schema.
 * Depends on:     vitest, fast-check, ./fakes, ./module, ./views
 * Spec:           docs/spec/02b-game-safecracker.md §5.2, §8, §9; docs/spec/09-testing-strategy.md §4.1
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { individual, input, shared, Table } from './fakes.js';
import { safecracker } from './module.js';
import { closestMiss, reveal, type PlayerView, type SpectatorView } from './views.js';

const all = { releasedBefore: Infinity };
const { views, viewSchemas } = safecracker;
const player = (t: Table, id: string, ctx = all) => views.player(t.state, id, ctx) as PlayerView;
const spectator = (t: Table, ctx = all) => views.spectator(t.state, ctx) as SpectatorView;

describe('the views per visibility and Frost', () => {
  const table = (visibility: 'own' | 'numbers' | 'full') => {
    const t = new Table(
      shared('1123'),
      input('shared', ['a', 'b'], { feedbackVisibility: visibility }),
    );
    t.play('a', '1312', 1_000);
    t.play('b', '4567', 2_000);
    return t;
  };

  it('shows others the code from numbers on and the answer only under full', () => {
    expect(player(table('own'), 'b').log[0]).toMatchObject({ value: null, feedback: null });
    expect(player(table('numbers'), 'b').log[0]).toMatchObject({ value: '1312', feedback: null });
    const full = player(table('full'), 'b').log[0];
    expect(full).toMatchObject({ value: '1312', feedback: { exact: 1, near: 3 }, tier: 'hot' });
    expect(full?.comment).toEqual(expect.any(String));
    expect(spectator(table('full')).log).toHaveLength(2);
  });

  it('holds every answer Frost has not delivered', () => {
    const t = table('full');
    const held = { releasedBefore: 1_500 };
    expect(player(t, 'a', held).guesses[0]?.feedback).not.toBeNull();
    expect(player(t, 'b', held).guesses[0]).toMatchObject({ feedback: null, comment: null });
    expect(spectator(t, held).log[1]).toMatchObject({ value: '4567', feedback: null, tier: null });
  });

  it('shows others in individual mode only that a code was tried', () => {
    const t = new Table(individual({ a: '1123', b: '9999' }), input('individual', ['a', 'b']));
    t.play('a', '1312');
    expect(player(t, 'b').log[0]).toMatchObject({ playerId: 'a', value: null, feedback: null });
    expect(player(t, 'a').guesses[0]?.feedback).toMatchObject({ exact: 1, near: 3 });
  });
});

describe('the board', () => {
  it('carries length, digits, the fallen digits and the shared hint to everyone', () => {
    const t = new Table(shared('1123'), input('shared', ['a'], { codeLength: 4, codeDigits: 8 }));
    t.spring();
    t.fall(1);
    const p = player(t, 'a');
    expect(p).toMatchObject({ length: 4, digits: 8, fallen: t.state.fallen, hint: t.state.hint });
    expect(p.fallen).toHaveLength(1);
    expect(spectator(t).hint).toEqual(t.state.hint);
    expect(viewSchemas.player.safeParse(p).success).toBe(true);
    expect(viewSchemas.spectator.safeParse(spectator(t)).success).toBe(true);
  });

  it('gives an individual hint to its player only', () => {
    const t = new Table(individual({ a: '1123', b: '4567' }), input('individual', ['a', 'b']));
    t.spring();
    expect(player(t, 'a').hint).toEqual(t.state.players.a?.hint);
    expect(player(t, 'b').hint).toEqual(t.state.players.b?.hint);
    expect(spectator(t).hint).toBeNull();
    expect(player(t, 'ghost').hint).toBeNull();
  });
});

// Sentinel codes of digits 5–9 and guesses of digits 0–4, so only a leak shows a mark.
const SHARED = '989898';
const OWN = { a: '987555', b: '987556', c: '987557' };
const guess = fc.tuple(fc.constantFrom('a', 'b', 'c'), fc.stringMatching(/^[0-4]{6}$/));

describe('the sentinel test', () => {
  it('keeps every secret out of the views and events of a running round', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('shared', 'individual'),
        fc.array(guess, { maxLength: 20 }),
        (mode, gs) => {
          const secrets = mode === 'shared' ? shared(SHARED) : individual(OWN);
          const marks = mode === 'shared' ? [SHARED] : Object.values(OWN);
          const t = new Table(secrets, input(mode, ['a', 'b', 'c'], { codeLength: 6 }));
          const seen: unknown[] = [t.spring().filter((e) => e.audience === 'room')];
          for (const [who, value] of gs) seen.push(t.play(who, value));
          seen.push(
            t.fall(1),
            spectator(t),
            ['a', 'b', 'c'].map((id) => player(t, id)),
          );
          const text = JSON.stringify(seen);
          for (const m of marks) expect(text).not.toContain(m);
          const result = JSON.stringify(views.result(t.state, secrets));
          for (const m of marks) expect(result).toContain(m);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('the closest miss and the result', () => {
  it('picks most exact, then most near, then the earlier, never the winner', () => {
    const t = new Table(shared('1123'), input('shared', ['a', 'b', 'c']));
    t.play('a', '1132'); // 2 exact, 2 near
    t.play('b', '1124'); // 3 exact
    t.play('c', '1129'); // 3 exact, later
    t.play('b', '1123'); // b wins
    t.play('a', '1120'); // 3 exact, after the winner's
    expect(closestMiss(t.state, '1123')).toEqual({
      playerId: 'c',
      value: '1129',
      exact: 3,
      near: 0,
    });
    const r = new Table(shared('1123'), input('shared', ['a', 'b', 'c']));
    r.play('a', '2311'); // 0 exact, 4 near
    r.play('b', '1000'); // 1 exact
    r.play('c', '1123');
    expect(closestMiss(r.state, '1123')).toMatchObject({ playerId: 'b', exact: 1, near: 0 });
  });

  it('is the closest code without a winner (T145), none without another player’s wrong code', () => {
    const t = new Table(shared('1123'), input('shared', ['a', 'b']));
    t.play('a', '4567');
    expect(closestMiss(t.state, '1123')).toMatchObject({ playerId: 'a', value: '4567' });
    t.play('a', '1123');
    expect(closestMiss(t.state, '1123')).toBeNull();
  });

  it('reveals the code in the result and the chat line', () => {
    const t = new Table(shared('0427'), input('shared', ['a', 'b']));
    t.play('b', '0429');
    t.play('a', '0427');
    const result = views.result(t.state, t.secrets);
    expect(viewSchemas.result.safeParse(result).success).toBe(true);
    expect(result).toMatchObject({ secret: '0427', secrets: null, closestMiss: { playerId: 'b' } });
    expect(reveal(result, 'a')).toBe('the code was 0427');
    const own = new Table(individual({ a: '1111', b: '2222' }), input('individual', ['a', 'b']));
    const r2 = views.result(own.state, own.secrets);
    expect(r2).toMatchObject({ secret: null, secrets: { a: '1111' }, closestMiss: null });
    expect(reveal(r2, 'b')).toBe('their code was 2222');
    expect(reveal(r2, null)).toBeNull();
  });
});
