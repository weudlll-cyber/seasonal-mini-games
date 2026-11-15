/**
 * @file   games/mind-games/src/words.ts
 * @module games/mind-games
 * @brief  The result's words: option names, places, the headline and the chat's round line.
 *
 * Responsibility: one wording for the result page's headline and the line under it (02e §9,
 *                 owner decision O97: "Winter wins!", "Spring and Winter win!", "Nobody wins
 *                 this round."; "Least chosen · 3 players win · +1 each", nobody at a place that
 *                 does not exist, nobody in the round), a losing option's reason ("not least
 *                 chosen", "not chosen") and the game's part of the chat's round-end line
 *                 (`reveal`, 07 §2), all from the result view only.
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

// The headline: the winning options, else that nobody won or nobody chose.
export function resultTitle(r: ResultView): string {
  if (r.entrants === 0) return 'Nobody chose this round.';
  if (r.winners.length === 0) return 'Nobody wins this round.';
  return `${namesOf(r.winners)} ${r.winners.length === 1 ? 'wins' : 'win'}!`;
}

// The points the winners get: a season 1, All 2 (02e §8.2); "each" only for more than one.
function pointsWords(r: ResultView, players: number): string {
  const all = r.winners.includes('all');
  const seasons = r.winners.some((c) => c !== 'all');
  if (all && seasons) return '+1 each, All +2';
  const n = all ? '+2' : '+1';
  return players === 1 ? n : `${n} each`;
}

// The line under the headline: the place that won, the winners and their points; why nobody
// won; null when nobody chose.
export function resultLine(r: ResultView): string | null {
  const place = placeWords(r.rules.winnerPlace);
  if (r.entrants === 0) return null;
  if (r.winners.length === 0) return `There is no ${place} option this round.`;
  const n = winningPlayers(r);
  const head = place.charAt(0).toUpperCase() + place.slice(1);
  return `${head} · ${playersWord(n)} ${n === 1 ? 'wins' : 'win'} · ${pointsWords(r, n)}`;
}

// Why an option did not win: nobody chose it, or it was not at the winning place.
export const whyNot = (r: ResultView, c: Choice): string =>
  r.counts[c] === 0 ? 'not chosen' : `not ${placeWords(r.rules.winnerPlace)}`;

// The chat line's part after "Round 3:" (O32); null when nobody won, so the line says only that.
export function revealOf(result: unknown): string | null {
  const r = result as ResultView;
  if (r.winners.length === 0) return null;
  const verb = r.winners.length === 1 ? 'was' : 'were';
  const place = placeWords(r.rules.winnerPlace);
  return `${namesOf(r.winners)} ${verb} the ${place} (${playersWord(winningPlayers(r))})`;
}
