// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/owner.test.tsx
 * @module web/round
 * @brief  The owner's decisions of 2026-11-22 on the platform's side: the solved player's board
 *         and notice, the result's words for finding, the phone row's height.
 *
 * Responsibility: a solved player of a board game keeps the game's input in `done` form beside
 *                 the notice, which is in the game's words for finding ("You hit the target.");
 *                 a list game's solved player gets the platform's notice alone (O25, T78, O136);
 *                 the result's headline and margin take the game's words, else "found it"
 *                 (O137); on the phone layout a row's button is at least 24 px high (O134: jsdom
 *                 has no layout, so the rule itself is checked, as ./rows.test does). Of
 *                 2026-11-23: every headline, solve row and the already-solved refusal in the
 *                 game's words where it has them (O137); a refused host command or team change
 *                 says "try again in a moment", a guess keeps its own words (O138).
 * Depends on:     vitest, @testing-library/react, @smg/contracts, ./fakes, ./InputRow,
 *                 ./roundText, ./roundLog.css (read as text)
 * Spec:           docs/spec/02-game-guess-the-number.md §9, §12; docs/spec/02d-game-seasonal-target.md §9, §11
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { RoundStateView } from '@smg/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ended } from './fakes.js';
import { InputRow } from './InputRow.js';
import { codeText, endHeadline, guessRefusal, marginText, platformLine } from './roundText.js';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const logCss = readFileSync(path.join(HERE, 'roundLog.css'), 'utf8');

afterEach(() => {
  cleanup();
});

const solved = {
  ...ended,
  status: 'open',
  secretMode: 'individual',
  role: 'player',
  game: {},
  roster: [{ ...ended.roster[1], playerKey: 'a', place: 1, solved: true }],
} as unknown as RoundStateView;

// A game whose input says whether it was drawn `done`; `found` its words for finding, if any.
const gameWith = (found?: string) =>
  ({
    text: { code: () => null, event: () => null, guesses: () => [], ...(found ? { found } : {}) },
    Input: (p: { readonly done?: boolean }) => (
      <div data-testid="game-input">{p.done === true ? 'done' : 'playing'}</div>
    ),
  }) as never;

function show(found: string | undefined, stage: HTMLElement | null) {
  render(
    <InputRow
      state={solved}
      game={gameWith(found)}
      viewerKey="a"
      now={0}
      reload={() => Promise.resolve()}
      stage={stage}
    />,
  );
}

describe('a solved player (O136)', () => {
  it('keeps a board game’s board, read-only, beside the notice in the game’s words', () => {
    show('hit the target', document.createElement('div'));
    expect(screen.getByTestId('solved-notice').textContent).toBe('You hit the target.');
    expect(screen.getByTestId('game-input').textContent).toBe('done');
  });

  it('gets the platform’s notice alone in a list game', () => {
    show(undefined, null);
    expect(screen.getByTestId('solved-notice').textContent).toBe(
      'You found your number — place 1. Your guesses stay here while the others play on.',
    );
    expect(screen.queryByTestId('game-input')).toBeNull();
  });
});

describe('the result’s words for finding (O137)', () => {
  const won = { ...ended, endReason: 'solved', winner: 'b' } as RoundStateView;

  it('names the first hit in the game’s words, else "found it"', () => {
    expect(endHeadline(won, 'hit the target')).toMatch(/^\S+ hit the target first — after \d+ /);
    expect(endHeadline(won)).toMatch(/^\S+ found it first — after \d+ /);
    const close = { ...won, secretMode: 'shared', margin: { ms: 400, playerId: 'b' } } as never;
    expect(marginText(close, 'hit the target')).toMatch(/^Hit the target 0\.4 s before /);
    expect(marginText(close)).toMatch(/^Found it 0\.4 s before /);
  });
});

describe('the phone layout’s rows (O134)', () => {
  it('makes a row’s button at least 24 px high', () => {
    const rule = /button\.round-row-line \{([^}]*)\}/.exec(logCss)?.[1] ?? '';
    expect(rule).toContain('min-height: 24px');
  });
});

describe('Seasonal Target’s words wherever finding is named (O137, 2026-11-23)', () => {
  const T = 'hit the target';
  const allSolved = (timedOut: boolean) =>
    ({
      ...ended,
      endReason: 'allSolved',
      results: [{ playerId: 'b', place: 1, timedOut }],
    }) as unknown as RoundStateView;

  it('says everyone hit the target, in shared and in individual mode', () => {
    for (const secretMode of ['shared', 'individual']) {
      const state = { ...allSolved(false), secretMode } as RoundStateView;
      expect(endHeadline(state, T)).toBe('Everyone hit the target.');
      expect(endHeadline(state)).toBe('Everyone found their number.');
    }
    expect(endHeadline(allSolved(true), T)).toBe('Everyone still in the round hit the target.');
    const won = { ...ended, endReason: 'solved', winner: 'b', secretMode: 'individual' };
    expect(endHeadline(won as RoundStateView, T)).toMatch(/^\S+ hit the target first — /);
  });

  it('refuses a second hit and names a solve in the game’s words', () => {
    expect(guessRefusal('ALREADY_SOLVED', undefined, 0, T)).toBe('You hit the target already.');
    expect(guessRefusal('ALREADY_SOLVED', undefined, 0)).toBe('You found your number already.');
    const solve = { type: 'PlayerSolved', playerId: 'b', place: 2 };
    expect(platformLine(solve, { b: 'Anna' }, T)?.text).toBe('Anna hit the target — place 2.');
    expect(platformLine(solve, { b: 'Anna' })?.text).toBe('Anna found their number — place 2.');
  });
});

describe('a refusal for going too fast (O138)', () => {
  it('keeps a guess’s words and says "try again in a moment" elsewhere', () => {
    expect(guessRefusal('RATE_LIMITED', undefined, 0)).toBe(
      'Slow down a little — too many guesses at once.',
    );
    expect(codeText('RATE_LIMITED')).toBe('Slow down a little — try again in a moment.');
  });
});
