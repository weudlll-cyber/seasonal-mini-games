/**
 * @file   e2e/flightChecks.ts
 * @module e2e
 * @brief  Journey 44's measures of one Mind Games flight wave, run in the browser.
 *
 * Responsibility: the checks ./flightProbe runs in the page on each wave (02e §11.1 points
 *                 2–7). At each moment of the flight: the coin turns over without going faint
 *                 and from 40 % on shows only the new season; a name label is as visible as its
 *                 coin, whole, above it and centred on it. At the landing: a lone coin on its
 *                 card's middle (±2 px), several symmetric around it, no two overlapping by more
 *                 than a fifth, none under 82 % of its size; every coin, label and "+N" inside
 *                 its card's frame. Standing: the coin where it landed, whole. Against the
 *                 step's feed lines, by content: a named flight has its player's line of its
 *                 from → to; a group "×N" has N such lines and no name; a single flight is named
 *                 only when its line is shown (a first choice, or a switch with switches
 *                 visible), never on the phone layout, and a lone one whose name fits its card
 *                 is named; one flight per from → to in a wave. Each function is self-contained
 *                 but for the others here, so ./flightProbe can send them to the page as text.
 * Used by:        ./flightProbe
 * Spec:           docs/spec/02e-game-mind-games.md §11.1; docs/spec/09-testing-strategy.md §4
 *                 (journey 44)
 */

export interface Line {
  readonly text: string;
  readonly seen: number;
  used: boolean;
}

// A flight's fixed times in ms (games/mind-games/web/flights.ts FADE_MS, GONE_MS); its flight
// and stand are its wave's own, shortened near the round's end (`own`).
export interface Times {
  readonly fade: number;
  readonly gone: number;
}

// An element's own flight and the end of its stand, from its CSS times.
export function own(e: Element): { readonly fly: number; readonly standEnd: number } {
  const style = (e as HTMLElement).style;
  return {
    fly: parseFloat(style.getPropertyValue('--mg-fly')),
    standEnd: parseFloat(style.getPropertyValue('--mg-fade-at')),
  };
}

// The probe's state in the page.
export interface Probe {
  readonly times: Times;
  // The round's switches are visible: every move has its line.
  readonly visible: boolean;
  // The phone layout: no flight has a name.
  readonly phone: boolean;
  readonly out: {
    waves: number;
    flights: number;
    named: number;
    // Single flights with a line but no name: their name had no room in the card.
    dropped: number;
    groups: number;
    // Coins still standing where a newer one landed: each must have faded at once.
    replaced: number;
    problems: Record<string, string[]>;
  };
  readonly born: Map<Element, number>;
  readonly log: Line[];
  lines: string[];
}

export function bad(p: Probe, check: string, msg: string): void {
  const list = (p.out.problems[check] ??= []);
  if (list.length < 12) list.push(msg);
  else if (list.length === 12) list.push('…');
}

export const r1 = (n: number): string => n.toFixed(1);

// What shows of an element: its opacity times its ancestors' up to the band.
export function opacity(e: Element | null): number {
  if (e === null) return 0;
  let o = 1;
  for (
    let n: Element | null = e;
    n !== null && !n.classList.contains('mg-band');
    n = n.parentElement
  )
    o *= Number(getComputedStyle(n).opacity);
  return o;
}

// One flight at one moment: its coin's faces (their own opacity, not the flight's fade).
export function coin(p: Probe, f: Element, t: number): void {
  const own = (sel: string) => {
    const e = f.querySelector(sel);
    return e === null ? 0 : Number(getComputedStyle(e).opacity);
  };
  const old = own('.mg-flight-from');
  if (Math.max(old, own('.mg-flight-to')) < 0.95) bad(p, 'coin', `a faint coin at ${String(t)}`);
  if (t >= 0.4 && old > 0) bad(p, 'coin', `the old face shows at ${String(t)}`);
}

