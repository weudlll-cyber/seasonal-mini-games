// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/round.test.tsx
 * @module web/round
 * @brief  The platform's round components and words: ring, guess list, teams, result, refusals.
 *
 * Responsibility: the cooldown ring counts down and says Ready; the guess list merges the
 *                 game's guess rows and the event rows, newest at the top, each guess with the
 *                 player's colour dot, "You" and a highlight on the viewer's own, the answer in
 *                 colour and the comment under it, "answer arriving" while Frost holds an own
 *                 answer (O20, O21); a player's colour is their team's when teams play, else a season colour by
 *                 roster order; the team tiles show each team's match points, only when teams
 *                 play; a player name stays whole, shortened, and opens on a tap; the result
 *                 screen gives the headline, the winning margin, placings with "took part",
 *                 the team result and the fairness proof; every platform refusal and event
 *                 has its plain sentence (02 §12).
 * Depends on:     vitest, @testing-library/react, @smg/contracts, ./CooldownRing, ./PlayerName,
 *                 ./RoundLog, ./RoundSide, ./ResultScreen, ./roundText
 * Spec:           docs/spec/02-game-guess-the-number.md §7, §9, §11, §12; docs/spec/09-testing-strategy.md §2
 */
import type { RoundStateView } from '@smg/contracts';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CooldownRing } from './CooldownRing.js';
import { PlayerName } from './PlayerName.js';
import { ResultScreen } from './ResultScreen.js';
import { RoundLog } from './RoundLog.js';
import { playerColor, TeamTiles } from './RoundSide.js';
import { codeText, endHeadline, marginText, platformLine } from './roundText.js';

afterEach(() => {
  cleanup();
});

const ended: RoundStateView = {
  roundId: 'r1',
  status: 'ended',
  season: 'autumn',
  secretMode: 'shared',
  teamsOn: true,
  specialOn: true,
  halving: false,
  frostDelayMs: null,
  commitment: 'ab'.repeat(32),
  opensAt: 0,
  endsAt: 600_000,
  endedAt: 9_000,
  cooldownMs: 3_000,
  endReason: 'solved',
  abortReason: null,
  winner: 'w',
  margin: { playerId: 'a', ms: 400 },
  roster: [
    { playerKey: 'w', team: 'autumn', guesses: 9, cooldownEndsAt: 0, place: 1, solved: true },
    {
      playerKey: 'a',
      team: 'winter',
      guesses: 4,
      cooldownEndsAt: 20_000,
      place: null,
      solved: false,
    },
  ],
  seq: 30,
  role: 'result',
  game: null,
  results: [
    {
      playerId: 'w',
      place: 1,
      solved: true,
      solveAt: 9_000,
      guesses: 9,
      team: 'autumn',
      points: 10,
    },
    {
      playerId: 'a',
      place: null,
      solved: false,
      solveAt: null,
      guesses: 4,
      team: 'winter',
      points: 0,
    },
  ],
  teams: [
    { team: 'autumn', members: 1, points: 1, won: true },
    { team: 'winter', members: 1, points: 0, won: false },
  ],
  seed: 'cd'.repeat(32),
  names: { w: 'Walter', a: 'Anna' },
};

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
  { ...row, key: '2', at: 5_000, playerId: 'w', value: 70 },
  { ...row, key: '3', at: 8_000, playerId: null, value: 45, pending: true },
];
const gameWith = (rows: readonly object[]) =>
  ({
    text: {
      code: () => null,
      event: () => ({ text: 'Leaf Fall: 12 fell.', playerId: null }),
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
      'You45answer arriving in 2 s',
      'Leaf Fall: 12 fell.',
      'Walter70',
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
    expect(rows[1]?.className).toContain('round-row--event');
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

describe('the result screen', () => {
  it('gives the headline, the margin, placings, the team result and the proof', () => {
    render(<ResultScreen state={ended} game={null} viewerKey="a" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Walter found it first — after 9 guesses.',
    );
    expect(screen.getByTestId('margin').textContent).toBe('Found it 0.4 s before Anna.');
    const rows = [...screen.getByTestId('placings').querySelectorAll('tbody tr')].map(
      (tr) => tr.textContent,
    );
    expect(rows).toEqual(['1 Walter910', 'took part Anna (you)40']);
    expect(screen.getByTestId('team-result').textContent).toContain(
      'Autumn: 1 point — the winner’s team',
    );
    expect(screen.getByTestId('proof').textContent).toContain('cd'.repeat(32));
  });
});

describe('the words', () => {
  it('give refusals, end reasons, margins and events plain sentences', () => {
    expect(codeText('COOLDOWN_ACTIVE', 5_000, 2_100)).toBe('Your cooldown is running — 3 s left.');
    expect(codeText('NOT_IN_ROUND')).toMatch(/watching this round/);
    expect(codeText('SOMETHING_NEW')).toBe('That did not work. Please try again.');
    expect(endHeadline({ ...ended, endReason: 'timeUp' })).toBe('Time is up.');
    expect(marginText({ ...ended, margin: null })).toBe('Nobody else was close.');
    expect(marginText({ ...ended, secretMode: 'individual' })).toBeNull();
    expect(platformLine({ type: 'CooldownChanged', cooldownMs: 7_000 }, {})?.text).toBe(
      'Heatwave: cooldown now 7.0 s.',
    );
    expect(platformLine({ type: 'PlayerSolved', playerId: 'a', place: 2 }, ended.names)).toEqual({
      text: 'Anna found their number — place 2.',
      playerId: 'a',
    });
    expect(platformLine({ type: 'GuessAccepted' }, {})).toBeNull();
  });
});
