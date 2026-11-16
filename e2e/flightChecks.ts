/**
 * @file   e2e/flightChecks.ts
 * @module e2e
 * @brief  Journey 44's measures of one Mind Games flight wave, run in the browser.
 *
 * Responsibility: the checks ./flightProbe runs in the page on each wave, at its moments and
 *                 against the step's feed lines: a name label as visible as its coin, whole,
 *                 above it, inside the band, centred (unless the band's edge is nearer than
 *                 half the label); at the landing a lone icon on its card's middle (±2 px),
 *                 several symmetric around it (unless a wave within 40 % of a flight lands
 *                 there too), no two landed icons overlapping by more than 20 %, All's icon
 *                 full size; by content against the feed lines near the wave, the nearest
 *                 first: a named icon has its player's line of its from → to, a group "×N" has
 *                 N such lines and no name, every single icon is named when the round's
 *                 switches are visible, only first choices when hidden; one icon per
 *                 from → to in a wave. Each
 *                 function is self-contained but for the others here, so ./flightProbe can
 *                 send them to the page as text. Problems are kept by check (`bad`).
 * Used by:        ./flightProbe
 * Spec:           docs/spec/02e-game-mind-games.md §11.1; docs/spec/09-testing-strategy.md §4
 *                 (journey 44)
 */

export interface Line {
  readonly text: string;
  readonly seen: number;
  used: boolean;
}

