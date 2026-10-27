/**
 * @file   apps/server/src/chat/filter.ts
 * @module server/chat
 * @brief  The chat's text rules as pure functions: normalization, links, and the word lists.
 *
 * Responsibility: normalize a text for matching (case, diacritics, leetspeak, zero-width
 *                 characters removed) while remembering where each normalized character came
 *                 from, so a masked word is replaced in the original text; find a web address;
 *                 apply the three word lists of Bingo 03 §12 in their order: a `block` term
 *                 refuses the message, `mask` terms become `***`, `flag` terms deliver the
 *                 message and name the flag. Terms match whole words of the normalized text.
 * Depends on:     nothing
 * Used by:        ./pipeline, ./filter.test
 * Spec:           docs/spec/07-integration.md §2; Bingo 03 §12, Bingo 06 §7
 */

export interface WordLists {
  readonly block: readonly string[];
  readonly mask: readonly string[];
  readonly flag: readonly string[];
}

export type Filtered =
  | { readonly blocked: true }
  | { readonly blocked: false; readonly shown: string; readonly flags: readonly string[] };

// Leetspeak: the digits and signs that stand for letters.
const LEET: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  $: 's',
};
// Zero-width and invisible joiners that would split a word for the eye but not the filter.
const INVISIBLE = /[\u200B-\u200F\u2060-\u2064\uFEFF\u00AD]/u;
const MARKS = /\p{M}/u;

export interface Normalized {
  readonly text: string;
  // For each character of `text`, the index of the original character it came from.
  readonly from: readonly number[];
}

export function normalize(original: string): Normalized {
  let text = '';
  const from: number[] = [];
  let index = 0;
  for (const ch of original) {
    if (!INVISIBLE.test(ch)) {
      for (const part of ch.normalize('NFKD').toLowerCase()) {
        if (MARKS.test(part)) continue;
        text += LEET[part] ?? part;
        from.push(index);
      }
    }
    index += ch.length;
  }
  return { text, from };
}

const isWordChar = (ch: string | undefined): boolean =>
  ch !== undefined && /[\p{L}\p{N}]/u.test(ch);

// Every whole-word occurrence of a term in the normalized text, as [start, end) there.
function occurrences(n: Normalized, term: string): [number, number][] {
  const t = normalize(term.trim()).text;
  if (t === '') return [];
  const found: [number, number][] = [];
  for (let at = n.text.indexOf(t); at !== -1; at = n.text.indexOf(t, at + 1)) {
    const end = at + t.length;
    if (!isWordChar(n.text[at - 1]) && !isWordChar(n.text[end])) found.push([at, end]);
  }
  return found;
}

// Masked spans in the original text, merged, replaced from the back so indexes stay right.
function masked(original: string, n: Normalized, terms: readonly string[]): string {
  const spans = terms
    .flatMap((term) => occurrences(n, term))
    .map(([a, b]): [number, number] => {
      const last = n.from[b - 1] ?? 0;
      const lastLength = (original.codePointAt(last) ?? 0) > 0xffff ? 2 : 1;
      return [n.from[a] ?? 0, last + lastLength];
    })
    .sort((x, y) => y[0] - x[0]);
  let out = original;
  let floor = Infinity;
  for (const [a, b] of spans) {
    const end = Math.min(b, floor);
    if (end <= a) continue;
    out = `${out.slice(0, a)}***${out.slice(end)}`;
    floor = a;
  }
  return out;
}

export function applyWordLists(original: string, lists: WordLists): Filtered {
  const n = normalize(original);
  if (lists.block.some((term) => occurrences(n, term).length > 0)) return { blocked: true };
  const flags = lists.flag.some((term) => occurrences(n, term).length > 0) ? ['flagged'] : [];
  const shown = masked(original, n, lists.mask);
  return { blocked: false, shown, flags: shown === original ? flags : [...flags, 'masked'] };
}

const TLDS = 'com|net|org|io|de|uk|co|eu|info|biz|xyz|me|app|dev|gg|tv|ru|fr|nl|ly|link|site';
const LINK = new RegExp(`https?://|\\bwww\\.|\\b[a-z0-9-]{2,}\\.(?:${TLDS})\\b`, 'iu');

// A web address in the text (refused unless chat.allowLinks); leetspeak is not undone here.
export function hasLink(text: string): boolean {
  return LINK.test(text.replace(new RegExp(INVISIBLE.source, 'gu'), ''));
}
