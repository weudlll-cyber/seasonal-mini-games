/**
 * @file   packages/game-sdk/src/random.ts
 * @module game-sdk
 * @brief  The random-number types a game sees: a DRBG cursor and the round's labelled view.
 *
 * Responsibility: types only, free of node:crypto, so browser code can import the SDK's
 *                 main entry. The implementation is ./drbg (entry @smg/game-sdk/crypto).
 * Depends on:     nothing
 * Used by:        ./drbg, ./index, games/*
 * Spec:           docs/spec/04-software-architecture.md §4.1, §5.4
 */

export interface Drbg {
  readonly nextUint32: () => number;
  // A uniform integer in [0, exclusiveMax).
  readonly nextInt: (exclusiveMax: number) => number;
  // A uniform integer in [low, high], both inclusive.
  readonly intBetween: (low: number, high: number) => number;
}

// What a game sees of the round's randomness: children separated by label (04 §5.4).
// A game never sees the seed itself.
export interface RoundRng {
  readonly child: (...labels: readonly string[]) => Drbg;
}
