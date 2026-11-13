/**
 * @file   packages/domain/src/index.ts
 * @module domain
 * @brief  Public entry point of @smg/domain: the platform's pure rules.
 *
 * Responsibility: the audit hash chain, the round rules (lifecycle, receive order,
 *                 cooldown, inactivity, placings, points, standings, seasonal specials and
 *                 teams) and the season board's period (04 §3).
 * Depends on:     ./audit/hashChain, ./league/periods, ./round/*
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
export { createRound, nextDue, roundResults, type NewRound } from './round/lifecycle.js';
export {
  INACTIVITY_GRACE_MS,
  inactivityDeadline,
  type InactivityDeadline,
} from './round/inactivity.js';
export { scoredPlayers, standings, type Scored, type StandingRow } from './round/results.js';
export { seasonPeriod, type SeasonPeriod } from './league/periods.js';
export { frostDelay } from './round/specials.js';
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
