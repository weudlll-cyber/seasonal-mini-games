/**
 * @file   apps/web/src/boards/VerifyPage.tsx
 * @module web/boards
 * @brief  A round's verification page: commitment, seed, the check, secrets, roster, guesses.
 *
 * Responsibility: load the round's proof (`/rounds/:id/verify`) and its result for the
 *                 players' names; explain the proof in plain words; show the commitment
 *                 published at creation and the seed revealed at the end, and check here in
 *                 the browser that the seed hashes to the commitment (./proof); show the
 *                 secret(s) the server recomputed from the seed, the settings, the roster and
 *                 the accepted guesses in receive order in a list that scrolls inside itself;
 *                 and save the whole answer as a file. A round without a proof, or one still
 *                 running, says so in one sentence.
 * Depends on:     react, @smg/contracts (RoundStateView), ../components/fields, ../season/*,
 *                 ./proof, ./ProofParts, ./useApi, ./boardsText, ./boards.css,
 *                 ../round/result.css
 * Used by:        ../shell/AppShell
 * Spec:           docs/spec/02-game-guess-the-number.md §9, §10; docs/DECISIONS.md O9
 */
import type { RoundStateView } from '@smg/contracts';
import { useEffect, useState, type ReactElement } from 'react';

import { Problem } from '../components/fields.js';
import { refusalText } from './boardsText.js';
import { downloadJson, readProof, seedMatches, type Proof, type ProofAnswer } from './proof.js';
import { Guesses, Secrets, Settings } from './ProofParts.js';
import { useApi } from './useApi.js';
import '../round/result.css';
import './boards.css';

function Check({ proof }: { readonly proof: Proof }): ReactElement {
  const { seed, commitment } = proof;
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    if (seed === null || commitment === null) return;
    void seedMatches(seed, commitment).then(setOk);
  }, [seed, commitment]);
  if (ok === null) return <p className="smg-muted">Checking the seed…</p>;
  return (
    <p className="boards-check" data-ok={ok} role="status" data-testid="seed-check">
      {ok
        ? 'The seed matches the commitment published before the round.'
        : 'The seed does not match the commitment. This round’s proof fails.'}
    </p>
  );
}

function Seed({ proof }: { readonly proof: Proof }): ReactElement {
  return (
    <section className="smg-panel smg-stack" aria-labelledby="verify-seed">
      <h2 id="verify-seed">Commitment and seed</h2>
      <p>
        Published when the round was created, <code>sha256(seed)</code>:{' '}
        <code className="boards-hex" data-testid="commitment">
          {proof.commitment}
        </code>
      </p>
      <p>
        Revealed when the round ended, the seed:{' '}
        <code className="boards-hex" data-testid="seed">
          {proof.seed}
        </code>
      </p>
      <Check proof={proof} />
    </section>
  );
}

function Intro({
  answer,
  roundId,
}: {
  readonly answer: ProofAnswer | null;
  readonly roundId: string;
}) {
  return (
    <header className="smg-panel smg-stack">
      <h1>Verify this round</h1>
      <p>
        Before the round started, the server published a fingerprint (a SHA-256 hash) of a secret
        seed. Every secret number of the round comes from that seed, so it was fixed before anyone
        guessed. Now the seed is public: anyone can hash it and recompute the numbers, and this page
        does the first check for you, in your browser.
      </p>
      {answer === null ? null : (
        <button
          type="button"
          className="smg-btn boards-more"
          onClick={() => {
            downloadJson(`round-${roundId}-proof.json`, answer);
          }}
        >
          Download the proof
        </button>
      )}
    </header>
  );
}

export function VerifyPage({ roundId }: { readonly roundId: string }): ReactElement {
  const id = encodeURIComponent(roundId);
  const verify = useApi<ProofAnswer>(`/rounds/${id}/verify`);
  // Only for the players' names; without it the page shows their keys.
  const result = useApi<RoundStateView>(`/rounds/${id}/result`);
  const names = result.data?.names ?? {};
  const name = (key: string): string => names[key] ?? key;
  const answer = verify.data;
  const proof = answer === null ? null : readProof(answer);
  return (
    <div className="smg-stack boards-page" data-testid="verify">
      <Intro answer={answer} roundId={roundId} />
      <Problem text={verify.error === null ? null : refusalText(verify.error)} />
      {verify.data === null && verify.error === null ? (
        <p className="smg-muted">Loading the proof…</p>
      ) : null}
      {proof === null || answer === null ? null : (
        <>
          <Seed proof={proof} />
          <Secrets secrets={answer.secrets} proof={proof} name={name} />
          <Settings proof={proof} name={name} />
          <Guesses proof={proof} name={name} />
        </>
      )}
    </div>
  );
}
