/**
 * @file   apps/admin/src/seasons/SeasonsPage.tsx
 * @module admin/seasons
 * @brief  The Seasons area: the In Season feed's state and the halving days.
 *
 * Responsibility: the feed's last good answer, its age and last error, and "Refresh now"
 *                 (07 §5); the halving days from the feed and from admins, with adding a day
 *                 and token and removing one (03 §4, 06 §2.6). Every change is audited by the
 *                 server.
 * Depends on:     react, ../http, ../TextInput
 * Used by:        ../App
 * Spec:           docs/spec/08-admin-settings.md §1, §5; docs/spec/07-integration.md §5
 */
import { useCallback, useEffect, useState, type ReactElement, type SyntheticEvent } from 'react';

import { api } from '../http.js';
import { TextInput } from '../TextInput.js';

interface FeedState {
  readonly inSeason: {
    readonly season: string;
    readonly token: string;
    readonly fetchedAt: number;
  } | null;
  readonly fetchedAt: number | null;
  readonly lastError: string | null;
}

interface HalvingDay {
  readonly day: string;
  readonly token: string;
  readonly source: string;
}

function feedText(feed: FeedState): string {
  if (feed.inSeason === null) return 'No answer yet.';
  const at = new Date(feed.inSeason.fetchedAt).toLocaleString();
  return `${feed.inSeason.season} (${feed.inSeason.token}), fetched ${at}`;
}

function Feed(): ReactElement {
  const [feed, setFeed] = useState<FeedState | null>(null);
  const load = useCallback(async () => {
    setFeed(await api<FeedState>('/admin/seasons/feed'));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const refresh = (): void => {
    void api('/admin/seasons/feed/refresh', { method: 'POST', body: {} }).then(load);
  };
  return (
    <section className="smg-panel smg-stack" data-testid="feed">
      <h2>In Season feed</h2>
      {feed === null ? <p className="smg-muted">Loading…</p> : <p>{feedText(feed)}</p>}
      {feed?.lastError == null ? null : <p role="alert">Last error: {feed.lastError}</p>}
      <button type="button" className="smg-btn" onClick={refresh}>
        Refresh now
      </button>
    </section>
  );
}

function AddDay({ done }: { readonly done: () => Promise<void> }): ReactElement {
  const [day, setDay] = useState('');
  const [token, setToken] = useState('');
  const add = (e: SyntheticEvent): void => {
    e.preventDefault();
    void api('/admin/halving-days', { method: 'POST', body: { day, token } }).then(done);
  };
  return (
    <form className="smg-row" onSubmit={add}>
      <TextInput label="Day" type="date" value={day} onChange={setDay} />
      <TextInput
        label="Token"
        placeholder="token, e.g. SUMMER"
        maxLength={40}
        value={token}
        onChange={setToken}
      />
      <button
        type="submit"
        className="smg-btn smg-btn--primary"
        disabled={day === '' || token.trim() === ''}
      >
        Add halving day
      </button>
    </form>
  );
}

function HalvingDays(): ReactElement {
  const [days, setDays] = useState<readonly HalvingDay[]>([]);
  const load = useCallback(async () => {
    setDays((await api<{ days: HalvingDay[] }>('/admin/halving-days')).days);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const remove = (d: HalvingDay): void => {
    void api(`/admin/halving-days/${d.day}/${encodeURIComponent(d.token)}`, {
      method: 'DELETE',
    }).then(load);
  };
  return (
    <section className="smg-panel smg-stack" data-testid="halving-days">
      <h2>Halving days</h2>
      <ul>
        {days.map((d) => (
          <li key={`${d.day}/${d.token}`}>
            {d.day} · {d.token} <small className="smg-muted">({d.source})</small>{' '}
            <button
              type="button"
              className="smg-btn"
              onClick={() => {
                remove(d);
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <AddDay done={load} />
    </section>
  );
}

export function SeasonsPage(): ReactElement {
  return (
    <div className="smg-stack">
      <h1>Seasons</h1>
      <Feed />
      <HalvingDays />
    </div>
  );
}
