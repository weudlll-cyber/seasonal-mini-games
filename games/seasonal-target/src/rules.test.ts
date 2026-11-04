/**
 * @file   games/seasonal-target/src/rules.test.ts
 * @module games/seasonal-target
 * @brief  Acceptance checks in the order of 02d §4, answers and comments, the settings, reveal.
 *
 * Responsibility: the action schema refuses anything but two whole coordinates; `OUT_OF_MAP`
 *                 (map and halving window) before `CELL_REMOVED` before `ALREADY_GUESSED`, a
 *                 repeat allowed with the rule off; the answer to the guesser and the room line
 *                 per visibility and mode; `Solved` on the cell; distance answers carry no
 *                 direction, closeness answers (the default, O53) only the tier, and every wrong
 *                 answer its tier (O45); the settings document with the grid size (default 20,
 *                 8–30, width = height), its three answer modes, a stored host choice kept over
 *                 the new default, its config and halving allowed; secrets drawn the same from
 *                 the same seed; the chat's reveal clause.
 * Depends on:     vitest, @smg/game-sdk, ./fakes, ./module, ./settings, ./views
 * Spec:           docs/spec/02d-game-seasonal-target.md §3, §4, §5; docs/spec/08-admin-settings.md §3.3
 */
import { resolveSettings } from '@smg/game-sdk';
import { roundRng } from '@smg/game-sdk/crypto';
import { describe, expect, it } from 'vitest';

import { defaultConfig, input, Table, targets } from './fakes.js';
import { seasonalTarget } from './module.js';
import { stRules } from './rules.js';
import { stSettings } from './settings.js';
import { reveal } from './views.js';

const shared = (config = {}) => {
  const inp = input('shared', ['a', 'b'], config);
  return new Table(targets(inp, [{ x: 12, y: 10 }]), inp);
};

describe('validation', () => {
  it('takes only two whole coordinates up to 30', () => {
    const schema = seasonalTarget.actionSchema;
    expect(schema.safeParse({ value: { x: 1, y: 30 } }).success).toBe(true);
    for (const value of [
      { x: 1.5, y: 2 },
      { x: 0, y: 2 },
      { x: 31, y: 2 },
      { x: '3', y: 2 },
      { x: 3 },
      { x: 3, y: 3, z: 1 },
      12,
    ]) {
      expect(schema.safeParse({ value }).success).toBe(false);
    }
  });

  it('refuses in the order of 02d §4: map, fallen, repeat', () => {
    const t = shared({ width: 15, height: 18 });
    expect(t.play('a', { x: 16, y: 1 })).toEqual({ ok: false, code: 'OUT_OF_MAP' });
    expect(t.play('a', { x: 1, y: 19 })).toEqual({ ok: false, code: 'OUT_OF_MAP' });
    expect(t.play('a', { x: 5, y: 5 }).ok).toBe(true);
    t.fold([{ audience: 'room', event: { type: 'CellsFell', index: 1, cells: [{ x: 5, y: 5 }] } }]);
    // Fallen and already tried: the fall is check 5, before the repeat (6).
    expect(t.play('a', { x: 5, y: 5 })).toEqual({ ok: false, code: 'CELL_REMOVED' });
    expect(t.play('a', { x: 6, y: 5 }).ok).toBe(true);
    expect(t.play('a', { x: 6, y: 5 })).toEqual({ ok: false, code: 'ALREADY_GUESSED' });
    // Another player may try the same cell.
    expect(t.play('b', { x: 6, y: 5 }).ok).toBe(true);
  });

  it('refuses a cell outside the halving window before a fallen one', () => {
    const t = shared();
    const area = { left: 6, right: 15, top: 1, bottom: 20 };
    t.fold([
      { audience: 'room', event: { type: 'CellsFell', index: 1, cells: [{ x: 2, y: 2 }] } },
      {
        audience: 'room',
        event: { type: 'AreaHalved', index: 1, playerId: null, area, width: 10, height: 20 },
      },
    ]);
    expect(t.play('a', { x: 2, y: 2 })).toEqual({ ok: false, code: 'OUT_OF_MAP' });
    expect(t.play('a', { x: 5, y: 9 })).toEqual({ ok: false, code: 'OUT_OF_MAP' });
    expect(t.play('a', { x: 6, y: 9 }).ok).toBe(true);
  });

  it('allows a repeat when the rule is off, and refuses a stranger', () => {
    const t = shared({ repeatGuessRejected: false });
    expect(t.play('a', { x: 6, y: 5 }).ok).toBe(true);
    expect(t.play('a', { x: 6, y: 5 }).ok).toBe(true);
    expect(t.play('zz', { x: 6, y: 5 })).toEqual({ ok: false, code: 'NOT_IN_ROUND' });
    expect(seasonalTarget.validate(t.state, 'zz', { value: { x: 1, y: 1 } })).toBe('NOT_IN_ROUND');
    // The game's own check, should it ever see a stranger: no area, so no cell.
    expect(stRules.check(t.state, 'zz', { x: 1, y: 1 })).toBe('OUT_OF_MAP');
  });
});

