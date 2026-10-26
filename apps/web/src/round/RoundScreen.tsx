/**
 * @file   apps/web/src/round/RoundScreen.tsx
 * @module web/round
 * @brief  A running round: banner, countdown or time left, cooldown ring, the game, roster, feed.
 *
 * Responsibility: the season banner with its token colour and icon, the special's name and
 *                 rule, the halving badge (03 §6); "Opens in 3 s" or the time left; for a
 *                 roster player the cooldown ring and the game's player panel, whose guesses
 *                 go through the socket and whose platform refusals appear here in plain words;
 *                 for everyone else the game's spectator panel; the roster and the live feed.
 *                 After the end the result screen takes over.
 * Depends on:     react, @smg/contracts, @smg-game/registry/web, ../live/*, ../season/*,
 *                 ./CooldownRing, ./RoundSide, ./ResultScreen, ./roundText, ./round.css
 * Used by:        ../match/MatchPage
 * Spec:           docs/spec/02-game-guess-the-number.md §4, §7, §11, §12; docs/spec/03-seasonal-specials.md §2, §6
 */
import { GAME_SCREENS, type GameWeb } from '@smg-game/registry/web';
import type { RoundStateView } from '@smg/contracts';
import type { ActReply } from '@smg/game-sdk';
import { useState, type CSSProperties, type ReactElement } from 'react';

import { intent, serverNow } from '../live/socket.js';
import type { RoundLive } from '../live/useRound.js';
import { useTicker } from '../live/useTicker.js';
import { SeasonIcon } from '../season/SeasonIcon.js';
import { SEASON_NAMES, seasonColor, SPECIALS } from '../season/season.js';
import { CooldownRing } from './CooldownRing.js';
import { ResultScreen } from './ResultScreen.js';
import { Feed, Roster } from './RoundSide.js';
import { codeText, seconds } from './roundText.js';
import './round.css';

interface RoundScreenProps {
  readonly live: RoundLive;
  readonly gameId: string;
  readonly viewerKey: string | null;
}

function Banner({ state }: { readonly state: RoundStateView }): ReactElement {
  const special = SPECIALS[state.season];
  return (
    <header className="round-banner" data-season={state.season} data-testid="round-banner">
      {/* On a light disc: the token icon would vanish on its own season colour. */}
      <span className="round-banner-icon">
        <SeasonIcon season={state.season} size="2.5rem" />
      </span>
      <div>
        <h1>
          {SEASON_NAMES[state.season]} round
          {state.halving ? <span className="round-badge">Halving round</span> : null}
        </h1>
        <p>
          {state.specialOn ? `${special.name}: ${special.rule}` : 'No season special this round.'}
        </p>
      </div>
    </header>
  );
}

function Clock({
  state,
  now,
}: {
  readonly state: RoundStateView;
  readonly now: number;
}): ReactElement | null {
  if (state.status === 'countdown' && state.opensAt !== null) {
    return (
      <p className="round-clock" data-testid="countdown">
        Opens in {Math.max(0, Math.ceil((state.opensAt - now) / 1_000))} s
      </p>
    );
  }
  if (state.status === 'open' && state.endsAt !== null) {
    const left = Math.max(0, state.endsAt - now);
    const minutes = Math.floor(left / 60_000);
    const secs = Math.floor((left % 60_000) / 1_000);
    return (
      <p className="round-clock">
        Open · {minutes}:{String(secs).padStart(2, '0')} left · cooldown {seconds(state.cooldownMs)}
      </p>
    );
  }
  return state.status === 'created' ? (
    <p className="round-clock">Waiting for the host to start.</p>
  ) : null;
}

interface PlayProps {
  readonly state: RoundStateView;
  readonly game: GameWeb | null;
  readonly viewerKey: string | null;
  readonly now: number;
  readonly reload: () => Promise<void>;
}

// A roster player's ring and panel, or the spectator panel for everyone else (02 §11).
function PlayArea({ state, game, viewerKey, now, reload }: PlayProps): ReactElement {
  const [refusal, setRefusal] = useState<string | null>(null);
  const mine = state.roster.find((r) => r.playerKey === viewerKey) ?? null;
  if (game === null || state.game === null)
    return <p className="smg-muted">The round starts soon.</p>;
  if (state.role !== 'player' || mine === null) {
    return <game.Spectator view={state.game} names={state.names} season={state.season} />;
  }
  const act = async (action: unknown): Promise<ActReply> => {
    const reply = await intent('guess', { roundId: state.roundId, ...(action as object) });
    // The game words its own refusals; the platform's are worded here.
    const own = reply.code === undefined ? null : game.text.code(reply.code);
    setRefusal(reply.ok || own !== null ? null : codeText(reply.code, reply.until, serverNow()));
    void reload();
    return reply;
  };
  const panel = {
    view: state.game,
    act,
    canAct: state.status === 'open' && mine.cooldownEndsAt <= now && !mine.solved,
    frostDelayMs: state.frostDelayMs,
    now: serverNow,
    season: state.season,
  };
  // The cooldown exists only while the round is open.
  const ring =
    state.status === 'open' ? (
      <CooldownRing endsAt={mine.cooldownEndsAt} cooldownMs={state.cooldownMs} now={now} />
    ) : null;
  return (
    <>
      <game.Player {...panel} />
      <game.Input {...panel} ring={ring} />
      {refusal === null ? null : (
        <p role="status" className="round-refusal">
          {refusal}
        </p>
      )}
    </>
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
  const now = serverNow();
  const style = { '--season': seasonColor(state.season) } as CSSProperties;
  return (
    <div className="round" style={style}>
      <Banner state={state} />
      <Clock state={state} now={now} />
      {state.status === 'aborted' ? (
        <p className="smg-panel">The round was aborted: {state.abortReason}</p>
      ) : null}
      <div className="round-main">
        <section className="smg-panel round-play">
          <PlayArea
            state={state}
            game={game}
            viewerKey={props.viewerKey}
            now={now}
            reload={props.live.reload}
          />
        </section>
        <aside className="round-side">
          <Roster state={state} now={now} />
          <Feed feed={feed} game={game} names={state.names} />
        </aside>
      </div>
    </div>
  );
}
