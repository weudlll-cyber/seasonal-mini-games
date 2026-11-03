// @vitest-environment jsdom
/**
 * @file   games/seasonal-target/web/line.test.tsx
 * @module games/seasonal-target/web
 * @brief  The phone's info line of Seasonal Target (T141).
 *
 * Responsibility: the line says the target area once a halving shrank it, else Spring's
 *                 quarter ("Hint: south-east quarter"), else the heat legend.
 * Depends on:     vitest, @testing-library/react, ./fixtures, ./PlayerPanel
 * Spec:           docs/spec/02d-game-seasonal-target.md §8, §11; docs/spec/09-testing-strategy.md §2
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { playerView, roster } from './fixtures.js';
import { InfoLine } from './PlayerPanel.js';

afterEach(() => {
  cleanup();
});

const quarter = { name: 'south-east', left: 11, right: 20, top: 11, bottom: 20 } as const;
const line = () => screen.getByTestId('st-line');

describe("the phone's info line", () => {
  it('says the halved area first, then the hint, else shows the legend', () => {
    const at = { ...roster, season: 'spring' as const, specialOn: true };
    const halved = { left: 6, right: 15, top: 1, bottom: 20 };
    render(<InfoLine view={playerView({ area: halved, hint: quarter })} {...at} />);
    expect(line().textContent).toBe('Target area: columns 6–15, rows 1–20');
    cleanup();
    render(<InfoLine view={playerView({ hint: quarter })} {...at} />);
    expect(line().textContent).toBe('Hint: south-east quarter');
    cleanup();
    render(<InfoLine view={playerView()} {...at} />);
    expect(screen.getByTestId('heat-legend')).toBeTruthy();
  });
});