describe('answers', () => {
  it('answers the guesser with distance and direction, and the room under full', () => {
    const t = shared({ feedback: 'direction' });
    const d = t.play('a', { x: 4, y: 14 });
    if (!d.ok) throw new Error('refused');
    const [own, room] = d.events;
    expect(own?.audience).toBe('player:a');
    expect(own?.feedback).toBe(true);
    expect(own?.event).toMatchObject({
      type: 'FeedbackGiven',
      feedback: { kind: 'direction', distance: 9, direction: 'NE', tier: 'cold' },
    });
    expect(room?.event).toMatchObject({ type: 'GuessFed', value: { x: 4, y: 14 } });
    expect(d.signals).toEqual([]);
    const win = t.play('b', { x: 12, y: 10 });
    expect(win.ok && win.signals).toEqual([{ type: 'Solved', playerId: 'b' }]);
  });

  it('answers only the rounded distance and its tier in distance mode, with no direction', () => {
    const d = shared({ feedback: 'distance' }).play('a', { x: 4, y: 14 });
    expect(d.ok && d.events[0]?.event).toMatchObject({
      feedback: { kind: 'distance', distance: 9, tier: 'cold' },
    });
    expect(d.ok && d.events[0]?.event).not.toHaveProperty('feedback.direction');
  });

  it('answers only the tier in closeness mode (the default, O53), also without comments', () => {
    const t = shared({ comments: false });
    const d = t.play('a', { x: 4, y: 14 });
    expect(d.ok && d.events[0]?.event).toMatchObject({
      feedback: { kind: 'closeness', tier: 'cold' },
      comment: null,
    });
  });

  it('tells the room only that someone guessed under own and in individual mode', () => {
    const own = shared({ feedbackVisibility: 'own' }).play('a', { x: 1, y: 1 });
    expect(own.ok && own.events[1]?.event).toEqual({ type: 'GuessFed', playerId: 'a', guesses: 1 });
    const inp = input('individual', ['a', 'b'], { feedback: 'direction' });
    const t = new Table(
      targets(inp, [
        { x: 3, y: 3 },
        { x: 18, y: 18 },
      ]),
      inp,
    );
    const ind = t.play('b', { x: 1, y: 1 });
    expect(ind.ok && ind.events[1]?.event).toEqual({ type: 'GuessFed', playerId: 'b', guesses: 1 });
    // Each player is answered about their own target.
    expect(ind.ok && ind.events[0]?.event).toMatchObject({
      feedback: { kind: 'direction', direction: 'SE', distance: 24, tier: 'wayOff' },
    });
  });
});

describe('settings', () => {
  it('reads the defaults of 08 §3.3 into the config, with no cross-key problem', () => {
    const cfg = stSettings.read(resolveSettings(stSettings.defs, {}));
    expect(cfg).toEqual(defaultConfig);
    // O43: the host picks one of three answer modes; warm/cold only is the default (O53).
    expect(cfg.feedback).toBe('closeness');
    const answers = stSettings.defs.find((d) => d.key === 'target.feedback');
    expect(answers).toMatchObject({ options: ['direction', 'distance', 'closeness'] });
    expect(stSettings.problem(cfg)).toBeNull();
    expect(stSettings.halvingAllowed?.(cfg)).toBe(true);
    const keys = stSettings.defs.map((d) => d.key);
    expect(keys).toContain('target.feedback');
    expect(keys).not.toContain('map.width');
    expect(keys).not.toContain('round.rangeLow');
  });
});

describe('answer mode default (O53)', () => {
  it('keeps a stored explicit host value and gives a missing one the new default', () => {
    const read = (overrides = {}) => stSettings.read(resolveSettings(stSettings.defs, overrides));
    expect(read({ 'target.feedback': { value: 'distance' } }).feedback).toBe('distance');
    expect(read().feedback).toBe('closeness');
  });
});

describe('grid size and stops', () => {
  it('has one square grid size: default 20, the host choosing 8–30, width = height', () => {
    const size = stSettings.defs.find((d) => d.key === 'target.size');
    expect(size).toMatchObject({
      kind: 'int',
      label: 'Grid size',
      unit: 'tiles',
      default: 20,
      min: 8,
      max: 30,
      status: 'owner',
      decision: 'O45',
      hostChooses: true,
      running: 'frozen',
    });
    const read = (value: number) =>
      stSettings.read(resolveSettings(stSettings.defs, { 'target.size': { value } }));
    expect(read(8)).toMatchObject({ width: 8, height: 8 });
    expect(read(30)).toMatchObject({ width: 30, height: 30 });
    // Out of bounds: the default.
    expect(read(31)).toMatchObject({ width: 20, height: 20 });
    expect(read(7)).toMatchObject({ width: 20, height: 20 });
  });

  it('keeps the stops of Leaf Fall and halving below the smallest grid of 64 tiles', () => {
    const max = (key: string) =>
      (stSettings.defs.find((d) => d.key === key) as { max: number }).max;
    expect(max('autumn.minCellsLeft')).toBeLessThan(64);
    expect(max('halving.minCells')).toBeLessThan(64);
  });
});

describe('secrets and reveal', () => {
  it('draws the same targets on the map from the same seed', () => {
    const inp = input('individual', ['a', 'b', 'c'], { width: 20, height: 30 });
    const one = seasonalTarget.deriveSecrets(inp, roundRng(new Uint8Array(32).fill(4)));
    const two = seasonalTarget.deriveSecrets(inp, roundRng(new Uint8Array(32).fill(4)));
    expect(one).toEqual(two);
    if (one.mode !== 'individual') throw new Error('mode');
    for (const t of Object.values(one.byPlayer)) {
      expect(t.x >= 1 && t.x <= 20 && t.y >= 1 && t.y <= 30).toBe(true);
    }
  });

  it('words the target for the chat', () => {
    expect(reveal({ target: { x: 12, y: 10 }, targets: null }, 'a')).toBe(
      'the target was (12, 10)',
    );
    const ind = { target: null, targets: { a: { x: 1, y: 2 } } };
    expect(reveal(ind, 'a')).toBe('their target was (1, 2)');
    expect(reveal(ind, null)).toBeNull();
    expect(reveal(ind, 'b')).toBeNull();
  });
});
