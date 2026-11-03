// @vitest-environment jsdom
/**
 * @file   games/guess-the-number/web/sentinel.test.tsx
 * @module games/guess-the-number/web
 * @brief  No secret of Guess The Number reaches the round view's game parts (T141).
 *
 * Responsibility: in both secret modes, a running round with the game's sentinel secrets after
 *                 a few actions (@smg/game-sdk `sentinelViews`): the phone's info line, the
 *                 player's and the spectator's panel, drawn from the player's and the
 *                 spectator's view, hold no sentinel mark in their text (thousands separators
 *                 taken out first). The views themselves are the conformance suite's (P2).
 * Depends on:     vitest, @testing-library/react, @smg/game-sdk, @smg-game/guess-the-number, ./index
 * Spec:           docs/spec/09-testing-strategy.md §2, §3 (P2)
 */
import { gtnConformance, guessTheNumber } from '@smg-game/guess-the-number';
import { sentinelViews } from '@smg/game-sdk';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { InfoLine, PlayerPanel, SpectatorPanel } from './index.js';

afterEach(() => {
  cleanup();
});

const at = {
  names: { p1: 'Anna', p2: 'Ben', p3: 'Cleo' },
  colors: {},
  season: 'autumn' as const,
  specialOn: true,
};
const entry = { module: guessTheNumber, conformance: gtnConformance };

describe('the round view’s game parts', () => {
  for (const mode of ['shared', 'individual'] as const) {
    it(`show no secret in ${mode} mode`, () => {
      const { player, spectator, marks } = sentinelViews(entry, mode);
      const Line = InfoLine;
      const Player = PlayerPanel;
      const Spectator = SpectatorPanel;
      const { container } = render(
        <>
          <Line view={player} {...at} />
          <Line view={spectator} {...at} />
          <Player
            view={player}
            act={() => Promise.resolve({ ok: false })}
            canAct={false}
            frostDelayMs={null}
            now={() => 0}
            waitS={null}
            {...at}
          />
          <Spectator view={spectator} {...at} />
        </>,
      );
      const text = container.textContent.replaceAll(',', '');
      expect(marks.filter((m) => text.includes(m))).toEqual([]);
    });
  }
});
