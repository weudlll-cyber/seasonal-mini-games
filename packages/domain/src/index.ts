/**
 * @file   packages/domain/src/index.ts
 * @module domain
 * @brief  Public entry point of @smg/domain: the platform's pure rules.
 *
 * Responsibility: the audit hash chain and the round rules (lifecycle, receive order,
 *                 cooldown, placings, points, standings, seasonal specials and teams) (04 §3).
 * Depends on:     ./audit/hashChain, ./round/*
 * Used by:        packages/application, apps/server
 * Spec:           docs/spec/04-software-architecture.md §3, §5
 */
export {
  brokenLink,
  canonicalJson,
  chainHash,
  type AuditRecord,
  type ChainLink,
} from './audit/hashChain.js';
export {
  evolveRound,
  initialRound,
  replayRound,
  roundInput,
  rosterPlayers,
} from './round/evolve.js';
export { createRound, type NewRound } from './round/lifecycle.js';
export {
  playerResults,
  scoredPlayers,
  standings,
  type Scored,
  type StandingRow,
} from './round/results.js';
export { frostDelay, nextDue } from './round/specials.js';
export { stepRound } from './round/step.js';
export type {
  EndReason,
  IntervalSpecial,
  Margin,
  PlayerResult,
  Reply,
  RosterEntry,
  RoundCode,
  RoundCommand,
  RoundDeps,
  RoundEvent,
  RoundState,
  RoundStatus,
  SpecialName,
  StepResult,
  TeamResult,
} from './round/types.js';
