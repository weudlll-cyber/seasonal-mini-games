/**
 * @file   apps/web/src/live/useRound.ts
 * @module web/live
 * @brief  One round as the page shows it: the viewer's state, kept fresh, and the live feed.
 *
 * Responsibility: load `GET /rounds/:id/state` (the viewer's own view, 02 §11) and load it
 *                 again shortly after each frame of the round, at most four times a second;
 *                 keep the round's events as they arrive for the feed (the room's public
 *                 forms and the player's own events), newest first, at most 60. A frame with
 *                 `late` brings Frost's held events; in a Frost round one more load follows
 *                 each frame or reconnect after the delay, so an answer released while the
 *                 page was away still shows. The client renders; the server decides.
 * Depends on:     react, @smg/contracts (shapes), ../shell/http, ./socket
 * Used by:        ../match/MatchPage, ../round/RoundScreen
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.1, §4.4, §4.5
 */
import type { RoundFrameView, RoundStateView } from '@smg/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../shell/http.js';
import { gameSocket } from './socket.js';

export interface FeedItem {
  readonly key: string;
  readonly at: number;
  readonly event: unknown;
}

export interface RoundLive {
  readonly state: RoundStateView | null;
  readonly feed: readonly FeedItem[];
  readonly reload: () => Promise<void>;
}

const FEED_LIMIT = 60;

export function useRound(roundId: string | null): RoundLive {
  const [state, setState] = useState<RoundStateView | null>(null);
  const [feed, setFeed] = useState<readonly FeedItem[]>([]);
  const pending = useRef<number | null>(null);
  const later = useRef<number | null>(null);
  const reload = useCallback(async () => {
    if (roundId === null) return;
    setState(await api<RoundStateView>(`/rounds/${roundId}/state`));
  }, [roundId]);
  // Under Frost an answer can be released while the page reconnects and miss its frame;
  // one more load after the delay shows it anyway (03 §2.4). Only after a frame or a
  // connect, never after itself, so it never loops.
  const reloadAndFollow = useCallback(async () => {
    if (roundId === null) return;
    const next = await api<RoundStateView>(`/rounds/${roundId}/state`);
    setState(next);
    if (next.frostDelayMs === null || next.status !== 'open') return;
    if (later.current !== null) window.clearTimeout(later.current);
    later.current = window.setTimeout(() => {
      later.current = null;
      void reload();
    }, next.frostDelayMs + 250);
  }, [roundId, reload]);
  useEffect(() => {
    setState(null);
    setFeed([]);
    void reloadAndFollow();
    const socket = gameSocket();
    const onFrame = (frame: RoundFrameView): void => {
      if (frame.roundId !== roundId) return;
      const items = frame.events
        .filter((e) => e.event !== null)
        .map((e) => ({
          key: `${String(e.s)}${frame.s === undefined ? 'p' : 'r'}`,
          at: e.at,
          event: e.event,
        }));
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
  }, [roundId, reloadAndFollow]);
  return { state, feed, reload };
}
