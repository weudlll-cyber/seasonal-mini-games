/**
 * @file   apps/web/src/live/useRound.ts
 * @module web/live
 * @brief  One round as the page shows it: the viewer's state, kept fresh, and the live feed.
 *
 * Responsibility: load `GET /rounds/:id/state` (the viewer's own view, 02 §11) and load it
 *                 again shortly after each frame of the round, at most four times a second;
 *                 keep the round's events as they arrive for the feed (the room's public
 *                 forms and the player's own events), newest first, at most 60, each shown
 *                 only once the loaded state holds it, so the list and the panels never
 *                 disagree (T124: measured, they did for 250–310 ms after each event). A frame with
 *                 `late` brings Frost's held events; in a Frost round one more load follows
 *                 each frame or reconnect after the delay, so an answer released while the
 *                 page was away still shows; a round counting down loads again just after it
 *                 opens, frame or not (T127). A load the server refused for the moment (the
 *                 session's API budget spent: 429) is tried again a second later until it
 *                 passes (T185: the intro stayed at "Opens in 0 s" when the load after the
 *                 opening's frame was refused). An answer for a round the page no longer shows
 *                 is dropped (T81). The client renders; the server decides.
 * Depends on:     react, @smg/contracts (shapes), ../shell/http, ./socket, ./retry
 * Used by:        ../match/MatchPage, ../round/RoundScreen
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.1, §4.4, §4.5
 */
import type { RoundFrameView, RoundStateView } from '@smg/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../shell/http.js';
import { retryable, useRetry } from './retry.js';
import { gameSocket } from './socket.js';

export interface FeedItem {
  readonly key: string;
  // The event's place in the round's log: shown once the state holds it (T124).
  readonly s: number;
  readonly at: number;
  readonly event: unknown;
}

export interface RoundLive {
  readonly state: RoundStateView | null;
  readonly feed: readonly FeedItem[];
  readonly reload: () => Promise<void>;
}

const FEED_LIMIT = 60;

// The state of the round shown now: an answer for another one (a reload of the last round
// still on its way when the next round loaded) is dropped, so it never shows over the new
// round (T81); so is an answer older than the one shown (two reloads crossing on the way,
// T124). `take` says whether it took the answer.
function useShownState(roundId: string | null) {
  const [state, setState] = useState<RoundStateView | null>(null);
  const shown = useRef(roundId);
  const shownSeq = useRef<number | null>(null);
  if (shown.current !== roundId) shownSeq.current = null;
  shown.current = roundId;
  const take = useCallback((next: RoundStateView): boolean => {
    if (next.roundId !== shown.current) return false;
    if (shownSeq.current !== null && next.seq < shownSeq.current) return false;
    shownSeq.current = next.seq;
    setState(next);
    return true;
  }, []);
  const clear = useCallback(() => {
    shownSeq.current = null;
    setState(null);
  }, []);
  return { state, take, clear };
}

// The events the shown state already holds (T124): a frame arrives before the reload that
// brings its effects (the fallen numbers, the new cooldown), so an event waits for that state
// and the list, the panels and the header always show the same moment.
const heldBy = (feed: readonly FeedItem[], state: RoundStateView | null): readonly FeedItem[] =>
  state === null ? [] : feed.filter((item) => item.s <= state.seq);

// A frame's events for the feed; a room frame and the player's own are told apart in the key.
const itemsOf = (frame: RoundFrameView): FeedItem[] =>
  frame.events
    .filter((e) => e.event !== null)
    .map((e) => ({
      key: `${String(e.s)}${frame.s === undefined ? 'p' : 'r'}`,
      s: e.s,
      at: e.at,
      event: e.event,
    }));

// The round's state from the server, taken if it is still the round shown; the taken state
// or null. A load refused for the moment (429 when the session's API budget is spent, a server
// error, no answer) is tried again a second later, one retry pending at a time, until it
// passes or the round changes (T185).
function useStateLoad(roundId: string | null, take: (next: RoundStateView) => boolean) {
  const { later, cancel } = useRetry();
  const load = useCallback(async (): Promise<RoundStateView | null> => {
    if (roundId === null) return null;
    try {
      const next = await api<RoundStateView>(`/rounds/${roundId}/state`);
      return take(next) ? next : null;
    } catch (error) {
      if (retryable(error)) later(() => void load());
      return null;
    }
  }, [roundId, take, later]);
  // A retry for the round shown before never runs for the next one.
  useEffect(() => cancel, [load, cancel]);
  return load;
}

export function useRound(roundId: string | null): RoundLive {
  const { state, take, clear } = useShownState(roundId);
  const [feed, setFeed] = useState<readonly FeedItem[]>([]);
  const pending = useRef<number | null>(null);
  const later = useRef<number | null>(null);
  const load = useStateLoad(roundId, take);
  const reload = useCallback(async () => {
    await load();
  }, [load]);
  // Under Frost an answer can be released while the page reconnects and miss its frame;
  // one more load after the delay shows it anyway (03 §2.4). Only after a frame or a
  // connect, never after itself, so it never loops.
  const reloadAndFollow = useCallback(async () => {
    const next = await load();
    if (next === null) return;
    if (next.frostDelayMs === null || next.status !== 'open') return;
    if (later.current !== null) window.clearTimeout(later.current);
    later.current = window.setTimeout(() => {
      later.current = null;
      void reload();
    }, next.frostDelayMs + 250);
  }, [load, reload]);
  useEffect(() => {
    clear();
    setFeed([]);
    void reloadAndFollow();
    const socket = gameSocket();
    const onFrame = (frame: RoundFrameView): void => {
      if (frame.roundId !== roundId) return;
      const items = itemsOf(frame);
      setFeed((f) => [...items.reverse(), ...f].slice(0, FEED_LIMIT));
      pending.current ??= window.setTimeout(() => {
        pending.current = null;
        void reloadAndFollow();
      }, 250);
    };
    const onConnect = (): void => {
      void reloadAndFollow();
    };
    socket.on('events', onFrame);
    socket.on('connect', onConnect);
    return () => {
      socket.off('events', onFrame);
      socket.off('connect', onConnect);
      for (const timer of [pending, later]) {
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [roundId, reloadAndFollow, clear]);
  useOpening(state, reload);
  return { state, feed: heldBy(feed, state), reload };
}

// A round counting down loads its state again just after it opens, so the intro never stays
// at "Opens in 0 s" if the frame of the opening is missed (T127). The stall seen in CI in
// night 4 and locally in night 5 was a refused load after the frame (T185, retried by
// useStateLoad); this stays as the only way out of a countdown whose frame never comes (a
// reconnect at the opening, a watch the server refused), at one load a round.
function useOpening(state: RoundStateView | null, reload: () => Promise<void>): void {
  const opensAt = state?.status === 'countdown' ? (state.opensAt ?? null) : null;
  useEffect(() => {
    if (opensAt === null) return;
    const timer = window.setTimeout(
      () => {
        void reload();
      },
      Math.max(0, opensAt - Date.now()) + 750,
    );
    return () => {
      window.clearTimeout(timer);
    };
    // Each new state re-arms it: a load that still found the countdown (clocks apart) tries
    // again 0.75 s later, until the round is open.
  }, [opensAt, state, reload]);
}
