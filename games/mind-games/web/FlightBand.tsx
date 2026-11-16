/**
 * @file   games/mind-games/web/FlightBand.tsx
 * @module games/mind-games/web
 * @brief  The flight band between the choice buttons and their counts.
 *
 * Responsibility: 02e §11.1. When a new released view arrives, its wave (./flights) flies:
 *                 every icon from its old season's card to the new one's, a first choice in
 *                 from beside the band's right edge (from below on a phone); one player's icon
 *                 with the name above it when the feed names them (a first choice or a visible
 *                 switch), a hidden switch without one; one step's moves with the same
 *                 from → to as one icon with "×N" (DECISIONS T377); at most 12 icons in a wave
 *                 and "+8" for the rest. The cards are measured at each wave's start (so every
 *                 wave after a resize uses the new layout), and each icon placed on its centre
 *                 at points of its own (`placeWave`): a lone icon lands on its card's middle.
 *                 The name is centred over its icon wherever it flies, moved aside only as far
 *                 as keeps it whole inside the band (./flights.css, from its width and the
 *                 band's), and is shown exactly as long as its icon: it flies and fades with it. A flight lasts about 1.2 s (T371), its CSS taking the
 *                 length from FLIGHT_MS: the icon flips into the new season's in the first
 *                 half, then shrinks and fades into its card, so nothing is left in the band
 *                 when its wave is removed at FLIGHT_MS. A step that arrives while a wave still
 *                 flies starts its own wave at once, clear of the points the old one's icons
 *                 are still near (its first 40 %); the old flights finish where they are, each
 *                 wave leaving at its own end, so nothing jumps; the "+8" tag is the newest
 *                 wave's. The band is a row of the stage's own layout, clipped at its edges,
 *                 so a flight never covers a button, a line or the chat. Hidden from screen
 *                 readers: the lines and the counts say the same in words. With the device's
 *                 reduced-motion setting no flight runs at all.
 * Depends on:     react, @smg-game/mind-games (options, views), ./flights, ./seasons
 * Used by:        ./ChoiceButtons
 * Spec:           docs/spec/02e-game-mind-games.md §11.1; docs/spec/09-testing-strategy.md §4.2
 */
import { optionsOf, type Choice, type SpectatorView } from '@smg-game/mind-games';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from 'react';

import { placeWave, waveOf, type Claim, type Layout, type Placed, type Spot } from './flights.js';
import { iconsOf } from './seasons.js';

// A flight's length (T371); its wave is removed at its end. The CSS reads it as --mg-flight.
export const FLIGHT_MS = 1_200;
// How long a wave's points stay held: its icons are near their start in the first moments and
// near their landing from 60 % on, so a wave started within this time of another must keep
// clear of its points (DECISIONS T377).
const HOLD_MS = 0.4 * FLIGHT_MS;

const reducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const px = (n: number): string => `${String(n)}px`;

// The cards as they are now (./ChoiceButtons' frames, in option order): each one's middle
// from the band's left and the room its icons spread over, the card itself 3 px inside its
// frame on each side; the strip past the right edge for first choices.
function layoutOf(
  band: HTMLElement | null,
  options: readonly Choice[],
  names: Readonly<Record<string, string>>,
): Layout {
  const box = band?.getBoundingClientRect();
  const frames = [...(band?.parentElement?.querySelectorAll<HTMLElement>('.mg-frame') ?? [])];
  const columns = options.map((c) => {
    const r = frames.find((f) => f.dataset['choice'] === c)?.getBoundingClientRect();
    if (r === undefined || box === undefined) return { middle: 0, room: 0 };
    return { middle: r.left - box.left + r.width / 2, room: Math.max(0, r.width - 6) };
  });
  const width = box?.width ?? 0;
  return {
    width,
    columns,
    edge: { middle: width + 60, room: 100 },
    // The label's small bold type: about 9.5 px a character and its padding (measured: a
    // six-letter name 65 px wide).
    labelPx: (player) => (names[player] ?? player).length * 9.5 + 10,
  };
}

// A choice's icon in flight (All's four in a square, as on its button).
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
  readonly width: number;
}

// The points held by the waves in the air (./flights Claim): a wave takes its claims at its
// start and gives them back after HOLD_MS.
function hold(taken: Map<string, Spot[]>, claims: readonly Claim[], on: boolean): void {
  for (const [column, spot] of claims) {
    const held = taken.get(column) ?? [];
    taken.set(column, on ? [...held, spot] : held.filter((s) => s !== spot));
  }
}

