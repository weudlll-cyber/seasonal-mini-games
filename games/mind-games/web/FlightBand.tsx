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
 *                 at once and a "+8" tag for the rest; each flight lasts about 0.8 s, so a wave
 *                 ends before the next step. The band is a row of the stage's own layout,
 *                 clipped at its edges, so a flight never covers a button, a line or the chat.
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

// A flight's length; the wave is cleared just after it.
export const FLIGHT_MS = 800;

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

// The wave of the newest released view; each new view replaces it.
function useWave(view: SpectatorView): { readonly id: number; readonly wave: Wave } | null {
  const prev = useRef<SpectatorView | null>(null);
  const timer = useRef<number | null>(null);
  const [shown, setShown] = useState<{ id: number; wave: Wave } | null>(null);
  useEffect(() => {
    const wave = waveOf(prev.current, view);
    prev.current = view;
    // A view that changed nothing leaves a running wave alone.
    if (wave.flights.length === 0 || reducedMotion()) return;
    setShown((s) => ({ id: (s?.id ?? 0) + 1, wave }));
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setShown(null);
    }, FLIGHT_MS + 100);
  }, [view]);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  return shown;
}

export function FlightBand(p: {
  readonly view: SpectatorView;
  readonly names: Readonly<Record<string, string>>;
}): ReactElement {
  const shown = useWave(p.view);
  const options = optionsOf(p.view.rules.allOption);
  return (
    <div className="mg-band" aria-hidden="true" data-testid="flight-band">
      {shown?.wave.flights.map((f) => (
        <span
          key={`${String(shown.id)}:${f.key}`}
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
      ))}
      {shown === null || shown.wave.more === 0 ? null : (
        <span className="mg-more">+{shown.wave.more}</span>
      )}
    </div>
  );
}