// The probe's state in the page.
export interface Probe {
  readonly ms: number;
  // The round's switches are visible: every move has its line.
  readonly visible: boolean;
  readonly out: {
    waves: number;
    flights: number;
    named: number;
    groups: number;
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

export const within = (a: DOMRect, b: DOMRect): boolean =>
  a.left >= b.left - 0.5 &&
  a.right <= b.right + 0.5 &&
  a.top >= b.top - 0.5 &&
  a.bottom <= b.bottom + 0.5;

// One label at one moment: as visible as its coin, whole, above it, inside, centred.
export function label(p: Probe, f: Element, band: DOMRect, t: number): void {
  const name = f.querySelector<HTMLElement>('.mg-flight-name');
  if (name === null) return;
  const text = `"${name.textContent}" at ${String(t)}`;
  const coin = Math.max(
    0,
    ...[...f.querySelectorAll('.mg-flight-from, .mg-flight-to')].map(opacity),
  );
  const seen = opacity(name);
  if (Math.abs(seen - coin) > 0.05)
    bad(p, 'label-with-coin', `${text}: label ${r1(seen)}, coin ${r1(coin)}`);
  if (name.scrollWidth > name.clientWidth) bad(p, 'label-clipped', text);
  const icon = f.querySelector('.mg-flight-to')?.getBoundingClientRect();
  if (icon === undefined || seen < 0.15 || !within(icon, band)) return;
  const box = name.getBoundingClientRect();
  if (!within(box, band))
    bad(
      p,
      'label-inside',
      `${text}: ${r1(box.left - band.left)}…${r1(box.right - band.left)} of ${r1(band.width)}`,
    );
  if (box.bottom > icon.top + 1) bad(p, 'label-above', text);
  const cx = icon.left + icon.width / 2;
  const off = box.left + box.width / 2 - cx;
  // Its room by its own width, not the landing's shrunken one: moved aside is right there.
  if (name.offsetWidth / 2 <= Math.min(cx - band.left, band.right - cx) - 3 && Math.abs(off) > 2)
    bad(p, 'label-centred', `${text}: ${r1(off)} px off its icon`);
}

// The landing points of one wave's icons per card, and All's size.
export function landings(p: Probe, wave: readonly Element[]): Map<string, number[]> {
  const columns = new Map<string, number[]>();
  for (const f of wave) {
    const box = f.querySelector('.mg-flight-to')?.getBoundingClientRect();
    if (box === undefined) continue;
    const to = f.getAttribute('data-to') ?? '';
    columns.set(to, [...(columns.get(to) ?? []), box.left + box.width / 2]);
    if (to === 'all' && box.width < 26) bad(p, 'all-size', `All's icon ${r1(box.width)} px`);
    for (const img of f.querySelectorAll('.mg-flight-to img')) {
      const w = img.getBoundingClientRect().width;
      if (w < 14) bad(p, 'all-size', `an icon ${r1(w)} px wide`);
    }
  }
  return columns;
}

// The share two boxes overlap, of the smaller one.
export function overlap(a: DOMRect, b: DOMRect): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? (w * h) / Math.min(a.width * a.height, b.width * b.height) : 0;
}

// The visible icons' boxes of a flight.
export function iconBoxes(f: Element): DOMRect[] {
  return [...f.querySelectorAll('.mg-flight-from, .mg-flight-to')]
    .filter((i) => opacity(i) > 0.15)
    .map((i) => i.getBoundingClientRect());
}

// The other waves' icons as they will be when this wave lands (80 % of its flight from now):
// those then near or at their own landing (60 % on), set to that moment, measured and put
// back; those gone by then are left out.
export function othersAtLanding(p: Probe, others: readonly Element[]): DOMRect[] {
  return others.flatMap((f) => {
    const anims = [f, ...f.querySelectorAll('*')].flatMap((e) => e.getAnimations());
    const now = Number(anims[0]?.currentTime ?? p.ms);
    const then = now + 0.8 * p.ms;
    if (then < 0.6 * p.ms || then >= p.ms) return [];
    const saved = anims.map((a) => [a, Number(a.currentTime ?? 0)] as const);
    for (const [a] of saved) a.currentTime = then;
    const boxes = iconBoxes(f);
    for (const [a, at] of saved) a.currentTime = at;
    return boxes;
  });
}

// The landing moment: centres on the cards (a card another wave started within 40 % of the
// flight lands in too may be shifted aside, 45 % for the moment the probe sees a wave start)
// and no icons over each other, this wave's or the others' at that moment.
export function landing(
  p: Probe,
  wave: readonly Element[],
  all: readonly Element[],
  t0: number,
): void {
  const others = all.filter((f) => !wave.includes(f));
  const near = others.filter((f) => Math.abs((p.born.get(f) ?? 0) - t0) < 0.45 * p.ms);
  for (const [to, xs] of landings(p, wave)) {
    const card = document.querySelector(`.mg-frame[data-choice="${to}"]`)?.getBoundingClientRect();
    if (card === undefined || near.some((f) => f.getAttribute('data-to') === to)) continue;
    const off = xs.reduce((a, b) => a + b, 0) / xs.length - (card.left + card.width / 2);
    if (Math.abs(off) > 2)
      bad(
        p,
        'landing-centre',
        `${String(xs.length)} into ${to}: ${r1(off)} px off the card's middle`,
      );
  }
  const boxes = [...wave.flatMap(iconBoxes), ...othersAtLanding(p, others)];
  boxes.forEach((a, i) => {
    for (const b of boxes.slice(i + 1)) {
      const share = overlap(a, b);
      if (share > 0.2)
        bad(p, 'overlap', `two landed icons overlap by ${String(Math.round(share * 100))} %`);
    }
  });
}

// An icon's from → to ("edge>summer" for a first choice), its count and its name.
export function iconOf(f: Element): { key: string; n: number; name: string | null } {
  const from = f.getAttribute('data-from') ?? '';
  const count = f.querySelector('.mg-flight-count')?.textContent ?? '';
  return {
    key: `${from === '' ? 'edge' : from}>${f.getAttribute('data-to') ?? ''}`,
    n: Number(/×(\d+)/.exec(count)?.[1] ?? 1),
    name: f.querySelector('.mg-flight-name')?.textContent ?? null,
  };
}

// Takes up to `n` of the unused lines of `key` (and of `who`, when given), those seen
// nearest the wave's moment `at` first; how many it took.
export function take(
  fresh: readonly Line[],
  at: number,
  want: { readonly key: string; readonly n: number; readonly who?: string },
): number {
  const { key, n, who } = want;
  const mine = fresh
    .filter(
      (l) =>
        !l.used &&
        l.text.endsWith(`|${key}`) &&
        (who === undefined || l.text.startsWith(`${who}|`)),
    )
    .sort((a, b) => Math.abs(a.seen - at) - Math.abs(b.seen - at));
  for (const l of mine.slice(0, n)) l.used = true;
  return Math.min(n, mine.length);
}

// One icon against the feed lines near its wave, by content: a named icon has a line of its
// player and from → to; a group "×N" has N lines of its from → to and no name; in a round
// with visible switches every single icon is named, with hidden ones only first choices.
export function named(
  p: Probe,
  icon: ReturnType<typeof iconOf>,
  fresh: readonly Line[],
  at: number,
): void {
  const { key, n, name } = icon;
  const first = key.startsWith('edge>');
  if (n >= 2) {
    if (name !== null) bad(p, 'names', `a group ${key} ×${String(n)} with a name`);
    const k = take(fresh, at, { key, n });
    if (p.visible && k < n)
      bad(
        p,
        'group-count',
        `${key} shows ×${String(n)}, only ${String(k)} lines near it: ${p.log
          .filter((l) => l.text.endsWith(`|${key}`))
          .map((l) => `${String(Math.round(l.seen - at))} ms${l.used ? ' used' : ''}`)
          .join(', ')}`,
      );
    return;
  }
  if (name === null) {
    if (p.visible || first) bad(p, 'names', `${key} flies without a name`);
    return;
  }
  if (!p.visible && !first) bad(p, 'names', `${key}, a hidden switch, flies with "${name}"`);
  if (take(fresh, at, { key, n: 1, who: name }) === 0)
    bad(
      p,
      'names',
      `"${name}" ${key} has no such line: ${p.log
        .filter((l) => l.text.startsWith(`${name}|`))
        .map(
          (l) =>
            `${l.text.split('|')[1] ?? ''} ${String(Math.round(l.seen - at))} ms${l.used ? ' used' : ''}`,
        )
        .join(', ')}`,
    );
}

// A wave's icons: each one's name and count, and one icon per from → to.
export function names(
  p: Probe,
  wave: readonly Element[],
  fresh: readonly Line[],
  at: number,
): void {
  const seen = new Map<string, number>();
  // Single icons first, so a group never takes a named one's line.
  const icons = wave.map(iconOf).sort((a, b) => a.n - b.n);
  for (const icon of icons) {
    p.out.flights += 1;
    p.out.groups += icon.n >= 2 ? 1 : 0;
    p.out.named += icon.name === null ? 0 : 1;
    named(p, icon, fresh, at);
    seen.set(icon.key, (seen.get(icon.key) ?? 0) + 1);
  }
  for (const [key, k] of seen)
    if (k > 1) bad(p, 'group-count', `${key} flies as ${String(k)} icons in one step`);
}
