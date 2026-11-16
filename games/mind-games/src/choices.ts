/**
 * @file   games/mind-games/src/choices.ts
 * @module games/mind-games
 * @brief  The five choices, counting final choices, and the winning options with their places.
 *
 * Responsibility: the four seasons and All (02e §1, owner decisions 77, 83); the options a
 *                 round offers; the counts per option of a set of final choices; the dense
 *                 places from the least to the most chosen, among the options chosen at least
 *                 once (02e §8.1: equal counts share a place, the next count takes the next
 *                 place); the winning options at a place, none when the round has no such
 *                 place; the points of a final choice (owner decision 84).
 * Depends on:     nothing
 * Used by:        ./rules, ./views, ./words, ./devBot, ./conformance, ./index
 * Spec:           docs/spec/02e-game-mind-games.md §1, §8
 */

const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export const CHOICES = [...SEASONS, 'all'] as const;
export type Choice = (typeof CHOICES)[number];
export type Counts = Readonly<Record<Choice, number>>;

export const isChoice = (value: string): value is Choice => CHOICES.some((c) => c === value);

// The options of a round: the four seasons, with All the fifth.
export const optionsOf = (allOption: boolean): readonly Choice[] => (allOption ? CHOICES : SEASONS);

// How many of the final choices fall on each option; options nobody chose count 0.
export function countsOf(finals: Iterable<Choice>): Counts {
  const counts = { spring: 0, summer: 0, autumn: 0, winter: 0, all: 0 };
  for (const choice of finals) counts[choice] += 1;
  return counts;
}

// Each chosen option's place from the least chosen, dense; null for an option nobody chose.
export function placesOf(counts: Counts): Readonly<Record<Choice, number | null>> {
  const taken = [...new Set(CHOICES.map((c) => counts[c]).filter((n) => n > 0))].sort(
    (a, b) => a - b,
  );
  const placeOf = (n: number) => (n > 0 ? taken.indexOf(n) + 1 : null);
  return {
    spring: placeOf(counts.spring),
    summer: placeOf(counts.summer),
    autumn: placeOf(counts.autumn),
    winter: placeOf(counts.winter),
    all: placeOf(counts.all),
  };
}

// The options at the winner place, in option order; empty when the round has no such place.
export function winnersOf(counts: Counts, winnerPlace: number): readonly Choice[] {
  const places = placesOf(counts);
  return CHOICES.filter((c) => places[c] === winnerPlace);
}

// A winning final choice scores 1, a winning All 2 (owner decision 84); nothing else scores.
export const pointsOf = (choice: Choice, winners: readonly Choice[]): number =>
  winners.includes(choice) ? (choice === 'all' ? 2 : 1) : 0;
