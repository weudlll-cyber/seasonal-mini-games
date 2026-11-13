/**
 * @file   apps/web/src/round/roundText.ts
 * @module web/round
 * @brief  The platform's sentences for a round: refusals, end reasons, feed lines, the margin.
 *
 * Responsibility: every platform code a player can meet in plain English (02 §12), the
 *                 solved player's notice (O25), the inactivity countdown line (O71), the
 *                 result's headline ("Walter found it first — after 9 guesses", 02 §9; a phased
 *                 round's "The round is over.", 02e §9), a round's action words (guesses, or a
 *                 phased round's choices, T332), the
 *                 winning margin, and one event row of the round's list per platform event (a
 *                 solve, a timeout, Heatwave's announcement at its first step only (O47),
 *                 Spring Herald, the round opening and ending), and the banner of a platform
 *                 special (Heatwave, Spring Herald, O35); a game's own rows and banners come
 *                 from the game's text.
 * Depends on:     @smg/contracts (shapes), @smg/game-sdk (FeedLine, formatNumber)
 * Used by:        ./RoundScreen, ./ResultScreen, ./RoundLog, ./SpecialBanner, ./InputRow,
 *                 ./InactivityLine, ../match/HostMenu
 * Spec:           docs/spec/02-game-guess-the-number.md §8, §9, §12; docs/spec/03-seasonal-specials.md §2
 */
import type { RoundStateView } from '@smg/contracts';
import { formatNumber, type FeedLine } from '@smg/game-sdk';

const CODES: Readonly<Record<string, string>> = {
  ROUND_NOT_OPEN: 'The round has not opened yet.',
  ROUND_OVER: 'The round is over.',
  NOT_IN_ROUND: 'You are watching this round. You can play from the next one.',
  ALREADY_SOLVED: 'You found your number already.',
  TIMED_OUT: 'Out of time this round. You can play the next round.',
  RATE_LIMITED: 'Slow down a little — too many guesses at once.',
  ROUND_BUSY: 'The round is very busy. Try again in a moment.',
  NO_ANSWER: 'No answer from the server. Check your connection and try again.',
  ROUND_RUNNING: 'A round is running already.',
  ROUND_SETTINGS_INVALID: 'These round settings are not allowed.',
  NOT_A_HALVING_DAY: 'Today is not a halving day.',
  MAINTENANCE: 'The games are being updated: new matches and rounds can start again shortly.',
  MATCH_TOO_LARGE: 'That many players are not allowed.',
  IN_SEASON_UNAVAILABLE: 'In Season is not available right now. Pick a season.',
  NOT_ENOUGH_PLAYERS: 'Not enough connected players to start.',
  TEAMS_LOCKED: 'Teams are locked while a round runs.',
  TEAM_LOCKED: 'You keep your team for the whole match.',
  TEAMS_OFF: 'This match is played without teams.',
  MATCH_FULL: 'This match is full.',
  KICKED: 'You were removed from this match by the host.',
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

// Players out of time are out of the round (O71): the solvers are everyone left in it.
const allSolvedText = (state: RoundStateView): string =>
  state.results?.some((r) => r.timedOut) === true
    ? 'Everyone still in the round found their number.'
    : 'Everyone found their number.';

// The words of a round's actions: a phased round's are choices (02e §5), a guess round's
// guesses (DECISIONS T332).
export const actionWords = (state: RoundStateView) =>
  state.plan === undefined
    ? { one: 'guess', many: 'guesses', Many: 'Guesses' }
    : { one: 'choice', many: 'choices', Many: 'Choices' };

export const actionCount = (state: RoundStateView, n: number): string => {
  const w = actionWords(state);
  return `${String(n)} ${n === 1 ? w.one : w.many}`;
};

// A phased round's end in plain words (02e §9): the round ran its time, or nobody chose.
function phasedEnd(state: RoundStateView): string | null {
  if (state.plan === undefined) return null;
  if (state.endReason === 'timeUp') return 'The round is over.';
  return state.endReason === 'noPlayers' ? 'Nobody chose this round.' : null;
}

export function endHeadline(state: RoundStateView): string {
  const phased = phasedEnd(state);
  if (phased !== null) return phased;
  const names = state.names;
  const winner = state.winner === null ? null : nameOf(names, state.winner);
  const guesses = state.roster.find((r) => r.playerKey === state.winner)?.guesses ?? 0;
  switch (state.endReason) {
    case 'solved':
      return `${winner ?? 'Someone'} found it first — after ${formatNumber(guesses)} ${guesses === 1 ? 'guess' : 'guesses'}.`;
    case 'allSolved':
      return allSolvedText(state);
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

// In place of the input row once a player solved their own number (O25).
export function solvedText(place: number | null): string {
  const at = place === null ? '' : ` — place ${formatNumber(place)}`;
  return `You found your number${at}. Your guesses stay here while the others play on.`;
}

// The inactivity countdown at the input row (O71): the whole seconds the server's deadline
// leaves, never below 0.
export function inactivityText(outAt: number, now: number): string {
  const left = Math.max(0, Math.ceil((outAt - now) / 1_000));
  return `${String(left)} s left for your next guess`;
}

// The winning margin when a second correct guess came within the window (O13), else null:
// the game's closest miss takes its place (O22).
export function marginText(state: RoundStateView): string | null {
  if (state.secretMode !== 'shared' || state.margin === null) return null;
  return `Found it ${seconds(state.margin.ms)} before ${nameOf(state.names, state.margin.playerId)}.`;
}

const roundLine = (text: string): FeedLine => ({ text, playerId: null });

// Heatwave's announcement, at its first step only (O47): the later steps change only the
// cooldown ring and the button at the input (DECISIONS T134).
function heatwaveText(e: Readonly<Record<string, unknown>>): string | null {
  if (e['index'] !== 1) return null;
  const s = Number((e['summary'] as { cooldownMs?: number } | undefined)?.cooldownMs) / 1_000;
  const now = Number.isInteger(s) ? String(s) : s.toFixed(1);
  return `Heatwave: waiting time is now ${now} s and keeps getting shorter.`;
}

// The text of Spring Herald's or Heatwave's firing, the same in the banner and the list.
function specialText(e: Readonly<Record<string, unknown>>): string | null {
  if (e['special'] === 'springHerald') return 'Spring Herald: everyone got a free hint.';
  return e['special'] === 'heatwave' ? heatwaveText(e) : null;
}

// The banner of a platform special (O35); the game's specials are the game's to word.
export function platformBanner(event: unknown): string | null {
  const e = event as { type?: string; [k: string]: unknown };
  return e.type === 'SpecialFired' ? specialText(e) : null;
}

// The list row of a platform event, or null (game events are the game's to word).
export function platformLine(event: unknown, names: Names): FeedLine | null {
  const e = event as { type?: string; [k: string]: unknown };
  switch (e.type) {
    case 'PlayerSolved': {
      const who = String(e['playerId']);
      const text = `${nameOf(names, who)} found ${e['place'] === 1 ? 'it' : 'their number'} — place ${formatNumber(Number(e['place']))}.`;
      return { text, playerId: who };
    }
    case 'PlayerTimedOut': {
      const who = String(e['playerId']);
      return { text: `${nameOf(names, who)} is out of time.`, playerId: who };
    }
    case 'RoundOpened':
      return roundLine('The round is open — guess!');
    case 'RoundEnded':
      return roundLine('The round has ended.');
    case 'RoundAborted':
      return roundLine(`The round was aborted: ${String(e['reason'])}.`);
    case 'SpecialFired': {
      const text = specialText(e);
      return text === null ? null : roundLine(text);
    }
    default:
      return null;
  }
}
