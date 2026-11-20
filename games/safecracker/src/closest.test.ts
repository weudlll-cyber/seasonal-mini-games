/**
 * @file   games/safecracker/src/closest.test.ts
 * @module games/safecracker
 * @brief  "Closest to winning" (O110): each player's best code, most digits in place first.
 *
 * Responsibility: the module's `closest` names one best code per player who guessed: the most
 *                 digits in their place, then the most right digits in a wrong place; an
 *                 opened safe is 0; equal ones keep the earlier code; individual mode by the
 *                 answers to the player's own code; a player without a code is left out.
 * Depends on:     vitest, ./fakes, ./module, ./views
 * Spec:           docs/spec/02b-game-safecracker.md §8; docs/spec/04-software-architecture.md §4
 */
import { describe, expect, it } from 'vitest';

import { individual, input, shared, Table } from './fakes.js';
import { safecracker } from './module.js';
import { codeDistance } from './views.js';

const closest = (t: Table) => safecracker.closest?.(t.state, t.secrets) ?? null;

describe('closest to winning', () => {
  it('ranks by digits in place, then in a wrong place; a solve is 0, ties keep the earlier', () => {
    const t = new Table(shared('1234'), input('shared', ['a', 'b', 'c', 'd']));
    t.play('a', '1243'); // 2 in place, 2 elsewhere
    t.play('a', '1235'); // 3 in place: the better one
    t.play('b', '2134'); // 2 in place, 2 elsewhere
    t.play('b', '1243'); // the same counts later: the earlier stays
    t.play('c', '1234');
    expect(closest(t)).toEqual([
      { playerId: 'a', index: 1, distance: codeDistance({ exact: 3, near: 0 }, 4), receiveSeq: 2 },
      { playerId: 'b', index: 0, distance: codeDistance({ exact: 2, near: 2 }, 4), receiveSeq: 3 },
      { playerId: 'c', index: 0, distance: 0, receiveSeq: 5 },
    ]);
    expect(codeDistance({ exact: 3, near: 0 }, 4)).toBeLessThan(
      codeDistance({ exact: 2, near: 2 }, 4),
    );
  });

  it('measures each code against the player’s own in individual mode', () => {
    const t = new Table(individual({ a: '1123', b: '9999' }), input('individual', ['a', 'b']));
    t.play('a', '1123');
    t.play('b', '9990');
    expect(closest(t)).toEqual([
      { playerId: 'a', index: 0, distance: 0, receiveSeq: 1 },
      { playerId: 'b', index: 0, distance: codeDistance({ exact: 3, near: 0 }, 4), receiveSeq: 2 },
    ]);
  });
});
