/**
 * @file   games/mind-games/src/views.ts
 * @module games/mind-games
 * @brief  The delayed feed for everyone, the viewer's own live choice, and the result.
 *
 * Responsibility: every view of a running round shows the others only as the round was at
 *                 `releasedBefore` (the platform's now − D, 04 §4.8 rule 5): the counts per
 *                 option of the final choices then, the number of players in the round then,
 *                 and the feed's lines, newest first, at most 60 (02e §6.1): every first
 *                 choice with its name, a switch only where it was named (02e §6.3). The
 *                 player's view adds their own current choice and box, live. The result, after
 *                 the end, shows every final choice, the counts, the places, the winning
 *                 options and the points, and every line the feed showed, never a hidden
 *                 switch or a pre-pick (02e §9), and the round's settings by key for the next
 *                 round's form (T338). Each view carries the round's rules and plan in
 *                 milliseconds after the opening, for the intro and the screen.
 * Depends on:     zod, @smg/game-sdk (types), ./choices, ./rules, ./settings, ./state
 * Used by:        ./module, ./devBot, ./words, ./index
 * Spec:           docs/spec/02e-game-mind-games.md §6, §9, §10; docs/spec/04-software-architecture.md §4.8
 */
import type { GameViews } from '@smg/game-sdk';
import { z } from 'zod';

import { CHOICES, countsOf, placesOf, pointsOf } from './choices.js';
import { finalOf } from './rules.js';
import { planOf } from './settings.js';
import { finalsBefore, type MindState, type Move } from './state.js';

// The newest lines a running round's view carries (02e §6.1, a proposal, not a setting).
export const FEED_LINES = 60;

const choice = z.enum(CHOICES);
const counts = z.object({
  spring: z.number(),
  summer: z.number(),
  autumn: z.number(),
  winter: z.number(),
  all: z.number(),
});
const line = z.object({
  playerKey: z.string(),
  from: choice.nullable(),
  choice,
  at: z.number(),
  // The viewer's own line ("You"); false in the spectator's view and the result.
  own: z.boolean(),
});
const rules = z.object({
  allOption: z.boolean(),
  switchVisibility: z.enum(['hidden', 'visible', 'perPlayer']),
  winnerPlace: z.number(),
  plan: z.object({
    entryEndMs: z.number(),
    actionsEndMs: z.number(),
    endMs: z.number(),
    viewDelayMs: z.number(),
  }),
});
const feed = z.object({ rules, counts, entrants: z.number(), lines: z.array(line) });
const own = z.object({ choice: choice.nullable(), hide: z.boolean() });
const result = z.object({
  rules,
  counts,
  entrants: z.number(),
  places: z.object({
    spring: z.number().nullable(),
    summer: z.number().nullable(),
    autumn: z.number().nullable(),
    winter: z.number().nullable(),
    all: z.number().nullable(),
  }),
  winners: z.array(choice),
  players: z.array(z.object({ playerKey: z.string(), choice, points: z.number() })),
  lines: z.array(line),
  // The round's frozen settings by key, so the next round's form starts from them (T338).
  settings: z.record(z.string(), z.union([z.number(), z.boolean(), z.string()])),
});

export type FeedLineView = z.infer<typeof line>;
export type SpectatorView = z.infer<typeof feed>;
export type PlayerView = SpectatorView & { readonly own: z.infer<typeof own> };
export type ResultView = z.infer<typeof result>;

export const viewSchemas = { player: feed.extend({ own }), spectator: feed, result };

const rulesOf = (s: MindState) => ({
  allOption: s.cfg.allOption,
  switchVisibility: s.cfg.switchVisibility,
  winnerPlace: s.cfg.winnerPlace,
  plan: planOf(s.cfg),
});

const lineOf = (m: Move, viewer: string | null): FeedLineView => ({
  playerKey: m.playerKey,
  from: m.from,
  choice: m.choice,
  at: m.at,
  own: m.playerKey === viewer,
});

// The feed's lines of the moves received before `before`, newest first: no hidden switch.
const linesBefore = (s: MindState, before: number, viewer: string | null): FeedLineView[] =>
  s.moves
    .filter((m) => m.at < before && !m.hidden)
    .map((m) => lineOf(m, viewer))
    .reverse();

// What anyone may see at a cut: the counts, the players in the round and the newest lines.
function feedAt(s: MindState, before: number, viewer: string | null): SpectatorView {
  const finals = finalsBefore(s.moves, before);
  return {
    rules: rulesOf(s),
    counts: countsOf(finals.values()),
    entrants: finals.size,
    lines: linesBefore(s, before, viewer).slice(0, FEED_LINES),
  };
}

// The viewer's own choice and box, live: their last move, or none yet.
function ownOf(s: MindState, playerKey: string) {
  const last = s.moves.findLast((m) => m.playerKey === playerKey);
  return { choice: last?.choice ?? null, hide: last?.hide ?? false };
}

// The frozen config by its settings' keys (08 §3.4).
const settingsOf = (s: MindState): Record<string, number | boolean | string> => ({
  'mind.totalS': s.cfg.totalS,
  'mind.delayAuto': s.cfg.delayAuto,
  'mind.delayS': s.cfg.delayS,
  'mind.joinAuto': s.cfg.joinAuto,
  'mind.joinS': s.cfg.joinS,
  'mind.allOption': s.cfg.allOption,
  'mind.switchVisibility': s.cfg.switchVisibility,
  'mind.winnerPlace': s.cfg.winnerPlace,
  'mind.rounds': s.cfg.rounds,
  'mind.pauseS': s.cfg.pauseS,
});

function resultOf(s: MindState): ResultView {
  const { finals, counts: c, winners } = finalOf(s);
  return {
    rules: rulesOf(s),
    counts: c,
    entrants: finals.size,
    places: placesOf(c),
    winners: [...winners],
    players: [...finals].map(([playerKey, final]) => ({
      playerKey,
      choice: final,
      points: pointsOf(final, winners),
    })),
    lines: linesBefore(s, Infinity, null),
    settings: settingsOf(s),
  };
}

export const views: GameViews<MindState, null> = {
  player: (s, playerKey, ctx) => ({
    ...feedAt(s, ctx.releasedBefore, playerKey),
    own: ownOf(s, playerKey),
  }),
  spectator: (s, ctx) => feedAt(s, ctx.releasedBefore, null),
  result: (s) => resultOf(s),
};
