/**
 * @file   games/mind-games/src/words.ts
 * @module games/mind-games
 * @brief  The result's words: option names, places, the headline and the chat's round line.
 *
 * Responsibility: one wording for the result page's headline (02e §9: the winning options
 *                 and how many players win, a shared place, nobody at a place that does not
 *                 exist, nobody in the round) and the game's part of the chat's round-end line
 *                 (`reveal`, 07 §2), both from the result view only.
 * Depends on:     ./choices, ./views (types)
 * Used by:        ./module, ./index
 * Spec:           docs/spec/02e-game-mind-games.md §8, §9; docs/spec/07-integration.md §2
 */
import type { Choice } from './choices.js';
import type { ResultView } from './views.js';

export const CHOICE_NAMES: Readonly<Record<Choice, string>> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
  all: 'All',
};

const ORDINALS = ['', '', '2nd', '3rd', '4th', '5th'];

// "least chosen", "2nd least chosen", …
export const placeWords = (place: number): string =>
  place === 1 ? 'least chosen' : `${ORDINALS[place] ?? `${String(place)}th`} least chosen`;

// "Winter", "Spring and Autumn", "Spring, Summer and Autumn".
function namesOf(choices: readonly Choice[]): string {
  const names = choices.map((c) => CHOICE_NAMES[c]);
  const last = names.pop() ?? '';
  return names.length === 0 ? last : `${names.join(', ')} and ${last}`;
}

const playersWord = (n: number) => `${String(n)} ${n === 1 ? 'player' : 'players'}`;

// The players whose final choice is a winning option.
const winningPlayers = (r: ResultView) => r.players.filter((p) => p.points > 0).length;

export function headline(r: ResultView): string {
  const place = placeWords(r.rules.winnerPlace);
  if (r.entrants === 0) return 'Nobody chose this round.';
  if (r.winners.length === 0) return `Nobody wins: there is no ${place} option this round.`;
  const win = `${playersWord(winningPlayers(r))} ${winningPlayers(r) === 1 ? 'wins' : 'win'}.`;
  if (r.winners.length === 1) return `${namesOf(r.winners)} was the ${place} — ${win}`;
  return `${namesOf(r.winners)} share the ${place} place — ${win}`;
}

// The chat line's part after "Round 3:" (O32); null when nobody won, so the line says only that.
export function revealOf(result: unknown): string | null {
  const r = result as ResultView;
  if (r.winners.length === 0) return null;
  const verb = r.winners.length === 1 ? 'was' : 'were';
  const place = placeWords(r.rules.winnerPlace);
  return `${namesOf(r.winners)} ${verb} the ${place} (${playersWord(winningPlayers(r))})`;
}
