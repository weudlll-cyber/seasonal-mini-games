/**
 * @file   apps/web/src/ownRowTint.test.ts
 * @module web
 * @brief  A row's text keeps 4.5:1 on the viewer's own-row tint of each season colour (T261).
 *
 * Responsibility: the tint is a colour the page mixes (`color-mix` of the season colour into
 *                 `--color-own-base`, `--own-tint` of it), laid on the panel's card over the
 *                 page; the kit's token guard (./designTokens.test) checks named colours only,
 *                 so the mix is made here, from the same stylesheets.
 * Depends on:     vitest, @seasonal/kit/tokens.css, @smg/ui/tokens.css (raw)
 * Spec:           docs/DECISIONS.md T261; WCAG 2.2 SC 1.4.3
 */
import kitCss from '@seasonal/kit/tokens.css?raw';
import gameCss from '@smg/ui/tokens.css?raw';
import { describe, expect, it } from 'vitest';

type Rgba = readonly [number, number, number, number];
const SELECTORS = { light: [':root'], dark: [':root', ":root[data-theme='dark']"] } as const;
// The text of a row: names and comments, Frost's held answer, "higher", "lower" and "Boom!".
const ROW_TEXT = [
  '--sk-color-text',
  '--sk-color-text-muted',
  '--color-winter-text',
  '--color-success-text',
  '--sk-color-danger',
];

// The custom properties of a theme, the kit's and then the game's, a later value winning.
function tokensOf(theme: keyof typeof SELECTORS): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const selector of SELECTORS[theme]) {
    for (const file of [kitCss, gameCss]) {
      const start = file.indexOf(`${selector} {`);
      const block = start < 0 ? '' : file.slice(start, file.indexOf('\n}', start));
      for (const m of block.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
        tokens.set(m[1] ?? '', m[2] ?? '');
      }
    }
  }
  return tokens;
}

// A token's colour (#rrggbb or rgb(r g b / a%)), following `var(--other)`.
function colour(tokens: Map<string, string>, name: string): Rgba {
  const value = tokens.get(name) ?? '';
  const ref = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
  if (ref !== undefined) return colour(tokens, ref);
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    const at = (i: number): number => parseInt(value.slice(i, i + 2), 16);
    return [at(1), at(3), at(5), 1];
  }
  const m = /^rgb\((\d+) (\d+) (\d+)(?: \/ (\d+)%)?\)$/.exec(value);
  if (m === null) throw new Error(`no colour in the token ${name}`);
  return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4]) / 100];
}

// CSS color-mix(in srgb, top pct, base): premultiplied by alpha, as the browser mixes. With
// pct = the top's own alpha over an opaque base it is plain compositing.
function mixed(top: Rgba, base: Rgba, pct: number): Rgba {
  const a = top[3] * pct + base[3] * (1 - pct);
  const channel = (i: 0 | 1 | 2): number =>
    (top[i] * top[3] * pct + base[i] * base[3] * (1 - pct)) / a;
  return [channel(0), channel(1), channel(2), a];
}

const over = (top: Rgba, base: Rgba): Rgba => {
  const channel = (i: 0 | 1 | 2): number => top[i] * top[3] + base[i] * (1 - top[3]);
  return [channel(0), channel(1), channel(2), 1];
};

function contrast(a: Rgba, b: Rgba): number {
  const luminance = (c: Rgba): number => {
    const channel = (v: number): number => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
  };
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('the own-row tint (T261)', () => {
  it.each(['light', 'dark'] as const)(
    '%s: a row’s text keeps 4.5:1 on every own colour',
    (theme) => {
      const tokens = tokensOf(theme);
      const pct = Number.parseInt(tokens.get('--own-tint') ?? '', 10) / 100;
      const card = over(colour(tokens, '--sk-color-card'), colour(tokens, '--sk-color-background'));
      for (const season of ['spring', 'summer', 'autumn', 'winter']) {
        const tint = mixed(
          colour(tokens, `--sk-color-${season}`),
          colour(tokens, '--color-own-base'),
          pct,
        );
        // A translucent tint lies on the panel's card over the page (T75's base in light).
        const bg = over(tint, card);
        for (const text of ROW_TEXT) {
          expect(
            contrast(colour(tokens, text), bg),
            `${theme}: ${text} on ${season}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    },
  );
});
