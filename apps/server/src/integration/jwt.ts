/**
 * @file   apps/server/src/integration/jwt.ts
 * @module server/integration
 * @brief  Verifies a host-signed handoff token (compact JWS) with node:crypto alone.
 *
 * Responsibility: the rules of Bingo 03 §4 and 07 §2.2: the algorithm is one the provider
 *                 allows (EdDSA, ES256, RS256; never `none`, never HMAC) and fits the key's type,
 *                 the signature holds, `iss` and `aud` match, `iat`/`nbf`/`exp` hold with 30 s of
 *                 skew, the token lives at most 60 s, `sub` and `jti` are present; `links` keeps
 *                 only the facts "telegram" and "discord" (07 §4, S8). The replay check is the caller's.
 * Depends on:     node:crypto
 * Used by:        ./handoff, ./jwt.test
 * Spec:           docs/spec/07-integration.md §1, §4; Bingo 07 §2.2; Bingo 03 §4
 */
import { verify, type KeyObject } from 'node:crypto';

export type JwtAlg = 'EdDSA' | 'ES256' | 'RS256';
type ChatLink = 'telegram' | 'discord';

const SKEW_S = 30;
const MAX_LIFETIME_S = 60;
const SEGMENT = /^[A-Za-z0-9_-]+$/;
const LINKS: readonly ChatLink[] = ['telegram', 'discord'];

export class HandoffRefused extends Error {}

export interface HandoffClaims {
  readonly sub: string;
  readonly jti: string;
  readonly exp: number;
  readonly name: string | null;
  readonly roles: readonly string[];
  readonly links: readonly ChatLink[];
}

export interface VerifyPolicy {
  readonly issuer: string;
  readonly audience: string;
  readonly allowedAlgs: readonly string[];
  // Seconds since the epoch.
  readonly now: number;
  // The provider's key for the token's `kid` and algorithm, or null when it has none.
  readonly keyFor: (kid: string | null, alg: JwtAlg) => Promise<KeyObject | null>;
}

interface Parts {
  readonly header: Record<string, unknown>;
  readonly payload: Record<string, unknown>;
  readonly signed: Buffer;
  readonly signature: Buffer;
}

function json(segment: string): Record<string, unknown> {
  const value: unknown = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HandoffRefused('not a JSON object');
  }
  return value as Record<string, unknown>;
}

function split(token: string): Parts {
  const segments = token.split('.');
  if (segments.length !== 3 || !segments.every((s) => SEGMENT.test(s))) {
    throw new HandoffRefused('not a compact JWS');
  }
  const [h = '', p = '', s = ''] = segments;
  try {
    return {
      header: json(h),
      payload: json(p),
      signed: Buffer.from(`${h}.${p}`),
      signature: Buffer.from(s, 'base64url'),
    };
  } catch (error) {
    if (error instanceof HandoffRefused) throw error;
    throw new HandoffRefused('unreadable token');
  }
}

// The issuer named by a token before it is verified: it picks the provider whose key checks it.
export function issuerOf(token: string): string | null {
  try {
    const iss = split(token).payload['iss'];
    return typeof iss === 'string' ? iss : null;
  } catch {
    return null;
  }
}

function algOf(header: Record<string, unknown>, allowed: readonly string[]): JwtAlg {
  const alg = header['alg'];
  if (alg !== 'EdDSA' && alg !== 'ES256' && alg !== 'RS256') {
    throw new HandoffRefused('algorithm not supported');
  }
  if (!allowed.includes(alg)) throw new HandoffRefused('algorithm not allowed');
  // Critical extensions this verifier does not know must refuse the token (RFC 7515 §4.1.11).
  if (header['crit'] !== undefined) throw new HandoffRefused('unknown critical header');
  return alg;
}

// The key must be of the algorithm's own type, so an RSA key can never check an EdDSA token.
function keyFits(key: KeyObject, alg: JwtAlg): boolean {
  if (key.type !== 'public') return false;
  const details = key.asymmetricKeyDetails;
  if (alg === 'EdDSA') return key.asymmetricKeyType === 'ed25519';
  if (alg === 'ES256')
    return key.asymmetricKeyType === 'ec' && details?.namedCurve === 'prime256v1';
  return key.asymmetricKeyType === 'rsa' && (details?.modulusLength ?? 0) >= 2048;
}

function signatureHolds(parts: Parts, key: KeyObject, alg: JwtAlg): boolean {
  if (alg === 'EdDSA') return verify(null, parts.signed, key, parts.signature);
  if (alg === 'ES256') {
    // JWS carries r‖s (64 bytes), not DER.
    if (parts.signature.length !== 64) return false;
    return verify('sha256', parts.signed, { key, dsaEncoding: 'ieee-p1363' }, parts.signature);
  }
  return verify('sha256', parts.signed, key, parts.signature);
}

const isText = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function checkTimes(p: Record<string, unknown>, now: number): number {
  const { iat, exp, nbf } = p;
  if (!isTime(iat) || !isTime(exp)) throw new HandoffRefused('iat and exp required');
  if (exp - iat > MAX_LIFETIME_S) throw new HandoffRefused('lives longer than 60 s');
  if (exp <= now - SKEW_S) throw new HandoffRefused('expired');
  if (iat > now + SKEW_S) throw new HandoffRefused('issued in the future');
  if (nbf !== undefined && (!isTime(nbf) || nbf > now + SKEW_S)) {
    throw new HandoffRefused('not yet valid');
  }
  return exp;
}

function audienceHolds(aud: unknown, audience: string): boolean {
  return aud === audience || (Array.isArray(aud) && aud.includes(audience));
}

function claimsOf(p: Record<string, unknown>, policy: VerifyPolicy): HandoffClaims {
  if (p['iss'] !== policy.issuer) throw new HandoffRefused('wrong issuer');
  if (!audienceHolds(p['aud'], policy.audience)) throw new HandoffRefused('wrong audience');
  const exp = checkTimes(p, policy.now);
  const { sub, jti, name, roles, links } = p;
  if (!isText(sub, 255) || !isText(jti, 255)) throw new HandoffRefused('sub and jti required');
  return {
    sub,
    jti,
    exp,
    name: isText(name, 200) ? name : null,
    roles: Array.isArray(roles) ? roles.filter((r): r is string => isText(r, 40)) : [],
    // Facts only, never handles (S8): anything else in the claim is dropped.
    links: Array.isArray(links) ? LINKS.filter((l) => links.includes(l)) : [],
  };
}

export async function verifyHandoff(token: string, policy: VerifyPolicy): Promise<HandoffClaims> {
  const parts = split(token);
  const alg = algOf(parts.header, policy.allowedAlgs);
  const kid = parts.header['kid'];
  const key = await policy.keyFor(typeof kid === 'string' ? kid : null, alg);
  if (key === null || !keyFits(key, alg)) throw new HandoffRefused('no key for the token');
  if (!signatureHolds(parts, key, alg)) throw new HandoffRefused('bad signature');
  return claimsOf(parts.payload, policy);
}
