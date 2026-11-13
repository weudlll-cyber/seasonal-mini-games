/**
 * @file   apps/server/src/chat/roundLines.test.ts
 * @module server/chat
 * @brief  The chat's round-end line of a guess round and of a phased round.
 *
 * Responsibility: a guess round's line is unchanged (its winner by name, the secret in the game's
 *                 words, or nobody found it); a phased round's line names what won in the
 *                 game's words, says when nobody won, and counts the winners when the round's
 *                 words are not at hand (02e §9; DECISIONS T325).
 * Depends on:     vitest, ./roundLines
 * Spec:           docs/spec/07-integration.md §2; docs/spec/02e-game-mind-games.md §9
 */
import { describe, expect, it } from 'vitest';

import { endLine, phasedEndLine } from './roundLines.js';

describe('the round-end chat line', () => {
  it("keeps a guess round's words", () => {
    expect(endLine(4, 'Walter', 'the number was 42')).toBe(
      'Round 4: Walter found it first — the number was 42',
    );
    expect(endLine(4, null, null)).toBe('Round 4 ended: nobody found it');
  });

  it("words a phased round from its winners and the game's words", () => {
    expect(phasedEndLine(3, 3, 'Winter was the least chosen (3 players)')).toBe(
      'Round 3: Winter was the least chosen (3 players).',
    );
    expect(phasedEndLine(3, 0, null)).toBe('Round 3 ended: nobody won.');
    expect(phasedEndLine(3, 1, null)).toBe('Round 3: 1 player won.');
    expect(phasedEndLine(3, 4, null)).toBe('Round 3: 4 players won.');
  });
});
