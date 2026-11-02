// @vitest-environment jsdom
/**
 * @file   games/bomb-defusal/web/panels.test.tsx
 * @module games/bomb-defusal/web
 * @brief  The bomb block, the result panel, and every sentence of the game's text.
 *
 * Responsibility: the bomb block names wires, cuts, the penalty, the hint and the harmless
 *                 wires (struck, by name); a spectator also sees the wires; the result shows
 *                 the secret as numbered chips or each player's own; the views become the
 *                 list's rows with the sequence in words and the answer with its tone ("Boom!"
 *                 with its icon, "The first 2 cuts were right.", "Defused!"), own rows pending under Frost,
 *                 hidden sequences as "cut a sequence"; the event lines and the Leaf Fall
 *                 banner; the refusals; the closest miss; the intro; the special's sentence;
 *                 the web entry has the registry's shape.
 * Depends on:     vitest, @testing-library/react, ./index, ./panels, ./ResultPanel, ./text
 * Spec:           docs/spec/02c-game-bomb-defusal.md §3–§11
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { bombDefusalWeb } from './index.js';
import { PlayerPanel, SpectatorPanel } from './panels.js';
import { ResultPanel } from './ResultPanel.js';
import { bdText } from './text.js';

afterEach(() => {
  cleanup();
});

const own = (receiveSeq: number, correct: number | null) => ({
  receiveSeq,
  receivedAt: receiveSeq * 1_000,
  value: ['blue', 'red', 'yellow', 'white'],
  feedback: correct === null ? null : { correct, defused: correct === 4 },
  tier: null,
  comment: correct === null ? null : 'A line.',
});

const view = {
  wires: ['red', 'blue', 'yellow', 'green', 'white', 'black'],
  cuts: 4,
  penaltyS: 5,
  harmless: ['black'],
  hint: 'red',
  guesses: [own(1, 0), own(3, null)],
  log: [
    { ...own(2, 2), playerId: 'p2' },
    { ...own(4, null), playerId: 'p3', value: null },
  ],
};

describe('the bomb block', () => {
  it('names the bomb, the penalty, the hint and the harmless wires', () => {
    const props = {
      view,
      act: () => Promise.resolve({ ok: true }),
      canAct: true,
      frostDelayMs: null,
      now: () => 0,
      waitS: null,
      names: {},
      colors: {},
    };
    render(<PlayerPanel {...props} season="autumn" specialOn />);
    expect(screen.getByTestId('bomb-block').textContent).toContain(
      '6 wires, cut 4 in the right order',
    );
    expect(screen.getByTestId('penalty').textContent).toBe('Wrong first cut: +5 s');
    expect(screen.getByTestId('hint').textContent).toBe('Free hint: cut red first.');
    expect(screen.getByTestId('harmless').textContent).toBe('black harmless');
  });

  it('shows a spectator the wires, and a penalty of 0 as no extra wait', () => {
    const v = { ...view, penaltyS: 0, hint: null };
    render(<SpectatorPanel view={v} names={{}} colors={{}} season="winter" specialOn={false} />);
    expect(screen.getByLabelText('Wires').textContent).toBe(
      'redblueyellowgreenwhiteblack harmless',
    );
    expect(screen.getByTestId('penalty').textContent).toBe('Wrong first cut: boom, no extra wait');
    expect(screen.queryByTestId('hint')).toBeNull();
  });
});

describe('the result panel', () => {
  const guesses = {
    a: [{ value: ['red', 'blue', 'yellow', 'white'], feedback: { correct: 4, defused: true } }],
    b: [],
  };
  it('reveals the shared sequence as numbered chips', () => {
    const v = {
      wires: view.wires,
      cuts: 4,
      secret: ['red', 'blue', 'yellow', 'white'],
      secrets: null,
      guesses,
      closestMiss: null,
    };
    render(<ResultPanel view={v} names={{ a: 'Anna' }} viewerKey="b" colors={{}} />);
    expect(screen.getByTestId('secret').textContent).toBe('redblueyellowwhite');
    expect(screen.getByText('red → blue → yellow → white: Defused!')).toBeTruthy();
    expect(screen.getByText('no sequences')).toBeTruthy();
  });

  it('shows every player’s own sequence in individual mode', () => {
    const v = {
      wires: view.wires,
      cuts: 4,
      secret: null,
      secrets: { a: ['red', 'blue', 'yellow', 'white'], b: ['white', 'red', 'blue', 'green'] },
      guesses,
      closestMiss: null,
    };
    render(<ResultPanel view={v} names={{ a: 'Anna' }} viewerKey="a" colors={{}} />);
    expect(screen.queryByTestId('secret')).toBeNull();
    expect(screen.getByLabelText("Anna's sequence").textContent).toBe('redblueyellowwhite');
    expect(screen.getByLabelText("b's sequence").textContent).toBe('whiteredbluegreen');
  });
});

describe('the game text', () => {
  it('turns a view into rows with the sequence and the answer in words', () => {
    const rows = bdText.guesses(view);
    expect(
      rows.map((r) => [
        r.playerId,
        r.text,
        r.answer?.text ?? null,
        r.answer?.tone ?? null,
        r.pending,
      ]),
    ).toEqual([
      [null, 'blue → red → yellow → white', '💥 Boom!', 'boom', false],
      [null, 'blue → red → yellow → white', null, null, true],
      ['p2', 'blue → red → yellow → white', 'The first 2 cuts were right.', 'close', false],
      ['p3', 'cut a sequence', null, null, false],
    ]);
    const more = bdText.guesses({ ...view, guesses: [own(1, 1), own(2, 4)], log: [] });
    expect(more.map((r) => [r.answer?.text, r.answer?.tone])).toEqual([
      ['The first cut was right.', 'far'],
      ['Defused!', 'correct'],
    ]);
  });
});

describe('the game text: events and results', () => {
  it('words the events, the banner and the refusals', () => {
    const names = {};
    expect(bdText.event({ type: 'WiresHarmless', index: 1, wires: ['orange'] }, names)).toEqual({
      text: 'Leaf Fall: the orange wire is harmless.',
      playerId: null,
      special: true,
    });
    expect(
      bdText.event({ type: 'WiresHarmless', index: 1, wires: ['orange', 'purple'] }, names)?.text,
    ).toBe('Leaf Fall: the orange and purple wires are harmless.');
    expect(bdText.event({ type: 'HarmlessOver', index: 3 }, names)?.text).toBe(
      'Leaf Fall: every harmless wire is marked.',
    );
    // The hint shows once, in the wire panel (O47).
    expect(bdText.event({ type: 'HintGiven', playerId: null, wire: 'red' }, names)).toBeNull();
    expect(bdText.event({ type: 'HintGiven', playerId: 'a', wire: 'red' }, names)).toBeNull();
    expect(bdText.event({ type: 'GuessFed', playerId: 'a', guesses: 1 }, names)).toBeNull();
    expect(bdText.event({ type: 'FeedbackGiven' }, names)).toBeNull();
    expect(bdText.banner?.({ type: 'WiresHarmless', index: 1, wires: ['orange'] })).toBe(
      'Leaf Fall: the orange wire is harmless.',
    );
    expect(bdText.banner?.({ type: 'HarmlessOver', index: 2 })).toBe(
      'Leaf Fall: every harmless wire is marked.',
    );
    expect(bdText.code('WIRE_HARMLESS')).toBe(
      'That wire is harmless — it is not part of the sequence.',
    );
    expect(bdText.code('SEQUENCE_INVALID')).toMatch(/different wire/);
    expect(bdText.code('COOLDOWN_ACTIVE')).toBeNull();
  });
});

describe('the game text: results, intro and entry', () => {
  it('words the closest miss, the intro and the special', () => {
    const miss = (correct: number) => ({
      closestMiss: { playerId: 'a', value: ['red', 'blue', 'yellow', 'black'], correct },
    });
    expect(bdText.runnerUp(miss(3), { a: 'Anna' })).toBe(
      'Closest miss besides the winner: Anna, the first 3 cuts right (red → blue → yellow → black).',
    );
    expect(bdText.runnerUp(miss(1), {})).toBe(
      'Closest miss besides the winner: a, the first cut right (red → blue → yellow → black).',
    );
    expect(bdText.runnerUp({ closestMiss: null }, {})).toBeNull();
    expect(bdText.intro?.(view, 'shared')).toBe('Shared bomb: 6 wires, 4 cuts');
    expect(bdText.intro?.(view, 'individual')).toBe(
      'Everyone defuses their own bomb: 6 wires, 4 cuts',
    );
    expect(bdText.intro?.(null, 'shared')).toBeNull();
    expect(bdText.specialRule?.('spring')).toMatch(/first cut/);
    expect(bdText.specialRule?.('autumn')).toMatch(/harmless/);
    expect(bdText.specialRule?.('summer')).toBeNull();
  });

  it('gives the registry every part of a game', () => {
    expect(Object.keys(bombDefusalWeb).sort()).toEqual([
      'Input',
      'Player',
      'Result',
      'Spectator',
      'settings',
      'text',
    ]);
    expect(bombDefusalWeb.settings.map((d) => d.key)).toContain('bomb.explosionPenaltyS');
  });
});