// The waves in flight: each released view that moves someone adds one, placed clear of the
// points the waves just before it hold; each leaves at its own end (`end`, from ./Airborne),
// so a new wave never cuts an old one short (T371).
function useWaves(
  view: SpectatorView,
  band: RefObject<HTMLDivElement | null>,
  names: Readonly<Record<string, string>>,
) {
  const prev = useRef<SpectatorView | null>(null);
  const last = useRef(0);
  const timers = useRef(new Set<number>());
  const taken = useRef(new Map<string, Spot[]>());
  const [shown, setShown] = useState<readonly Shown[]>([]);
  useEffect(() => {
    const wave = waveOf(prev.current, view);
    prev.current = view;
    // A view that changed nothing leaves the running waves alone.
    if (wave.flights.length === 0 || reducedMotion()) return;
    const options = optionsOf(view.rules.allOption);
    const layout = layoutOf(band.current, options, names);
    const { placed, claims } = placeWave(wave, options, layout, taken.current);
    hold(taken.current, claims, true);
    last.current += 1;
    const id = last.current;
    setShown((s) => [...s, { id, placed, more: wave.more, width: layout.width }]);
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      hold(taken.current, claims, false);
    }, HOLD_MS);
    timers.current.add(timer);
  }, [view, band, names]);
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending) window.clearTimeout(t);
    };
  }, []);
  const end = useCallback((id: number) => {
    setShown((s) => s.filter((w) => w.id !== id));
  }, []);
  return { shown, end };
}

// The name over its icon: its width for the CSS, which centres it over the icon wherever the
// icon is and moves it aside only as far as keeps it whole inside the band.
function Name(p: { readonly text: string }): ReactElement {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el !== null) el.style.setProperty('--mg-w', px(el.offsetWidth));
  }, [p.text]);
  return (
    <span ref={ref} className="mg-flight-name">
      {p.text}
    </span>
  );
}

// One flight: the box is the icon's own, placed on its centre; the name hangs above it, the
// count of a group at its foot.
function Flying(p: {
  readonly placed: Placed;
  readonly width: number;
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
        ['--mg-from' as string]: px(start.x),
        ['--mg-to' as string]: px(end.x),
        ['--mg-s0' as string]: String(start.scale),
        ['--mg-s1' as string]: String(end.scale),
        ['--mg-band' as string]: px(p.width),
      }}
    >
      {f.from === null ? null : <Icon choice={f.from} className="mg-flight-from" />}
      <Icon choice={f.to} className="mg-flight-to" />
      {f.player === null ? null : <Name text={p.names[f.player] ?? f.player} />}
      {f.count < 2 ? null : <span className="mg-flight-count">×{f.count}</span>}
    </span>
  );
}

// One wave's flights. Its end is timed from the moment its flights are on the page (not from
// the view's arrival, a render earlier), so it is removed when its animations end, never
// before: at FLIGHT_MS its icons have landed and faded out, and nothing lingers.
function Airborne(p: {
  readonly wave: Shown;
  readonly end: (id: number) => void;
  readonly names: Readonly<Record<string, string>>;
}): ReactElement {
  const { wave, end } = p;
  useLayoutEffect(() => {
    const timer = window.setTimeout(() => {
      end(wave.id);
    }, FLIGHT_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [wave.id, end]);
  return (
    <>
      {wave.placed.map((one) => (
        <Flying key={one.flight.key} placed={one} width={wave.width} names={p.names} />
      ))}
    </>
  );
}

export function FlightBand(p: {
  readonly view: SpectatorView;
  readonly names: Readonly<Record<string, string>>;
}): ReactElement {
  const band = useRef<HTMLDivElement>(null);
  const { shown, end } = useWaves(p.view, band, p.names);
  const more = shown.at(-1)?.more ?? 0;
  return (
    <div
      ref={band}
      className="mg-band"
      aria-hidden="true"
      data-testid="flight-band"
      style={{ ['--mg-flight' as string]: `${String(FLIGHT_MS)}ms` }}
    >
      {shown.map((wave) => (
        <Airborne key={wave.id} wave={wave} end={end} names={p.names} />
      ))}
      {more === 0 ? null : <span className="mg-more">+{more}</span>}
    </div>
  );
}
