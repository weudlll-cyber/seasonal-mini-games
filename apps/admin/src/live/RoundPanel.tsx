/**
 * @file   apps/admin/src/live/RoundPanel.tsx
 * @module admin/live
 * @brief  One round as staff watch it, with the staff actions: abort, kick, remove a result.
 *
 * Responsibility: the spectator view staff get (`GET /admin/rounds/:id`: status, players with
 *                 their guesses and places, never a secret before the end), reloaded every 3
 *                 seconds; while it runs, abort it with a reason (`match.abort`); kick an
 *                 active player of the match with a reason (`match.manage`); after the end,
 *                 remove one player's result with a reason (`leaderboard.adjust`). Each action
 *                 goes through the confirm dialog with its effect in one sentence.
 * Depends on:     react, ../ConfirmDialog, ../http
 * Used by:        ./LivePage
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.2; Bingo 11 §1, §3.2
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { useConfirm, type ConfirmRequest } from '../ConfirmDialog.js';
import { api } from '../http.js';

export interface Rights {
  readonly abort: boolean;
  readonly kick: boolean;
  readonly removeResult: boolean;
}

interface StaffRound {
  readonly roundId: string;
  readonly status: string;
  readonly abortReason: string | null;
  readonly roster: readonly { playerKey: string; guesses: number; place: number | null }[];
  readonly results?: readonly { playerId: string; place: number | null; points: number }[];
  readonly names: Readonly<Record<string, string>>;
  readonly match: { readonly id: string; readonly code: string; readonly title: string };
  readonly players: readonly string[];
  readonly removed: readonly string[];
}

const REFRESH_MS = 3_000;
const RUNNING = new Set(['created', 'countdown', 'open']);
const REASON = { label: 'Reason (goes into the audit log)', minLength: 3 };

function requests(view: StaffRound) {
  const name = (key: string) => view.names[key] ?? key;
  const post = (path: string, body: object) => api(path, { method: 'POST', body });
  return {
    abort: (): ConfirmRequest => ({
      title: 'Abort this round',
      effect: `The round of ${view.match.title} ends at once for every player, shown as aborted by staff with your reason.`,
      confirmLabel: 'Abort round',
      danger: true,
      ask: REASON,
      action: (reason) => post(`/admin/rounds/${view.roundId}/abort`, { reason }),
    }),
    kick: (key: string): ConfirmRequest => ({
      title: `Kick ${name(key)}`,
      effect: `${name(key)} leaves ${view.match.title} for good and cannot guess or join again.`,
      confirmLabel: 'Kick player',
      danger: true,
      ask: REASON,
      action: (reason) => post(`/admin/matches/${view.match.id}/kick`, { playerKey: key, reason }),
    }),
    remove: (key: string): ConfirmRequest => ({
      title: `Remove the result of ${name(key)}`,
      effect: `The match standings, team standings and league boards leave out this round's result of ${name(key)}.`,
      confirmLabel: 'Remove result',
      danger: true,
      ask: REASON,
      action: (reason) =>
        post(`/admin/rounds/${view.roundId}/results/${encodeURIComponent(key)}/remove`, {
          reason,
        }),
    }),
  };
}

// Name, guesses, place and points (or "removed") of one player.
function cells(view: StaffRound, k: string): string[] {
  const row = view.roster.find((r) => r.playerKey === k);
  const result = view.results?.find((r) => r.playerId === k);
  const points = view.removed.includes(k) ? 'removed' : String(result?.points ?? '—');
  return [view.names[k] ?? k, String(row?.guesses ?? '—'), String(row?.place ?? '—'), points];
}

function PlayerRow(p: {
  readonly k: string;
  readonly view: StaffRound;
  readonly rights: Rights;
  readonly open: (r: ConfirmRequest) => void;
}): ReactElement {
  const { k, view } = p;
  const result = view.results?.find((r) => r.playerId === k);
  const removed = view.removed.includes(k);
  const canKick = p.rights.kick && view.players.includes(k);
  const canRemove = p.rights.removeResult && result !== undefined && !removed;
  const action = (make: (key: string) => ConfirmRequest) => () => {
    p.open(make(k));
  };
  return (
    <tr>
      {cells(view, k).map((text, i) => (
        <td key={String(i)}>{text}</td>
      ))}
      <td>
        {canKick ? (
          <button type="button" className="smg-btn" onClick={action(requests(view).kick)}>
            Kick
          </button>
        ) : null}
        {canRemove ? (
          <button type="button" className="smg-btn" onClick={action(requests(view).remove)}>
            Remove result
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function Players({
  view,
  rights,
  open,
}: {
  readonly view: StaffRound;
  readonly rights: Rights;
  readonly open: (r: ConfirmRequest) => void;
}): ReactElement {
  const keys = [...new Set([...view.roster.map((r) => r.playerKey), ...view.players])];
  return (
    <div className="admin-table-wrap">
      <table className="admin-table" data-testid="round-players">
        <thead>
          <tr>
            {['Player', 'Guesses', 'Place', 'Points', 'Action'].map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <PlayerRow key={key} k={key} view={view} rights={rights} open={open} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RoundPanel(p: {
  readonly roundId: string;
  readonly rights: Rights;
  readonly close: () => void;
}): ReactElement {
  const [view, setView] = useState<StaffRound | null>(null);
  const load = useCallback(async () => {
    setView(await api<StaffRound>(`/admin/rounds/${p.roundId}`));
  }, [p.roundId]);
  const [dialog, open] = useConfirm(() => void load());
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => {
      clearInterval(timer);
    };
  }, [load]);
  if (view === null) return <p className="smg-muted">Loading…</p>;
  return (
    <section className="smg-panel smg-stack" data-testid="round-panel">
      <h2>
        {view.match.title} <small className="smg-muted">{view.match.code}</small>
      </h2>
      <p role="status">
        Status: {view.status}
        {view.abortReason === null ? '' : ` — aborted ${view.abortReason}`}
      </p>
      <Players view={view} rights={p.rights} open={open} />
      <div className="smg-row">
        {p.rights.abort && RUNNING.has(view.status) ? (
          <button
            type="button"
            className="smg-btn smg-btn--danger"
            onClick={() => {
              open(requests(view).abort());
            }}
          >
            Abort round
          </button>
        ) : null}
        <button type="button" className="smg-btn" onClick={p.close}>
          Close
        </button>
      </div>
      {dialog}
    </section>
  );
}
