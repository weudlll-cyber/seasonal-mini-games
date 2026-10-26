/**
 * @file   apps/web/src/round/roundText.ts
 * @module web/round
 * @brief  The platform's sentences for a round: refusals, end reasons, feed lines, the margin.
 *
 * Responsibility: every platform code a player can meet in plain English (02 §12), the
 *                 result's headline ("Walter found it first — after 9 guesses", 02 §9), the
 *                 winning margin, and one feed line per platform event (a solve, Heatwave's new
 *                 cooldown, the end); a game's own lines come from the game's text.
 * Depends on:     @smg/contracts (shapes)
 * Used by:        ./RoundScreen, ./ResultScreen, ./Feed, ../match/HostConsole
 * Spec:           docs/spec/02-game-guess-the-number.md §8, §9, §12; docs/spec/03-seasonal-specials.md §2
 */
import type { RoundStateView } from '@smg/contracts';

const CODES: Readonly<Record<string, string>> = {
  ROUND_NOT_OPEN: 'The round has not opened yet.',
  ROUND_OVER: 'The round is over.',
  NOT_IN_ROUND: 'You are watching this round. You can play from the next one.',
  ALREADY_SOLVED: 'You found your number already.',
  RATE_LIMITED: 'Slow down a little — too many guesses at once.',
  ROUND_BUSY: 'The round is very busy. Try again in a moment.',
  NO_ANSWER: 'No answer from the server. Check your connection and try again.',
  ROUND_RUNNING: 'A round is running already.',
  ROUND_SETTINGS_INVALID: 'These round settings are not allowed.',
  NOT_A_HALVING_DAY: 'Today is not a halving day.',
  IN_SEASON_UNAVAILABLE: 'In Season is not available right now. Pick a season.',
  NOT_ENOUGH_PLAYERS: 'Not enough connected players to start.',
  TEAMS_LOCKED: 'Teams are locked while a round runs.',
  MATCH_FULL: 'This match is full.',
  MATCH_CLOSED: 'This match has ended.',
  NOT_THE_HOST: 'Only the host can do that.',
  ROUND_STATE_INVALID: 'That is not possible at this point of the round.',
};

export function codeText(code: string | undefined, until?: number, now?: number): string {
  if (code === 'COOLDOWN_ACTIVE') {
    const left =
      until === undefined || now === undefined
        ? null
        : Math.max(1, Math.ceil((until - now) / 1_000));
    return left === null
      ? 'Your cooldown is running.'
      : `Your cooldown is running — ${String(left)} s left.`;
  }
  return CODES[code ?? ''] ?? 'That did not work. Please try again.';
}

type Names = Readonly<Record<string, string>>;
const nameOf = (names: Names, key: string) => names[key] ?? key;

export function seconds(ms: number): string {
  const s = ms / 1_000;
  return `${s < 10 ? s.toFixed(1) : String(Math.round(s))} s`;
}

export function endHeadline(state: RoundStateView): string {
  const names = state.names;
  const winner = state.winner === null ? null : nameOf(names, state.winner);
  const guesses = state.roster.find((r) => r.playerKey === state.winner)?.guesses ?? 0;
  switch (state.endReason) {
    case 'solved':
      return `${winner ?? 'Someone'} found it first — after ${String(guesses)} ${guesses === 1 ? 'guess' : 'guesses'}.`;
    case 'allSolved':
      return 'Everyone found their number.';
    case 'timeUp':
      return 'Time is up.';
    case 'host':
      return 'The host ended the round.';
    case 'noPlayers':
      return 'No players were left.';
    default:
      return 'The round has ended.';
  }
}

export function marginText(state: RoundStateView): string | null {
  if (state.secretMode !== 'shared' || state.winner === null) return null;
  if (state.margin === null) return 'Nobody else was close.';
  return `Found it ${seconds(state.margin.ms)} before ${nameOf(state.names, state.margin.playerId)}.`;
}

// The feed line of a platform event, or null (game events are the game's to word).
export function platformLine(event: unknown, names: Names): string | null {
  const e = event as { type?: string; [k: string]: unknown };
  switch (e.type) {
    case 'PlayerSolved':
      return `${nameOf(names, String(e['playerId']))} found ${e['place'] === 1 ? 'it' : 'their number'} — place ${String(e['place'])}.`;
    case 'CooldownChanged':
      return `Heatwave: cooldown now ${seconds(Number(e['cooldownMs']))}.`;
    case 'RoundOpened':
      return 'The round is open — guess!';
    case 'RoundEnded':
      return 'The round has ended.';
    case 'RoundAborted':
      return `The round was aborted: ${String(e['reason'])}.`;
    case 'SpecialFired':
      return e['special'] === 'springHerald' ? 'Spring Herald: everyone received a hint.' : null;
    default:
      return null;
  }
}
