/**
 * @file   packages/game-sdk/src/crypto.ts
 * @module game-sdk
 * @brief  Entry @smg/game-sdk/crypto: the DRBG implementation and the seed commitment.
 *
 * Responsibility: the parts of the SDK that need node:crypto, kept apart from the main
 *                 entry so browser code never pulls them in. Used by the platform; a game
 *                 receives only a RoundRng and never makes one.
 * Depends on:     ./drbg, ./commitment
 * Used by:        packages/domain, apps/server
 * Spec:           docs/spec/04-software-architecture.md §5.4
 */
export { createDrbg, roundRng, SEED_BYTES } from './drbg.js';
export { commitSeed, verifyCommitment } from './commitment.js';
