// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/inactivity.test.tsx
 * @module web/round
 * @brief  The inactivity limit's views (O71): countdown, timed-out notice, "timed out" lines.
 *
 * Responsibility: before the server's warning point the input row has no countdown; from it
 *                 the line "30 s left for your next guess" counts down with the render's clock
 *                 while the polite live region keeps its first sentence (announced once); a
 *                 timed-out player gets the notice instead of the input row; the Others panel,
 *                 the phone's Others line, the placings, the round's list and the headline say
 *                 "timed out"; the host form's limit field takes 0 (off) but not 1–19.
 * Depends on:     vitest, @testing-library/react, @smg/contracts, @smg/game-sdk,
 *                 @smg-game/registry/web, ./fakes, ./InputRow, ./ResultParts, ./RoundLog,
 *                 ./RoundSide, ./roundText, ../match/roundFields
 * Spec:           docs/spec/02-game-guess-the-number.md §5.3, §9, §12; docs/spec/09-testing-strategy.md §2
 */
import { GAME_SCREENS } from '@smg-game/registry/web';
import type { RosterRowView, RoundStateView } from '@smg/contracts';
import { PLATFORM_ROUND_SETTINGS, type SettingValue } from '@smg/game-sdk';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Field } from '../match/roundFields.js';
import { ended } from './fakes.js';
import { InputRow } from './InputRow.js';
import { Placings } from './ResultParts.js';
import { othersLine } from './RoundLog.js';
import { OthersPanel } from './RoundSide.js';
import { endHeadline, platformLine } from './roundText.js';

afterEach(() => {
  cleanup();
});

const WARN_AT = 40_000;
const OUT_AT = 70_000;
const game = GAME_SCREENS['guess-the-number'];
const view = {
  range: { low: 1, high: 100 },
  removed: [],
  newest: [],
  guesses: [],
  log: [],
  hint: null,
};
const me = (over: Partial<RosterRowView> = {}): RosterRowView => ({
  ...(ended.roster[1] as RosterRowView),
  cooldownEndsAt: 0,
  inactivity: { warnAt: WARN_AT, outAt: OUT_AT },
  ...over,
});
const open = (row: RosterRowView): RoundStateView => ({
  ...ended,
  status: 'open',
  role: 'player',
  game: view,
  roster: [row],
});

function inputRow(state: RoundStateView, now: number) {
  if (game === undefined) throw new Error('the game');
  return (
    <InputRow
      state={state}
      game={game}
      viewerKey="a"
      now={now}
      reload={() => Promise.resolve()}
      stage={null}
    />
  );
}

describe('the countdown at the input row', () => {
  it('shows from the warning point, counts down, and is announced once', () => {
    const state = open(me());
    const { rerender } = render(inputRow(state, WARN_AT - 1));
    expect(screen.queryByTestId('inactivity-warning')).toBeNull();
    expect(screen.getByTestId('inactivity-announcement').textContent).toBe('');
    rerender(inputRow(state, WARN_AT));
    expect(screen.getByTestId('inactivity-warning').textContent).toBe(
      '30 s left for your next guess',
    );
    const said = screen.getByTestId('inactivity-announcement');
    expect(said.getAttribute('role')).toBe('status');
    expect(said.textContent).toBe('30 s left for your next guess.');
    rerender(inputRow(state, WARN_AT + 1_200));
    expect(screen.getByTestId('inactivity-warning').textContent).toBe(
      '29 s left for your next guess',
    );
    // The live region keeps its first sentence: no announcement every second.
    expect(said.textContent).toBe('30 s left for your next guess.');
    rerender(inputRow(state, OUT_AT + 500));
    expect(screen.getByTestId('inactivity-warning').textContent).toBe(
      '0 s left for your next guess',
    );
    expect(screen.getByTestId('guess-input')).toBeTruthy();
  });

  it('has no line while the limit cannot run out (off, solved, a running cooldown)', () => {
    render(inputRow(open(me({ inactivity: null })), WARN_AT + 5_000));
    expect(screen.queryByTestId('inactivity-warning')).toBeNull();
  });

  it('replaces the input row with the notice once the player is out of time', () => {
    render(inputRow(open(me({ timedOut: true, inactivity: null })), OUT_AT));
    expect(screen.getByTestId('timed-out-notice').textContent).toBe(
      'Out of time this round. You can play the next round.',
    );
    expect(screen.queryByTestId('guess-input')).toBeNull();
  });
});

describe('"timed out" for the others and in the result', () => {
  const roster = [
    me({ playerKey: 'v', inactivity: null }),
    me({ playerKey: 'b1', guesses: 8, inactivity: null }),
    me({ playerKey: 'b2', guesses: 0, timedOut: true, inactivity: null }),
  ];
  const state: RoundStateView = {
    ...open(roster[0] as RosterRowView),
    secretMode: 'individual',
    roster,
    names: { v: 'Me', b1: 'bot-01', b2: 'bot-02' },
  };

  it('in the Others panel and the phone Others line', () => {
    render(<OthersPanel state={state} viewerKey="v" />);
    const rows = screen.getByTestId('others-panel').querySelectorAll('li');
    expect(rows[0]?.textContent).toBe('bot-018 guesses');
    expect(rows[1]?.textContent).toBe('bot-020 guessestimed out');
    expect(othersLine(state, 'v')).toBe('Others: bot-01: 8 guesses · bot-02: 0, timed out');
  });

  it('in the placings, the round list and the headline', () => {
    const [won, lost] = ended.results ?? [];
    if (won === undefined || lost === undefined) throw new Error('two results');
    const results = [
      { ...won, playerId: 'b1', place: 1 },
      { ...lost, playerId: 'b2', timedOut: true },
    ];
    const done = { ...ended, ...state, status: 'ended', endReason: 'allSolved', results } as const;
    render(<Placings state={done} viewerKey="v" />);
    const cells = screen.getByTestId('placings').querySelectorAll('tbody tr td:first-child');
    expect([...cells].map((c) => c.textContent)).toEqual(['1', 'timed out']);
    expect(endHeadline(done)).toBe('Everyone still in the round found their number.');
    expect(platformLine({ type: 'PlayerTimedOut', playerId: 'b2', at: 1 }, state.names)).toEqual({
      text: 'bot-02 is out of time.',
      playerId: 'b2',
    });
  });
});

describe('the host form', () => {
  it('shows both fields with their help, the limit taking 0 (off) but not 10', () => {
    const def = (key: string) => PLATFORM_ROUND_SETTINGS.find((d) => d.key === key);
    const limit = def('round.inactivityLimitS');
    const warn = def('round.inactivityWarnS');
    if (limit === undefined || warn === undefined) throw new Error('the definitions');
    const set: SettingValue[] = [];
    render(
      <>
        <Field def={limit} value={60} set={(v) => set.push(v)} />
        <Field def={warn} value={30} set={() => undefined} />
      </>,
    );
    const field = screen.getByLabelText('Inactivity limit');
    expect(field.getAttribute('min')).toBe('0');
    expect(screen.getByLabelText('Inactivity warning')).toBeTruthy();
    expect(screen.getByText(/0 switches it off/)).toBeTruthy();
    expect(screen.getByText(/Must be below the limit/)).toBeTruthy();
    fireEvent.change(field, { target: { value: '10' } });
    expect(set).toEqual([]);
    expect(screen.getByText(/Allowed: 20 to 600, or 0 for off\./)).toBeTruthy();
    fireEvent.change(field, { target: { value: '0' } });
    expect(set).toEqual([0]);
  });
});
