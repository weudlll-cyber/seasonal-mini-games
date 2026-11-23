/**
 * @file   e2e/flightProbe.ts
 * @module e2e
 * @brief  Journey 44's probe: every Mind Games flight wave measured in the browser as it starts.
 *
 * Responsibility: installed in a page before the round (`probeScript`: its functions and
 *                 ./flightChecks' and ./flightLines' as one script), it watches the flight
 *                 band. When a wave starts (flights added in one render) it sets the wave's
 *                 animations to chosen moments of the flight, runs ./flightChecks' coin and
 *                 label checks at each, the landing checks at its end and the standing check
 *                 during the stand, and puts the animations back, so the wave plays on
 *                 unchanged. A second later it hands the wave the feed lines that showed within
 *                 PAIR_MS of it (the list renders apart from the band) for ./flightLines' name
 *                 and group checks. When the wave lands, an earlier coin still standing in one
 *                 of its cards must have faded at once. A flight removed before its life's end,
 *                 or still in the band after it (by the page's own timers), is a problem too.
 *                 Problems by check in window.__flightProbe.
 * Used by:        ./mindGamesFlights.spec
 * Spec:           docs/spec/02e-game-mind-games.md §11.1; docs/spec/09-testing-strategy.md §4
 *                 (journey 44)
 */
import {
  bad,
  clear,
  coin,
  inner,
  inside,
  label,
  landing,
  opacity,
  overlap,
  r1,
  slotsIn,
  standing,
  own,
  type Probe,
  type Times,
} from './flightChecks.js';
import { fits, flightOf, named, nameless, names, ownLine, take } from './flightLines.js';

export interface ProbeResult {
  readonly waves: number;
  readonly flights: number;
  readonly named: number;
  readonly dropped: number;
  readonly groups: number;
  readonly replaced: number;
  readonly problems: Readonly<Record<string, readonly string[]>>;
}

// Moments of the flight, as shares of it.
const MOMENTS = [0.05, 0.2, 0.3, 0.5, 0.65, 0.9];
const PAIR_MS = 1_000;
// The platform's phone layout (games/mind-games/web/FlightBand PHONE).
const PHONE = '(max-width: 899px), (orientation: portrait)';
const keyOf = (name: string): string => name.toLowerCase();

// The feed's lines as "who|from>to" ("edge>to" for a first choice), one entry per line.
function linesNow(): string[] {
  return [...document.querySelectorAll('[data-testid="guess-list"] li')].flatMap((li) => {
    const m = /(chose|switched) (\w+)(?: → (\w+))?/.exec(
      li.querySelector('.round-value')?.textContent ?? '',
    );
    if (m === null) return [];
    const key =
      m[1] === 'chose' ? `edge>${keyOf(m[2] ?? '')}` : `${keyOf(m[2] ?? '')}>${keyOf(m[3] ?? '')}`;
    return [`${li.querySelector('.round-who')?.textContent ?? ''}|${key}`];
  });
}

// The lines `now` shows on top of `before`: the list is newest first and drops its oldest
// past the feed's 60, so the new ones are the head before `before` continues (compared by
// place, not by text: a bot's repeat of an old switch reads the same as the line it pushes out).
function added(before: readonly string[], now: readonly string[]): string[] {
  for (let i = 0; i <= now.length; i += 1) {
    const rest = now.slice(i);
    if (rest.every((l, j) => l === before[j])) return now.slice(0, i);
  }
  return [...now];
}

// Nothing of a flight is left after its life: judged on the page's own timers, a task after
// one due 0.2 s past it, so a page held up (by this probe's measuring among others) delays
// the check just as it delays the band's own removal (measured unprobed: 2.40–2.44 s).
function overstay(p: Probe, f: Element): void {
  const life = own(f).standEnd + p.times.fade;
  window.setTimeout(() => {
    window.setTimeout(() => {
      if (f.isConnected)
        bad(p, 'leftover', `a flight still in the band after its ${String(life)} ms`);
    }, 0);
  }, life + 200);
}