// One flight's label (its name or its "×N") at one moment, against its coin.
export function label(p: Probe, f: Element, t: number): void {
  const name = f.querySelector<HTMLElement>('.mg-flight-name, .mg-flight-count');
  if (name === null) return;
  const text = `"${name.textContent}" at ${String(t)}`;
  // The coin shows whichever face is turned up: the old one in its first quarter.
  const seen = Math.max(...[...f.querySelectorAll('.mg-flight-from, .mg-flight-to')].map(opacity));
  if (Math.abs(opacity(name) - seen) > 0.05) bad(p, 'label', `${text}: not as visible as its coin`);
  if (name.scrollWidth > name.clientWidth) bad(p, 'label', `${text}: cut`);
  const icon = f.querySelector('.mg-flight-to')?.getBoundingClientRect();
  const box = name.getBoundingClientRect();
  if (icon === undefined) return;
  if (box.bottom > icon.top + 1) bad(p, 'label', `${text}: not above its coin`);
  const off = box.left + box.width / 2 - (icon.left + icon.width / 2);
  if (Math.abs(off) > 2) bad(p, 'label', `${text}: ${r1(off)} px off its coin`);
}

// The share two boxes overlap, of the smaller one.
export function overlap(a: DOMRect, b: DOMRect): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? (w * h) / Math.min(a.width * a.height, b.width * b.height) : 0;
}

// A card's frame inside its border: its left and right edge on the page.
export function inner(to: string): { left: number; right: number } | null {
  const frame = document.querySelector<HTMLElement>(`.mg-frame[data-choice="${to}"]`);
  if (frame === null) return null;
  const left = frame.getBoundingClientRect().left + frame.clientLeft;
  return { left, right: left + frame.clientWidth };
}

// Every part of a landed wave inside its card's frame: coins, labels and "+N".
export function inside(p: Probe, wave: readonly Element[]): void {
  for (const f of wave) {
    const to = f.getAttribute('data-to') ?? '';
    const card = inner(to);
    if (card === null) continue;
    const parts = f.classList.contains('mg-more')
      ? [f]
      : [...f.querySelectorAll('.mg-flight-to, .mg-flight-name, .mg-flight-count')];
    for (const e of parts) {
      const b = e.getBoundingClientRect();
      if (b.left < card.left - 0.5 || b.right > card.right + 0.5)
        bad(p, 'inside', `${e.className} "${e.textContent}" into ${to} crosses its card's frame`);
    }
  }
}

// One card's landed slots: their centres around its middle, no two over each other by more
// than a fifth.
export function slotsIn(p: Probe, to: string, boxes: readonly DOMRect[]): void {
  const card = document.querySelector(`.mg-frame[data-choice="${to}"]`)?.getBoundingClientRect();
  if (card === undefined) return;
  const xs = boxes.map((b) => b.left + b.width / 2);
  const off = xs.reduce((a, b) => a + b, 0) / xs.length - (card.left + card.width / 2);
  if (Math.abs(off) > 2)
    bad(p, 'landing', `${String(xs.length)} into ${to}: ${r1(off)} px off the card's middle`);
  boxes.forEach((a, i) => {
    for (const b of boxes.slice(i + 1)) {
      const o = overlap(a, b);
      if (o > 0.2) bad(p, 'landing', `two into ${to} overlap by ${String(Math.round(o * 100))} %`);
    }
  });
}

// The landing moment: per card its slots (coins and "+N"), the coins' size, all inside.
export function landing(p: Probe, wave: readonly Element[]): void {
  const cards = new Map<string, DOMRect[]>();
  for (const f of wave) {
    const more = f.classList.contains('mg-more');
    const box = (more ? f : f.querySelector('.mg-flight-to'))?.getBoundingClientRect();
    if (box === undefined) continue;
    const to = f.getAttribute('data-to') ?? '';
    cards.set(to, [...(cards.get(to) ?? []), box]);
    const full = to === 'all' ? 36 : 26;
    if (!more && box.width < 0.82 * full - 0.5)
      bad(p, 'size', `a coin into ${to} ${r1(box.width)} px`);
  }
  for (const [to, boxes] of cards) slotsIn(p, to, boxes);
  inside(p, wave);
}

// Standing: each coin where it landed, whole and fully shown.
export function standing(p: Probe, landed: ReadonlyMap<Element, DOMRect>): void {
  for (const [f, was] of landed) {
    const now = f.querySelector('.mg-flight-to')?.getBoundingClientRect();
    if (now === undefined) continue;
    const moved = Math.abs(now.left - was.left) + Math.abs(now.top - was.top);
    if (moved > 0.5 || Math.abs(now.width - was.width) > 0.5 || opacity(f) < 0.99)
      bad(p, 'standing', `a coin into ${f.getAttribute('data-to') ?? ''} moved or faded`);
  }
}

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
  if (take(fresh, at, { key, n: 1, who: name }).length === 0)
    bad(p, 'names', `"${name}" ${key} has no such line`);
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
