/**
 * @file   games/mind-games/web/FlightBand.tsx
 * @module games/mind-games/web
 * @brief  The flight band between the choice buttons and their counts.
 *
 * Responsibility: 02e §11.1. When a new released view arrives, its wave (./flights) flies:
 *                 every icon from its old season's column to the new one's, a first choice in
 *                 from beside the band's right edge (from below on a phone) with the player's
 *                 name above it, a hidden switch without any name; at most 12 in a wave and a
 *                 "+8" tag for the rest. Each flight is placed on its icon's centre, in a slot
 *                 of its own where it starts and where it lands (`placeWave`, DECISIONS T376);
 *                 the name never moves the icon. A flight lasts about 1.2 s (T371), its CSS
 *                 taking the length from FLIGHT_MS: the icon turns into the new season's in
 *                 the first half, then shrinks and fades into its column, so nothing is left in
 *                 the band when its wave is removed at FLIGHT_MS. A step that arrives while a
 *                 wave still flies starts its own wave at once, around the slots the old one
 *                 still holds; the old flights finish where they are, each wave leaving at its
 *                 own end, so nothing jumps; the "+8" tag is the newest wave's. The band is a
 *                 row of the stage's own layout, clipped at its edges, so a flight never covers
 *                 a button, a line or the chat. Hidden from screen readers: the lines and the
 *                 counts say the same in words. With the device's reduced-motion setting no
 *                 flight runs at all.
 * Depends on:     react, @smg-game/mind-games (options, views), ./flights, ./seasons
 * Used by:        ./ChoiceButtons
 * Spec:           docs/spec/02e-game-mind-games.md §11.1; docs/spec/09-testing-strategy.md §4.2
 */
import { optionsOf, type Choice, type SpectatorView } from '@smg-game/mind-games';
import { useEffect, useRef, useState, type ReactElement, type RefObject } from 'react';

import { placeWave, waveOf, type Claim, type Placed } from './flights.js';
import { iconsOf } from './seasons.js';

// A flight's length (T371); its wave is removed at its end. The CSS reads it as --mg-flight.
export const FLIGHT_MS = 1_200;

const reducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pct = (share: number): string => `${String(share * 100)}%`;
const px = (n: number): string => `${String(n)}px`;

// A choice's icon in flight (All's four small ones in a square of the same size).
function Icon(p: { readonly choice: Choice; readonly className: string }): ReactElement {
  return (
    <span className={p.className} data-choice={p.choice}>
      {iconsOf(p.choice).map((src) => (
        <img key={src} src={src} alt="" />
      ))}
    </span>
  );
}

interface Shown {
  readonly id: number;
  readonly placed: readonly Placed[];
  readonly more: number;
}

// The slots held by the flights in the air (./flights Claim): a wave takes its claims at its
// start and gives them back at its end.
function hold(taken: Map<string, Set<number>>, claims: readonly Claim[], on: boolean): void {
  for (const [column, slot] of claims) {
    const held = taken.get(column) ?? new Set<number>();
    taken.set(column, held);
    if (on) held.add(slot);
    else held.delete(slot);
  }
}

// The waves in flight: each released view that moves someone adds one, placed around the
// slots the waves still in the air hold; each leaves at its own end, so a new wave never
// cuts an old one short (T371).
function useWaves(view: SpectatorView, band: RefObject<HTMLDivElement | null>): readonly Shown[] {
  const prev = useRef<SpectatorView | null>(null);
  const last = useRef(0);
  const timers = useRef(new Set<number>());
  const taken = useRef(new Map<string, Set<number>>());
  const [shown, setShown] = useState<readonly Shown[]>([]);
  useEffect(() => {
    const wave = waveOf(prev.current, view);
    prev.current = view;
    // A view that changed nothing leaves the running waves alone.
    if (wave.flights.length === 0 || reducedMotion()) return;
    const options = optionsOf(view.rules.allOption);
    const width = band.current?.clientWidth ?? 0;
    const { placed, claims } = placeWave(wave, options, width, taken.current);
    hold(taken.current, claims, true);
    last.current += 1;
    const id = last.current;
    setShown((s) => [...s, { id, placed, more: wave.more }]);
    // At its end a wave's flights have landed and faded out: nothing lingers.
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      hold(taken.current, claims, false);
      setShown((s) => s.filter((w) => w.id !== id));
    }, FLIGHT_MS);
    timers.current.add(timer);
  }, [view, band]);
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending) window.clearTimeout(t);
    };
  }, []);
  return shown;
}

// One flight: the box is the icon's own, placed on its centre; the name hangs above it.
function Flying(p: {
  readonly placed: Placed;
  readonly names: Readonly<Record<string, string>>;
}): ReactElement {
  const { flight: f, start, end } = p.placed;
  return (
    <span
      className="mg-flight"
      data-first={f.from === null}
      data-to={f.to}
      data-from={f.from ?? ''}
      style={{
        ['--mg-from' as string]: pct(start.x),
        ['--mg-to' as string]: pct(end.x),
        ['--mg-y0' as string]: px(start.y),
        ['--mg-y1' as string]: px(end.y),
      }}
    >
      {f.from === null ? null : <Icon choice={f.from} className="mg-flight-from" />}
      <Icon choice={f.to} className="mg-flight-to" />
      {f.player === null ? null : (
        <span className="mg-flight-name">{p.names[f.player] ?? f.player}</span>
      )}
    </span>
  );
}

export function FlightBand(p: {
  readonly view: SpectatorView;
  readonly names: Readonly<Record<string, string>>;
}): ReactElement {
  const band = useRef<HTMLDivElement>(null);
  const waves = useWaves(p.view, band);
  const more = waves.at(-1)?.more ?? 0;
  return (
    <div
      ref={band}
      className="mg-band"
      aria-hidden="true"
      data-testid="flight-band"
      style={{ ['--mg-flight' as string]: `${String(FLIGHT_MS)}ms` }}
    >
      {waves.flatMap(({ id, placed }) =>
        placed.map((one) => (
          <Flying key={`${String(id)}:${one.flight.key}`} placed={one} names={p.names} />
        )),
      )}
      {more === 0 ? null : <span className="mg-more">+{more}</span>}
    </div>
  );
}
