// @vitest-environment jsdom
/**
 * @file   apps/web/src/match/waiting.test.tsx
 * @module web/match
 * @brief  The waiting area (O23, O26): the team choice once per match, the player rows, the next step.
 *
 * Responsibility: before their first round a match player reads what teams are for (kept for
 *                 the whole match) and sees the four team buttons, their own pressed, checked
 *                 and with its icon in the text colour; a watcher sees no buttons; once the
 *                 player's team is fixed there are no buttons, and beside a result only the
 *                 status line and the players remain; every player row names the team (or
 *                 "no team yet") and, apart from it, "online" or "away" with a dot; the line on
 *                 top says whether the next round is set up and who acts; a match without
 *                 teams shows no team text, buttons or column (O34).
 * Depends on:     vitest, @testing-library/react, @smg/contracts, ./WaitingArea
 * Spec:           docs/spec/02-game-guess-the-number.md §2; docs/spec/03-seasonal-specials.md §5
 */
import type { MatchDetailsView } from '@smg/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { WaitingArea } from './WaitingArea.js';

afterEach(() => {
  cleanup();
});

const match: MatchDetailsView = {
  code: 'ABC123',
  gameId: 'guess-the-number',
  title: 'Quick Test',
  status: 'open',
  visibility: 'unlisted',
  maxPlayers: 4,
  countsForLeaderboard: false,
  teamMatch: true,
  createdAt: 0,
  youHost: false,
  youPlayer: true,
  you: 'p2',
  teamLocked: false,
  host: 'h',
  players: [
    { playerKey: 'h', name: 'Hanna', team: null },
    { playerKey: 'a', name: 'Anna', team: 'summer' },
    { playerKey: 'bot-01', name: 'bot-01', team: 'winter' },
  ],
  connected: ['h', 'bot-01'],
  round: null,
  teamStandings: [],
  standings: [],
  nextRoundDefaults: null,
  ended: null,
};

const show = (m: MatchDetailsView, viewerKey: string | null, after = false) =>
  render(<WaitingArea match={m} viewerKey={viewerKey} after={after} reload={() => undefined} />);

const teamButtons = () => screen.queryAllByRole('button');

describe('the waiting area before the player’s first round', () => {
  it('says what teams are for and that the team is kept, and marks the viewer’s team', () => {
    show(match, 'a');
    const area = screen.getByTestId('waiting-area');
    expect(area.textContent).toContain('in shared rounds the winner’s team gets a point');
    expect(area.textContent).toContain('You keep it for the whole match');
    expect(area.textContent).toContain('you join the smallest team when your first round starts');
    const pressed = teamButtons().filter((b) => b.ariaPressed === 'true');
    expect(pressed.map((b) => b.textContent)).toEqual([' Team Summer✓']);
    expect(teamButtons()).toHaveLength(4);
    // The pressed team's icon is drawn in the button's text colour (a mask), not as a picture.
    const icon = pressed[0]?.querySelector<HTMLElement>('[role="img"]');
    expect(icon?.getAttribute('aria-label')).toBe('Summer');
    expect(icon?.style.background).toBe('currentcolor');
    expect(teamButtons()[0]?.querySelector('img')).not.toBeNull();
  });

  it('offers a watcher no team buttons', () => {
    show({ ...match, youPlayer: false }, null);
    expect(teamButtons()).toHaveLength(0);
  });
});

describe('the waiting area once the team is fixed (O26)', () => {
  it('beside a result: only the status line and the players', () => {
    show({ ...match, teamLocked: true }, 'a', true);
    const area = screen.getByTestId('waiting-area');
    expect(teamButtons()).toHaveLength(0);
    expect(area.textContent).not.toContain('Pick a season team');
    expect([...area.querySelectorAll('p')].map((p) => p.dataset['testid'])).toEqual([
      'waiting-state',
    ]);
  });

  it('before the next round is started: still no team buttons', () => {
    show({ ...match, teamLocked: true, round: { id: 'r', status: 'created' } }, 'a');
    expect(teamButtons()).toHaveLength(0);
  });

  it('a newcomer beside a result still picks a team', () => {
    show(match, 'a', true);
    expect(teamButtons()).toHaveLength(4);
  });
});

describe('the player rows', () => {
  it('name the team or "no team yet", and the connection apart with a dot', () => {
    show(match, 'a');
    const rows = [...screen.getByTestId('match-players').querySelectorAll('li')];
    const cells = rows.map((li) =>
      [...li.children].map((c) => c.textContent.replace(/\s+/g, ' ').trim()),
    );
    expect(cells).toEqual([
      ['Hanna', 'no team yet', 'online'],
      ['Anna', 'Team Summer', 'away'],
      ['bot-01', 'Team Winter', 'online'],
    ]);
    expect(rows[0]?.children[1]?.className).toBe('smg-muted');
    const presence = rows.map((li) => li.querySelector('.match-presence'));
    expect(presence.map((p) => p?.getAttribute('data-online'))).toEqual(['true', 'false', 'true']);
    expect(presence.every((p) => p?.querySelector('.match-dot[aria-hidden="true"]'))).toBe(true);
  });
});

describe('a match without teams (O34)', () => {
  it('shows no team text or buttons, and rows of name and connection only', () => {
    show({ ...match, teamMatch: false }, 'a');
    const area = screen.getByTestId('waiting-area');
    expect(teamButtons()).toHaveLength(0);
    expect(area.textContent).not.toMatch(/team/i);
    const rows = [...screen.getByTestId('match-players').querySelectorAll('li')];
    expect(rows.map((li) => li.children.length)).toEqual([2, 2, 2]);
    expect(rows[1]?.textContent.replace(/\s+/g, ' ').trim()).toBe('Anna away');
  });
});

describe('the status line', () => {
  it('says whether the next round is set up and who starts it', () => {
    show(match, 'a');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Before the round');
    expect(screen.getByTestId('waiting-state').textContent).toBe(
      'Waiting for the host to start the next round.',
    );
    cleanup();
    const ready = { ...match, youHost: true, round: { id: 'r', status: 'created' } };
    show(ready, 'h', true);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Next round');
    expect(screen.getByTestId('waiting-state').textContent).toBe(
      'The next round is set up. Start it from the Host menu.',
    );
  });
});
