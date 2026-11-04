// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/longNames.test.tsx
 * @module web/round
 * @brief  A 30-character display name everywhere a screen of the platform shows it.
 *
 * Responsibility: in the waiting area ("Next round"), the Players panel, the placings and
 *                 the match standings a long name is the one-line ./PlayerName: its text and
 *                 its title are the full name (the ellipsis is the stylesheet's, checked here
 *                 too, since jsdom lays nothing out), "(you)" stands apart from it so only the
 *                 name gives way; the waiting area's team and connection, and the Players
 *                 panel's team and guesses, sit in columns of their own on every row (T202).
 * Depends on:     vitest, @testing-library/react, @smg/contracts, ./fakes, ./MatchStandings,
 *                 ./ResultScreen, ./RoundSide, ../match/WaitingArea, node:fs, node:path (./playerName.css as text)
 * Spec:           docs/spec/02-game-guess-the-number.md §9, §12; DECISIONS T150, T202
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { MatchDetailsView, RoundStateView } from '@smg/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { WaitingArea } from '../match/WaitingArea.js';
import { ended } from './fakes.js';
import { ResultScreen } from './ResultScreen.js';
import { PlayersPanelBody } from './RoundSide.js';

// 30 characters, no break point inside: the longest test of every name cell.
const LONG = 'Maximilian_Wolfgang_Oberhuber1';

// The name's styles as text, read as ./rows.test.tsx reads its own (jsdom computes no layout
// and its import.meta.url is no file URL).
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const nameCss = readFileSync(path.join(HERE, 'playerName.css'), 'utf8');
const listCss = {
  waiting: readFileSync(path.join(HERE, '..', 'match', 'match.css'), 'utf8'),
  players: readFileSync(path.join(HERE, 'players.css'), 'utf8'),
};
// The declarations of the rule for exactly `selector` (the text up to its closing brace).
const ruleOf = (css: string, selector: string): string => {
  const at = css.indexOf(`
${selector} {`);
  return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
};

afterEach(() => {
  cleanup();
});

// Every shown name with this text is the one-line name, titled with the full name.
function expectWhole(root: HTMLElement): HTMLElement[] {
  const names = [...root.querySelectorAll<HTMLElement>('.player-name')].filter(
    (n) => n.textContent === LONG,
  );
  expect(names.length).toBeGreaterThan(0);
  for (const n of names) expect(n.title).toBe(LONG);
  return names;
}

const state: RoundStateView = { ...ended, names: { w: LONG, a: 'Anna' } };

describe('a 30-character name', () => {
  it('is cut by the stylesheet at its end, never wrapped', () => {
    const rule = /\.player-name\s*\{([^}]*)\}/.exec(nameCss)?.[1] ?? '';
    expect(rule).toMatch(/text-overflow:\s*ellipsis/);
    expect(rule).toMatch(/white-space:\s*nowrap/);
    expect(rule).toMatch(/overflow:\s*hidden/);
  });
});

describe('the player lists (T210)', () => {
  it('give the name every width the team and status columns leave', () => {
    // The list holds the columns, the rows take them: the team and the status as wide as
    // their widest entry, the same on every row; the name all the rest.
    for (const [css, list, cols] of [
      [listCss.waiting, '.match-players', 'minmax(0, 1fr) max-content max-content'],
      [listCss.players, '.round-player-list', 'auto minmax(0, 1fr) max-content max-content'],
    ] as const) {
      expect(ruleOf(css, list)).toContain(`grid-template-columns: ${cols}`);
      expect(ruleOf(css, `${list} li`)).toMatch(/grid-template-columns:\s*subgrid/);
    }
  });
});

describe('a 30-character name, in its cells', () => {
  it('in the placings and the match standings, with "(you)" apart from it', () => {
    const standings = [{ rank: 1, playerKey: 'w', name: LONG, points: 20, wins: 2 }];
    render(<ResultScreen state={state} game={null} viewerKey="w" standings={standings} />);
    for (const table of ['placings', 'match-standings']) {
      const [name] = expectWhole(screen.getByTestId(table));
      const mark = name?.nextElementSibling;
      expect(mark?.className).toBe('round-you-mark');
      expect(mark?.textContent).toBe(' (you)');
    }
  });

  it('in the Players panel, its team and guesses in columns of their own', () => {
    render(<PlayersPanelBody state={state} points={[]} viewerKey="a" />);
    const [name] = expectWhole(screen.getByTestId('players-panel'));
    const row = name?.closest('li');
    expect(row?.querySelector('.round-player-team')?.textContent).toBe(' Team Autumn');
    expect(row?.querySelector('.round-player-guesses')?.textContent).toBe('9 guesses');
    expect(row?.parentElement?.dataset.teams).toBe('true');
  });

  it('in the waiting area ("Next round"), its team and connection in columns of their own', () => {
    const match = {
      code: 'ABC123',
      teamMatch: true,
      youHost: true,
      youPlayer: true,
      teamLocked: true,
      round: null,
      players: [
        { playerKey: 'w', name: LONG, team: 'autumn' },
        { playerKey: 'a', name: 'Anna', team: null },
      ],
      connected: ['w'],
    } as unknown as MatchDetailsView;
    render(<WaitingArea match={match} after viewerKey="w" reload={() => undefined} />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Next round');
    const [name] = expectWhole(screen.getByTestId('match-players'));
    const parts = [...(name?.closest('li')?.children ?? [])].map((c) => c.className);
    expect(parts).toEqual(['player-name', 'match-player-team', 'match-presence']);
    const other = screen.getByText('no team yet');
    expect(other.className).toBe('match-player-team smg-muted');
  });
});
