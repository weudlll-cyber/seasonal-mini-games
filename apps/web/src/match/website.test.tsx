// @vitest-environment jsdom
/**
 * @file   apps/web/src/match/website.test.tsx
 * @module web/match
 * @brief  The host's "Show on the website" while the match is open (O125).
 *
 * Responsibility: the switch shows the match's setting and sends a change with
 *                 `PUT …/website`, the details reloaded after; a Quick Test and an ended match
 *                 have no switch.
 * Depends on:     vitest, @testing-library/react, @smg/contracts (types), ./WebsiteSwitch
 * Spec:           docs/spec/07-integration.md §8
 */
import type { MatchDetailsView } from '@smg/contracts';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const sent = vi.hoisted(() => [] as { path: string; body: unknown }[]);
vi.mock('../shell/http.js', () => ({
  api: (path: string, init: { body: unknown }) => {
    sent.push({ path, body: init.body });
    return Promise.resolve(null);
  },
}));

const { WebsiteSwitch } = await import('./WebsiteSwitch.js');

afterEach(() => {
  cleanup();
  sent.length = 0;
});

const match = (change: Partial<MatchDetailsView>): MatchDetailsView =>
  ({
    code: 'ABC123',
    status: 'lobby',
    showOnWebsite: true,
    quickTest: false,
    ...change,
  }) as MatchDetailsView;

describe('Show on the website (O125)', () => {
  it('shows the setting and sends a change, then reloads', async () => {
    const reload = vi.fn();
    render(<WebsiteSwitch match={match({})} reload={reload} />);
    const box = screen.getByTestId<HTMLInputElement>('website-switch');
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    await vi.waitFor(() => {
      expect(reload).toHaveBeenCalled();
    });
    expect(sent).toEqual([{ path: '/matches/ABC123/website', body: { show: false } }]);
  });

  it('is not there for a Quick Test or an ended match', () => {
    render(<WebsiteSwitch match={match({ quickTest: true })} reload={vi.fn()} />);
    render(<WebsiteSwitch match={match({ status: 'closed' })} reload={vi.fn()} />);
    expect(screen.queryByTestId('website-switch')).toBeNull();
  });
});
