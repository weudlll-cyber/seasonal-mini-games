/**
 * @file   games/guess-the-number/src/distance.ts
 * @module games/guess-the-number
 * @brief  How far a guess is from the number: the game's measure for "Closest to winning".
 *
 * Responsibility: the plain distance |guess − secret|, so a guess outside a hidden range
 *                 counts like any other; 0 is the number found. The module's `distance`
 *                 (O110), which names each player's best guess after the round's end; it
 *                 needs the secret, so it runs on the server only.
 * Depends on:     nothing
 * Used by:        ./module (`distance`), ./closest.test
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/04-software-architecture.md §4.7
 */
export const numberDistance = (g: { readonly value: number }, secret: number): number =>
  Math.abs(g.value - secret);
