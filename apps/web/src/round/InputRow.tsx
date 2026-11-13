/**
 * @file   apps/web/src/round/InputRow.tsx
 * @module web/round
 * @brief  A roster player's input row: the game's input with the cooldown ring and refusals.
 *
 * Responsibility: the game's input (`game.Input`) with the platform's cooldown ring at its
 *                 start and the platform's refusals under it in plain words; a guess counts as
 *                 answered once the view holds the new cooldown (T76); the whole seconds left
 *                 of the cooldown go to the game, so its button reads "Wait 6 s" (T125). A
 *                 board game also gets the stage, the box it draws its board into (O51). From
 *                 the inactivity warning point the countdown line above the input
 *                 (./InactivityLine, O71). Once the player solved (individual mode), a short
 *                 notice with their place instead (O25); once out of time, the notice that
 *                 they play the next round (O71), while they keep watching. In a phased round
 *                 (04 §4.8) every match player gets the input, also before the delayed roster
 *                 lists them (it shows a player only once their entry is one delay old), with no
 *                 ring, and acting ends at the plan's play end; the server decides every choice
 *                 (DECISIONS T326). Moved out of ./RoundScreen to keep each file under the size
 *                 limit.
 * Depends on:     react, @smg/contracts, @smg/game-sdk (ActReply), @smg-game/registry/web
 *                 (types), ../live/socket, ./CooldownRing, ./InactivityLine, ./RoundSide
 *                 (colours), ./roundText
 * Used by:        ./RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §7, §12
 */
import type { GameWeb } from '@smg-game/registry/web';
import type { RosterRowView, RoundStateView } from '@smg/contracts';
import type { ActReply, OwnMatchPart } from '@smg/game-sdk';
import { useState, type ReactElement } from 'react';

import { intent, serverNow } from '../live/socket.js';
import { CooldownRing } from './CooldownRing.js';
import { timingOf } from './InfoParts.js';
import { InactivityLine } from './InactivityLine.js';
import { colorsOf } from './RoundSide.js';
import { codeText, solvedText } from './roundText.js';
import { roundMarks } from './playerMarks.js';

interface PlayProps {
  readonly state: RoundStateView;
  readonly game: GameWeb;
  readonly viewerKey: string | null;
  readonly now: number;
  readonly reload: () => Promise<void>;
  // A board game's stage, the box its input draws the board into; null for a list game.
  readonly stage: HTMLElement | null;
  // A phased game's: the viewer's own part of the match (T327).
  readonly own?: OwnMatchPart | undefined;
}

// Whole seconds left of the viewer's cooldown in an open round, else null (T125).
function waitOf(state: RoundStateView, endsAt: number, now: number): number | null {
  if (state.status !== 'open' || endsAt <= now) return null;
  return Math.ceil((endsAt - now) / 1_000);
}

// The notice in place of the input row, or null while the player plays: solved (individual
// mode) with their place (O25), or out of time for this round (O71).
function noticeOf(me: RosterRowView): ReactElement | null {
  if (!me.solved && !me.timedOut) return null;
  return (
    <p
      className="round-input round-solved"
      role="status"
      data-testid={me.solved ? 'solved-notice' : 'timed-out-notice'}
    >
      {me.solved ? solvedText(me.place) : codeText('TIMED_OUT')}
    </p>
  );
}

// Whether the viewer may act now: the round open, their cooldown over, and in a phased round
// before the plan's play end (the server checks again, 04 §4.8 rule 2).
function mayAct(state: RoundStateView, me: RosterRowView | null, now: number): boolean {
  if (state.status !== 'open') return false;
  if (state.plan !== undefined) return now < (state.opensAt ?? 0) + state.plan.actionsEndMs;
  return (me?.cooldownEndsAt ?? 0) <= now;
}

// Who gets the input: a roster player, and in a phased round every match player (role
// `player`), also before the delayed roster lists them.
const inDock = (state: RoundStateView, me: RosterRowView | null): boolean =>
  me !== null || (state.plan !== undefined && state.role === 'player');

// The cooldown ring of an open guess round; a phased round has no cooldown (04 §4.8 rule 4).
function ringOf(state: RoundStateView, me: RosterRowView | null, now: number) {
  if (state.status !== 'open' || me === null || state.plan !== undefined) return null;
  return <CooldownRing endsAt={me.cooldownEndsAt} cooldownMs={state.cooldownMs} now={now} />;
}

// A roster player's input row with the ring, and the platform's refusals under it; once the
// player solved (individual mode), a short notice with their place instead (O25); once out
// of time, the timeout's notice (O71). A phased round's match player without a row yet (the
// roster is delayed) gets the input too.
export function InputRow({
  state,
  game,
  viewerKey,
  now,
  reload,
  stage,
  own,
}: PlayProps): ReactElement | null {
  const [refusal, setRefusal] = useState<string | null>(null);
  const me = state.roster.find((r) => r.playerKey === viewerKey) ?? null;
  if (state.game === null || !inDock(state, me)) return null;
  const notice = me === null ? null : noticeOf(me);
  if (notice !== null) return notice;
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
  const ring = ringOf(state, me, now);
  return (
    <div className="round-input">
      <InactivityLine inactivity={state.ownInactivity} now={now} />
      <game.Input
        view={state.game}
        act={act}
        canAct={mayAct(state, me, now)}
        frostDelayMs={state.frostDelayMs}
        now={serverNow}
        season={state.season}
        specialOn={state.specialOn}
        waitS={
          me === null || state.plan !== undefined ? null : waitOf(state, me.cooldownEndsAt, now)
        }
        names={state.names}
        colors={colorsOf(state)}
        marks={roundMarks(state, game, viewerKey)}
        viewerKey={viewerKey}
        ring={ring}
        stage={stage}
        timing={timingOf(state)}
        own={own}
      />
      {refusal === null ? null : (
        <p role="status" className="round-refusal">
          {refusal}
        </p>
      )}
    </div>
  );
}
