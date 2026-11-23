/**
 * @file   apps/web/src/round/roundText.ts
 * @module web/round
 * @brief  The platform's sentences for a round: refusals, end reasons, feed lines, the margin.
 *
 * Responsibility: every platform code a player can meet in plain English (02 §12), the
 *                 solved player's notice (O25), the inactivity countdown line (O71), the
 *                 result's headline ("Walter found it first — after 9 guesses", 02 §9; a phased
 *                 round's "The round is over.", 02e §9), where a game names finding in its own
 *                 words those (`found`, "hit the target": the headline, the solve's row, the
 *                 already-solved refusal, O136, O137), a guess's own words for going too fast
 *                 while other refusals say "try again in a moment" (O138), a round's action words
 *                 (guesses, or a phased round's choices, T332), the
 *                 winning margin, the round bar's time ("9:30 left"; a phased round's counts
 *                 to the plan's end, where its phase strip ends, and in the hold before the
 *                 result says "Result in 0:04", DECISIONS T386), and one event row of the round's list per platform event (a
 *                 solve, a timeout, Heatwave's announcement at its first step only (O47),
 *                 Spring Herald, the round opening and ending), and the banner of a platform
 *                 special (Heatwave, Spring Herald, O35); a game's own rows and banners come
 *                 from the game's text.
 * Depends on:     @smg/contracts (shapes), @seasonal/kit (clockText), @smg/game-sdk (FeedLine, formatNumber)
 * Used by:        ./RoundScreen, ./ResultScreen, ./RoundLog, ./SpecialBanner, ./InputRow,
 *                 ./InactivityLine, ./FocusBar, ../match/HostMenu
 * Spec:           docs/spec/02-game-guess-the-number.md §8, §9, §12; docs/spec/03-seasonal-specials.md §2
 */
import type { RoundStateView } from '@smg/contracts';
import { clockText } from '@seasonal/kit';
import { formatNumber, type FeedLine } from '@smg/game-sdk';

