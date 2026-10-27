/**
 * @file   apps/web/src/lobby/Lobby.tsx
 * @module web/lobby
 * @brief  The lobby: open matches, a match by its code, opening a match, and the Quick Test.
 *
 * Responsibility: the public matches in the lobby or running (06 §3.1 `GET /matches`), a field
 *                 to go to a match by its code, for hosts (`match.create`) a form to open a
 *                 match of a registered game, and in development builds the way to the Quick
 *                 Test, and the lobby's chat room (07 §2). Signed-out visitors are asked to
 *                 sign in or register.
 * Depends on:     react, @smg/contracts, ../chat/ChatPanel, ../shell/*, ../components/fields
 * Used by:        ../shell/AppShell
 * Spec:           docs/spec/02-game-guess-the-number.md §2; docs/spec/06-data-model-api-realtime.md §3.1
 */
import type { GameInfoView, MatchSummaryView } from '@smg/contracts';
import { lazy, Suspense, useEffect, useState, type ReactElement, type SyntheticEvent } from 'react';

import { ChatPanel } from '../chat/ChatPanel.js';
import { NumberField, TextField } from '../components/fields.js';
import { api, ApiError } from '../shell/http.js';
import { hrefOf, navigate } from '../shell/router.js';
import { useSession } from '../shell/session.js';

// Development only: a production build drops this import with everything behind it.
const QuickTestLink = import.meta.env.DEV
  ? lazy(() => import('../shell/DevTools.js').then((m) => ({ default: m.QuickTestLink })))
  : null;

const LOBBY = { kind: 'lobby' } as const;

function OpenMatch(): ReactElement {
  const [games, setGames] = useState<readonly GameInfoView[]>([]);
  const [title, setTitle] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(50);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    void api<{ games: GameInfoView[] }>('/games').then((r) => {
      setGames(r.games);
    });
  }, []);
  const open = (e: SyntheticEvent): void => {
    e.preventDefault();
    const body = { gameId: games[0]?.id, title, maxPlayers };
    api<MatchSummaryView>('/matches', { method: 'POST', body })
      .then((m) => {
        navigate({ name: 'match', code: m.code });
      })
      .catch((error: unknown) => {
        const tooLarge = error instanceof ApiError && error.code === 'MATCH_TOO_LARGE';
        setProblem(
          tooLarge ? 'That many players are not allowed.' : 'The match could not be opened.',
        );
      });
  };
  return (
    <form className="smg-panel smg-stack" onSubmit={open} data-testid="open-match">
      <h2>Open a match</h2>
      <TextField
        label="Title"
        value={title}
        maxLength={80}
        testId="match-title"
        onChange={setTitle}
      />
      <NumberField
        label="Players at most"
        value={maxPlayers}
        min={2}
        max={1_000}
        onChange={setMaxPlayers}
      />
      <p className="smg-muted">Game: {games[0]?.name ?? '…'}</p>
      {problem === null ? null : (
        <p role="alert" className="round-refusal">
          {problem}
        </p>
      )}
      <button
        type="submit"
        className="smg-btn smg-btn--primary"
        disabled={games.length === 0 || title.trim() === ''}
      >
        Open match
      </button>
    </form>
  );
}

function ByCode(): ReactElement {
  const [code, setCode] = useState('');
  return (
    <form
      className="smg-row"
      onSubmit={(e) => {
        e.preventDefault();
        navigate({ name: 'match', code: code.trim().toUpperCase() });
      }}
    >
      <label htmlFor="match-code">Match code</label>
      <input
        id="match-code"
        className="smg-input"
        maxLength={16}
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
        }}
      />
      <button type="submit" className="smg-btn" disabled={code.trim() === ''}>
        Go
      </button>
    </form>
  );
}

export function Lobby({ dev }: { readonly dev: boolean }): ReactElement {
  const { session, can } = useSession();
  const [matches, setMatches] = useState<readonly MatchSummaryView[] | null>(null);
  useEffect(() => {
    void api<{ matches: MatchSummaryView[] }>('/matches')
      .then((r) => {
        setMatches(r.matches);
      })
      .catch(() => {
        setMatches([]);
      });
  }, []);
  const name = session?.account?.displayName ?? null;
  return (
    <div className="smg-stack" data-testid="lobby">
      <section className="smg-panel smg-stack">
        <h1>Seasonal Mini Games</h1>
        {name === null ? (
          <p>
            <a href={hrefOf({ name: 'signIn' })}>Sign in</a> or{' '}
            <a href={hrefOf({ name: 'register' })}>register</a> to play. You can watch any match.
          </p>
        ) : (
          <p>Welcome, {name}. Join a match below, or open one.</p>
        )}
        <ByCode />
        {dev && QuickTestLink !== null ? (
          <Suspense fallback={null}>
            <QuickTestLink />
          </Suspense>
        ) : null}
      </section>
      <section className="smg-panel smg-stack" aria-labelledby="matches-title">
        <h2 id="matches-title">Matches</h2>
        {matches === null ? (
          <p className="smg-muted">Loading…</p>
        ) : matches.length === 0 ? (
          <p className="smg-muted">No match is open right now.</p>
        ) : (
          <ul className="smg-stack" data-testid="matches">
            {matches.map((m) => (
              <li key={m.code}>
                <a href={hrefOf({ name: 'match', code: m.code })}>{m.title}</a>{' '}
                <span className="smg-muted">
                  · {m.status} · up to {m.maxPlayers} players
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {can('match.create') ? <OpenMatch /> : null}
      <ChatPanel target={LOBBY} />
    </div>
  );
}
