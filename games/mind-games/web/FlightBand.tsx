/**
 * @file   games/mind-games/web/FlightBand.tsx
 * @module games/mind-games/web
 * @brief  The flight band between the choice buttons and their counts.
 *
 * Responsibility: 02e §11.1. When a new released view arrives, its wave (./flights) flies:
 *                 every icon from its old season's column to the new one's, turning into the
 *                 new season's icon on the way, a first choice in
 *                 from the band's edge (beside the lines on a desktop, from below on a phone)
 *                 with the player's name on it, a hidden switch without any name; at most 12
 *                 in a wave and a "+8" tag for the rest; each flight lasts about 1.2 s
 *                 (DECISIONS T371), its CSS taking the length from FLIGHT_MS. A step that
 *                 arrives while a wave still flies starts its own wave at once; the old
 *                 flights finish where they are, each wave leaving at its own end, so nothing
 *                 jumps; the "+8" tag is the newest wave's. The band is a row of the stage's
 *                 own layout, clipped at its edges, so a flight never covers a button, a line or the chat.
 *                 Hidden from screen readers: the lines and the counts say the same in words.
 *                 With the device's reduced-motion setting no flight runs at all.
 * Depends on:     react, @smg-game/mind-games (options, views), ./flights, ./seasons
 * Used by:        ./ChoiceButtons
 * Spec:           docs/spec/02e-game-mind-games.md §11.1; docs/spec/09-testing-strategy.md §4.2
 */
import { optionsOf, type Choice, type SpectatorView } from '@smg-game/mind-games';
import { useEffect, useRef, useState, type ReactElement } from 'react';

import { waveOf, type Wave } from './flights.js';
import { iconsOf } from './seasons.js';

// A flight's length (T371); a wave is cleared just after it. The CSS reads it as --mg-flight.
export const FLIGHT_MS = 1_200;

const reducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// A column's middle along the band, as a share of its width.
const xOf = (c: Choice, options: readonly Choice[]): string =>
  `${String(((options.indexOf(c) + 0.5) / options.length) * 100)}%`;

// A choice's icon in flight (All's four small ones together).
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
  readonly wave: Wave;
}

// The waves in flight: each released view that moves someone adds one; each leaves at its
// own end, so a new wave never cuts an old one short (T371).
function useWaves(view: SpectatorView): readonly Shown[] {
  const prev = useRef<SpectatorView | null>(null);
  const last = useRef(0);
  const timers = useRef(new Set<number>());
  const [shown, setShown] = useState<readonly Shown[]>([]);
  useEffect(() => {
    const wave = waveOf(prev.current, view);
    prev.current = view;
    // A view that changed nothing leaves the running waves alone.
    if (wave.flights.length === 0 || reducedMotion()) return;
    last.current += 1;
    const id = last.current;
    setShown((s) => [...s, { id, wave }]);
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      setShown((s) => s.filter((w) => w.id !== id));
    }, FLIGHT_MS + 100);
    timers.current.add(timer);
  }, [view]);
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending) window.clearTimeout(t);
    };
  }, []);
  return shown;
}

export function FlightBand(p: {
  readonly view: SpectatorView;
  readonly names: Readonly<Record<string, string>>;
}): ReactElement {
  const waves = useWaves(p.view);
  const options = optionsOf(p.view.rules.allOption);
  const more = waves.at(-1)?.wave.more ?? 0;
  return (
    <div
      className="mg-band"
      aria-hidden="true"
      data-testid="flight-band"
      style={{ ['--mg-flight' as string]: `${String(FLIGHT_MS)}ms` }}
    >
      {waves.flatMap(({ id, wave }) =>
        wave.flights.map((f) => (
          <span
            key={`${String(id)}:${f.key}`}
            className="mg-flight"
            data-first={f.from === null}
            data-to={f.to}
            data-from={f.from ?? ''}
            style={{
              ['--mg-from' as string]: f.from === null ? '100%' : xOf(f.from, options),
              ['--mg-to' as string]: xOf(f.to, options),
            }}
          >
            {f.from === null ? null : <Icon choice={f.from} className="mg-flight-from" />}
            <Icon choice={f.to} className="mg-flight-to" />
            {f.player === null ? null : (
              <span className="mg-flight-name">{p.names[f.player] ?? f.player}</span>
            )}
          </span>
        )),
      )}
      {more === 0 ? null : <span className="mg-more">+{more}</span>}
    </div>
  );
}
