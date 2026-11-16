/**
 * @file   e2e/flightProbe.ts
 * @module e2e
 * @brief  Journey 44's probe: every Mind Games flight wave measured in the browser as it starts.
 *
 * Responsibility: installed in a page before the round (`probeScript`: its functions and
 *                 ./flightChecks' as one script, each self-contained but for one another), it
 *                 watches the flight band. When a wave starts (flights added in one render) it
 *                 sets the wave's animations to chosen moments of the flight, runs
 *                 ./flightChecks' label checks at each and the landing checks at 80 %, and puts
 *                 the animations back where they were, so the wave plays on unchanged. It
 *                 hands each wave, a second later, the feed lines that showed within PAIR_MS
 *                 of it (the list is the platform's and renders apart from the band, at times
 *                 hundreds of ms later) for the name and group checks, which match by content; a flight removed before FLIGHT_MS, or still in the band after
 *                 it, is a problem too. Problems by check in window.__flightProbe.
 * Used by:        ./mindGamesFlights.spec
 * Spec:           docs/spec/02e-game-mind-games.md §11.1; docs/spec/09-testing-strategy.md §4
 *                 (journey 44)
 */
import {
  bad,
  iconOf,
  label,
  landing,
  landings,
  named,
  names,
  take,
  opacity,
  overlap,
  r1,
  within,
  type Probe,
} from './flightChecks.js';

export interface ProbeResult {
  readonly waves: number;
  readonly flights: number;
  readonly named: number;
  readonly groups: number;
  readonly problems: Readonly<Record<string, readonly string[]>>;
}

const MOMENTS = [0.05, 0.2, 0.3, 0.5, 0.65, 0.8, 0.9, 0.97];
const LAND = 0.8;
const PAIR_MS = 1_000;
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
// past the feed's 60, so the new ones are the head before `before` continues (a bot's repeat
// of an old switch reads the same as the line it pushes out: compared by place, not by text).
function added(before: readonly string[], now: readonly string[]): string[] {
  for (let i = 0; i <= now.length; i += 1) {
    const rest = now.slice(i);
    if (rest.every((l, j) => l === before[j])) return now.slice(0, i);
  }
  return [...now];
}

// A new wave at its moments, then back where it was.
function measure(p: Probe, wave: readonly Element[]): void {
  const band = document.querySelector('[data-testid="flight-band"]');
  if (band === null) return;
  const t0 = performance.now();
  for (const f of wave) p.born.set(f, t0);
  const all = [...band.querySelectorAll('.mg-flight')];
  const saved = wave
    .flatMap((f) => [f, ...f.querySelectorAll('*')].flatMap((e) => e.getAnimations()))
    .map((a) => [a, Number(a.currentTime ?? 0)] as const);
  const rect = band.getBoundingClientRect();
  for (const t of MOMENTS) {
    for (const [a] of saved) a.currentTime = t * p.ms;
    for (const f of wave) label(p, f, rect, t);
    if (t === LAND) landing(p, wave, all, t0);
  }
  const spent = performance.now() - t0;
  for (const [a, at] of saved) a.currentTime = at + spent;
}

// One render's records: flights removed (never early), lines seen, a wave started.
function onRender(p: Probe, records: readonly MutationRecord[]): void {
  const wave: Element[] = [];
  for (const r of records) {
    for (const n of r.addedNodes)
      if (n instanceof Element && n.classList.contains('mg-flight')) wave.push(n);
    for (const n of r.removedNodes) {
      if (!(n instanceof Element) || !p.born.has(n)) continue;
      const life = performance.now() - (p.born.get(n) ?? 0);
      if (life < p.ms - 30)
        bad(p, 'leftover', `a flight removed after ${String(Math.round(life))} ms`);
      p.born.delete(n);
    }
  }
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
}

function install(ms: number, visible: boolean): void {
  const p: Probe = {
    ms,
    visible,
    out: { waves: 0, flights: 0, named: 0, groups: 0, problems: {} },
    born: new Map(),
    log: [],
    lines: linesNow(),
  };
  new MutationObserver((records) => {
    onRender(p, records);
  }).observe(document.body, { childList: true, subtree: true });
  // Nothing of a wave is left in the band after FLIGHT_MS (and a little room for the timer).
  window.setInterval(() => {
    for (const [f, t] of p.born)
      if (performance.now() - t > ms + 400) {
        bad(
          p,
          'leftover',
          `a flight still in the band ${String(Math.round(performance.now() - t))} ms after its start`,
        );
        p.born.delete(f);
      }
  }, 200);
  (window as unknown as { __flightProbe: Probe['out'] }).__flightProbe = p.out;
}

// The probe as one script for page.evaluate: its constants and functions, then the install.
export function probeScript(flightMs: number, visible: boolean): string {
  const parts = [
    bad,
    linesNow,
    added,
    opacity,
    label,
    landings,
    overlap,
    landing,
    iconOf,
    take,
    named,
    names,
    measure,
    onRender,
    install,
  ];
  return [
    '(() => {',
    `const MOMENTS = ${JSON.stringify(MOMENTS)}, LAND = ${String(LAND)}, PAIR_MS = ${String(PAIR_MS)};`,
    `const r1 = ${r1.toString()}, keyOf = ${keyOf.toString()}, within = ${within.toString()};`,
    ...parts.map((f) => f.toString()),
    `install(${String(flightMs)}, ${String(visible)});`,
    '})();',
  ].join('\n');
}
