/**
 * @file   apps/web/src/boards/proof.ts
 * @module web/boards
 * @brief  A round's published proof, read and checked in the browser.
 *
 * Responsibility: pick out of `GET /rounds/:id/verify` what the page shows (commitment,
 *                 seed, settings, roster, accepted guesses in receive order); check that the
 *                 SHA-256 of the seed's bytes is the commitment, with the browser's own
 *                 crypto (02 §10), so nobody has to trust the server for it; name the
 *                 recomputed secrets by player without knowing a game's shape (every number
 *                 in the secrets, labelled by the roster player on its path); and save the
 *                 answer as a JSON file.
 * Depends on:     @smg/contracts (SeasonName)
 * Used by:        ./VerifyPage
 * Spec:           docs/spec/02-game-guess-the-number.md §9, §10; docs/spec/06-data-model-api-realtime.md §3.1
 */
import type { SeasonName } from '@smg/contracts';

export interface ProofAnswer {
  readonly ok: true;
  readonly secrets: unknown;
  readonly events: readonly unknown[];
}

interface Event {
  readonly type?: string;
  readonly [key: string]: unknown;
}

export interface Guess {
  readonly seq: number;
  readonly playerId: string;
  readonly action: unknown;
}

export interface Proof {
  readonly commitment: string | null;
  readonly seed: string | null;
  readonly season: SeasonName | null;
  readonly config: Readonly<Record<string, unknown>>;
  readonly gameConfig: unknown;
  readonly roster: readonly { readonly playerId: string; readonly team: SeasonName | null }[];
  readonly guesses: readonly Guess[];
}

const hexOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);

export function readProof(answer: ProofAnswer): Proof {
  const events = answer.events as readonly Event[];
  const created = events.find((e) => e.type === 'RoundCreated') ?? {};
  const countdown = events.find((e) => e.type === 'CountdownStarted') ?? {};
  const ended = events.find((e) => e.type === 'RoundEnded') ?? {};
  const guesses = events
    .filter((e) => e.type === 'GuessAccepted')
    .map((e) => ({
      seq: Number(e['receiveSeq']),
      playerId: String(e['playerId']),
      action: e['action'],
    }))
    .sort((a, b) => a.seq - b.seq);
  return {
    commitment: hexOrNull(created['commitment']),
    seed: hexOrNull(ended['seed']),
    season: (created['season'] as SeasonName | undefined) ?? null,
    config: (created['config'] as Record<string, unknown> | undefined) ?? {},
    gameConfig: created['gameConfig'] ?? null,
    roster: (countdown['roster'] as Proof['roster'] | undefined) ?? [],
    guesses,
  };
}

// The bytes of a hex string, or null when it is no whole hex.
export function hexBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  return bytes;
}

// sha256(seed bytes) === commitment, computed here in the browser.
export async function seedMatches(seed: string, commitment: string): Promise<boolean> {
  const bytes = hexBytes(seed);
  if (bytes === null) return false;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const hex = Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
  return hex === commitment.toLowerCase();
}

function numbers(value: unknown, path: readonly string[]): { path: string[]; value: number }[] {
  if (typeof value === 'number') return [{ path: [...path], value }];
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, inner]) => numbers(inner, [...path, key]));
}

// Every number in the secrets, labelled by the roster player on its path; a single number
// without a player is the round's one shared secret.
export function secretLines(
  secrets: unknown,
  playerName: (key: string) => string | null,
): { readonly label: string; readonly value: number }[] {
  const found = numbers(secrets, []);
  return found.map(({ path, value }) => {
    const player = path.map(playerName).find((n) => n !== null) ?? null;
    const label = player ?? (found.length === 1 ? 'The secret number' : path.join(' '));
    return { label, value };
  });
}

// A guess in one cell: its one value when it has one, else the whole action.
export function actionText(action: unknown): string {
  if (action !== null && typeof action === 'object') {
    const values = Object.values(action);
    if (values.length === 1 && typeof values[0] !== 'object') return String(values[0]);
  }
  return JSON.stringify(action);
}

export function downloadJson(fileName: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Freed after the click has started the download.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
