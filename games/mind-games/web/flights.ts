/**
 * @file   games/mind-games/web/flights.ts
 * @module games/mind-games/web
 * @brief  What flies when a feed step is released, where each flight lands, and for how long.
 *
 * Responsibility: the flights' rules (02e §11.1), from the released views only. A wave is
 *                 the difference between the view shown and the next one: each new feed line
 *                 is a named move (a first choice or a visible switch); the change of the
 *                 counts no new line explains is a hidden switch, each option that lost a
 *                 player sending one to an option that gained one, in option order. One step's
 *                 moves with the same from → to fly as one flight, "×N" from two on; a single
 *                 flight carries its player's name if the feed named it, never on the phone
 *                 layout. The flights landing in one card spread evenly around its middle
 *                 inside its frame, shrinking only as far as keeps two from overlapping by more
 *                 than a fifth and never below 82 % of their size; those that would not fit join
 *                 the card's "+N" in its last slot. A name whose label would not lie wholly
 *                 inside the card, clear of its neighbours' labels, is dropped for the whole
 *                 flight. The times: the flight, its standing at the landing, its fade; a coin
 *                 still standing where a newer wave lands fades at once.
 * Depends on:     @smg-game/mind-games (options, views)
 * Used by:        ./FlightBand, ./flights.test, ./FlightBand.test
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
// The room between two labels side by side.
const LABEL_GAP = 4;

// A card as measured: its middle in px from the band's left and its inner width, inside its
// frame's border.
export interface Card {
  readonly middle: number;
  readonly room: number;
}

export interface Layout {
  readonly width: number;
  readonly cards: Readonly<Partial<Record<Choice, Card>>>;
  // The width in px of a flight's label above its coin: its name or its "×N"; 0 without.
  readonly labelPx: (f: Flight) => number;
}

export interface Placed {
  // Its player null where the name had no room.
  readonly flight: Flight;
  // Centres in px from the band's left; the coin's scale at its landing.
  readonly from: number;
  readonly to: number;
  readonly scale: number;
}

// A card's "+N" in its last slot: the players whose flights it had no room for.
export interface More {
  readonly to: Choice;
  readonly at: number;
  readonly scale: number;
  readonly n: number;
}

// The most slots of `size` a card holds: as many as fit at SMALLEST, a fifth's overlap apart.
const fitOf = (card: Card, size: number): number =>
  Math.max(1, Math.floor(1 + (card.room / (size * SMALLEST) - 1) / CLOSEST));

// `k` slots of `size` around a card's middle, evenly and symmetrically, wholly inside it:
// `apart` from each other where the card has the room (a slot and 4 px at least), closer down
// to a fifth's overlap, smaller only where even that does not fit. A lone one sits on the middle.
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

// Whether slot `i`'s label, `widths[i]` px wide, lies wholly inside the card and clear of the
// labels of the slots beside it.
function clear(card: Card, xs: readonly number[], i: number, widths: readonly number[]): boolean {
  const x = xs[i] ?? card.middle;
  const w = widths[i] ?? 0;
  if (Math.abs(x - card.middle) + w / 2 > card.room / 2) return false;
  return [i - 1, i + 1].every((j) => {
    const y = xs[j];
    return y === undefined || Math.abs(x - y) >= (w + (widths[j] ?? 0)) / 2 + LABEL_GAP;
  });
}

// One card's flights placed: a slot holds a coin and its "×N" above it; the flights that fit
// spread (labelled ones as far apart as their labels need), each name kept only where its
// label is clear; the players of the rest in a last slot's "+N".
function placeCard(
  to: Choice,
  group: readonly Flight[],
  layout: Layout,
): { readonly placed: Placed[]; readonly more: More | null } {
  const card = layout.cards[to] ?? { middle: 0, room: 0 };
  const unit = Math.max(sizeOf(to), ...group.filter((f) => f.count > 1).map(layout.labelPx));
  const fit = fitOf(card, unit);
  const kept = group.length <= fit ? group : group.slice(0, fit - 1);
  const labels = kept.map(layout.labelPx);
  const labelled = labels.filter((w) => w > 0);
  const apart = labelled.length < 2 ? 0 : Math.max(...labelled) + LABEL_GAP;
  const slots = kept.length < group.length ? kept.length + 1 : kept.length;
  const { xs, scale } = spread(card, slots, unit, apart);
  const widths = labels.map((w) => w * scale);
  const placed = kept.map((flight, i): Placed => {
    const roomless = flight.player !== null && !clear(card, xs, i, widths);
    const from = flight.from === null ? layout.width + ICON_PX : layout.cards[flight.from]?.middle;
    return {
      flight: roomless ? { ...flight, player: null } : flight,
      from: from ?? 0,
      to: xs[i] ?? card.middle,
      scale,
    };
  });
  const n = group.slice(kept.length).reduce((sum, f) => sum + f.count, 0);
  return { placed, more: n > 0 ? { to, at: xs[kept.length] ?? card.middle, scale, n } : null };
}

// A wave placed: each flight from its card's middle (a first choice from just past the band's
// right edge) to its landing, card by card.
export function placeWave(
  flights: readonly Flight[],
  layout: Layout,
): { readonly placed: Placed[]; readonly more: More[] } {
  const byCard = new Map<Choice, Flight[]>();
  for (const f of flights) byCard.set(f.to, [...(byCard.get(f.to) ?? []), f]);
  const cards = [...byCard].map(([to, group]) => placeCard(to, group, layout));
  return {
    placed: cards.flatMap((c) => c.placed),
    more: cards.flatMap((c) => (c.more === null ? [] : [c.more])),
  };
}

// A flight's times in ms (02e §11.1 point 7): it flies, stands still at its landing, then
// shrinks and fades into its card; a coin still standing where a newer one lands fades at
// once, in GONE_MS. A wave is removed LIFE_MS after it starts.
export const FLIGHT_MS = 1_600;
export const STAND_MS = 500;
export const FADE_MS = 300;
export const GONE_MS = 150;
export const LIFE_MS = FLIGHT_MS + STAND_MS + FADE_MS;

// A wave on the page: when it started (ms), the cards it lands in, those it has left at once.
export interface Timed {
  readonly id: number;
  readonly start: number;
  readonly cards: readonly Choice[];
  readonly gone: readonly Choice[];
}

// The waves once wave `id` lands: every earlier one still standing in one of its cards then
// fades there at once; one already fading goes on as it is.
export function landed<W extends Timed>(waves: readonly W[], id: number): W[] {
  const lands = waves.find((w) => w.id === id);
  if (lands === undefined) return [...waves];
  const at = lands.start + FLIGHT_MS;
  return waves.map((w) => {
    if (w.start >= lands.start || at - w.start >= FLIGHT_MS + STAND_MS) return w;
    const gone = lands.cards.filter((c) => w.cards.includes(c) && !w.gone.includes(c));
    return gone.length === 0 ? w : { ...w, gone: [...w.gone, ...gone] };
  });
}
