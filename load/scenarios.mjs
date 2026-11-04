/**
 * @file   load/scenarios.mjs
 * @module load
 * @brief  The rounds of load scenario L1 and the halving day a halving round needs.
 *
 * Responsibility: the host settings of each L1 round (shared, cooldown 3 s, range
 *                 1–1 000 000): plain, each season with its special, a halving round; the
 *                 named scenarios as lists of those rounds (`l1` is 09 §5's ten in one match,
 *                 one after another: five plain, the four specials, the halving round); and, for a halving round, today's halving day (in the
 *                 time zone of the `seasons` settings) through the admin route, removed again
 *                 afterwards when the check added it. Special timings stay the game
 *                 document's (Heatwave 30 s, Leaf Fall 20 s, halving 60 s, Frost 3 s by default).
 * Depends on:     ./http
 * Used by:        ./guessStorm
 * Spec:           docs/spec/09-testing-strategy.md §5 (L1); docs/spec/03-seasonal-specials.md §2, §4
 */
import { call } from './http.mjs';

const BASE_SETTINGS = {
  'round.secretMode': 'shared',
  'round.cooldownS': 3,
  'round.countdownS': 5,
  'round.maxDurationMin': 3,
  'round.rangeLow': 1,
  'round.rangeHigh': 1_000_000,
  'round.teamsOn': false,
};

const special = (season, extra = {}) => ({
  season,
  settings: { ...BASE_SETTINGS, 'round.specialOn': true, ...extra },
});

export const ROUNDS = {
  plain: { season: 'spring', settings: { ...BASE_SETTINGS, 'round.specialOn': false } },
  spring: special('spring'),
  // Heatwave never takes the cooldown below 3 s (03 §2.2): at L1's 3 s it would never fire,
  // so its round starts at 6 s and steps down to 3 s (DECISIONS T181).
  summer: special('summer', { 'round.cooldownS': 6 }),
  autumn: special('autumn'),
  winter: special('winter'),
  // Halving alone, without a season special; Guess The Number halves only a shown range (T55).
  halving: {
    season: 'spring',
    settings: {
      ...BASE_SETTINGS,
      'round.specialOn': false,
      'round.halving': true,
      'round.rangeVisible': true,
    },
  },
};

export const SCENARIOS = {
  ...Object.fromEntries(Object.keys(ROUNDS).map((name) => [name, [name]])),
  specials: ['spring', 'summer', 'autumn', 'winter'],
  // 09 §5's ten rounds: "plain, then each special, then a halving round"; the plain rounds
  // fill the count, so the match also shows whether anything builds up from round to round
  // before the specials start (DECISIONS T180, amended by T200).
  l1: [...Array(5).fill('plain'), 'spring', 'summer', 'autumn', 'winter', 'halving'],
};

const TOKEN = 'load-check';

// Today's halving day, added when there is none; returns what to remove afterwards, or null.
export async function ensureHalvingDay(admin) {
  const now = await call(admin, 'GET', '/seasons/current');
  if (now?.halvingToday !== null) return null;
  const doc = await call(admin, 'GET', '/admin/settings/seasons');
  const timeZone = doc?.overrides?.['halving.timeZone']?.value ?? 'UTC';
  // en-CA writes dates as YYYY-MM-DD.
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  await call(admin, 'POST', '/admin/halving-days', { day, token: TOKEN });
  return { day, token: TOKEN };
}

export async function removeHalvingDay(admin, added) {
  if (added !== null)
    await call(admin, 'DELETE', `/admin/halving-days/${added.day}/${added.token}`);
}
