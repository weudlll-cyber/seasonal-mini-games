/**
 * @file   e2e/flightLines.ts
 * @module e2e
 * @brief  Journey 44's pairing of a Mind Games flight wave with the feed's lines, in the browser.
 *
 * Responsibility: the name and group checks ./flightProbe runs on each wave a second after it
 *                 starts, against the feed lines shown near it, by content: a named flight has
 *                 its player's line of its from → to (also one a neighbouring wave's group or
 *                 nameless flight took first); a group "×N" has N such lines and no
 *                 name; a single flight is named only when its line is shown (a first choice,
 *                 or a switch with switches visible), never on the phone layout, and a lone one
 *                 whose name fits its card is named; one flight per from → to in a wave. Each
 *                 function is self-contained but for the others here and ./flightChecks', so
 *                 ./flightProbe can send them to the page as text.
 * Depends on:     ./flightChecks (types, bad, inner)
 * Used by:        ./flightProbe
 * Spec:           docs/spec/02e-game-mind-games.md §11.1; docs/spec/09-testing-strategy.md §4
 *                 (journey 44)
 */
import { bad, inner, type Line, type Probe } from './flightChecks.js';

// A flight's from → to ("edge>summer" for a first choice), its count and its name.
export function flightOf(f: Element): { key: string; n: number; name: string | null } {
  const from = f.getAttribute('data-from') ?? '';
  const count = f.querySelector('.mg-flight-count')?.textContent ?? '';
  return {
    key: `${from === '' ? 'edge' : from}>${f.getAttribute('data-to') ?? ''}`,
    n: Number(/×(\d+)/.exec(count)?.[1] ?? 1),
    name: f.querySelector('.mg-flight-name')?.textContent ?? null,
  };
}

// Takes up to `n` of the unused lines of `key` (and of `who`, when given), those seen nearest
// the wave's moment `at` first; the lines it took.
export function take(
  fresh: readonly Line[],
  at: number,
  want: { readonly key: string; readonly n: number; readonly who?: string },
): Line[] {
  const { key, n, who } = want;
  const mine = fresh
    .filter(
      (l) =>
        !l.used &&
        l.text.endsWith(`|${key}`) &&
        (who === undefined || l.text.startsWith(`${who}|`)),
    )
    .sort((a, b) => Math.abs(a.seen - at) - Math.abs(b.seen - at))
    .slice(0, n);
  for (const l of mine) l.used = true;
  return mine;
}

// Whether `who`'s name label, at full size, fits inside card `to`'s frame.
export function fits(who: string, to: string): boolean {
  const band = document.querySelector('.mg-band');
  const card = inner(to);
  if (band === null || card === null) return false;
  const probe = document.createElement('span');
  probe.className = 'mg-flight-name';
  probe.textContent = who;
  band.append(probe);
  const w = probe.getBoundingClientRect().width;
  probe.remove();
  return w <= card.right - card.left;
}

type One = ReturnType<typeof flightOf> & { readonly lone: boolean };

// A single flight without a name: with a line, its name had no room, which a lone flight's
// name always has where it fits its card.
export function nameless(p: Probe, one: One, fresh: readonly Line[], at: number): void {
  const line = take(fresh, at, { key: one.key, n: 1 })[0];
  if (line === undefined) return;
  p.out.dropped += 1;
  const who = line.text.split('|')[0] ?? '';
  if (one.lone && fits(who, one.key.split('>')[1] ?? ''))
    bad(p, 'names', `${one.key} flies alone without "${who}", whose name fits its card`);
}

// A named flight's own line among those near its wave: the player's own line counts even when a
// group or nameless flight of a neighbouring wave took it first, as those take the nearest
// lines of their path, whoever wrote them (journey 44's flake into All, found by the log of
// that path, BACKLOG "Flaky tests"); else the problem names that path's lines within 3 s.
export function ownLine(
  p: Probe,
  flight: { readonly key: string; readonly name: string },
  fresh: readonly Line[],
  at: number,
): void {
  const { key, name } = flight;
  if (take(fresh, at, { key, n: 1, who: name }).length > 0) return;
  if (fresh.some((l) => l.text === `${name}|${key}`)) return;
  const near = p.log
    .filter((l) => l.text.endsWith(`|${key}`) && Math.abs(l.seen - at) <= 3_000)
    .map(
      (l) => `${l.text.split('|')[0] ?? ''}@${String(Math.round(l.seen - at))}${l.used ? '*' : ''}`,
    );
  bad(p, 'names', `"${name}" ${key} has no such line; near: ${near.join(' ') || 'none'}`);
}

// One flight against the feed lines near its wave, by content; `lone`: the only one into its
// card in this wave.
export function named(p: Probe, one: One, fresh: readonly Line[], at: number): void {
  const { key, n, name } = one;
  if (n >= 2) {
    if (name !== null) bad(p, 'names', `a group ${key} ×${String(n)} with a name`);
    const k = take(fresh, at, { key, n }).length;
    if (p.visible && k < n)
      bad(p, 'groups', `${key} shows ×${String(n)}, only ${String(k)} lines near it`);
    return;
  }
  const lined = !p.phone && (p.visible || key.startsWith('edge>'));
  if (name === null) {
    if (lined) nameless(p, one, fresh, at);
    return;
  }
  if (!lined) bad(p, 'names', `${key} flies with "${name}"`);
  ownLine(p, { key, name }, fresh, at);
}

// A wave's flights: each one's name and count, and one flight per from → to.
export function names(
  p: Probe,
  wave: readonly Element[],
  fresh: readonly Line[],
  at: number,
): void {
  const seen = new Map<string, number>();
  const flights = wave.filter((f) => f.classList.contains('mg-flight'));
  const into = (to: string | null) => flights.filter((f) => f.getAttribute('data-to') === to);
  // Single flights first, so a group never takes a named one's line.
  const ones = flights
    .map((f) => ({ ...flightOf(f), lone: into(f.getAttribute('data-to')).length === 1 }))
    .sort((a, b) => a.n - b.n);
  for (const one of ones) {
    p.out.flights += 1;
    p.out.groups += one.n >= 2 ? 1 : 0;
    p.out.named += one.name === null ? 0 : 1;
    named(p, one, fresh, at);
    seen.set(one.key, (seen.get(one.key) ?? 0) + 1);
  }
  for (const [key, k] of seen)
    if (k > 1) bad(p, 'groups', `${key} flies as ${String(k)} flights in one step`);
}
