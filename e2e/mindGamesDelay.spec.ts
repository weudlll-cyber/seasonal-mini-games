/**
 * @file   e2e/mindGamesDelay.spec.ts
 * @module e2e
 * @brief  Journey 41: nothing of a Mind Games round reaches anyone earlier than the delay.
 *
 * Responsibility: 09 §4 journey 41: during a Quick Test round with 6 bots switching (delay
 *                 10 s), a guest's page and the playing host's page record every socket frame and
 *                 poll `GET …/state` once a second; no recorded frame holds a released choice
 *                 younger than the delay; no state answer holds a line younger than it, and its
 *                 players in the round are exactly those with a first-choice line; the room's
 *                 release numbers are gap-free; the acknowledgements carry no number; the
 *                 admin's round view, the delayed spectator view, holds nothing younger than the
 *                 delay (DECISIONS T337), and the public read API no count, line or entrant
 *                 before the end. A player who joins after the join time is refused with
 *                 `JOIN_CLOSED` by the receive time.
 * Depends on:     @playwright/test, ./mindGames, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 41), §6; docs/spec/05-security-threat-model.md §3.2
 */
import { expect, test, type Page } from '@playwright/test';

import { guessHttp, mindQuickTest, roundIdOf, startRound } from './mindGames.js';
import {
  abortMatch,
  attempt,
  call,
  closeAll,
  person,
  playerRow,
  roundOpen,
  visit,
  type Person,
} from './play.js';

const WIDE = { width: 1280, height: 720 };
const DELAY = 10_000;
// One release tick and the page's own clock.
const SLACK = 1_500;

interface Seen {
  readonly at: number;
  readonly text: string;
}

// Every socket frame the page receives, with its arrival time.
function record(page: Page): Seen[] {
  const seen: Seen[] = [];
  page.on('websocket', (ws) => {
    ws.on('framereceived', (f) => {
      if (typeof f.payload === 'string') seen.push({ at: Date.now(), text: f.payload });
    });
  });
  return seen;
}

interface FrameEvent {
  readonly s: number;
  readonly at: number;
  readonly event: { readonly type?: string; readonly event?: { readonly type?: string } } | null;
}
interface Frame {
  readonly s?: number;
  readonly events: readonly FrameEvent[];
}

// The room frames among the recorded ones ('42/play,["events", {...}]').
function roomFrames(seen: readonly Seen[]): { readonly at: number; readonly frame: Frame }[] {
  return seen.flatMap((x) => {
    const start = x.text.indexOf('[');
    if (!x.text.startsWith('42') || start < 0) return [];
    const [name, frame] = JSON.parse(x.text.slice(start)) as [string, Frame];
    return name === 'events' && frame.s !== undefined ? [{ at: x.at, frame }] : [];
  });
}

function checkFrames(seen: readonly Seen[]): void {
  const frames = roomFrames(seen);
  const numbers = frames.flatMap((f) => f.frame.events.map((e) => e.s));
  for (let i = 1; i < numbers.length; i++) expect(numbers[i]).toBe((numbers[i - 1] ?? 0) + 1);
  for (const f of frames) {
    for (const e of f.frame.events) {
      if (e.event?.event?.type === 'ChoiceFed') expect(f.at - e.at).toBeGreaterThan(DELAY - SLACK);
    }
  }
  const acks = seen.filter((x) => /^43/.test(x.text));
  for (const a of acks) expect(a.text).not.toContain('receiveSeq');
}

interface Line {
  readonly at: number;
  readonly from: string | null;
}

// One state answer: no line younger than the delay, its players exactly those with a line.
async function checkState(
  p: Person,
  roundId: string,
  path = `/rounds/${roundId}/state`,
): Promise<boolean> {
  const asked = Date.now();
  const r = await attempt(p, 'GET', path);
  const state = r.body as { status: string; game: { lines?: Line[]; entrants?: number } | null };
  if (state.status !== 'open' || state.game?.lines === undefined) return state.status !== 'ended';
  for (const l of state.game.lines) expect(l.at).toBeLessThan(asked - DELAY + SLACK);
  expect(state.game.entrants).toBe(state.game.lines.filter((l) => l.from === null).length);
  return true;
}

