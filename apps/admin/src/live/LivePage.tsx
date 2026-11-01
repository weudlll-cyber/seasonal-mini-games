/**
 * @file   apps/admin/src/live/LivePage.tsx
 * @module admin/live
 * @brief  The Live area: every running round, refreshed every few seconds, and one opened.
 *
 * Responsibility: list the running rounds (`GET /admin/rounds/live`: match, host, mode,
 *                 players, connected, guesses, times; never a secret) every 3 seconds; open
 *                 one into ./RoundPanel, which stays open after the round ended so a result
 *                 can be removed. The server checks every permission again.
 * Depends on:     react, @smg/contracts (LiveRoundView), ../http, ./RoundPanel
 * Used by:        ../App
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.2; Bingo 11 §3.2
 */
import type { LiveRoundView } from '@smg/contracts';
import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { api } from '../http.js';
import { RoundPanel, type Rights } from './RoundPanel.js';

const REFRESH_MS = 3_000;
const COLUMNS = [
  'Match',
  'Host',
  'Status',
  'Mode',
  'Players',
  'Connected',
  'Guesses',
  'Opens',
  'Ends',
  '',
];

const time = (ms: number | null) => (ms === null ? '—' : new Date(ms).toLocaleTimeString());

function Rows({
  rounds,
  open,
}: {
  readonly rounds: readonly LiveRoundView[];
  readonly open: (id: string) => void;
}): ReactElement {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table" data-testid="live-table">
        <thead>
          <tr>
            {COLUMNS.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rounds.map((r) => (
            <tr key={r.roundId} data-testid={`live-${r.matchCode}`}>
              <td>
                {r.matchTitle} <span className="smg-muted">{r.matchCode}</span>
              </td>
              <td>{r.host ?? '—'}</td>
              <td>{r.status}</td>
              <td>
                {r.secretMode}, {r.season}
                {r.halving ? ', halving' : ''}
              </td>
              <td>{r.roster}</td>
              <td>{r.connected}</td>
              <td>{r.guesses}</td>
              <td>{time(r.opensAt)}</td>
              <td>{time(r.endsAt)}</td>
              <td>
                <button
                  type="button"
                  className="smg-btn"
                  onClick={() => {
                    open(r.roundId);
                  }}
                >
                  Open
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LivePage({ rights }: { readonly rights: Rights }): ReactElement {
  const [rounds, setRounds] = useState<readonly LiveRoundView[] | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const load = useCallback(async () => {
    setRounds((await api<{ items: LiveRoundView[] }>('/admin/rounds/live')).items);
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => {
      clearInterval(timer);
    };
  }, [load]);
  return (
    <div className="smg-stack">
      <section className="smg-panel smg-stack">
        <h1>Live rounds</h1>
        {rounds === null ? (
          <p className="smg-muted">Loading…</p>
        ) : rounds.length === 0 ? (
          <p>No round is running.</p>
        ) : (
          <Rows rounds={rounds} open={setOpened} />
        )}
      </section>
      {opened === null ? null : (
        <RoundPanel
          key={opened}
          roundId={opened}
          rights={rights}
          close={() => {
            setOpened(null);
          }}
        />
      )}
    </div>
  );
}
