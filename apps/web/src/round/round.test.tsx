// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/round.test.tsx
 * @module web/round
 * @brief  The platform's round components and words: ring, guess list, teams, solved, words.
 *
 * Responsibility: the cooldown ring counts down and says Ready; the guess list merges the
 *                 game's guess rows and the event rows, newest at the top, each guess with the
 *                 player's colour dot, "You" and a highlight on the viewer's own, the answer in
 *                 colour and the comment under it, "answer arriving" while Frost holds an own
 *                 answer (O20, O21); a player's colour is their team's when teams play, else a
 *                 season colour by roster order; the team tiles show each team's match points,
 *                 only when teams play; a player name stays whole, shortened, and opens on a
 *                 tap; a solved player in individual mode gets a notice with their place
 *                 instead of the input row and keeps their own rows (O25); every platform
 *                 refusal and event has its plain sentence (02 §12). The result screen has its
 *                 own tests (./result.test).
 * Depends on:     vitest, @testing-library/react, @smg/contracts, ./fakes, ./CooldownRing,
 *                 ./PlayerName, ./RoundLog, ./RoundScreen, ./RoundSide, ./roundText
 * Spec:           docs/spec/02-game-guess-the-number.md §7, §9, §11, §12; docs/spec/09-testing-strategy.md §2
 */
import type { RoundStateView } from '@smg/contracts';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CooldownRing } from './CooldownRing.js';
import { ended } from './fakes.js';
import { PlayerName } from './PlayerName.js';
import { RoundLog } from './RoundLog.js';
import { RoundScreen } from './RoundScreen.js';
import { playerColor, TeamTiles } from './RoundSide.js';
import { codeText, endHeadline, marginText, platformLine } from './roundText.js';

afterEach(() => {
  cleanup();
});

describe('the cooldown ring', () => {
  it('counts the seconds left and then says Ready', () => {
    render(<CooldownRing endsAt={10_000} cooldownMs={5_000} now={7_100} />);
    expect(screen.getByTestId('cooldown').textContent).toBe('3 s');
    cleanup();
    render(<CooldownRing endsAt={10_000} cooldownMs={5_000} now={10_000} />);
    expect(screen.getByTestId('cooldown').getAttribute('aria-label')).toBe('Ready to guess');
  });
});

// The guess list's game: its rows, and an event line for every game event.
const row = { pending: false, tier: null, comment: null, feedback: null, value: null };
const guesses = [
  {
    ...row,
    key: '1',
    at: 3_000,
    playerId: null,
    value: 40,
    feedback: 'lower',
    tier: 'warm',
    comment: 'Getting cosy.',
  },
  { ...row, key: '2', at: 5_000, playerId: 'w', value: 7_000 },
  { ...row, key: '3', at: 8_000, playerId: null, value: 45, pending: true },
];
const gameWith = (rows: readonly object[]) =>
  ({
    text: {
      code: () => null,
      event: () => ({ text: 'Leaf Fall: 12 fell.', playerId: null, special: true }),
      guesses: () => rows,
    },
  }) as never;
const game = gameWith(guesses);
const live = { ...ended, status: 'open', frostDelayMs: 3_000, game: {} } as const;

describe('the guess list', () => {
  it('merges guesses and events newest first, with "You", answers, comments and Frost', () => {
    const feed = [
      { key: '9', at: 6_000, event: { type: 'Game', event: {} } },
      { key: '1', at: 1_000, event: { type: 'RoundOpened' } },
    ];
    render(<RoundLog feed={feed} game={game} state={live} viewerKey="a" now={9_000} />);
    const rows = [...screen.getByTestId('guess-list').querySelectorAll('li')];
    expect(rows.map((li) => li.textContent)).toEqual([
      'You45answer arriving… 2 s',
      'Leaf Fall: 12 fell.',
      'Walter7,000',
      'You40lower ↓Getting cosy.',
      'The round is open — guess!',
    ]);
    expect(rows.map((li) => li.dataset['own'])).toEqual([
      'true',
      undefined,
      'false',
      'true',
      undefined,
    ]);
    expect(rows[3]?.querySelector('[data-feedback="lower"]')).not.toBeNull();
    expect(rows[3]?.querySelector('.round-comment')?.textContent).toBe('Getting cosy.');
    expect(rows[3]?.dataset['tier']).toBe('warm');
    // The viewer's own dot: Anna plays for winter.
    expect(rows[0]?.querySelector<HTMLElement>('.round-dot')?.style.getPropertyValue('--dot')).toBe(
      'var(--color-winter)',
    );
    // Leaf Fall's row stands out: the season's tint and icon (T115); numbers are grouped.
    expect(rows[1]?.className).toContain('round-row--special');
    expect(rows[1]?.querySelector('.round-row-icon')).not.toBeNull();
    expect(rows[4]?.className).toBe('round-row round-row--event');
  });

  it('says so when nothing has happened yet', () => {
    render(<RoundLog feed={[]} game={gameWith([])} state={live} viewerKey="a" now={0} />);
    expect(screen.getByText('No guesses yet.')).toBeTruthy();
  });
});

