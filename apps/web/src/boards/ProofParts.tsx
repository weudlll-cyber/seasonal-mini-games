/**
 * @file   apps/web/src/boards/ProofParts.tsx
 * @module web/boards
 * @brief  The verification page's lists: recomputed secrets, settings and roster, guesses.
 *
 * Responsibility: the secret(s) the server recomputed from the seed, each by its player's
 *                 name (one number in shared mode); the round's season and mode with every
 *                 published setting behind a disclosure, and the roster with team icons; the
 *                 accepted guesses in receive order (receive order, player, guess) in a table
 *                 that scrolls inside itself and can be scrolled by keyboard.
 * Depends on:     react, ../season/*, ./proof
 * Used by:        ./VerifyPage
 * Spec:           docs/spec/02-game-guess-the-number.md §9, §10
 */
import type { ReactElement } from 'react';

import { SeasonIcon } from '../season/SeasonIcon.js';
import { SEASON_NAMES } from '../season/season.js';
import { actionText, secretLines, type Proof } from './proof.js';

type Name = (playerId: string) => string;

interface PartProps {
  readonly proof: Proof;
  readonly name: Name;
}

export function Secrets(p: PartProps & { readonly secrets: unknown }): ReactElement {
  const roster = new Set(p.proof.roster.map((r) => r.playerId));
  const lines = secretLines(p.secrets, (key) => (roster.has(key) ? p.name(key) : null));
  return (
    <section className="smg-panel smg-stack" aria-labelledby="verify-secrets">
      <h2 id="verify-secrets">Recomputed from the seed</h2>
      <ul className="boards-list" data-testid="secrets">
        {lines.map((l) => (
          <li key={l.label}>
            {l.label}: <strong>{l.value}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Settings({ proof, name }: PartProps): ReactElement {
  const mode = proof.config['secretMode'] === 'shared' ? 'Shared' : 'Individual';
  return (
    <section className="smg-panel smg-stack" aria-labelledby="verify-settings">
      <h2 id="verify-settings">Settings and players</h2>
      <p>
        {proof.season === null ? null : (
          <>
            <SeasonIcon season={proof.season} size="1rem" /> {SEASON_NAMES[proof.season]} ·{' '}
          </>
        )}
        {mode} secret
      </p>
      <details>
        <summary>All published settings</summary>
        <pre className="boards-json">
          {JSON.stringify({ config: proof.config, gameConfig: proof.gameConfig }, null, 2)}
        </pre>
      </details>
      <ul className="boards-list" data-testid="roster">
        {proof.roster.map((r) => (
          <li key={r.playerId}>
            {r.team === null ? null : <SeasonIcon season={r.team} size="1rem" />} {name(r.playerId)}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Guesses({ proof, name }: PartProps): ReactElement {
  return (
    <section className="smg-panel smg-stack" aria-labelledby="verify-guesses">
      <h2 id="verify-guesses">Accepted guesses in receive order</h2>
      {proof.guesses.length === 0 ? (
        <p>No guesses were accepted.</p>
      ) : (
        // Focusable, so the list scrolls by keyboard too (WCAG 2.1.1).
        <div
          className="round-table-wrap boards-scroll"
          tabIndex={0}
          role="region"
          aria-labelledby="verify-guesses"
        >
          <table className="round-table" data-testid="guesses">
            <thead>
              <tr>
                <th scope="col">Receive order</th>
                <th scope="col">Player</th>
                <th scope="col">Guess</th>
              </tr>
            </thead>
            <tbody>
              {proof.guesses.map((g) => (
                <tr key={g.seq}>
                  <td>{g.seq}</td>
                  <td>{name(g.playerId)}</td>
                  <td>{actionText(g.action)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
