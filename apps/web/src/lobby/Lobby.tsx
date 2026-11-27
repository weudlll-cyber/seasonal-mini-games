/**
 * @file   apps/web/src/lobby/Lobby.tsx
 * @module web/lobby
 * @brief  The lobby: open matches, a match by its code, opening a match, and the Quick Test.
 *
 * Responsibility: the public matches in the lobby or running (06 §3.1 `GET /matches`), a field
 *                 to go to a match by its code, each match with its game (O41), for hosts
 *                 (`match.create`) a form to open a match of the game they choose (O41), with
 *                 its title, players at most, whether it is a team match (O34) and whether the
 *                 website lists it (on by default, O125), and in
 *                 development builds the way to the Quick Test, also for hosts only (the
 *                 greeting offers opening a match to them alone), and the lobby's chat room
 *                 (07 §2). Signed-out visitors are asked to
 *                 sign in or register; in website mode only to sign in, through the website
 *                 (O66, ../account/SignIn SignInLink).
 * Depends on:     react, @smg/contracts, ../account/SignIn, ../chat/ChatPanel, ../shell/*,
 *                 ../components/fields,
 *                 ../round/roundText (refusals), ../match/formHelp, ./games
 * Used by:        ../shell/AppShell
 * Spec:           docs/spec/02-game-guess-the-number.md §2; docs/spec/06-data-model-api-realtime.md §3.1
 */
import type { MatchSummaryView } from '@smg/contracts';
import { lazy, Suspense, useEffect, useState, type ReactElement, type SyntheticEvent } from 'react';

import { SignInLink } from '../account/SignIn.js';
import { ChatPanel } from '../chat/ChatPanel.js';
import { ChoiceField, NumberField, SwitchField, TextField } from '../components/fields.js';
import { FORM_HELP } from '../match/formHelp.js';
import { codeText } from '../round/roundText.js';
import { api, ApiError } from '../shell/http.js';
import { hrefOf, navigate } from '../shell/router.js';
import { useSession } from '../shell/session.js';
import { gameName, useGames } from './games.js';

// Development only: a production build drops this import with everything behind it.
const QuickTestLink = import.meta.env.DEV
  ? lazy(() => import('../shell/DevTools.js').then((m) => ({ default: m.QuickTestLink })))
  : null;

const LOBBY = { kind: 'lobby' } as const;

// Opens the match and goes to it; a refusal in plain words.
function useOpenMatch() {
  const [problem, setProblem] = useState<string | null>(null);
  const openWith = (body: {
    gameId: string;
    title: string;
    maxPlayers: number;
    teamMatch: boolean;
    showOnWebsite: boolean;
  }): void => {
    api<MatchSummaryView>('/matches', { method: 'POST', body })
      .then((m) => {
        navigate({ name: 'match', code: m.code });
      })
      .catch((error: unknown) => {
        const code = error instanceof ApiError ? error.code : '';
        const worded = code === 'MATCH_TOO_LARGE' || code === 'MAINTENANCE';
        setProblem(worded ? codeText(code) : 'The match could not be opened.');
      });
  };
  return { problem, openWith };
}

// The match's two switches: season teams (O34) and the website's list (O125, on by default;
// the host may switch it off now or while the match is open).
function MatchSwitches(p: {
  readonly teamMatch: boolean;
  readonly setTeamMatch: (on: boolean) => void;
  readonly showOnWebsite: boolean;
  readonly setShowOnWebsite: (on: boolean) => void;
}): ReactElement {
  return (
    <>
      <SwitchField
        label="Team match"
        help={FORM_HELP.teamMatch}
        checked={p.teamMatch}
        testId="team-match"
        onChange={p.setTeamMatch}
      />
      <SwitchField
        label="Show on the website"
        help={FORM_HELP.showOnWebsite}
        checked={p.showOnWebsite}
        testId="show-on-website"
        onChange={p.setShowOnWebsite}
      />
    </>
  );
}

function OpenMatch(): ReactElement {
  const games = useGames();
  // The host's choice, or the first game until they choose (O41).
  const [chosen, setChosen] = useState('');
  const [title, setTitle] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(50);
  const [teamMatch, setTeamMatch] = useState(true);
  const [showOnWebsite, setShowOnWebsite] = useState(true);
  const { problem, openWith } = useOpenMatch();
  const gameId = chosen === '' ? (games[0]?.id ?? '') : chosen;
  const open = (e: SyntheticEvent): void => {
    e.preventDefault();
    openWith({ gameId, title, maxPlayers, teamMatch, showOnWebsite });
  };
  return (
    <form className="sk-panel smg-stack" onSubmit={open} data-testid="open-match">
      <h2>Open a match</h2>
      <ChoiceField
        label="Game"
        help={FORM_HELP.game}
        value={gameId}
        options={games.map((g) => ({ value: g.id, label: g.name }))}
        testId="match-game"
        onChange={setChosen}
      />
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
      <MatchSwitches
        teamMatch={teamMatch}
        setTeamMatch={setTeamMatch}
        showOnWebsite={showOnWebsite}
        setShowOnWebsite={setShowOnWebsite}
      />
      {problem === null ? null : (
        <p role="alert" className="round-refusal">
          {problem}
        </p>
      )}
      <button
        type="submit"
        className="sk-btn sk-btn--primary"
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
        className="sk-input"
        maxLength={16}
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
        }}
      />
      <button type="submit" className="sk-btn" disabled={code.trim() === ''}>
        Go
      </button>
    </form>
  );
}

// Signed out: how to play. The website has its own registration, so website mode asks only
// for the sign-in.
function SignInLine({ website }: { readonly website: boolean }): ReactElement {
  return website ? (
    <p>
      <SignInLink>Sign in</SignInLink> to play. You can watch any match.
    </p>
  ) : (
    <p>
      <SignInLink>Sign in</SignInLink> or <a href={hrefOf({ name: 'register' })}>register</a> to
      play. You can watch any match.
    </p>
  );
}

// Signed out: the way in; signed in: the welcome, offering to open a match to hosts only.
function Greeting(p: {
  readonly name: string | null;
  readonly host: boolean;
  readonly website: boolean;
}) {
  if (p.name === null) return <SignInLine website={p.website} />;
  return (
    <p>
      Welcome, {p.name}. Join a match below{p.host ? ', or open one' : ''}.
    </p>
  );
}

export function Lobby({ dev }: { readonly dev: boolean }): ReactElement {
  const { session, can } = useSession();
  const games = useGames();
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
  // Opening a match, and the Quick Test that opens one, are for hosts (`match.create`).
  const host = can('match.create');
  return (
    <div className="smg-stack" data-testid="lobby">
      <section className="sk-panel smg-stack">
        <h1>Seasonal Mini Games</h1>
        <Greeting name={name} host={host} website={session?.authMode === 'website'} />
        <ByCode />
        {dev && host && QuickTestLink !== null ? (
          <Suspense fallback={null}>
            <QuickTestLink />
          </Suspense>
        ) : null}
      </section>
      <section className="sk-panel smg-stack" aria-labelledby="matches-title">
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
                <span className="smg-muted" data-testid="match-game-name">
                  · {gameName(games, m.gameId)} · {m.status} · up to {m.maxPlayers} players
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {host ? <OpenMatch /> : null}
      <ChatPanel target={LOBBY} />
    </div>
  );
}
