// @vitest-environment jsdom
/**
 * @file   games/seasonal-target/web/panels.test.tsx
 * @module games/seasonal-target/web
 * @brief  The input row's behaviour and the panels: map, selection, arrows, fields, Guess.
 *
 * Responsibility: the selection starts in the middle of the target area, moves with the arrow
 *                 buttons and the keyboard arrows, follows a click and the Column and Row fields,
 *                 and stays inside the area; "Selected: column …, row …" says where; Guess sends
 *                 `{ value: { x, y } }` and nothing else is sent; a fallen or tried cell is
 *                 refused at once without sending; a server `OUT_OF_MAP` on the map says
 *                 "outside the target area"; Guess is disabled during the cooldown; Enter on the
 *                 map guesses; own dots are ringed and a held one pending; the player panel
 *                 shows the hint and area lines and the Fallen cells in autumn; the spectator
 *                 and result panels draw what their views hold.
 * Depends on:     vitest, @testing-library/react, ./PlayerPanel, ./TargetInput,
 *                 ./SpectatorPanel, ./ResultPanel
 * Spec:           docs/spec/02d-game-seasonal-target.md §4, §6, §8, §9, §11
 */
import type { PlayerView } from '@smg-game/seasonal-target';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlayerPanel } from './PlayerPanel.js';
import { ResultPanel } from './ResultPanel.js';
import { SpectatorPanel } from './SpectatorPanel.js';
import { TargetInput } from './TargetInput.js';

afterEach(cleanup);

const ne = { kind: 'direction', distance: 9, direction: 'NE' } as const;
const seen = { tier: null, comment: null };

function playerView(over: Partial<PlayerView> = {}): PlayerView {
  return {
    map: { width: 50, height: 50 },
    feedbackMode: 'direction',
    repeatRejected: true,
    area: { left: 1, right: 50, top: 1, bottom: 50 },
    hint: null,
    fallen: [],
    guesses: [],
    log: [],
    ...over,
  };
}

function renderInput(view: PlayerView, canAct = true) {
  const send = vi.fn(() => Promise.resolve({ ok: true }));
  const props = {
    view,
    act: send,
    canAct,
    frostDelayMs: null,
    now: () => 0,
    season: 'spring' as const,
    specialOn: true,
  };
  render(<TargetInput {...props} ring={<span data-testid="ring" />} />);
  return send;
}

const selected = () => screen.getByTestId('selected').textContent;

