// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/rows.test.tsx
 * @module web/round
 * @brief  What a player needs is never cut or doubled (T150): rows, the ring, names.
 *
 * Responsibility: "Your guesses" shows the guess and the answer only; in individual mode no
 *                 row says "You" or carries the own colour, and the others' counts stay in
 *                 their own row while a banner shows (a phone's row, T260); every held Frost answer, the viewer's
 *                 and another player's, has the same "answer arriving…" marker; the list's
 *                 styles give way in the order comment, name, never the guess or the answer
 *                 (jsdom has no layout: the rule itself is checked); the ring's ready state is
 *                 a check mark named "Ready"; "(you)" stands apart from the name it follows.
 * Depends on:     vitest, @testing-library/react, @smg/contracts, ./fakes, ./CooldownRing,
 *                 ./MatchStandings, ./RoundLog, ./roundLog.css (read as text)
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/09-testing-strategy.md §2
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { RoundStateView } from '@smg/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CooldownRing } from './CooldownRing.js';
import { ended } from './fakes.js';
import { MatchStandings } from './MatchStandings.js';
import { RoundLog, type LogProps } from './RoundLog.js';

// The list's styles as text (jsdom computes no layout, so the rules themselves are checked).
// (The test file's folder as noFixedColours.test.ts finds it: jsdom's import.meta.url is no file URL.)
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const logCss = readFileSync(path.join(HERE, 'roundLog.css'), 'utf8');

afterEach(() => {
  cleanup();
});

const row = { pending: false, tier: null, feedback: 'higher' as const, value: 10 };
const own = { ...row, key: '1', at: 1_000, playerId: null, comment: 'Cold. Try far away.' };
const theirs = { ...row, key: '2', at: 2_000, playerId: 'w', value: 50, comment: 'Warm.' };
const gameOf = (rows: readonly object[]) =>
  ({ text: { code: () => null, event: () => null, guesses: () => rows } }) as never;
const open: RoundStateView = { ...ended, status: 'open', role: 'player', game: {} };

function show(p: Partial<LogProps> = {}) {
  render(
    <RoundLog
      feed={[]}
      game={gameOf([own, theirs])}
      state={open}
      viewerKey="a"
      now={4_000}
      kind="main"
      phone={false}
      {...p}
    />,
  );
}

describe('"Your guesses"', () => {
  it('shows the guess and the answer only: no comment, no name', () => {
    show({ kind: 'own' });
    const line = screen.getByTestId('own-list').querySelector('.round-row-line');
    expect(line?.querySelector('.round-value')?.textContent).toBe('10');
    expect(line?.querySelector('.round-answer')?.textContent).toBe('higher ↑');
    expect(line?.querySelector('.round-comment')).toBeNull();
    expect(line?.querySelector('.round-who')).toBeNull();
  });
});

describe('individual mode', () => {
  const individual = { ...open, secretMode: 'individual' } as const;

  it('labels no row "You" and gives none the own colour: every row is the viewer’s', () => {
    show({ state: individual });
    const rows = [...screen.getByTestId('guess-list').querySelectorAll('li')];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).not.toContain('You');
    expect(rows[0]?.getAttribute('data-solo')).toBe('true');
    expect(logCss).toContain(".round-row[data-own='true']:not([data-solo]) {");
  });

  it('keeps the others’ counts in their own row while a banner shows', () => {
    show({ state: individual, banner: 'Leaf Fall: 10 numbers fell.', phone: true });
    expect(screen.getByTestId('special-banner').textContent).toBe('Leaf Fall: 10 numbers fell.');
    expect(screen.getByTestId('others-line').textContent).toBe('Others: Walter: 9 guesses');
  });
});

describe('Frost', () => {
  it('marks every held answer alike, the viewer’s and another player’s', () => {
    const held = { ...row, feedback: null, comment: null, pending: true };
    const rows = [
      { ...held, key: '1', at: 2_000, playerId: null },
      { ...held, key: '2', at: 2_000, playerId: 'w', value: 50 },
    ];
    const frost = { ...open, season: 'winter', frostDelayMs: 3_000 } as const;
    show({ game: gameOf(rows), state: frost, now: 3_200 });
    const marks = [...screen.getByTestId('guess-list').querySelectorAll('.round-arriving')];
    expect(marks.map((m) => m.textContent)).toEqual([
      'answer arriving… 2 s',
      'answer arriving… 2 s',
    ]);
  });
});

describe('the order in which a row gives way', () => {
  // The rule for a selector, as written in ./roundLog.css.
  const rule = (selector: string) => {
    const at = logCss.indexOf(`${selector} {`);
    return logCss.slice(at, logCss.indexOf('}', at));
  };

  it('cuts the comment first, then the name, never the guess or the answer', () => {
    expect(rule('.round-comment')).toContain('flex: 1 1 0');
    expect(rule('.round-who')).toContain('flex: 0 1 auto');
    // No fixed cap (T150), only half the line, so a long name never wraps the row (T202).
    expect(rule('.round-who')).toContain('max-width: 50%');
    expect(rule('.round-who')).not.toMatch(/max-width: [\d.]+rem/);
    expect(rule('.round-value,\n.round-answer')).toContain('flex: none');
    expect(rule('.round-arriving')).toContain('flex: none');
  });
});

describe('colour-dot guesses', () => {
  it('give the viewer a neutral marker beside them, never a colour that reads as a wire', () => {
    const rule = logCss.slice(logCss.indexOf(".round-row[data-own='true']:has(.round-swatches)"));
    expect(rule.slice(0, rule.indexOf('}'))).toContain('background: transparent');
  });
});

describe('the cooldown ring', () => {
  it('shows a check mark named "Ready" once the cooldown is over, the seconds before', () => {
    render(<CooldownRing endsAt={5_000} cooldownMs={5_000} now={1_000} />);
    expect(screen.getByTestId('cooldown').getAttribute('aria-label')).toBe('Cooldown, 4 s left');
    cleanup();
    render(<CooldownRing endsAt={5_000} cooldownMs={5_000} now={6_000} />);
    const ring = screen.getByRole('timer', { name: 'Ready' });
    expect(ring.querySelector('.round-ring-check')).not.toBeNull();
    expect(ring.textContent).toBe('');
  });
});

describe('names in a table', () => {
  it('keep "(you)" apart from the name, which alone may give way', () => {
    const standings = [
      { playerKey: 'a', name: 'A very long display name indeed', rank: 1, points: 10, wins: 1 },
    ];
    render(<MatchStandings standings={standings as never} viewerKey="a" />);
    const mark = screen.getByText('(you)', { exact: false });
    expect(mark.className).toBe('round-you-mark');
    expect(mark.previousElementSibling?.className).toBe('player-name');
  });
});
