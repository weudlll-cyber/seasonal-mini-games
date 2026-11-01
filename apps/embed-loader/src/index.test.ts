/**
 * @file   apps/embed-loader/src/index.test.ts
 * @module embed-loader
 * @brief  The loader's rules: the frame's address, which messages count, what each one does.
 *
 * Responsibility: views and their parameters make the game's embed address (an invalid view or
 *                 match code makes none); only messages of the game's frame from the game's
 *                 origin in the `smg` envelope count; resize is clamped, an auth request is
 *                 answered with the host backend's token, anything else becomes a DOM event.
 * Depends on:     vitest, ./index
 * Spec:           docs/spec/07-integration.md §1; Bingo 07 §3.2, §3.3; docs/spec/09-testing-strategy.md §2
 */
import { describe, expect, it } from 'vitest';

import { frameUrl, gameMessage, handle, type Host } from './index.js';

const BASE = 'https://games.example.org/games/mini-games/embed.js';

describe('the frame address', () => {
  it('names the view and its parameter under the game base', () => {
    expect(frameUrl(BASE, { view: 'lobby' })).toBe(
      'https://games.example.org/games/mini-games/#/embed/lobby',
    );
    expect(frameUrl(BASE, { view: 'match', match: 'K7Q2MZ' })).toBe(
      'https://games.example.org/games/mini-games/#/embed/match/K7Q2MZ',
    );
    expect(frameUrl(BASE, { view: 'profile', player: 'Walter K' })).toBe(
      'https://games.example.org/games/mini-games/#/embed/profile/Walter%20K',
    );
  });

  it('makes no frame for an unknown view or a match view without a valid code', () => {
    expect(frameUrl(BASE, { view: 'admin' })).toBeNull();
    expect(frameUrl(BASE, { view: 'match' })).toBeNull();
    expect(frameUrl(BASE, { view: 'match', match: '../x' })).toBeNull();
  });
});

describe('the messages that count', () => {
  const frame = {};
  const good = { source: 'smg', v: 1, type: 'smg:resize', payload: { height: 300 } };
  const origin = 'https://games.example.org';

  it('takes the game frame’s messages from the game origin only', () => {
    expect(gameMessage({ origin, source: frame, data: good }, origin, frame)).toEqual({
      type: 'smg:resize',
      payload: { height: 300 },
    });
    expect(
      gameMessage({ origin: 'https://evil.example', source: frame, data: good }, origin, frame),
    ).toBeNull();
    expect(gameMessage({ origin, source: {}, data: good }, origin, frame)).toBeNull();
    expect(
      gameMessage({ origin, source: frame, data: { ...good, source: 'sbr' } }, origin, frame),
    ).toBeNull();
    expect(
      gameMessage({ origin, source: frame, data: { ...good, type: 'resize' } }, origin, frame),
    ).toBeNull();
    expect(gameMessage({ origin, source: frame, data: 'smg:resize' }, origin, frame)).toBeNull();
  });
});

function fakeHost(authUrl: string | null): Host & { log: unknown[] } {
  const log: unknown[] = [];
  return {
    log,
    authUrl,
    setHeight: (px) => log.push(['height', px]),
    post: (type, payload) => log.push(['post', type, payload]),
    emit: (type, payload) => log.push(['emit', type, payload]),
    fetchToken: (url) => Promise.resolve(`token-from-${url}`),
  };
}

describe('what a message does', () => {
  it('sizes the frame within bounds', async () => {
    const host = fakeHost(null);
    await handle(host, { type: 'smg:resize', payload: { height: 640.2 } });
    await handle(host, { type: 'smg:resize', payload: { height: 5 } });
    await handle(host, { type: 'smg:resize', payload: { height: 'tall' } });
    expect(host.log).toEqual([
      ['height', 641],
      ['height', 120],
    ]);
  });

  it('answers an auth request with the host backend’s token, sent to the game', async () => {
    const host = fakeHost('/handoff-token');
    await handle(host, { type: 'smg:auth:request', payload: null });
    expect(host.log).toEqual([['post', 'smg:auth:token', { jwt: 'token-from-/handoff-token' }]]);
  });

  it('passes the other messages on as DOM events, an auth request too without an auth URL', async () => {
    const host = fakeHost(null);
    await handle(host, { type: 'smg:event', payload: { kind: 'round.ended' } });
    await handle(host, { type: 'smg:auth:request', payload: null });
    expect(host.log).toEqual([
      ['emit', 'smg:event', { kind: 'round.ended' }],
      ['emit', 'smg:auth:request', null],
    ]);
  });
});