describe('the colours and the teams', () => {
  it('colour players by team when teams play, else by roster order', () => {
    expect(playerColor(ended, 'w')).toBe('var(--color-autumn)');
    const plain = { ...ended, teamsOn: false };
    expect([playerColor(plain, 'w'), playerColor(plain, 'a')]).toEqual([
      'var(--color-spring)',
      'var(--color-summer)',
    ]);
  });

  it('show the four team tiles with match points only when teams play', () => {
    const points = [{ team: 'autumn' as const, points: 3 }];
    render(<TeamTiles state={ended} points={points} />);
    const tiles = screen.getByTestId('team-tiles').textContent;
    expect(tiles).toContain('Autumn3');
    expect(tiles).toContain('Spring0');
    cleanup();
    render(<TeamTiles state={{ ...ended, teamsOn: false }} points={points} />);
    expect(screen.queryByTestId('team-tiles')).toBeNull();
  });
});

describe('a player name', () => {
  it('stays on one line, shortened, and shows in full on a tap or focus', () => {
    render(<PlayerName name="bot-03" />);
    const name = screen.getByTitle('bot-03');
    expect(name.className).toBe('player-name');
    expect(name.getAttribute('tabindex')).toBe('0');
    expect(name.dataset['full']).toBe('false');
    fireEvent.click(name);
    expect(name.dataset['full']).toBe('true');
    fireEvent.blur(name);
    expect(name.dataset['full']).toBe('false');
  });
});

describe('a solved player in individual mode (O25)', () => {
  it('gets a notice with their place instead of the input row, and keeps their own rows', () => {
    const view = {
      range: { low: 1, high: 100 },
      removed: [],
      guesses: [
        {
          receiveSeq: 1,
          receivedAt: 1_000,
          value: 92,
          feedback: 'correct',
          tier: 'correct',
          comment: 'Bullseye!',
        },
      ],
      log: [],
      hint: null,
    };
    const solved = {
      ...live,
      secretMode: 'individual',
      frostDelayMs: null,
      role: 'player',
      game: view,
      roster: [{ ...ended.roster[1], playerKey: 'a', place: 2, solved: true }],
    } as unknown as RoundStateView;
    const roundLive = { state: solved, feed: [], reload: () => Promise.resolve() };
    render(
      <RoundScreen
        live={roundLive}
        gameId="guess-the-number"
        viewerKey="a"
        hostMenu={null}
        teamPoints={[]}
        standings={[]}
        chat={null}
      />,
    );
    expect(screen.getByTestId('solved-notice').textContent).toBe(
      'You found your number — place 2. Your guesses stay here while the others play on.',
    );
    expect(screen.queryByTestId('guess-input')).toBeNull();
    const own = screen.getByTestId('guess-list').querySelector('li[data-own="true"]');
    expect(own?.textContent).toBe('You92correct ✓Bullseye!');
  });
});

describe('the words', () => {
  it('give refusals, end reasons, margins and events plain sentences', () => {
    expect(codeText('COOLDOWN_ACTIVE', 5_000, 2_100)).toBe('Your cooldown is running — 3 s left.');
    expect(codeText('NOT_IN_ROUND')).toMatch(/watching this round/);
    expect(codeText('SOMETHING_NEW')).toBe('That did not work. Please try again.');
    expect(endHeadline({ ...ended, endReason: 'timeUp' })).toBe('Time is up.');
    expect(marginText({ ...ended, margin: null })).toBeNull();
    expect(marginText({ ...ended, secretMode: 'individual' })).toBeNull();
    expect(platformLine({ type: 'CooldownChanged', cooldownMs: 7_000 }, {})?.text).toBe(
      'Heatwave: waiting time is now 7 s.',
    );
    expect(platformLine({ type: 'PlayerSolved', playerId: 'a', place: 2 }, ended.names)).toEqual({
      text: 'Anna found their number — place 2.',
      playerId: 'a',
    });
    expect(platformLine({ type: 'GuessAccepted' }, {})).toBeNull();
  });
});