describe('input row', () => {
  it('moves the selection with the arrow buttons and the keyboard, inside the area', () => {
    renderInput(playerView({ area: { left: 13, right: 37, top: 1, bottom: 50 } }));
    expect(selected()).toBe('Selected: column 25, row 25');
    fireEvent.click(screen.getByRole('button', { name: 'Move north' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move east' }));
    expect(selected()).toBe('Selected: column 26, row 24');
    const map = screen.getByTestId('map');
    fireEvent.keyDown(map, { key: 'ArrowDown' });
    fireEvent.keyDown(map, { key: 'ArrowLeft' });
    fireEvent.keyDown(map, { key: 'a' });
    expect(selected()).toBe('Selected: column 25, row 25');
    fireEvent.change(screen.getByLabelText('Column'), { target: { value: '5' } });
    // Clamped to the area's west edge.
    expect(selected()).toBe('Selected: column 13, row 25');
    fireEvent.change(screen.getByLabelText('Row'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Row'), { target: { value: '3' } });
    expect(selected()).toBe('Selected: column 13, row 3');
    expect(screen.getByTestId('ring')).toBeTruthy();
  });

  it('selects the clicked cell', () => {
    renderInput(
      playerView({
        map: { width: 20, height: 20 },
        area: { left: 1, right: 20, top: 1, bottom: 20 },
      }),
    );
    const map = screen.getByTestId('map');
    // The view box is 21.4 units square (20 cells and a 1.4 margin) drawn at 214 px.
    map.getBoundingClientRect = () => ({ left: 0, top: 0, width: 214, height: 214 }) as DOMRect;
    fireEvent.click(map, { clientX: 14 + 25, clientY: 14 + 95 });
    expect(selected()).toBe('Selected: column 3, row 10');
  });
});

describe('guessing', () => {
  it('sends only the selected cell on Guess, and Enter guesses too', async () => {
    const send = renderInput(playerView());
    fireEvent.click(screen.getByTestId('guess-button'));
    await act(() => Promise.resolve());
    expect(send).toHaveBeenCalledWith({ value: { x: 25, y: 25 } });
    fireEvent.keyDown(screen.getByTestId('map'), { key: 'Enter' });
    await act(() => Promise.resolve());
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('refuses a fallen or tried cell at once without sending', () => {
    const tried = { receiveSeq: 1, receivedAt: 0, value: { x: 25, y: 24 }, feedback: ne, ...seen };
    const send = renderInput(playerView({ fallen: [{ x: 25, y: 25 }], guesses: [tried] }));
    fireEvent.click(screen.getByTestId('guess-button'));
    expect(screen.getByRole('status').textContent).toBe('That cell has fallen.');
    fireEvent.click(screen.getByRole('button', { name: 'Move north' }));
    fireEvent.click(screen.getByTestId('guess-button'));
    expect(screen.getByRole('status').textContent).toBe('You already tried that cell.');
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByTestId('last-answer').textContent).toBe(
      'Last guess: 9 cells away, to the north-east',
    );
  });

  it('says "outside the target area" for a server OUT_OF_MAP on the map', async () => {
    const send = vi.fn(() => Promise.resolve({ ok: false, code: 'OUT_OF_MAP' }));
    const view = playerView();
    render(
      <TargetInput
        view={view}
        act={send}
        canAct
        frostDelayMs={null}
        now={() => 0}
        season="winter"
        specialOn
      />,
    );
    fireEvent.click(screen.getByTestId('guess-button'));
    await act(() => Promise.resolve());
    expect(screen.getByRole('status').textContent).toBe('That cell is outside the target area.');
  });
});

describe('cooldown and dots', () => {
  it('keeps Guess disabled during the cooldown, and Enter does nothing', () => {
    const send = renderInput(playerView(), false);
    expect(screen.getByTestId<HTMLButtonElement>('guess-button').disabled).toBe(true);
    fireEvent.keyDown(screen.getByTestId('map'), { key: 'Enter' });
    expect(send).not.toHaveBeenCalled();
  });

  it('rings own dots and draws a held one hollow', () => {
    const own = [
      { receiveSeq: 1, receivedAt: 0, value: { x: 1, y: 1 }, feedback: ne, ...seen },
      { receiveSeq: 3, receivedAt: 0, value: { x: 2, y: 2 }, feedback: null, ...seen },
    ];
    const log = [
      { receiveSeq: 2, receivedAt: 0, playerId: 'b', value: { x: 9, y: 9 }, feedback: ne, ...seen },
      { receiveSeq: 4, receivedAt: 0, playerId: 'c', value: null, feedback: null, ...seen },
    ];
    renderInput(playerView({ guesses: own, log }));
    const dots = screen.getAllByTestId('map-dot');
    expect(dots).toHaveLength(3);
    expect(dots.map((d) => d.getAttribute('data-own'))).toEqual(['false', 'true', 'true']);
    expect(dots[2]?.getAttribute('data-pending')).toBe('true');
    expect(dots[2]?.textContent).toContain('You (2, 2) — answer arriving');
    expect(dots[0]?.textContent).toContain(
      'Another player (9, 9) — 9 cells away, to the north-east',
    );
  });
});

describe('panels', () => {
  const quarter = { name: 'north-west', left: 1, right: 25, top: 1, bottom: 25 } as const;
  const base = { act: vi.fn(), canAct: false, frostDelayMs: null, now: () => 0 };

  it('shows the hint, the area line and the Fallen cells in autumn', () => {
    const view = playerView({
      hint: quarter,
      area: { left: 13, right: 37, top: 1, bottom: 50 },
      fallen: [{ x: 14, y: 2 }],
    });
    render(<PlayerPanel {...base} view={view} season="autumn" specialOn />);
    expect(screen.getByTestId('hint').textContent).toBe(
      'Free hint: the target is in the north-west quarter (columns 1–25, rows 1–25).',
    );
    expect(screen.getByTestId('area-line').textContent).toBe(
      'Target area: columns 13–37, rows 1–50',
    );
    expect(screen.getByTestId('fallen').textContent).toBe('Fallen cells (1)');
    fireEvent.click(screen.getByTestId('fallen-toggle'));
    expect(screen.getByTestId('fallen-list').textContent).toBe('(14, 2)');
    cleanup();
    render(<PlayerPanel {...base} view={playerView()} season="spring" specialOn />);
    expect(screen.getByTestId('area-line').textContent).toBe('Map: 50 × 50 cells');
    expect(screen.queryByTestId('fallen-panel')).toBeNull();
  });
});

describe('spectator panel', () => {
  it('gives the spectator the map with named dots, and only the size in individual mode', () => {
    const log = [
      {
        receiveSeq: 1,
        receivedAt: 0,
        playerId: 'b',
        value: { x: 9, y: 9 },
        feedback: null,
        ...seen,
      },
    ];
    const view = {
      map: { width: 50, height: 50 },
      feedbackMode: 'direction',
      area: null,
      areaSize: { width: 25, height: 50 },
      hint: null,
      fallen: [],
      log,
    };
    render(<SpectatorPanel view={view} names={{ b: 'Anna' }} season="autumn" specialOn />);
    expect(screen.getByTestId('area-line').textContent).toBe('Every target area: 25 × 50 cells');
    expect(screen.getByTestId('map-dot').textContent).toBe('Anna (9, 9)');
    expect(screen.getByTestId('fallen').textContent).toBe('Fallen cells (0)');
  });
});

describe('result panel', () => {
  it('shows the target, every dot and every player on the result', () => {
    const view = {
      map: { width: 50, height: 50 },
      target: null,
      targets: { a: { x: 20, y: 30 }, b: { x: 5, y: 5 } },
      guesses: {
        a: [{ value: { x: 20, y: 30 }, feedback: { kind: 'correct' } }],
        b: [{ value: { x: 12, y: 34 }, feedback: ne }],
      },
      fallen: [{ x: 1, y: 1 }],
      closestMiss: null,
    };
    render(<ResultPanel view={view} names={{ a: 'Walter' }} viewerKey="b" />);
    expect(screen.getByTestId('secret').textContent).toBe('Target: column 5, row 5');
    expect(screen.getAllByTestId('map-dot')).toHaveLength(2);
    expect(screen.getByTestId('map-target')).toBeTruthy();
    expect(screen.getAllByTestId('map-fallen')).toHaveLength(1);
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual([
      'b — target (5, 5): (12, 34) 9 away, NE ↗',
      'Walter — target (20, 30): (20, 30) Target found!',
    ]);
  });
});
