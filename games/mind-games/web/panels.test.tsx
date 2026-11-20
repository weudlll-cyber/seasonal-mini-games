// @vitest-environment jsdom
/**
 * @file   games/mind-games/web/panels.test.tsx
 * @module games/mind-games/web
 * @brief  The feed's head, the spectator's stage, the list rows, the intro and the result.
 *
 * Responsibility: the head before and after the first choices reach the feed; the phone's
 *                 line; a spectator's stage with the counts and no way to choose; the feed's
 *                 lines as list rows ("You" for the viewer's own); the intro's rule and timing;
 *                 the codes in words; the result's options with counts, places, the winners'
 *                 check and "wins", the players with +1 and +2 and the viewer's own line, its
 *                 history of every named line, and the headline.
 * Depends on:     vitest, @testing-library/react, ./FeedPanels, ./fixtures, ./ResultPanel, ./text
 * Spec:           docs/spec/02e-game-mind-games.md §2, §6, §9, §10; docs/spec/09-testing-strategy.md §4.2
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { MindLine, MindPlayer, MindSpectator } from './FeedPanels.js';
import { inputProps, names, playerView, resultView, spectatorView } from './fixtures.js';
import { ResultPanel } from './ResultPanel.js';
import { mindText } from './text.js';

afterEach(cleanup);

const moves = [
  ['anna', 'summer'],
  ['me', 'winter'],
  ['anna', 'autumn'],
] as const;
const panel = { names, colors: {}, season: 'winter' as const, specialOn: false };

describe('Mind Games feed panels (02e §6.1, §10)', () => {
  it('says when the first choices show, then the feed’s time and players', () => {
    render(<MindPlayer {...inputProps(playerView(moves, 0))} />);
    expect(screen.getByTestId('feed-head').textContent).toBe(
      'The first choices show 30 s after they are made.',
    );
    cleanup();
    render(<MindLine {...panel} view={spectatorView(moves, 1_500)} />);
    expect(screen.getByText('30 seconds ago · 2 players')).toBeTruthy();
  });

  it('lets a spectator watch the counts without choosing', () => {
    render(<MindSpectator {...panel} view={spectatorView(moves, 1_500)} />);
    expect(screen.getAllByRole('radio').every((r) => (r as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getByTestId('count-summer').textContent).toBe('1 player, 30 s ago');
    expect(screen.getByTestId('phase-strip').textContent).toBe(
      'Join until 1:00Play until 1:30Reveal until 2:00You see the round 30 s late',
    );
    expect(screen.queryByLabelText('Hide my switches')).toBeNull();
  });
});

describe('Mind Games text (02e §2, §5.2, §6.1)', () => {
  it('turns the feed’s lines into list rows, the viewer’s own as "You"', () => {
    const rows = mindText.guesses(playerView(moves, Infinity));
    expect(rows.map((r) => [r.playerId, r.text, r.at])).toEqual([
      ['anna', 'switched Summer → Autumn', 2_000],
      [null, 'chose Winter', 1_000],
      ['anna', 'chose Summer', 0],
    ]);
    expect(mindText.event({ type: 'ChoiceFed' }, names)).toBeNull();
  });

  it('words the intro with the rule and the timing', () => {
    expect(mindText.intro?.(spectatorView([], 0), 'shared')).toBe(
      'Pick a season. The least chosen wins. Join within 1:00 · choices close at 1:30 · everyone sees the round 30 s late',
    );
    expect(
      mindText.intro?.(spectatorView([], 0, { allOption: true, winnerPlace: 2 }), 'shared'),
    ).toBe(
      'Pick a season. The 2nd least chosen wins. All counts as a fifth choice and scores 2. Join within 1:00 · choices close at 1:30 · everyone sees the round 30 s late',
    );
  });

  it('words the game’s and the phased codes, and leaves the rest to the platform', () => {
    expect(mindText.code('PLAY_OVER')).toBe('Choices are closed for this round.');
    expect(mindText.code('SAME_CHOICE')).toBe('That is already your choice.');
    // The account's rate in the game's word (T383); the rest stays the platform's.
    expect(mindText.code('RATE_LIMITED')).toBe('Slow down a little — too many choices at once.');
    expect(mindText.code('ROUND_BUSY')).toBeNull();
  });
});

describe('Mind Games result (02e §9)', () => {
  const r = resultView([...moves, ['bo', 'all'], ['cy', 'winter']], { allOption: true });
  const props = { names, colors: {}, viewerKey: 'me' };

  it('heads the result, lists the winners, then the options in one row without names', () => {
    render(<ResultPanel {...props} view={r} part="reveal" />);
    expect(screen.getByTestId('result-title').textContent).toBe('Autumn and All win!');
    expect(screen.getByTestId('result-line').textContent).toBe('Least chosen season · 4 players');
    // The winners in their own panel, the viewer's chip first (here not a winner).
    const winners = screen.getByTestId('winners');
    expect(within(winners).getByText('2 winners · +1 each, +2 for All')).toBeTruthy();
    expect([...winners.querySelectorAll('.mg-chip')].map((c) => c.textContent)).toEqual([
      'Anna',
      'Bo',
    ]);
    // One column per option, so the row never wraps (O97).
    const options = screen.getByRole('list', { name: 'The options' });
    expect(options.getAttribute('style')).toContain('--mg-options: 5');
    const card = (name: string) =>
      screen.getByText(name, { selector: '.mg-name' }).closest('li') as HTMLElement;
    expect(card('Autumn').querySelector('.mg-wins')?.textContent).toBe('✓ WINNER');
    expect(within(card('Winter')).getByText('not least chosen')).toBeTruthy();
    expect(within(card('Spring')).getByText('not chosen')).toBeTruthy();
    // No player names in the cards (O99).
    for (const n of ['Anna', 'Bo', 'Cy', 'You']) expect(options.textContent).not.toContain(n);
    expect(mindText.runnerUp?.(r, names, false)).toBe(
      'Autumn and All win! Least chosen season · 4 players',
    );
  });

  it('says so in a neutral panel when nobody wins', () => {
    const none = resultView([...moves], { winnerPlace: 4 });
    render(<ResultPanel {...props} view={none} part="reveal" />);
    expect(screen.getByTestId('winners').textContent).toBe('Nobody wins this round.');
  });

  it('lists every named line, oldest first, in the history part', () => {
    render(<ResultPanel {...props} view={r} part="history" />);
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Anna chose Summer',
      'You chose Winter',
      'Anna switched Summer → Autumn',
      'Bo chose All',
      'Cy chose Winter',
    ]);
  });
});
