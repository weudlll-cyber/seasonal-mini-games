/**
 * @file   apps/embed-loader/src/index.ts
 * @module embed-loader
 * @brief  embed.js: puts the game into a host page, in an iframe that sizes itself.
 *
 * Responsibility: every `<div data-smg-embed data-view="lobby|match|leaderboard|profile">`
 *                 (`data-match` for a match, `data-player` for a profile) gets a sandboxed iframe
 *                 of the game at the address this script came from; messages are taken only from
 *                 that frame and the game's origin, and sent only to the game's origin, never `*`
 *                 (Bingo 07 §3.3): `smg:resize` sizes the frame, `smg:auth:request` is answered with
 *                 a token from `data-auth-url` (the host's backend), the rest become DOM events.
 * Depends on:     nothing (browser only, no dependencies)
 * Used by:        apps/server (GET /embed.js, built by apps/server/build.mjs), ./index.test
 * Spec:           docs/spec/07-integration.md §1; Bingo 07 §3.2, §3.3
 */

const SOURCE = 'smg';
const VERSION = 1;
const VIEWS = new Set(['lobby', 'match', 'leaderboard', 'profile']);
const MATCH_CODE = /^[A-Z0-9]{6}$/;
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 10_000;

interface Embed {
  readonly view: string;
  readonly match?: string | undefined;
  readonly player?: string | undefined;
}

// The game's page for an embed: `<base>#/embed/<view>[/<code or name>]`; null when the markup
// names no valid view (or a match view without a match code).
export function frameUrl(base: string, embed: Embed): string | null {
  if (!VIEWS.has(embed.view)) return null;
  const parts = ['embed', embed.view];
  if (embed.view === 'match') {
    if (embed.match === undefined || !MATCH_CODE.test(embed.match)) return null;
    parts.push(embed.match);
  }
  if (embed.view === 'profile' && embed.player !== undefined && embed.player !== '') {
    parts.push(embed.player);
  }
  return `${new URL('./', base).href}#/${parts.map(encodeURIComponent).join('/')}`;
}

interface Message {
  readonly type: string;
  readonly payload: unknown;
}

// A message of the game's frame, or null for anything else (another origin, another window,
// another shape).
export function gameMessage(
  event: { readonly origin: string; readonly source: unknown; readonly data: unknown },
  gameOrigin: string,
  frame: unknown,
): Message | null {
  if (event.origin !== gameOrigin || event.source !== frame || frame === null) return null;
  if (typeof event.data !== 'object' || event.data === null) return null;
  const d = event.data as { source?: unknown; v?: unknown; type?: unknown; payload?: unknown };
  if (d.source !== SOURCE || d.v !== VERSION) return null;
  if (typeof d.type !== 'string' || !d.type.startsWith('smg:')) return null;
  return { type: d.type, payload: d.payload };
}

// What the loader does for one embed; a seam for the tests.
export interface Host {
  setHeight(px: number): void;
  post(type: string, payload: unknown): void;
  emit(type: string, payload: unknown): void;
  readonly authUrl: string | null;
  fetchToken(url: string): Promise<string | null>;
}

export async function handle(host: Host, message: Message): Promise<void> {
  const { type, payload } = message;
  if (type === 'smg:resize') {
    const height = (payload as { height?: unknown } | null)?.height;
    if (typeof height === 'number' && Number.isFinite(height)) {
      host.setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.ceil(height))));
    }
    return;
  }
  if (type === 'smg:auth:request' && host.authUrl !== null) {
    // The host's own backend signs the token for its signed-in user (Bingo 07 §2.2).
    const jwt = await host.fetchToken(host.authUrl);
    if (jwt !== null) host.post('smg:auth:token', { jwt });
    return;
  }
  host.emit(type, payload);
}

async function tokenFrom(url: string): Promise<string | null> {
  const r = await fetch(url, {
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  });
  if (!r.ok) return null;
  const body = (await r.json()) as { token?: unknown };
  return typeof body.token === 'string' ? body.token : null;
}

function mount(el: HTMLElement, base: string): void {
  const src = frameUrl(base, {
    view: el.dataset['view'] ?? 'lobby',
    match: el.dataset['match'],
    player: el.dataset['player'],
  });
  if (src === null) return;
  const gameOrigin = new URL(base).origin;
  const frame = document.createElement('iframe');
  frame.src = src;
  frame.title = el.dataset['title'] ?? 'Seasonal Mini Games';
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms');
  frame.setAttribute('allow', 'autoplay; fullscreen');
  frame.style.cssText = `width:100%;border:0;display:block;height:${String(MIN_HEIGHT * 4)}px`;
  const host: Host = {
    setHeight: (px) => {
      frame.style.height = `${String(px)}px`;
    },
    post: (type, payload) =>
      frame.contentWindow?.postMessage({ source: SOURCE, v: VERSION, type, payload }, gameOrigin),
    emit: (type, payload) => el.dispatchEvent(new CustomEvent(type, { detail: payload })),
    authUrl: el.dataset['authUrl'] ?? null,
    fetchToken: (url) => tokenFrom(url).catch(() => null),
  };
  window.addEventListener('message', (event) => {
    const message = gameMessage(event, gameOrigin, frame.contentWindow);
    if (message !== null) void handle(host, message);
  });
  el.replaceChildren(frame);
}

// Every embed of the page not mounted yet.
function boot(base: string): void {
  for (const el of document.querySelectorAll<HTMLElement>('[data-smg-embed]')) {
    if (el.dataset['smgMounted'] !== undefined) continue;
    el.dataset['smgMounted'] = '';
    mount(el, base);
  }
}

// As a page script: the game lives where this script was loaded from.
const script = typeof document === 'undefined' ? null : document.currentScript;
if (script !== null && script instanceof HTMLScriptElement && script.src !== '') {
  const base = script.src;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      boot(base);
    });
  } else {
    boot(base);
  }
}
