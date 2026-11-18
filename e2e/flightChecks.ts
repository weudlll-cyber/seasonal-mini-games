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
 *                 its card's frame, every label clear of the card's button above the band.
 *                 Standing: the coin where it landed, whole. The pairing with the feed's lines
 *                 is ./flightLines'. Each function is self-contained but for the others here, so
 *                 ./flightProbe can send them to the page as text.
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

// A label (a name or a "×N") stands clear of the card's button and its "✓ Your choice" above
// the band: 2 px or more below the band's top.
export function clear(p: Probe, f: Element, to: string): void {
  const top = f.closest('.mg-band')?.getBoundingClientRect().top ?? -Infinity;
  for (const e of f.querySelectorAll('.mg-flight-name, .mg-flight-count'))
    if (e.getBoundingClientRect().top < top + 2)
      bad(p, 'inside', `"${e.textContent}" into ${to} touches the card's button`);
}

// Every part of a landed wave inside its card's frame: coins, labels and "+N".
export function inside(p: Probe, wave: readonly Element[]): void {
  for (const f of wave) {
    const to = f.getAttribute('data-to') ?? '';
    const card = inner(to);
    if (card === null) continue;
    clear(p, f, to);
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
