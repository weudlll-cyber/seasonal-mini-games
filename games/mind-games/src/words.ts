/**
 * @file   games/mind-games/src/words.ts
 * @module games/mind-games
 * @brief  The result's words: option names, places, the headline and the chat's round line.
 *
 * Responsibility: one wording for the result page's headline and the line under it (02e §9,
 *                 owner decision O97: "Winter wins!", "Spring and Winter win!", "Nobody wins
 *                 this round."; "Least chosen season · 3 players win 1 point", nobody at a place that
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

// The winners and their points (02e §8.2): "1 player wins 1 point", "3 players win 1 point ·
// +2 for All", "1 player wins · +2 for All" (T355).
function winnersWords(r: ResultView): string {
  const n = winningPlayers(r);
  const win = `${playersWord(n)} ${n === 1 ? 'wins' : 'win'}`;
  const all = r.winners.includes('all');
  if (!r.winners.some((c) => c !== 'all')) return `${win} · +2 for All`;
  return all ? `${win} 1 point · +2 for All` : `${win} 1 point`;
}

// The line under the headline: the place that won in words, the winners and their points
// ("Least chosen season · 1 player wins 1 point"); why nobody won; null when nobody chose.
export function resultLine(r: ResultView): string | null {
  const place = placeWords(r.rules.winnerPlace);
  if (r.entrants === 0) return null;
  if (r.winners.length === 0) return `There is no ${place} season this round.`;
  const head = place.charAt(0).toUpperCase() + place.slice(1);
  return `${head} season · ${winnersWords(r)}`;
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
