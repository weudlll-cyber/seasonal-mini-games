/**
 * @file   games/safecracker/src/rules.test.ts
 * @module games/safecracker
 * @brief  Acceptance checks in order, the decision of a code, settings and the secret's draw.
 *
 * Responsibility: `CODE_INVALID` for a wrong length, a non-digit, a digit ≥ `code.digits` and
 *                 an empty string, then `DIGIT_REMOVED`, then `ALREADY_GUESSED` (02b §4), with
 *                 leading zeros kept and the action schema refusing anything not 3–6 digits,
 *                 the whole code checked after a hint (O59);
 *                 the answer to the guesser, the room's line per visibility and `Solved`; the
 *                 setting definitions of 08 §3.1, reading, no cross-key problem, no halving;
 *                 secrets per mode and label, in the code space, the same for the same seed,
 *                 uniform per position (chi-square smoke test, as G7).
 * Depends on:     vitest, @smg/game-sdk (crypto, resolveSettings), ./fakes, ./module, ./settings
 * Spec:           docs/spec/02b-game-safecracker.md §3, §4, §5; docs/spec/08-admin-settings.md §3.1
 */
import { resolveSettings } from '@smg/game-sdk';
import { roundRng, SEED_BYTES } from '@smg/game-sdk/crypto';
import { describe, expect, it } from 'vitest';

import { input, shared, Table } from './fakes.js';
import { safecracker } from './module.js';
import { scSettings } from './settings.js';

const code = (t: Table, value: string, who = 'a') => safecracker.validate(t.state, who, { value });

describe('the acceptance checks', () => {
  it('refuses a malformed code with CODE_INVALID', () => {
    const t = new Table(shared('1123'), input('shared', ['a'], { codeDigits: 6 }));
    for (const bad of ['', '112', '11234', '12a4', '12 4', '1-23', '1196', '6000']) {
      expect(code(t, bad), bad).toBe('CODE_INVALID');
    }
    expect(code(t, '0000')).toBeNull();
    expect(code(t, '5555')).toBeNull();
  });

  it('checks the form first, then fallen digits, then repeats, and keeps leading zeros', () => {
    const t = new Table(shared('1123'), input('shared', ['a']));
    expect(t.play('a', '0427').ok).toBe(true);
    expect(t.state.players.a?.guesses[0]?.value).toBe('0427');
    expect(code(t, '0427')).toBe('ALREADY_GUESSED');
    t.state = { ...t.state, fallen: [7] };
    expect(code(t, '0427')).toBe('DIGIT_REMOVED');
    expect(code(t, '04277')).toBe('CODE_INVALID');
    expect(code(t, '0428')).toBeNull();
    expect(code(t, '0427', 'ghost')).toBe('NOT_IN_ROUND');
  });

  it('checks the whole code after Spring Herald, hint digit included (O59)', () => {
    const t = new Table(shared('1123'), input('shared', ['a']));
    t.state = { ...t.state, hint: { position: 1, digit: 1 } };
    // The client locks the hint's box, but the server trusts nothing it sends.
    expect(code(t, '112')).toBe('CODE_INVALID');
    expect(t.play('a', '0927').ok).toBe(true);
    expect(t.state.players.a?.guesses[0]?.value).toBe('0927');
  });

  it('allows a repeat when the round does not refuse them', () => {
    const t = new Table(shared('1123'), input('shared', ['a'], { repeatGuessRejected: false }));
    expect(t.play('a', '0427').ok).toBe(true);
    expect(t.play('a', '0427').ok).toBe(true);
  });

  it('takes only 3–6 digits as an action', () => {
    const ok = (value: unknown) => safecracker.actionSchema.safeParse({ value }).success;
    expect(ok('012')).toBe(true);
    expect(ok('012345')).toBe(true);
    for (const bad of ['01', '0123456', 427, '04x7', '']) expect(ok(bad)).toBe(false);
    expect(safecracker.actionSchema.safeParse({ value: '0427', extra: 1 }).success).toBe(false);
  });
});

