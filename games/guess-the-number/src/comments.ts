/**
 * @file   games/guess-the-number/src/comments.ts
 * @module games/guess-the-number
 * @brief  Guess The Number's comment picker: the guess engine's picking over this game's lines (O21).
 *
 * Responsibility: bind the engine's reproducible, repeat-free choice (DECISIONS T71, T72) to
 *                 the game's catalogue (./commentLines), once, for the rules, the state and the
 *                 tests.
 * Depends on:     @smg/guess-engine (commentPicker), ./commentLines
 * Used by:        ./module, ./comments.test
 * Spec:           docs/spec/02-game-guess-the-number.md §6.3; docs/spec/04-software-architecture.md §4.7
 */
import { commentPicker } from '@smg/guess-engine';

import { COMMENT_LINES } from './commentLines.js';

export type { Comment, UsedLines } from '@smg/guess-engine';

export const gtnComments = commentPicker(COMMENT_LINES);
export const { linesOf, noteUsed, pickComment } = gtnComments;
