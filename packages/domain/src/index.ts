/**
 * @file   packages/domain/src/index.ts
 * @module domain
 * @brief  Public entry point of @smg/domain: the platform's pure rules.
 *
 * Responsibility: the audit hash chain; the round rules (lifecycle, cooldown, receive
 *                 order, placings, specials) join with the Guess The Number work (04 §3).
 * Depends on:     ./audit/hashChain
 * Used by:        packages/application, apps/server
 * Spec:           docs/spec/04-software-architecture.md §3
 */
export {
  brokenLink,
  canonicalJson,
  chainHash,
  type AuditRecord,
  type ChainLink,
} from './audit/hashChain.js';
