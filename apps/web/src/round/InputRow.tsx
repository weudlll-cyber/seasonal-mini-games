/**
 * @file   apps/web/src/round/InputRow.tsx
 * @module web/round
 * @brief  A roster player's input row: the game's input with the cooldown ring and refusals.
 *
 * Responsibility: the game's input (`game.Input`) with the platform's cooldown ring at its
 *                 start and the platform's refusals under it in plain words; a guess counts as
 *                 answered once the view holds the new cooldown (T76); the whole seconds left
 *                 of the cooldown go to the game, so its button reads "Wait 6 s" (T125). A
 *                 board game also gets the stage, the box it draws its board into (O51). Once
 *                 the player solved (individual mode), a short notice with their place
 *                 instead (O25). Moved out of ./RoundScreen to keep each file under the size
 *                 limit.
 * Depends on:     react, @smg/contracts, @smg/game-sdk (ActReply), @smg-game/registry/web
 *                 (types), ../live/socket, ./CooldownRing, ./RoundSide (colours), ./roundText
 * Used by:        ./RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §7, §12
 */
import type { GameWeb } from '@smg-game/registry/web';
import type { RoundStateView } from '@smg/contracts';
import type { ActReply } from '@smg/game-sdk';
import { useState, type ReactElement } from 'react';

import { intent, serverNow } from '../live/socket.js';
import { CooldownRing } from './CooldownRing.js';
import { colorsOf } from './RoundSide.js';
import { codeText, solvedText } from './roundText.js';

interface PlayProps {
  readonly state: RoundStateView;
  readonly game: GameWeb;
  readonly viewerKey: string | null;
  readonly now: number;
  readonly reload: () => Promise<void>;
  // A board game's stage, the box its input draws the board into; null for a list game.
  readonly stage: HTMLElement | null;
}

// Whole seconds left of the viewer's cooldown in an open round, else null (T125).
function waitOf(state: RoundStateView, endsAt: number, now: number): number | null {
  if (state.status !== 'open' || endsAt <= now) return null;
  return Math.ceil((endsAt - now) / 1_000);
}

// A roster player's input row with the ring, and the platform's refusals under it; once the
// player solved (individual mode), a short notice with their place instead (O25).
export function InputRow({
  state,
  game,
  viewerKey,
  now,
  reload,
  stage,
}: PlayProps): ReactElement | null {
  const [refusal, setRefusal] = useState<string | null>(null);
  const me = state.roster.find((r) => r.playerKey === viewerKey) ?? null;
  if (me === null || state.game === null) return null;
  if (me.solved) {
    return (
      <p className="round-input round-solved" role="status" data-testid="solved-notice">
        {solvedText(me.place)}
      </p>
    );
  }
  const act = async (action: unknown): Promise<ActReply> => {
    const reply = await intent('guess', { roundId: state.roundId, ...(action as object) });
    // The game words its own refusals; the platform's are worded here.
    const own = reply.code === undefined ? null : game.text.code(reply.code);
    setRefusal(reply.ok || own !== null ? null : codeText(reply.code, reply.until, serverNow()));
    // The answer counts as arrived once the view holds the new cooldown: until then the old
    // one would show Guess enabled for a send the server refuses (T76).
    await reload().catch(() => undefined);
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
        canAct={state.status === 'open' && me.cooldownEndsAt <= now}
        frostDelayMs={state.frostDelayMs}
        now={serverNow}
        season={state.season}
        specialOn={state.specialOn}
        waitS={waitOf(state, me.cooldownEndsAt, now)}
        names={state.names}
        colors={colorsOf(state)}
        ring={ring}
        stage={stage}
      />
      {refusal === null ? null : (
        <p role="status" className="round-refusal">
          {refusal}
        </p>
      )}
    </div>
  );
}
