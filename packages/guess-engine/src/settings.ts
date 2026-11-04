/**
 * @file   packages/guess-engine/src/settings.ts
 * @module guess-engine
 * @brief  The setting definitions every guessing game shares, and reading them.
 *
 * Responsibility: `round.feedbackVisibility` (owner O8), `round.comments` (O21),
 *                 `comments.trendPercent` (proposal, T71) and `round.repeatGuessRejected` (O15)
 *                 with their bounds and status in one place; the help line of visibility and of
 *                 the repeat rule is the game's own, so each says "number", "code", "cell" in
 *                 its terms. Reading their frozen values into the engine's config.
 * Depends on:     @smg/game-sdk (SettingDef, SettingValue), ./state (GuessConfig, Visibility)
 * Used by:        ./index, games/* (their settings)
 * Spec:           docs/spec/08-admin-settings.md §3; docs/spec/04-software-architecture.md §4.7
 */
import type { SettingDef, SettingValue } from '@smg/game-sdk';

import type { GuessConfig, Visibility } from './state.js';

const GAME_ADMIN = 'settings.game.edit';
const host = { editPermission: GAME_ADMIN, hostChooses: true, running: 'frozen' } as const;
const admin = { editPermission: GAME_ADMIN, hostChooses: false, running: 'frozen' } as const;
const owner = (decision: string) => ({ status: 'owner', decision, spec: '08 §3' }) as const;

export function visibilityDef(help: string): SettingDef {
  return {
    key: 'round.feedbackVisibility',
    kind: 'enum',
    label: 'What others see of a guess',
    help,
    default: 'full',
    options: ['own', 'numbers', 'full'],
    ...owner('O8'),
    ...host,
  };
}

export const COMMENTS_DEF: SettingDef = {
  key: 'round.comments',
  kind: 'bool',
  label: 'Closeness comments',
  help: 'A short comment on how close each guess came, shown with its answer.',
  default: true,
  ...owner('O21'),
  ...host,
};

export const TREND_DEF: SettingDef = {
  key: 'comments.trendPercent',
  kind: 'int',
  label: 'Trend lines',
  help: 'How often a guess in another tier than the player’s last one gets a "getting warmer" or "wrong way" line instead.',
  default: 33,
  min: 0,
  max: 100,
  unit: '%',
  status: 'proposal',
  spec: '08 §3',
  ...admin,
};

export function repeatDef(help: string): SettingDef {
  return {
    key: 'round.repeatGuessRejected',
    kind: 'bool',
    label: 'Refuse repeated guesses',
    help,
    default: true,
    ...owner('O15'),
    ...admin,
  };
}

export function readGuessConfig(values: Readonly<Record<string, SettingValue>>): GuessConfig {
  return {
    feedbackVisibility: values['round.feedbackVisibility'] as Visibility,
    comments: values['round.comments'] as boolean,
    trendPercent: values['comments.trendPercent'] as number,
    repeatGuessRejected: values['round.repeatGuessRejected'] as boolean,
  };
}