// The admin's round view is the delayed spectator view (morning sheet G13): nothing in it
// younger than the delay; the public read API holds no count, line or entrant at all.
async function adminAndPublic(admin: Person, roundId: string): Promise<void> {
  expect(await checkState(admin, roundId, `/admin/rounds/${roundId}`)).toBe(true);
  const text = JSON.stringify((await attempt(admin, 'GET', '/public/rounds/current')).body);
  expect(text).not.toMatch(/"counts"|"entrants"|"lines"|ChoiceFed/);
}

test('journey 41: no frame or answer of a Mind Games round is younger than the delay', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const host = await person(browser, 'host', WIDE);
  const guest = await person(browser, 'guest', WIDE);
  const admin = await person(browser, 'admin', WIDE);
  const hostSeen = record(host.page);
  const guestSeen = record(guest.page);
  // The pages' sockets open again under the recorders.
  for (const p of [host, guest]) await p.page.reload();
  let code = '';
  try {
    code = await mindQuickTest(host, {
      fields: { 'Total length': '40', Delay: '10', Switches: 'visible' },
      bots: 6,
      picks: { 1: 'winter' },
    });
    await guest.page.goto(`./#/match/${code}`);
    await startRound(host);
    await roundOpen(host.page);
    const roundId = await roundIdOf(host, code);
    await adminAndPublic(admin, roundId);
    // A switch of the host's own once its first choice is in the feed: an acknowledgement.
    await host.page.getByRole('radio', { name: /Spring/ }).click({ timeout: 20_000 });
    let open = true;
    while (open) {
      open = (await checkState(host, roundId)) && (await checkState(guest, roundId));
      if (open) await adminAndPublic(admin, roundId);
      await host.page.waitForTimeout(1_000);
    }
    checkFrames(hostSeen);
    checkFrames(guestSeen);
    for (const seen of [hostSeen, guestSeen]) expect(roomFrames(seen).length).toBeGreaterThan(0);
    expect(
      hostSeen.some((x) => /^43/.test(x.text)),
      'an acknowledgement',
    ).toBe(true);
  } finally {
    if (code !== '') await abortMatch(host, code);
    await closeAll([host, guest, admin]);
  }
});

test('journey 41: a choice after the join time is refused by the receive time', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const host = await person(browser, 'host', WIDE);
  const one = await person(browser, 'player-1', WIDE);
  const late = await person(browser, 'player-2', WIDE);
  const m = await call<{ code: string }>(host, 'POST', '/matches', {
    gameId: 'mind-games',
    title: 'e2e join closed',
    maxPlayers: 10,
  });
  try {
    await call(one, 'POST', `/matches/${m.code}/join`, {});
    for (const p of [host, one]) await visit(p, m.code);
    // The first round's minimum counts the players whose page watches the match.
    await expect(playerRow(host, 'dev-player-1')).toContainText('online');
    await call(host, 'POST', `/matches/${m.code}/rounds`, {
      season: 'winter',
      settings: {
        'mind.totalS': 30,
        'mind.delayS': 5,
        'round.countdownS': 3,
        'round.seasonSource': 'manual',
      },
      startNow: true,
    });
    const roundId = await roundIdOf(host, m.code);
    await call(late, 'POST', `/matches/${m.code}/join`, {});
    // Join time 15 s after the opening, 3 s after the start.
    await host.page.waitForTimeout(19_500);
    const refused = await guessHttp(late, roundId, 'summer');
    expect(refused.body, JSON.stringify(refused)).toMatchObject({ code: 'JOIN_CLOSED' });
  } finally {
    await abortMatch(host, m.code);
    await closeAll([host, one, late]);
  }
});
