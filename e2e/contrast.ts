/**
 * @file   e2e/contrast.ts
 * @module e2e
 * @brief  The contrast of every text on the screen, measured on the rendered pixels.
 *
 * Responsibility: the page's backgrounds are translucent cards over soft gradients, which
 *                 axe cannot judge (it leaves such text "incomplete"). So for every visible
 *                 text — text nodes, typed values and placeholders — the text colour is read
 *                 from the page (its alpha times the opacity of its ancestors; text covered by
 *                 an open menu is left out), then all text
 *                 is made transparent, the window is captured, and the colour behind each
 *                 line of text is the median pixel of that line's box. The ratio is WCAG's
 *                 (relative luminance, 2.x). The screenshot is decoded on a canvas in the
 *                 page itself, so no image library is needed. Transitions are held still
 *                 while measuring.
 * Depends on:     @playwright/test, ./screens
 * Used by:        ./range.spec, ./specials.spec
 * Spec:           docs/spec/02-game-guess-the-number.md §12; WCAG 2.2 SC 1.4.3
 */
import { expect, type Page } from '@playwright/test';

import { setTheme } from './screens.js';

interface TextBox {
  readonly text: string;
  readonly where: string;
  // The text colour as [r, g, b, a] with a already times the ancestors' opacity.
  readonly color: readonly [number, number, number, number];
  readonly boxes: readonly { x: number; y: number; w: number; h: number }[];
}

interface Measured extends TextBox {
  readonly ratio: number;
  readonly background: string;
}

const CLEAR = `*, *::before, *::after, ::placeholder {
  color: transparent !important; -webkit-text-fill-color: transparent !important;
  text-shadow: none !important; caret-color: transparent !important;
  transition: none !important; animation: none !important; }`;

// Runs in the page: every visible text with its colour and its line boxes.
function collect(): TextBox[] {
  const rgba = (css: string): [number, number, number, number] => {
    const n = (/rgba?\(([^)]+)\)/.exec(css)?.[1] ?? '0 0 0').split(/[\s,/]+/).map(Number);
    return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n[3] ?? 1];
  };
  const opacity = (el: Element | null): number =>
    el === null ? 1 : Number(getComputedStyle(el).opacity) * opacity(el.parentElement);
  const where = (el: Element): string => {
    const tagged = el.closest('[data-testid]');
    return `${el.tagName.toLowerCase()}${tagged === null ? '' : ` in ${tagged.getAttribute('data-testid') ?? ''}`}`;
  };
  const shown = (r: DOMRect): boolean =>
    r.width >= 2 && r.height >= 2 && r.bottom > 0 && r.top < innerHeight;
  const box = (r: DOMRect) => ({ x: r.x, y: r.y, w: r.width, h: r.height });
  // Text under an open menu is not on the screen: the top element at the line's middle must
  // be the text's own element, inside it, or around it.
  const onTop = (el: Element, r: DOMRect): boolean => {
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return hit === null || el.contains(hit) || hit.contains(el);
  };
  const fromText = (node: Node): TextBox | null => {
    const el = node.parentElement;
    const text = node.textContent?.trim() ?? '';
    if (el === null || text === '' || el.closest('script, style, option') !== null) return null;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = [...range.getClientRects()].filter((r) => shown(r) && onTop(el, r));
    if (rects.length === 0 || getComputedStyle(el).visibility !== 'visible') return null;
    const [r, g, b, a] = rgba(getComputedStyle(el).color);
    const color: TextBox['color'] = [r, g, b, a * opacity(el)];
    return { text: text.slice(0, 60), where: where(el), color, boxes: rects.map(box) };
  };
  // A typed value, or the placeholder while the field is empty.
  const fromInput = (input: HTMLInputElement): TextBox | null => {
    const rect = input.getBoundingClientRect();
    const text = input.value === '' ? input.placeholder : input.value;
    if (text === '' || ['checkbox', 'radio'].includes(input.type)) return null;
    if (!shown(rect) || !onTop(input, rect)) return null;
    const style = getComputedStyle(input, input.value === '' ? '::placeholder' : null);
    const [r, g, b, a] = rgba(style.color);
    return { text, where: where(input), color: [r, g, b, a * opacity(input)], boxes: [box(rect)] };
  };
  const found: (TextBox | null)[] = [...document.querySelectorAll('input')].map(fromInput);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    found.push(fromText(node));
  }
  return found.filter((t): t is TextBox => t !== null);
}

// Runs in the page: decodes the capture and measures every box against its median pixel.
async function measure(args: { png: string; items: TextBox[] }): Promise<Measured[]> {
  const img = new Image();
  img.src = `data:image/png;base64,${args.png}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx === null) throw new Error('no 2d canvas');
  ctx.drawImage(img, 0, 0);
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = (p: readonly number[]): number =>
    0.2126 * lin(p[0] ?? 0) + 0.7152 * lin(p[1] ?? 0) + 0.0722 * lin(p[2] ?? 0);
  return args.items.map((item) => {
    const pixels: number[][] = [];
    for (const b of item.boxes) {
      const x = Math.max(0, Math.floor(b.x));
      const y = Math.max(0, Math.floor(b.y));
      const w = Math.max(1, Math.min(img.width - x, Math.ceil(b.w)));
      const h = Math.max(1, Math.min(img.height - y, Math.ceil(b.h)));
      const data = ctx.getImageData(x, y, w, h).data;
      for (let i = 0; i < data.length; i += 4)
        pixels.push([data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]);
    }
    pixels.sort((p, q) => lum(p) - lum(q));
    const bg = pixels[Math.floor(pixels.length / 2)] ?? [255, 255, 255];
    const [r, g, b, a] = item.color;
    const fg = [r, g, b].map((c, i) => a * c + (1 - a) * (bg[i] ?? 0));
    const [hi, lo] = [lum(fg), lum(bg)].sort((p, q) => q - p);
    return {
      ...item,
      ratio: ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05),
      background: `rgb(${bg.join(' ')})`,
    };
  });
}

// Every text on the window with its contrast.
async function measureContrast(page: Page): Promise<Measured[]> {
  const items = await page.evaluate(collect);
  const clear = await page.addStyleTag({ content: CLEAR });
  // Two frames, so the cleared text is painted before the capture.
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  const png = (await page.screenshot({ scale: 'css', animations: 'disabled' })).toString('base64');
  await clear.evaluate((el) => {
    el.parentNode?.removeChild(el);
  });
  return page.evaluate(measure, { png, items });
}

async function failures(page: Page): Promise<string[]> {
  return (await measureContrast(page))
    .filter((m) => m.ratio < 4.5)
    .map((m) => `${m.ratio.toFixed(2)}:1 "${m.text}" (${m.where}) on ${m.background}`);
}

// Every text on the window keeps 4.5:1 in the given themes (the owner's rule for the round
// view, night run 2); the page's theme is put back afterwards.
export async function readable(
  page: Page,
  where: string,
  themes: readonly ('light' | 'dark')[] = ['light', 'dark'],
): Promise<void> {
  const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  for (const theme of themes) {
    await setTheme(page, theme);
    expect(await failures(page), `text below 4.5:1 on the ${where}, ${theme}`).toEqual([]);
  }
  await setTheme(page, before ?? 'light');
}