const CODES: Readonly<Record<string, string>> = {
  ROUND_NOT_OPEN: 'The round has not opened yet.',
  ROUND_OVER: 'The round is over.',
  NOT_IN_ROUND: 'You are watching this round. You can play from the next one.',
  ALREADY_SOLVED: 'You found your number already.',
  TIMED_OUT: 'Out of time this round. You can play the next round.',
  // A host's round command or a team change too soon after the last (O138); a guess has its
  // own words (guessRefusal).
  RATE_LIMITED: 'Slow down a little — try again in a moment.',
  ROUND_BUSY: 'The round is very busy. Try again in a moment.',
  // More rounds running on this server than `match.maxConcurrentRounds` (08 §4).
  SERVER_BUSY: 'The server is running as many rounds as it can. Try again in a moment.',
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
  // Owner decision O119: no "by the host" (staff can remove a player too).
  KICKED: 'You were removed from this match.',
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

// A guess's refusal: going too fast in a guess's words (O138), and where a game names finding
// in its own words (GameText.found, O137) the already-solved refusal in those ("You hit the
// target already."); else as codeText.
export function guessRefusal(
  code: string | undefined,
  until: number | undefined,
  now: number,
  found?: string,
): string {
  if (code === 'RATE_LIMITED') return 'Slow down a little — too many guesses at once.';
  if (code === 'ALREADY_SOLVED' && found !== undefined) return `You ${found} already.`;
  return codeText(code, until, now);
}

type Names = Readonly<Record<string, string>>;
const nameOf = (names: Names, key: string) => names[key] ?? key;

export function seconds(ms: number): string {
  const s = ms / 1_000;
  return `${s < 10 ? s.toFixed(1) : String(Math.round(s))} s`;
}

// Players out of time are out of the round (O71): the solvers are everyone left in it. In a
// game's own words for finding, those ("Everyone hit the target.", O137).
function allSolvedText(state: RoundStateView, found: string | undefined): string {
  const who =
    state.results?.some((r) => r.timedOut) === true ? 'Everyone still in the round' : 'Everyone';
  return `${who} ${found ?? 'found their number'}.`;
}

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

// "Walter found it first — after 9 guesses.", with the game's words for finding (O137).
function firstSolve(state: RoundStateView, found: string): string {
  const winner = state.winner === null ? 'Someone' : nameOf(state.names, state.winner);
  const guesses = state.roster.find((r) => r.playerKey === state.winner)?.guesses ?? 0;
  return `${winner} ${found} first — after ${formatNumber(guesses)} ${guesses === 1 ? 'guess' : 'guesses'}.`;
}

// `found`: the game's words for finding the secret (GameText.found, O137), else "found it"
// and "found their number".
export function endHeadline(state: RoundStateView, found?: string): string {
  const phased = phasedEnd(state);
  if (phased !== null) return phased;
  switch (state.endReason) {
    case 'solved':
      return firstSolve(state, found ?? 'found it');
    case 'allSolved':
      return allSolvedText(state, found);
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

// In place of the input row once a player solved their own number (O25); in a game's own
// words for finding it, that alone ("You hit the target.", O136).
export function solvedText(place: number | null, found?: string): string {
  if (found !== undefined) return `You ${found}.`;
  const at = place === null ? '' : ` — place ${formatNumber(place)}`;
  return `You found your number${at}. Your guesses stay here while the others play on.`;
}

// The round bar's time of an open round, null before it opens. A guess round's "9:30" is
// the time to its end. A phased round's counts to the plan's end (the end of Reveal), so it
// agrees with the phase strip; in the hold from there to the result it is "Result in 0:04".
// Whole seconds down, as every countdown on the round's screen (O107).
export function barTime(
  state: RoundStateView,
  now: number,
): { readonly text: string; readonly left: boolean } | null {
  if (state.status !== 'open' || state.endsAt === null) return null;
  const playEnd =
    state.plan === undefined || state.opensAt === null
      ? state.endsAt
      : state.opensAt + state.plan.endMs;
  if (now < playEnd || playEnd === state.endsAt)
    return { text: clockText(Math.max(0, playEnd - now)), left: true };
  return { text: `Result in ${clockText(Math.max(0, state.endsAt - now))}`, left: false };
}

// The inactivity countdown at the input row (O71): the whole seconds the server's deadline
// leaves, never below 0.
export function inactivityText(outAt: number, now: number): string {
  const left = Math.max(0, Math.ceil((outAt - now) / 1_000));
  return `${String(left)} s left for your next guess`;
}

// The winning margin when a second correct guess came within the window (O13), else null:
// the game's closest miss takes its place (O22).
export function marginText(state: RoundStateView, found = 'found it'): string | null {
  if (state.secretMode !== 'shared' || state.margin === null) return null;
  const verb = found.charAt(0).toUpperCase() + found.slice(1);
  return `${verb} ${seconds(state.margin.ms)} before ${nameOf(state.names, state.margin.playerId)}.`;
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

// A solve's row: "Anna found their number — place 2.", or in the game's words for finding
// ("Anna hit the target — place 2.", O137).
function solvedLine(e: Readonly<Record<string, unknown>>, names: Names, found?: string): FeedLine {
  const who = String(e['playerId']);
  const words = found ?? `found ${e['place'] === 1 ? 'it' : 'their number'}`;
  const text = `${nameOf(names, who)} ${words} — place ${formatNumber(Number(e['place']))}.`;
  return { text, playerId: who };
}

// The list row of a platform event, or null (game events are the game's to word); `found`
// the game's words for finding (GameText.found), if any.
export function platformLine(event: unknown, names: Names, found?: string): FeedLine | null {
  const e = event as { type?: string; [k: string]: unknown };
  switch (e.type) {
    case 'PlayerSolved':
      return solvedLine(e, names, found);
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
