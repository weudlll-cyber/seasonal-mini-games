/**
 * @file   apps/web/src/round/RoundScreen.tsx
 * @module web/round
 * @brief  A running round on one screen: top bar, range and the one guess list, teams, input.
 *
 * Responsibility: the round view everyone gets alike, the host included (O16): a one-line top
 *                 bar (season chip in its token colour with icon and special, the halving
 *                 badge, shared or individual, the cooldown, the time left or "Opens in 3 s",
 *                 and the host menu for the host); the main area with the game's range block
 *                 (the player panel for a roster player, else the spectator panel) above the
 *                 round's one list of guesses and events (./RoundLog, O20); the side column
 *                 with the team tiles; and for a roster player the game's input row with the
 *                 cooldown ring, whose platform refusals appear under it in plain words. The
 *                 layout (round.css) fits the viewport without a page scrollbar; only the list
 *                 scrolls inside itself. After the end the result screen takes over.
 * Depends on:     react, @smg/contracts, @smg-game/registry/web, ../live/*, ../season/*,
 *                 ./CooldownRing, ./RoundLog, ./RoundSide, ./ResultScreen, ./roundText,
 *                 ./round.css
 * Used by:        ../match/MatchPage
 * Spec:           docs/spec/02-game-guess-the-number.md §4, §7, §11, §12; docs/spec/03-seasonal-specials.md §2, §6
 */
import { GAME_SCREENS, type GameWeb } from '@smg-game/registry/web';
import type { RoundStateView, TeamName } from '@smg/contracts';
import type { ActReply } from '@smg/game-sdk';
import { useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';

import { intent, serverNow } from '../live/socket.js';
import type { RoundLive } from '../live/useRound.js';
import { useTicker } from '../live/useTicker.js';
import { SeasonIcon } from '../season/SeasonIcon.js';
import { SEASON_NAMES, seasonColor, SPECIALS } from '../season/season.js';
import { CooldownRing } from './CooldownRing.js';
import { ResultScreen } from './ResultScreen.js';
import { RoundLog } from './RoundLog.js';
import { TeamTiles } from './RoundSide.js';
import { codeText, seconds } from './roundText.js';
import './round.css';

interface RoundScreenProps {
  readonly live: RoundLive;
  readonly gameId: string;
  readonly viewerKey: string | null;
  // The host menu for the host, else null.
  readonly hostMenu: ReactNode;
  readonly teamPoints: readonly { readonly team: TeamName; readonly points: number }[];
}

function timeText(state: RoundStateView, now: number): string {
  if (state.status === 'countdown' && state.opensAt !== null) {
    return `Opens in ${String(Math.max(0, Math.ceil((state.opensAt - now) / 1_000)))} s`;
  }
  if (state.status === 'open' && state.endsAt !== null) {
    const left = Math.max(0, state.endsAt - now);
    const secs = Math.floor((left % 60_000) / 1_000);
    return `${String(Math.floor(left / 60_000))}:${String(secs).padStart(2, '0')} left`;
  }
  return state.status === 'created' ? 'Waiting for the host' : '';
}

function TopBar(p: {
  readonly state: RoundStateView;
  readonly now: number;
  readonly hostMenu: ReactNode;
}): ReactElement {
  const { state } = p;
  return (
    <header className="round-top" data-testid="round-banner">
      <span className="round-season" data-season={state.season}>
        {/* On a light disc: the token icon would vanish on its own season colour. */}
        <span className="round-season-icon">
          <SeasonIcon season={state.season} size="1.25rem" />
        </span>
        <span>
          <strong>{SEASON_NAMES[state.season]}</strong>
          <span className="round-special">
            {' '}
            · {state.specialOn ? SPECIALS[state.season].name : 'no special'}
          </span>
        </span>
        {state.halving ? <span className="round-badge">Halving round</span> : null}
      </span>
      <span className="round-fact round-mode">
        {state.secretMode === 'shared' ? 'Shared' : 'Individual'}
      </span>
      <span className="round-fact" data-testid="round-cooldown">
        <span className="round-fact-label">Cooldown </span>
        {seconds(state.cooldownMs)}
      </span>
      <span className="round-fact" data-testid="countdown">
        {timeText(state, p.now)}
      </span>
      {p.hostMenu}
    </header>
  );
}

interface PlayProps {
  readonly state: RoundStateView;
  readonly game: GameWeb;
  readonly viewerKey: string | null;
  readonly now: number;
  readonly reload: () => Promise<void>;
}

// A roster player's input row with the ring, and the platform's refusals under it.
function InputRow({ state, game, viewerKey, now, reload }: PlayProps): ReactElement | null {
  const [refusal, setRefusal] = useState<string | null>(null);
  const me = state.roster.find((r) => r.playerKey === viewerKey) ?? null;
  if (me === null || state.game === null) return null;
  const act = async (action: unknown): Promise<ActReply> => {
    const reply = await intent('guess', { roundId: state.roundId, ...(action as object) });
    // The game words its own refusals; the platform's are worded here.
    const own = reply.code === undefined ? null : game.text.code(reply.code);
    setRefusal(reply.ok || own !== null ? null : codeText(reply.code, reply.until, serverNow()));
    void reload();
    return reply;
  };
  // The cooldown exists only while the round is open.
  const ring =
    state.status === 'open' ? (
      <CooldownRing endsAt={me.cooldownEndsAt} cooldownMs={state.cooldownMs} now={now} />
    ) : null;
  return (
    <div className="round-input">
      <game.Input
        view={state.game}
        act={act}
        canAct={state.status === 'open' && me.cooldownEndsAt <= now && !me.solved}
        frostDelayMs={state.frostDelayMs}
        now={serverNow}
        season={state.season}
        ring={ring}
      />
      {refusal === null ? null : (
        <p role="status" className="round-refusal">
          {refusal}
        </p>
      )}
    </div>
  );
}

export function RoundScreen(props: RoundScreenProps): ReactElement {
  const { state, feed } = props.live;
  useTicker(state !== null && state.status !== 'ended' && state.status !== 'aborted');
  const game = GAME_SCREENS[props.gameId] ?? null;
  if (state === null) return <p className="smg-muted">Loading the round…</p>;
  if (state.status === 'ended') {
    return <ResultScreen state={state} game={game} viewerKey={props.viewerKey} />;
  }
  if (state.status === 'aborted') {
    return <p className="smg-panel">The round was aborted: {state.abortReason}</p>;
  }
  const now = serverNow();
  const style = { '--season': seasonColor(state.season) } as CSSProperties;
  const player = state.role === 'player' && game !== null;
  return (
    <div className="round-live" style={style} data-testid="round-view">
      <TopBar state={state} now={now} hostMenu={props.hostMenu} />
      <section className="smg-panel round-main" aria-label="The round">
        {game === null || state.game === null ? (
          <p className="smg-muted">The round starts soon.</p>
        ) : player ? (
          // The main area only shows; guesses go through the input row.
          <game.Player
            view={state.game}
            act={() => Promise.resolve({ ok: false })}
            canAct={false}
            frostDelayMs={state.frostDelayMs}
            now={serverNow}
            season={state.season}
          />
        ) : (
          <game.Spectator view={state.game} names={state.names} season={state.season} />
        )}
        <RoundLog feed={feed} game={game} state={state} viewerKey={props.viewerKey} now={now} />
      </section>
      <aside className="round-side">
        <TeamTiles state={state} points={props.teamPoints} />
      </aside>
      {player ? (
        <InputRow
          state={state}
          game={game}
          viewerKey={props.viewerKey}
          now={now}
          reload={props.live.reload}
        />
      ) : null}
    </div>
  );
}
