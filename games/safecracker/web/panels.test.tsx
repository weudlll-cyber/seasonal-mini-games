// @vitest-environment jsdom
/**
 * @file   games/safecracker/web/panels.test.tsx
 * @module games/safecracker/web
 * @brief  The code block, the result panel and every sentence of the game's text.
 *
 * Responsibility: the code line, the digit strip with a fallen digit labelled and struck, the
 *                 free hint; the result with the code or every player's; the guess rows (code
 *                 as text, answer words with pegs and plurals, "tried a code", own rows pending under
 *                 Frost); refusal words; event lines and the Leaf Fall banner; the closest-miss
 *                 line; the intro line; the special's sentence; the `GameWeb` line.
 * Depends on:     vitest, @testing-library/react, ./Board, ./ResultPanel, ./text, ./index
 * Spec:           docs/spec/02b-game-safecracker.md §2, §4, §5.2, §7, §8, §10
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PlayerPanel, SpectatorPanel } from './Board.js';
import { safecrackerWeb } from './index.js';
import { ResultPanel } from './ResultPanel.js';
import { answerOf, counts, safecrackerText as text } from './text.js';

afterEach(() => {
  cleanup();
});

const f = (exact: number, near: number, solved = false) => ({ exact, near, solved });
const answered = { feedback: f(1, 3), tier: 'hot' as const, comment: 'Click… click… so close.' };
const held = { feedback: null, tier: null, comment: null };
const board = { length: 4, digits: 10, fallen: [7], hint: { position: 1, digit: 4 } };
const view = {
  ...board,
  guesses: [
    { receiveSeq: 1, receivedAt: 1_000, value: '1312', ...answered },
    { receiveSeq: 3, receivedAt: 5_000, value: '0427', ...held },
  ],
  log: [{ receiveSeq: 2, receivedAt: 2_000, playerId: 'p2', value: null, ...held }],
};
const names = { p1: 'Anna', p2: 'Ben' };
const colors = { p1: 'var(--color-spring)', p2: 'var(--color-autumn)' };
const props = {
  act: () => Promise.resolve({ ok: true }),
  canAct: true,
  frostDelayMs: null,
  waitS: null,
  names,
  colors,
};

describe('the code block', () => {
  it('shows the line, the strip with the fallen digit and the free hint', () => {
    render(<PlayerPanel view={view} {...props} now={() => 0} season="spring" specialOn />);
    expect(screen.getByTestId('code-line').textContent).toBe('4-digit code, digits 0–9');
    const chips = screen.getByTestId('digit-strip').querySelectorAll('li');
    expect(chips).toHaveLength(10);
    expect(chips[7]?.getAttribute('aria-label')).toBe('7, fallen');
    expect(chips[7]?.dataset.fallen).toBe('true');
    expect(chips[3]?.getAttribute('aria-label')).toBe('3');
    expect(screen.getByTestId('hint').textContent).toBe('Free hint: the 2nd digit is 4.');
  });

  it('shows a spectator no hint where the view has none', () => {
    render(
      <SpectatorPanel
        view={{ ...board, hint: null, log: [] }}
        names={names}
        colors={colors}
        season="autumn"
        specialOn
      />,
    );
    expect(screen.queryByTestId('hint')).toBeNull();
  });
});

describe('the result panel', () => {
  it('reveals the shared code and the codes tried, the viewer first', () => {
    const result = {
      length: 4,
      digits: 10,
      secret: '0427',
      secrets: null,
      guesses: {
        p1: [{ value: '0427', feedback: f(4, 0, true) }],
        p2: [{ value: '1312', feedback: f(0, 1) }],
      },
      closestMiss: null,
    };
    render(<ResultPanel view={result} names={names} colors={colors} viewerKey="p2" />);
    expect(screen.getByTestId('sc-result').textContent).toContain(
      'The code was 0427 (4 digits, 0–9).',
    );
    const rows = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(rows).toEqual(['Ben: 1312 (0 right places, 1 wrong place)', 'Anna: 0427 open']);
  });

  it('shows every player’s own code in individual mode', () => {
    const result = {
      length: 3,
      digits: 6,
      secret: null,
      secrets: { p1: '012', p2: '345' },
      guesses: { p1: [], p2: [] },
      closestMiss: null,
    };
    render(<ResultPanel view={result} names={names} colors={colors} viewerKey={null} />);
    expect(screen.getByTestId('sc-result').textContent).toContain(
      'Everyone had their own code (3 digits, 0–5).',
    );
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Anna — code 012: no codes tried',
      'Ben — code 345: no codes tried',
    ]);
  });
});

describe('the text', () => {
  it('says place for exactly one and places otherwise', () => {
    expect(counts(f(1, 1))).toBe('1 right place, 1 wrong place');
    expect(counts(f(2, 2))).toBe('2 right places, 2 wrong places');
    expect(counts(f(0, 0))).toBe('0 right places, 0 wrong places');
  });

  it('turns a view into rows with codes, answers and pegs', () => {
    const rows = text.guesses(view);
    expect(rows[0]).toMatchObject({
      playerId: null,
      text: '1312',
      value: null,
      feedback: null,
      pending: false,
    });
    expect(rows[0]?.answer).toEqual({
      text: '1 right place, 3 wrong places',
      tone: 'close',
      pegs: ['hit', 'near', 'near', 'near'],
    });
    expect(rows[1]).toMatchObject({ text: '0427', answer: null, pending: true });
    expect(rows[2]).toMatchObject({
      playerId: 'p2',
      text: 'tried a code',
      answer: null,
      pending: false,
    });
    expect(answerOf(f(4, 0, true), 4)).toMatchObject({
      text: 'correct — the safe is open',
      tone: 'correct',
    });
    expect(answerOf(f(1, 0), 4).tone).toBe('far');
  });
});

describe('the sentences', () => {
  it('words refusals, events, banners, the closest miss, the intro and the specials', () => {
    expect(text.code('DIGIT_REMOVED')).toBe('That digit has fallen.');
    expect(text.code('ALREADY_GUESSED')).toBe('You already tried that code.');
    expect(text.code('CODE_INVALID')).toEqual(expect.any(String));
    expect(text.code('COOLDOWN_ACTIVE')).toBeNull();
    const fall = { type: 'DigitsFallen', index: 1, digits: [7] };
    expect(text.event(fall, names)).toEqual({
      text: 'Leaf Fall: 7 is not in the code.',
      playerId: null,
      special: true,
    });
    expect(text.banner?.({ ...fall, digits: [1, 3, 7] })).toBe(
      'Leaf Fall: 1, 3 and 7 are not in the code.',
    );
    expect(text.banner?.({ type: 'GuessFed' })).toBeNull();
    const hint = { position: 0, digit: 5 };
    expect(text.event({ type: 'HintGiven', playerId: null, hint }, names)?.text).toBe(
      'Spring Herald: the 1st digit is 5.',
    );
    expect(text.event({ type: 'HintGiven', playerId: null, hint: null }, names)?.text).toBe(
      'Spring Herald: everyone got a free hint.',
    );
    expect(text.event({ type: 'HintGiven', playerId: 'p1', hint }, names)).toBeNull();
    expect(text.event({ type: 'GuessFed' }, names)).toBeNull();
    const miss = { closestMiss: { playerId: 'p1', value: '0427', exact: 3, near: 1 } };
    expect(text.runnerUp(miss, names)).toBe('Closest: Anna, 3 right places, 1 wrong place (0427).');
    expect(text.runnerUp({ closestMiss: null }, names)).toBeNull();
    expect(text.intro?.(view, 'shared')).toBe('Shared 4-digit code, digits 0–9');
    expect(text.intro?.(view, 'individual')).toBe(
      'Everyone has their own 4-digit code, digits 0–9',
    );
    expect(text.intro?.(null, 'shared')).toBeNull();
    expect(text.specialRule?.('autumn')).toContain('falls out');
    expect(text.specialRule?.('summer')).toBeNull();
  });

  it('is one GameWeb line with the game’s settings', () => {
    expect(Object.keys(safecrackerWeb).sort()).toEqual([
      'Input',
      'Player',
      'Result',
      'Spectator',
      'settings',
      'text',
    ]);
    expect(safecrackerWeb.settings.map((d) => d.key)).toContain('code.length');
  });
});
