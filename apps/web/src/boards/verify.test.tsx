// @vitest-environment jsdom
/**
 * @file   apps/web/src/boards/verify.test.tsx
 * @module web/boards
 * @brief  The verification page: the seed checked against the commitment in the browser.
 *
 * Responsibility: the page checks the seed against the commitment in the browser (matching
 *                 and not), names the secrets by player, lists the guesses in receive order,
 *                 and words a missing proof.
 * Depends on:     node:crypto, vitest, @testing-library/react, ./fakes, ./VerifyPage
 * Spec:           docs/spec/02-game-guess-the-number.md §9, §10; docs/spec/09-testing-strategy.md §2
 */
import { createHash } from 'node:crypto';

import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { rowsOf, serve, show } from './fakes.js';
import { VerifyPage } from './VerifyPage.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const seed = 'cd'.repeat(32);
const sha = createHash('sha256').update(Buffer.from(seed, 'hex')).digest('hex');

function proofAnswer(commitment: string) {
  return {
    ok: true,
    secrets: { mode: 'individual', byPlayer: { w: 412, a: 77 } },
    events: [
      {
        type: 'RoundCreated',
        roundId: 'r1',
        season: 'winter',
        commitment,
        config: { secretMode: 'individual' },
        gameConfig: { rangeLow: 1, rangeHigh: 1000 },
      },
      {
        type: 'CountdownStarted',
        roster: [
          { playerId: 'w', team: 'winter' },
          { playerId: 'a', team: null },
        ],
      },
      { type: 'GuessAccepted', playerId: 'a', receiveSeq: 2, receivedAt: 2, action: { value: 80 } },
      { type: 'GuessAccepted', playerId: 'w', receiveSeq: 1, receivedAt: 1, action: { value: 9 } },
      { type: 'RoundEnded', seed, reason: 'allSolved' },
    ],
  };
}

describe('the verification page', () => {
  it('confirms a matching seed, names the secrets and lists the guesses in receive order', async () => {
    serve({
      '/rounds/r1/verify': [200, proofAnswer(sha)],
      '/rounds/r1/result': [200, { names: { w: 'Walter', a: 'Anna' } }],
    });
    await show(<VerifyPage roundId="r1" />);
    expect(screen.getByTestId('seed-check').textContent).toBe(
      'The seed matches the commitment published before the round.',
    );
    expect(screen.getByTestId('commitment').textContent).toBe(sha);
    expect(screen.getByTestId('secrets').textContent).toBe('Walter: 412Anna: 77');
    expect(screen.getByTestId('roster').textContent).toContain('Walter');
    expect(rowsOf('guesses')).toEqual(['1Walter9', '2Anna80']);
    expect(screen.getByRole('button', { name: 'Download the proof' })).toBeTruthy();
  });

  it('reports a seed that does not match the commitment', async () => {
    serve({ '/rounds/r1/verify': [200, proofAnswer('00'.repeat(32))] });
    await show(<VerifyPage roundId="r1" />);
    const check = screen.getByTestId('seed-check');
    expect(check.textContent).toMatch(/does not match/);
    expect(check.dataset['ok']).toBe('false');
  });

  it('words a round without a proof', async () => {
    serve({ '/rounds/r2/verify': [409, { code: 'NO_PROOF' }] });
    await show(<VerifyPage roundId="r2" />);
    expect(screen.getByRole('alert').textContent).toMatch(/without a fairness proof/);
  });
});
