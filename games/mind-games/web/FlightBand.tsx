/**
 * @file   games/mind-games/web/FlightBand.tsx
 * @module games/mind-games/web
 * @brief  The flight band between the choice buttons and their counts.
 *
 * Responsibility: 02e §11.1. Each released view that moves someone starts one wave
 *                 (./flights): the cards and the labels are measured as it starts, every flight
 *                 placed, and the wave drawn until LIFE_MS after it is on the page, then removed;
 *                 a new wave never cuts an earlier one short, but where it lands it makes a coin
 *                 of an earlier wave still standing there fade at once. A flight is the coin of
 *                 its old season (none for a first choice), the coin of its new one and above
 *                 it its name or its "×N"; a card's "+N" in its last slot counts the players it
 *                 had no room for. The motion is ./flights.css's, its times ./flights'. Hidden
 *                 from screen readers and from the pointer: the lines and counts say the same in
 *                 words, and a click goes through to the card. With the device's reduced-motion
 *                 setting nothing flies.
 * Depends on:     react, @smg-game/mind-games (options, views), ./flights, ./seasons
 * Used by:        ./ChoiceButtons
 * Spec:           docs/spec/02e-game-mind-games.md §11.1
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

import {
  FADE_MS,
  FLIGHT_MS,
  GONE_MS,
  landed,
  LIFE_MS,
  placeWave,
  STAND_MS,
  waveOf,
  type Flight,
  type Layout,
  type More,
  type Placed,
  type Timed,
} from './flights.js';
import { iconsOf } from './seasons.js';

// The platform's phone layout (./mind.css): no names, first choices rise from below.
const PHONE = '(max-width: 899px), (orientation: portrait)';
const REDUCED = '(prefers-reduced-motion: reduce)';

const matches = (query: string): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia(query).matches;

const px = (n: number): string => `${String(n)}px`;
const ms = (n: number): string => `${String(n)}ms`;

// What a flight's label says, and its class.
const labelOf = (f: Flight, names: Readonly<Record<string, string>>) =>
  f.count > 1
    ? { text: `×${String(f.count)}`, className: 'mg-flight-count' }
    : f.player === null
      ? null
      : { text: names[f.player] ?? f.player, className: 'mg-flight-name' };

// Each flight's label width, measured once in the band in its own type.
function labelWidths(
  band: HTMLElement,
  flights: readonly Flight[],
  names: Readonly<Record<string, string>>,
): Map<string, number> {
  const probe = document.createElement('span');
  probe.style.visibility = 'hidden';
  band.append(probe);
  const widths = new Map<string, number>();
  for (const f of flights) {
    const label = labelOf(f, names);
    if (label === null) continue;
    probe.className = label.className;
    probe.textContent = label.text;
    widths.set(f.key, probe.getBoundingClientRect().width);
  }
  probe.remove();
  return widths;
}

// The cards as they are now (./ChoiceButtons' frames): each one's middle from the band's left
// and its width inside the frame's border.
function layoutOf(band: HTMLElement, options: readonly Choice[], widths: Map<string, number>) {
  const box = band.getBoundingClientRect();
  const frames = [...(band.parentElement?.querySelectorAll<HTMLElement>('.mg-frame') ?? [])];
  const cards: Partial<Record<Choice, { middle: number; room: number }>> = {};
  for (const c of options) {
    const frame = frames.find((f) => f.dataset['choice'] === c);
    const r = frame?.getBoundingClientRect();
    if (frame !== undefined && r !== undefined)
      cards[c] = { middle: r.left - box.left + r.width / 2, room: frame.clientWidth };
  }
  const layout: Layout = { width: box.width, cards, labelPx: (f) => widths.get(f.key) ?? 0 };
  return layout;
}

interface Wave extends Timed {
  readonly placed: readonly Placed[];
  readonly more: readonly More[];
}

// The waves on the page: each released view that moves someone adds one; each leaves at its
// own end, and its landing may make an earlier one fade at once.
function useWaves(
  view: SpectatorView,
  band: RefObject<HTMLDivElement | null>,
  names: Readonly<Record<string, string>>,
) {
  const prev = useRef<SpectatorView | null>(null);
  const last = useRef(0);
  const [waves, setWaves] = useState<readonly Wave[]>([]);
  useEffect(() => {
    const flights = waveOf(prev.current, view, matches(PHONE));
    prev.current = view;
    if (flights.length === 0 || matches(REDUCED) || band.current === null) return;
    const widths = labelWidths(band.current, flights, names);
    const layout = layoutOf(band.current, optionsOf(view.rules.allOption), widths);
    const { placed, more } = placeWave(flights, layout);
    last.current += 1;
    const id = last.current;
    const cards = [...new Set([...placed.map((p) => p.flight.to), ...more.map((m) => m.to)])];
    const wave: Wave = { id, start: performance.now(), cards, gone: [], placed, more };
    setWaves((w) => [...w, wave]);
  }, [view, band, names]);
  const land = useCallback((id: number) => {
    setWaves((w) => landed(w, id));
  }, []);
  const end = useCallback((id: number) => {
    setWaves((w) => w.filter((x) => x.id !== id));
  }, []);
  return { waves, land, end };
}

function Coin(p: { readonly choice: Choice; readonly className: string }): ReactElement {
  return (
    <span className={p.className} data-choice={p.choice}>
      {iconsOf(p.choice).map((src) => (
        <img key={src} src={src} alt="" />
      ))}
    </span>
  );
}

function Flying(p: {
  readonly placed: Placed;
  readonly gone: boolean;
  readonly names: Readonly<Record<string, string>>;
}): ReactElement {
  const { flight: f, from, to, scale } = p.placed;
  const label = labelOf(f, p.names);
  return (
    <span
      className="mg-flight"
      data-first={f.from === null}
      data-from={f.from ?? ''}
      data-to={f.to}
      data-gone={p.gone}
      style={{
        ['--mg-from' as string]: px(from),
        ['--mg-to' as string]: px(to),
        ['--mg-s' as string]: String(scale),
      }}
    >
      {f.from === null ? null : <Coin choice={f.from} className="mg-flight-from" />}
      <Coin choice={f.to} className="mg-flight-to" />
      {label === null ? null : <span className={label.className}>{label.text}</span>}
    </span>
  );
}

// One wave: it lands FLIGHT_MS after it is on the page and is removed LIFE_MS after, when
// everything of it has faded.
function Airborne(p: {
  readonly wave: Wave;
  readonly land: (id: number) => void;
  readonly end: (id: number) => void;
  readonly names: Readonly<Record<string, string>>;
}): ReactElement {
  const { wave, land, end } = p;
  useLayoutEffect(() => {
    const timers = [
      window.setTimeout(() => {
        land(wave.id);
      }, FLIGHT_MS),
      window.setTimeout(() => {
        end(wave.id);
      }, LIFE_MS),
    ];
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [wave.id, land, end]);
  return (
    <>
      {wave.placed.map((one) => (
        <Flying
          key={one.flight.key}
          placed={one}
          gone={wave.gone.includes(one.flight.to)}
          names={p.names}
        />
      ))}
      {wave.more.map(({ to, at, scale, n }) => (
        <span
          key={to}
          className="mg-more"
          data-to={to}
          data-gone={wave.gone.includes(to)}
          style={{ ['--mg-to' as string]: px(at), ['--mg-s' as string]: String(scale) }}
        >
          +{n}
        </span>
      ))}
    </>
  );
}

export function FlightBand(p: {
  readonly view: SpectatorView;
  readonly names: Readonly<Record<string, string>>;
}): ReactElement {
  const band = useRef<HTMLDivElement>(null);
  const { waves, land, end } = useWaves(p.view, band, p.names);
  return (
    <div
      ref={band}
      className="mg-band"
      aria-hidden="true"
      data-testid="flight-band"
      style={{
        ['--mg-fly' as string]: ms(FLIGHT_MS),
        ['--mg-fade-at' as string]: ms(FLIGHT_MS + STAND_MS),
        ['--mg-fade' as string]: ms(FADE_MS),
        ['--mg-gone' as string]: ms(GONE_MS),
      }}
    >
      {waves.map((wave) => (
        <Airborne key={wave.id} wave={wave} land={land} end={end} names={p.names} />
      ))}
    </div>
  );
}