// A new wave at its moments, its landing and its stand, then back where it was.
function measure(p: Probe, wave: readonly Element[]): void {
  const t0 = performance.now();
  for (const f of wave) {
    p.born.set(f, t0);
    overstay(p, f);
  }
  const flights = wave.filter((f) => f.classList.contains('mg-flight'));
  const saved = wave
    .flatMap((f) => [f, ...f.querySelectorAll('*')].flatMap((e) => e.getAnimations()))
    .map((a) => [a, Number(a.currentTime ?? 0)] as const);
  const set = (ms: number) => {
    for (const [a] of saved) a.currentTime = ms;
  };
  const { fly, standEnd } = own(wave[0] ?? document.body);
  // A coin that appears at its landing (no flight) is looked at only there.
  for (const t of fly > 0 ? [...MOMENTS, 1] : [1]) {
    set(t * fly);
    for (const f of flights) {
      coin(p, f, t);
      label(p, f, t);
    }
  }
  landing(p, wave);
  const landed = new Map(
    flights.flatMap((f) => {
      const box = f.querySelector('.mg-flight-to')?.getBoundingClientRect();
      return box === undefined ? [] : [[f, box] as const];
    }),
  );
  set(fly + 0.8 * (standEnd - fly));
  standing(p, landed);
  const spent = performance.now() - t0;
  for (const [a, at] of saved) a.currentTime = at + spent;
}

// As a wave born at `at` lands: earlier coins still standing in its cards have faded at once.
function replaced(p: Probe, wave: readonly Element[], at: number): void {
  const lands = at + own(wave[0] ?? document.body).fly;
  const cards = new Set(wave.map((f) => f.getAttribute('data-to')));
  for (const [f, t] of p.born) {
    const age = lands - t;
    const { fly, standEnd } = own(f);
    if (t >= at || !cards.has(f.getAttribute('data-to'))) continue;
    if (age < fly + 50 || age > standEnd - 50) continue;
    p.out.replaced += 1;
    if (opacity(f) > 0.05)
      bad(p, 'standing', `a coin into ${f.getAttribute('data-to') ?? ''} stays beside a newer one`);
  }
}

// The flights a render removed, none before its life's end; the flights it added.
function removed(p: Probe, records: readonly MutationRecord[]): Element[] {
  const wave: Element[] = [];
  for (const r of records) {
    for (const n of r.addedNodes)
      if (n instanceof Element && ['mg-flight', 'mg-more'].some((c) => n.classList.contains(c)))
        wave.push(n);
    for (const n of r.removedNodes) {
      if (!(n instanceof Element) || !p.born.has(n)) continue;
      const lived = performance.now() - (p.born.get(n) ?? 0);
      if (lived < own(n).standEnd + p.times.fade - 30)
        bad(p, 'leftover', `a flight removed after ${String(Math.round(lived))} ms`);
      p.born.delete(n);
    }
  }
  return wave;
}

// One render's records: flights removed (never early), lines seen, a wave started.
function onRender(p: Probe, records: readonly MutationRecord[]): void {
  const wave = removed(p, records);
  const now = linesNow();
  const at = performance.now();
  for (const text of added(p.lines, now)) p.log.push({ text, seen: at, used: false });
  p.lines = now;
  if (wave.length === 0) return;
  p.out.waves += 1;
  measure(p, wave);
  window.setTimeout(() => {
    names(
      p,
      wave,
      p.log.filter((l) => Math.abs(l.seen - at) <= PAIR_MS),
      at,
    );
  }, PAIR_MS + 10);
  window.setTimeout(
    () => {
      replaced(p, wave, at);
    },
    own(wave[0] ?? document.body).fly + p.times.gone + 80,
  );
}

function install(times: Times, visible: boolean): void {
  const p: Probe = {
    times,
    visible,
    phone: window.matchMedia(PHONE).matches,
    out: { waves: 0, flights: 0, named: 0, dropped: 0, groups: 0, replaced: 0, problems: {} },
    born: new Map(),
    log: [],
    lines: linesNow(),
  };
  new MutationObserver((records) => {
    onRender(p, records);
  }).observe(document.body, { childList: true, subtree: true });
  (window as unknown as { __flightProbe: Probe['out'] }).__flightProbe = p.out;
}

// The probe as one script for page.evaluate: its constants and functions, then the install.
export function probeScript(times: Times, visible: boolean): string {
  const parts = [
    own,
    bad,
    linesNow,
    added,
    opacity,
    coin,
    label,
    overlap,
    inner,
    clear,
    inside,
    slotsIn,
    landing,
    standing,
    flightOf,
    take,
    fits,
    nameless,
    ownLine,
    named,
  ];
  return [
    '(() => {',
    `const MOMENTS = ${JSON.stringify(MOMENTS)}, PAIR_MS = ${String(PAIR_MS)};`,
    `const PHONE = ${JSON.stringify(PHONE)};`,
    `const r1 = ${r1.toString()}, keyOf = ${keyOf.toString()};`,
    ...[...parts, names, overstay, measure, replaced, removed, onRender, install].map((f) =>
      f.toString(),
    ),
    `install(${JSON.stringify(times)}, ${String(visible)});`,
    '})();',
  ].join('\n');
}
