/**
 * @file   games/bomb-defusal/src/closest.test.ts
 * @module games/bomb-defusal
 * @brief  "Closest to winning" (O110): each player's best sequence, the most cuts right first.
 *
 * Responsibility: the module's `closest` names one best sequence per player who cut: the
 *                 longest correct start; a defused bomb is 0, an explosion the farthest; equal
 *                 ones keep the earlier sequence; individual mode by the player's own bomb; a
 *                 player without a sequence is left out.
 * Depends on:     vitest, ./fakes, ./module, ./wires
 * Spec:           docs/spec/02c-game-bomb-defusal.md §9; docs/spec/04-software-architecture.md §4
 */
import { describe, expect, it } from 'vitest';

import { input, Table } from './fakes.js';
import { bombDefusal } from './module.js';
import type { Sequence } from './wires.js';

const SECRET: Sequence = ['red', 'blue', 'yellow', 'white'];
const closest = (t: Table) => bombDefusal.closest?.(t.state, t.secrets) ?? null;

describe('closest to winning', () => {
  it('ranks by the cuts right from the first; a defuse is 0, ties keep the earlier', () => {
    const t = new Table({ mode: 'shared', value: SECRET }, input('shared', ['a', 'b', 'c', 'd']));
    t.play('a', ['blue', 'red', 'yellow', 'white'], 1_000); // explodes: 4 to go
    t.play('a', ['red', 'blue', 'green', 'white'], 2_000); // 2 right
    t.play('b', ['red', 'green', 'yellow', 'white'], 3_000); // 1 right
    t.play('b', ['red', 'white', 'yellow', 'blue'], 4_000); // 1 right again: the earlier stays
    t.play('c', SECRET, 5_000);
    expect(closest(t)).toEqual([
      { playerId: 'a', index: 1, distance: 2, receiveSeq: 2 },
      { playerId: 'b', index: 0, distance: 3, receiveSeq: 3 },
      { playerId: 'c', index: 0, distance: 0, receiveSeq: 5 },
    ]);
  });

  it('measures each sequence against the player’s own bomb in individual mode', () => {
    const own: Sequence = ['white', 'yellow', 'blue', 'red'];
    const secrets = { mode: 'individual' as const, byPlayer: { a: SECRET, b: own } };
    const t = new Table(secrets, input('individual', ['a', 'b']));
    t.play('a', ['red', 'blue', 'yellow', 'black'], 1_000);
    t.play('b', ['white', 'yellow', 'red', 'blue'], 2_000);
    expect(closest(t)).toEqual([
      { playerId: 'a', index: 0, distance: 1, receiveSeq: 1 },
      { playerId: 'b', index: 0, distance: 2, receiveSeq: 2 },
    ]);
  });
});
