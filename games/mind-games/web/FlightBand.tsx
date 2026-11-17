/**
 * @file   games/mind-games/web/FlightBand.tsx
 * @module games/mind-games/web
 * @brief  The flight band between the choice buttons and their counts.
 *
 * Responsibility: 02e §11.1. Each released view that moves someone starts one wave
 *                 (./flights): the cards are measured as it starts, every flight placed, and
 *                 the wave drawn until FLIGHT_MS after it is on the page, then removed; a new
 *                 wave never cuts an earlier one short. A flight is the coin of its old
 *                 season (none for a first choice), the coin of its new one, its name or its
 *                 "×N"; a card's "+N" names the players it had no room for. The motion is
 *                 ./flights.css's. Hidden from screen readers: the lines and counts say the
 *                 same in words. With the device's reduced-motion setting nothing flies.
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

import { placeWave, waveOf, type Layout, type More, type Placed } from './flights.js';
import { iconsOf } from './seasons.js';

// A flight's length; the CSS reads it as --mg-flight.
export const FLIGHT_MS = 1_200;
// The platform's phone layout (./mind.css): no names, first choices rise from below.
const PHONE = '(max-width: 899px), (orientation: portrait)';
const REDUCED = '(prefers-reduced-motion: reduce)';

const matches = (query: string): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia(query).matches;

const px = (n: number): string => `${String(n)}px`;

// The cards as they are now (./ChoiceButtons' frames): each one's middle from the band's left
// and its width inside the frame's 3 px border.
function layoutOf(
  band: HTMLElement | null,
  options: readonly Choice[],
  names: Readonly<Record<string, string>>,
): Layout {
  const box = band?.getBoundingClientRect();
  const frames = [...(band?.parentElement?.querySelectorAll<HTMLElement>('.mg-frame') ?? [])];
  const cards: Partial<Record<Choice, { middle: number; room: number }>> = {};
  for (const c of options) {
    const r = frames.find((f) => f.dataset['choice'] === c)?.getBoundingClientRect();
    if (r !== undefined && box !== undefined)
      cards[c] = { middle: r.left - box.left + r.width / 2, room: Math.max(0, r.width - 6) };
  }
  return {
    width: box?.width ?? 0,
    cards,
    // The label's small bold type: about 9.5 px a character and its padding.
    labelPx: (player) => (names[player] ?? player).length * 9.5 + 10,
  };
}

interface Wave {
  readonly id: number;
  readonly placed: readonly Placed[];
  readonly more: readonly More[];
}

// The waves in the air: each released view that moves someone adds one; each leaves at its
// own end.
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
    if (flights.length === 0 || matches(REDUCED)) return;
    const layout = layoutOf(band.current, optionsOf(view.rules.allOption), names);
    last.current += 1;
    const id = last.current;
    setWaves((w) => [...w, { id, ...placeWave(flights, layout) }]);
  }, [view, band, names]);
  const end = useCallback((id: number) => {
    setWaves((w) => w.filter((x) => x.id !== id));
  }, []);
  return { waves, end };
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
  readonly names: Readonly<Record<string, string>>;
}): ReactElement {
  const { flight: f, from, to, scale } = p.placed;
  return (
    <span
      className="mg-flight"
      data-first={f.from === null}
      data-from={f.from ?? ''}
      data-to={f.to}
      style={{
        ['--mg-from' as string]: px(from),
        ['--mg-to' as string]: px(to),
        ['--mg-s' as string]: String(scale),
      }}
    >
      {f.from === null ? null : <Coin choice={f.from} className="mg-flight-from" />}
      <Coin choice={f.to} className="mg-flight-to" />
      {f.player === null ? null : (
        <span className="mg-flight-name">{p.names[f.player] ?? f.player}</span>
      )}
      {f.count < 2 ? null : <span className="mg-flight-count">×{f.count}</span>}
    </span>
  );
}

// One wave, removed FLIGHT_MS after it is on the page: by then everything of it has faded.
function Airborne(p: {
  readonly wave: Wave;
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
        <Flying key={one.flight.key} placed={one} names={p.names} />
      ))}
      {wave.more.map(({ card, n }) => (
        <span
          key={card.middle}
          className="mg-more"
          style={{ ['--mg-to' as string]: px(card.middle + card.room / 2) }}
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
  const { waves, end } = useWaves(p.view, band, p.names);
  return (
    <div
      ref={band}
      className="mg-band"
      aria-hidden="true"
      data-testid="flight-band"
      style={{ ['--mg-flight' as string]: `${String(FLIGHT_MS)}ms` }}
    >
      {waves.map((wave) => (
        <Airborne key={wave.id} wave={wave} end={end} names={p.names} />
      ))}
    </div>
  );
}