describe('the decision', () => {
  it('answers the guesser and tells the room per visibility', () => {
    const lines = (visibility: 'own' | 'numbers' | 'full') => {
      const t = new Table(
        shared('1123'),
        input('shared', ['a'], { feedbackVisibility: visibility }),
      );
      const d = t.play('a', '1312');
      if (!d.ok) throw new Error('refused');
      return d.events.map((e) => [e.audience, e.event]);
    };
    const [own, room] = lines('full');
    expect(own?.[0]).toBe('player:a');
    expect(own?.[1]).toMatchObject({ value: '1312', feedback: { exact: 1, near: 3 } });
    expect(room?.[1]).toMatchObject({ value: '1312', feedback: { exact: 1, near: 3 } });
    expect(lines('numbers')[1]?.[1]).toEqual({
      type: 'GuessFed',
      playerId: 'a',
      guesses: 1,
      value: '1312',
    });
    expect(lines('own')[1]?.[1]).toEqual({ type: 'GuessFed', playerId: 'a', guesses: 1 });
  });

  it('signals Solved only for the code itself, with a hot comment before it', () => {
    const t = new Table(shared('1123'), input('shared', ['a']));
    const near = t.play('a', '1312');
    expect(near.ok && near.signals).toEqual([]);
    expect(t.state.players.a?.guesses[0]?.comment?.tier).toBe('hot');
    const hit = t.play('a', '1123');
    expect(hit.ok && hit.signals).toEqual([{ type: 'Solved', playerId: 'a' }]);
    expect(hit.ok && hit.extraCooldownMs).toBeUndefined();
  });
});

describe('the settings', () => {
  it('defines the keys of 08 §3.1 with their bounds and reads their defaults', () => {
    const byKey = Object.fromEntries(scSettings.defs.map((d) => [d.key, d]));
    expect(byKey['code.length']).toMatchObject({ default: 4, min: 3, max: 6, hostChooses: true });
    expect(byKey['code.digits']).toMatchObject({ default: 10, min: 4, max: 10, hostChooses: true });
    expect(byKey['autumn.digitsPerFall']).toMatchObject({
      default: 1,
      min: 1,
      max: 3,
      hostChooses: false,
    });
    for (const key of [
      'round.feedbackVisibility',
      'round.comments',
      'comments.trendPercent',
      'round.repeatGuessRejected',
    ]) {
      expect(byKey[key], key).toBeDefined();
    }
    const cfg = scSettings.read(resolveSettings(scSettings.defs, {}));
    expect(cfg).toEqual({
      codeLength: 4,
      codeDigits: 10,
      digitsPerFall: 1,
      feedbackVisibility: 'full',
      comments: true,
      trendPercent: 33,
      repeatGuessRejected: true,
    });
    expect(scSettings.problem(cfg)).toBeNull();
    expect(scSettings.halvingAllowed?.(cfg)).toBe(false);
    expect(safecracker.specials?.halving).toBeUndefined();
  });
});

describe('the secrets', () => {
  const rng = (b: number) => roundRng(new Uint8Array(SEED_BYTES).fill(b));

  it('are drawn per mode and label, in the code space, the same for the same seed', () => {
    const one = input('shared', ['a', 'b'], { codeLength: 6, codeDigits: 4 });
    const s = safecracker.deriveSecrets(one, rng(1));
    expect(s.mode === 'shared' && s.value).toMatch(/^[0-3]{6}$/);
    expect(safecracker.deriveSecrets(one, rng(1))).toEqual(s);
    const each = safecracker.deriveSecrets(input('individual', ['a', 'b']), rng(1));
    if (each.mode !== 'individual') throw new Error('mode');
    expect(Object.keys(each.byPlayer)).toEqual(['a', 'b']);
    expect(each.byPlayer.a).toMatch(/^[0-9]{4}$/);
    expect(each.byPlayer.a).not.toBe(each.byPlayer.b);
  });

  it('are uniform per position (chi-square smoke test)', () => {
    const cfg = input(
      'individual',
      Array.from({ length: 2_000 }, (_, k) => `p${String(k)}`),
    );
    const s = safecracker.deriveSecrets(cfg, rng(5));
    if (s.mode !== 'individual') throw new Error('mode');
    const codes = Object.values(s.byPlayer);
    for (let pos = 0; pos < 4; pos += 1) {
      const seen = Array.from({ length: 10 }, () => 0);
      for (const c of codes) seen[Number(c[pos])] = (seen[Number(c[pos])] ?? 0) + 1;
      const chi = seen.reduce((sum, o) => sum + (o - 200) ** 2 / 200, 0);
      // 9 degrees of freedom: 27.9 is the 0.1 % critical value.
      expect(chi).toBeLessThan(27.9);
    }
  });
});
