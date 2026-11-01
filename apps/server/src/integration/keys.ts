/**
 * @file   apps/server/src/integration/keys.ts
 * @module server/integration
 * @brief  A provider's verification key: its pinned public key, or its JWKS fetched and cached.
 *
 * Responsibility: a pinned PEM is parsed once per provider version; a JWKS is fetched through
 *                 the SSRF-safe client (Bingo 03 §10), validated, kept 10 minutes and fetched
 *                 again early when a token names a `kid` it does not hold (key rotation), at most
 *                 every 30 s; a JWK is chosen by `kid`, or the only key that fits when no `kid` is given.
 * Depends on:     node:crypto, zod, ./jwt (types)
 * Used by:        ./handoff, ../http/app
 * Spec:           Bingo 07 §2.2; Bingo 03 §4, §10
 */
import { createPublicKey, type JsonWebKey, type KeyObject } from 'node:crypto';

import { z } from 'zod';

import type { JwtAlg } from './jwt.js';

const JWKS_TTL_MS = 10 * 60_000;
const REFETCH_AFTER_MS = 30_000;

const jwksSchema = z.object({
  keys: z
    .array(
      z.looseObject({
        kty: z.string(),
        kid: z.string().optional(),
        alg: z.string().optional(),
        use: z.string().optional(),
      }),
    )
    .max(20),
});
type Jwk = z.infer<typeof jwksSchema>['keys'][number];

export interface KeySource {
  readonly id: string;
  readonly version: number;
  readonly jwksUrl: string | null;
  readonly pinnedPublicKey: string | null;
}

// The key type a JWK must have for an algorithm.
const KTY: Readonly<Record<JwtAlg, string>> = { EdDSA: 'OKP', ES256: 'EC', RS256: 'RSA' };

function pick(keys: readonly Jwk[], kid: string | null, alg: JwtAlg): Jwk | null {
  const fit = keys.filter(
    (k) => k.kty === KTY[alg] && (k.alg ?? alg) === alg && (k.use ?? 'sig') === 'sig',
  );
  if (kid !== null) return fit.find((k) => k.kid === kid) ?? null;
  return fit.length === 1 ? (fit[0] ?? null) : null;
}

export class ProviderKeys {
  private readonly pinned = new Map<string, { version: number; key: KeyObject }>();
  private readonly sets = new Map<string, { keys: readonly Jwk[]; at: number }>();

  constructor(
    // The SSRF-safe JSON fetch (../seasons/safeFetch with the install's options).
    private readonly fetchJson: (url: string) => Promise<unknown>,
    private readonly now: () => number = Date.now,
  ) {}

  async keyFor(source: KeySource, kid: string | null, alg: JwtAlg): Promise<KeyObject | null> {
    if (source.pinnedPublicKey !== null) return this.pinnedKey(source);
    if (source.jwksUrl === null) return null;
    let set = await this.jwks(source.jwksUrl, false);
    let jwk = pick(set, kid, alg);
    if (jwk === null && kid !== null) {
      set = await this.jwks(source.jwksUrl, true);
      jwk = pick(set, kid, alg);
    }
    if (jwk === null) return null;
    try {
      return createPublicKey({ key: jwk as JsonWebKey, format: 'jwk' });
    } catch {
      return null;
    }
  }

  private pinnedKey(source: KeySource): KeyObject | null {
    const known = this.pinned.get(source.id);
    if (known?.version === source.version) return known.key;
    try {
      const key = createPublicKey(source.pinnedPublicKey ?? '');
      this.pinned.set(source.id, { version: source.version, key });
      return key;
    } catch {
      return null;
    }
  }

  // The cached set, fetched when it is older than its TTL, or (`rotated`) older than 30 s.
  private async jwks(url: string, rotated: boolean): Promise<readonly Jwk[]> {
    const cached = this.sets.get(url);
    const age = cached === undefined ? Infinity : this.now() - cached.at;
    if (cached !== undefined && age < (rotated ? REFETCH_AFTER_MS : JWKS_TTL_MS)) {
      return cached.keys;
    }
    const parsed = jwksSchema.safeParse(await this.fetchJson(url));
    const keys = parsed.success ? parsed.data.keys : [];
    this.sets.set(url, { keys, at: this.now() });
    return keys;
  }
}

// A pinned key as the admin pastes it: a PEM public key (SPKI). A private key is refused, so
// none is ever stored by mistake (createPublicKey would derive a public key from it).
export function pinnedKeyProblem(pem: string): string | null {
  if (!pem.trimStart().startsWith('-----BEGIN PUBLIC KEY-----')) return 'not a PEM public key';
  try {
    createPublicKey(pem);
    return null;
  } catch {
    return 'not a PEM public key';
  }
}
