/**
 * @file   e2e/sweepMatches.ts
 * @module e2e
 * @brief  The matches the layout sweep's game screens show.
 *
 * Responsibility: each game's matches through the development Quick Test, made when a screen
 *                 first needs one: a waiting match, a running round that stays (no inactivity
 *                 limit; Mind Games a series of long rounds), a start card, and a match its
 *                 host ended. A start card and a running round are taken anew before they end
 *                 (or after a bot solved the round), the one before aborted; the codes of those
 *                 still open are listed for the caller to abort.
 * Depends on:     ./play
 * Used by:        ./sweepScreens
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 47)
 */
import { abortMatch, call, type Person } from './play.js';

// A start card keeps this long before the sweep takes a new one (its countdown runs 30 s).
const CARD_FRESH_MS = 15_000;

// A running round is taken anew after this long: its bots guess again after 120 s and could
// end it under the sweep.
const ROUND_FRESH_MS = 90_000;

type Body = Readonly<Record<string, unknown>>;

// How a game's matches are made and ended; `codes` lists those still open.
interface Maker {
  readonly make: (body: Body) => Promise<string>;
  readonly end: (code: string) => Promise<void>;
}

function makerOf(p: Person, game: string, codes: string[]): Maker {
  return {
    make: async (body) => {
      const started = await call<{ matchCode: string }>(p, 'POST', '/dev/quicktest', {
        gameId: game,
        seedText: 'acorn',
        bots: 3,
        rangeHigh: 1_000_000,
        botDelayS: 120,
        fast: false,
        // A round that stays: nobody timed out while the sweep looks.
        settings: {
          'round.inactivityLimitS': 0,
          // A series of long rounds, so a result always has a pause and a next round after it.
          ...(game === 'mind-games'
            ? { 'mind.totalS': 600, 'mind.rounds': 10, 'mind.pauseS': 120 }
            : {}),
        },
        ...body,
      });
      codes.push(started.matchCode);
      return started.matchCode;
    },
    end: async (code) => {
      await abortMatch(p, code);
      codes.splice(codes.indexOf(code), 1);
    },
  };
}

// The seeds a running round is made from, in turn: the next one only after a bot solved the
// round, so a run of the same screens shows the same rounds (kit K125).
const ROUND_SEEDS = ['acorn', 'birch', 'cedar', 'dogwood', 'elm', 'fir'] as const;

// A match that stays fresh for `ms`, the one before ended when another is taken, so a run never
// holds many rounds open; `keep` holds the one in use from then on. Its body is told how many
// were dropped as over.
function lasting({ make, end }: Maker, ms: number, body: (dropped: number) => Body) {
  let current = { code: '', at: 0 };
  let kept = false;
  let dropped = 0;
  return {
    code: async (): Promise<string> => {
      if (current.code === '' || (!kept && Date.now() - current.at > ms)) {
        if (current.code !== '') await end(current.code);
        current = { code: await make(body(dropped)), at: Date.now() };
      }
      return current.code;
    },
    keep: () => {
      kept = true;
    },
    // The one in use is over: the next ask makes another.
    drop: async (): Promise<void> => {
      await end(current.code);
      current = { code: '', at: 0 };
      dropped += 1;
    },
  };
}

// A match ended by its host, for the page that closes it.
function endedMatch({ make, end }: Maker): () => Promise<string> {
  let ended = '';
  return async () => {
    if (ended === '') {
      const code = await make({ lobby: true });
      await end(code);
      ended = code;
    }
    return ended;
  };
}

// The matches one game's screens use, each made when a screen first needs it. A running round
// with `rows` guesses has bots enough for them; where a seed's round is solved at once by one
// of them, the next seed's is taken.
export function matchesOf(p: Person, game: string, codes: string[], rows: number | null) {
  const maker = makerOf(p, game, codes);
  const waiting = lasting(maker, Number.POSITIVE_INFINITY, () => ({ lobby: true }));
  const crowd = rows === null ? {} : { bots: rows + 4 };
  const round = lasting(maker, ROUND_FRESH_MS, (dropped) => ({
    countdownS: 3,
    seedText: ROUND_SEEDS[dropped % ROUND_SEEDS.length],
    ...crowd,
  }));
  const card = lasting(maker, CARD_FRESH_MS, () => ({ countdownS: 30 }));
  return {
    over: endedMatch(maker),
    waiting: waiting.code,
    round: round.code,
    card: card.code,
    keepRound: round.keep,
    dropRound: round.drop,
  };
}

export type Matches = ReturnType<typeof matchesOf>;
