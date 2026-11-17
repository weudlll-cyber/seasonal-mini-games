/**
 * @file   games/mind-games/web/flights.ts
 * @module games/mind-games/web
 * @brief  What flies when a feed step is released, and where each flight lands.
 *
 * Responsibility: the flights' rules (02e §11.1), from the released views only. A wave is
 *                 the difference between the view shown and the next one: each new feed line
 *                 is a named move (a first choice or a visible switch); the change of the
 *                 counts no new line explains is a hidden switch, each option that lost a
 *                 player sending one to an option that gained one, in option order. One step's
 *                 moves with the same from → to fly as one flight, "×N" from two on; a single
 *                 flight carries its player's name if the feed named it, never on the phone
 *                 layout. The flights landing in one card spread evenly around its middle,
 *                 shrinking only as far as keeps two from overlapping by more than a fifth and
 *                 never below 82 % of their size; those that would not fit join the card's "+N".
 * Depends on:     @smg-game/mind-games (options, views)
 * Used by:        ./FlightBand, ./flights.test
 * Spec:           docs/spec/02e-game-mind-games.md §11.1
 */
import {
  optionsOf,
  type Choice,
  type FeedLineView,
  type SpectatorView,
} from '@smg-game/mind-games';

export interface Flight {
  // Its from → to, unique in its wave.
  readonly key: string;
  // Null: a first choice, flying in from outside the band.
  readonly from: Choice | null;
  readonly to: Choice;
  // The player's key whose name it shows; null on a group, a hidden switch and a phone.
  readonly player: string | null;
  readonly count: number;
}

interface Move {
  readonly from: Choice | null;
  readonly to: Choice;
  readonly player: string | null;
}

const lineKey = (l: FeedLineView) => `${String(l.at)}:${l.playerKey}`;

// The lines of `next` that `prev` did not hold, oldest first.
function newLines(prev: SpectatorView, next: SpectatorView): FeedLineView[] {
  const seen = new Set(prev.lines.map(lineKey));
  const newest = prev.lines[0]?.at ?? -Infinity;
  return next.lines.filter((l) => !seen.has(lineKey(l)) && l.at >= newest).reverse();
}

// The hidden switches: the counts' changes the new lines leave unexplained, losses paired
// with gains in option order.
function hiddenMoves(prev: SpectatorView, next: SpectatorView, lines: readonly FeedLineView[]) {
  const options = optionsOf(next.rules.allOption);
  const rest = new Map(options.map((c) => [c, next.counts[c] - prev.counts[c]]));
  for (const l of lines) {
    rest.set(l.choice, (rest.get(l.choice) ?? 0) - 1);
    if (l.from !== null) rest.set(l.from, (rest.get(l.from) ?? 0) + 1);
  }
  const repeat = (c: Choice, n: number) => Array<Choice>(Math.max(0, n)).fill(c);
  const losses = options.flatMap((c) => repeat(c, -(rest.get(c) ?? 0)));
  const gains = options.flatMap((c) => repeat(c, rest.get(c) ?? 0));
  return losses
    .slice(0, gains.length)
    .map((from, i): Move => ({ from, to: gains[i] ?? from, player: null }));
}

// The wave from the view shown to the next released one (none on the first view): one flight
// per from → to, in the order each first appears.
export function waveOf(prev: SpectatorView | null, next: SpectatorView, phone: boolean): Flight[] {
  if (prev === null) return [];
  const lines = newLines(prev, next);
  const moves: Move[] = [
    ...lines.map((l) => ({ from: l.from, to: l.choice, player: l.playerKey })),
    ...hiddenMoves(prev, next, lines),
  ];
  const groups = new Map<string, Move[]>();
  for (const m of moves) {
    const key = `${m.from ?? 'edge'}>${m.to}`;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  return [...groups].map(([key, [first, ...others]]) => ({
    key,
    from: first?.from ?? null,
    to: first?.to ?? 'all',
    player: others.length > 0 || phone ? null : (first?.player ?? null),
    count: 1 + others.length,
  }));
}

// A coin's size in px: a season's icon, All's square of four.
export const ICON_PX = 26;
const ALL_PX = 36;
const sizeOf = (c: Choice): number => (c === 'all' ? ALL_PX : ICON_PX);
// Two landed coins overlap by at most a fifth (their centres 82 % of a coin apart, so the
// browser's pixel rounding never makes it more); a coin never shrinks below 82 %.
const CLOSEST = 0.82;
const SMALLEST = 0.82;

// A card as measured: its middle in px from the band's left and the width its coins may use.
export interface Card {
  readonly middle: number;
  readonly room: number;
}

export interface Layout {
  readonly width: number;
  readonly cards: Readonly<Partial<Record<Choice, Card>>>;
  // A name label's width in px.
  readonly labelPx: (player: string) => number;
}

export interface Placed {
  readonly flight: Flight;
  // Centres in px from the band's left; the coin's scale at its landing.
  readonly from: number;
  readonly to: number;
  readonly scale: number;
}

// A card's "+N": the players whose flights it had no room for.
export interface More {
  readonly card: Card;
  readonly n: number;
}

// The most coins of `size` a card shows: as many as fit at SMALLEST, a fifth's overlap apart.
const fitOf = (card: Card, size: number): number =>
  Math.max(1, Math.floor(1 + (card.room / (size * SMALLEST) - 1) / CLOSEST));

// `k` coins of `size` around a card's middle, evenly and symmetrically: `apart` from each
// other where the card has the room (a coin and 4 px at least), closer down to a fifth's
// overlap, smaller only where even that does not fit. A lone coin sits on the middle.
export function spread(
  card: Card,
  k: number,
  size: number,
  apart = 0,
): { readonly xs: number[]; readonly scale: number } {
  const scale = k < 2 ? 1 : Math.min(1, card.room / (size * (1 + CLOSEST * (k - 1))));
  const s = size * scale;
  const step = k < 2 ? 0 : Math.min(Math.max(s + 4, apart), (card.room - s) / (k - 1));
  const xs = Array.from({ length: k }, (_, j) => card.middle + (j - (k - 1) / 2) * step);
  return { xs, scale };
}

// A wave placed: each flight from its card's middle (a first choice from just past the band's
// right edge) to its landing; per card, its flights that fit spread (named ones as far apart
// as their names need) and the players of the rest as its "+N".
export function placeWave(
  flights: readonly Flight[],
  layout: Layout,
): { readonly placed: Placed[]; readonly more: More[] } {
  const middleOf = (c: Choice) => layout.cards[c]?.middle ?? 0;
  const byCard = new Map<Choice, Flight[]>();
  for (const f of flights) byCard.set(f.to, [...(byCard.get(f.to) ?? []), f]);
  const placed: Placed[] = [];
  const more: More[] = [];
  for (const [to, group] of byCard) {
    const card = layout.cards[to] ?? { middle: 0, room: 0 };
    const size = sizeOf(to);
    const kept = group.slice(0, fitOf(card, size));
    const labels = kept.flatMap((f) => (f.player === null ? [] : [layout.labelPx(f.player)]));
    const apart = labels.length < 2 ? 0 : Math.max(...labels) + 4;
    const { xs, scale } = spread(card, kept.length, size, apart);
    kept.forEach((flight, i) => {
      const from = flight.from === null ? layout.width + ICON_PX : middleOf(flight.from);
      placed.push({ flight, from, to: xs[i] ?? card.middle, scale });
    });
    const rest = group.slice(kept.length).reduce((n, f) => n + f.count, 0);
    if (rest > 0) more.push({ card, n: rest });
  }
  return { placed, more };
}
