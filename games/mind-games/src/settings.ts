/**
 * @file   games/mind-games/src/settings.ts
 * @module games/mind-games
 * @brief  The game's own keys of document `game.mind-games`, its frozen config and its plan.
 *
 * Responsibility: the round's lengths (total, delay, join time following the total or set),
 *                 the All option, how switches show, the winner place, and the match's rounds
 *                 and pause (host, 08 §3.4) as setting definitions; reading frozen values into
 *                 the config; the cross-key rules with their sentences (02e §3); the round's
 *                 phase plan (02e §4) and its series (02e §2) from the config. The platform
 *                 keys of a phased document (the countdown and the season) come first in the
 *                 document (packages/application).
 * Depends on:     @smg/game-sdk (SettingDef, GameSettings, PhasePlan, Series)
 * Used by:        ./module, ./rules, ./views, ./conformance, ./index
 * Spec:           docs/spec/08-admin-settings.md §3.4; docs/spec/02e-game-mind-games.md §2–§4
 */
import type { GameSettings, PhasePlan, Series, SettingDef } from '@smg/game-sdk';

type SwitchVisibility = 'hidden' | 'visible' | 'perPlayer';

export interface MindConfig {
  readonly totalS: number;
  readonly delayS: number;
  readonly joinAuto: boolean;
  readonly joinS: number;
  readonly allOption: boolean;
  readonly switchVisibility: SwitchVisibility;
  readonly winnerPlace: number;
  readonly rounds: number;
  readonly pauseS: number;
}

const GAME_ADMIN = 'settings.game.edit';
const host = { editPermission: GAME_ADMIN, hostChooses: true, running: 'frozen' } as const;
const owner = (decision: string) => ({ status: 'owner', decision, spec: '08 §3.4' }) as const;

const lengths: readonly SettingDef[] = [
  {
    key: 'mind.totalS',
    kind: 'int',
    label: 'Total length',
    help: 'The whole round, from its opening to the result: joining, play and the replay of its last part.',
    default: 120,
    min: 30,
    max: 600,
    unit: 's',
    ...owner('O78'),
    ...host,
  },
  {
    key: 'mind.delayS',
    kind: 'int',
    label: 'Delay',
    help: 'Everyone sees the round this much later. At most half the total minus 10 s.',
    default: 30,
    min: 5,
    max: 120,
    unit: 's',
    ...owner('O78'),
    ...host,
  },
  {
    key: 'mind.joinAuto',
    kind: 'bool',
    label: 'Join time follows the total',
    help: 'On: players can join with a first choice during the first half of the round. Off: the join time below applies.',
    default: true,
    ...owner('O78'),
    ...host,
  },
  {
    key: 'mind.joinS',
    kind: 'int',
    label: 'Join time',
    help: 'How long after the opening a player can still join with a first choice. Used only while the join time does not follow the total; at most total − delay.',
    default: 60,
    min: 10,
    max: 590,
    unit: 's',
    ...owner('O78'),
    ...host,
  },
];

const rules: readonly SettingDef[] = [
  {
    key: 'mind.allOption',
    kind: 'bool',
    label: 'All',
    help: 'A fifth choice beside the four seasons. It counts like a season and scores 2 when it wins.',
    default: false,
    ...owner('O77'),
    ...host,
  },
  {
    key: 'mind.switchVisibility',
    kind: 'enum',
    label: 'Switches',
    help: 'hidden: a switch changes only the counts. visible: it shows with the name. perPlayer: each player decides with "Hide my switches".',
    default: 'perPlayer',
    options: ['hidden', 'visible', 'perPlayer'],
    ...owner('O82'),
    ...host,
  },
  {
    key: 'mind.winnerPlace',
    kind: 'int',
    label: 'Winner',
    help: '1: the least chosen option wins; 2: the 2nd least chosen, and so on. 5 only with All.',
    default: 1,
    min: 1,
    max: 5,
    unit: '',
    ...owner('O83'),
    ...host,
  },
  {
    key: 'mind.rounds',
    kind: 'int',
    label: 'Rounds',
    help: "The match's number of rounds, chosen in its first round; it holds for the whole match.",
    default: 6,
    min: 1,
    max: 20,
    unit: '',
    ...owner('O85'),
    ...host,
  },
  {
    key: 'mind.pauseS',
    kind: 'int',
    label: 'Pause',
    help: 'How long a result stays before the next round starts by itself; the host can always start it sooner.',
    default: 15,
    min: 5,
    max: 120,
    unit: 's',
    ...owner('O86'),
    ...host,
  },
];

// The join time in force: half the total, rounded down, while it follows the total (O78).
const joinOf = (cfg: MindConfig): number => (cfg.joinAuto ? Math.floor(cfg.totalS / 2) : cfg.joinS);

// The cross-key rules of 02e §3, the first that fails.
function problem(cfg: MindConfig): string | null {
  if (2 * cfg.delayS + 10 > cfg.totalS) {
    return 'The delay must be at most half the total minus 10 s.';
  }
  if (!cfg.joinAuto && cfg.joinS > cfg.totalS - cfg.delayS) {
    return 'The join time must end by the time choices close (total − delay).';
  }
  if (cfg.winnerPlace === 5 && !cfg.allOption) return 'The 5th least chosen needs the All option.';
  return null;
}

export const mindSettings: GameSettings<MindConfig> = {
  defs: [...lengths, ...rules],
  read: (values) => ({
    totalS: values['mind.totalS'] as number,
    delayS: values['mind.delayS'] as number,
    joinAuto: values['mind.joinAuto'] as boolean,
    joinS: values['mind.joinS'] as number,
    allOption: values['mind.allOption'] as boolean,
    switchVisibility: values['mind.switchVisibility'] as SwitchVisibility,
    winnerPlace: values['mind.winnerPlace'] as number,
    rounds: values['mind.rounds'] as number,
    pauseS: values['mind.pauseS'] as number,
  }),
  problem,
};

// The round's timeline (02e §4): joining until J, choices until T − D, the end at T.
export const planOf = (cfg: MindConfig): PhasePlan => ({
  entryEndMs: joinOf(cfg) * 1_000,
  actionsEndMs: (cfg.totalS - cfg.delayS) * 1_000,
  endMs: cfg.totalS * 1_000,
  viewDelayMs: cfg.delayS * 1_000,
});

// Every match is a series (02e §2): its rounds and pause from its first round.
export const seriesOf = (cfg: MindConfig): Series => ({
  rounds: cfg.rounds,
  pauseMs: cfg.pauseS * 1_000,
});

// The settings' defaults, for the conformance kit and the tests.
export const DEFAULT_CONFIG: MindConfig = mindSettings.read(
  Object.fromEntries(mindSettings.defs.map((d) => [d.key, d.default])),
);
