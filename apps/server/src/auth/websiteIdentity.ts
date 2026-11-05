/**
 * @file   apps/server/src/auth/websiteIdentity.ts
 * @module server/auth
 * @brief  Website mode: the visitor the website's proxy names in request headers (O66, Bingo D37).
 *
 * Responsibility: decide whether a TCP peer is one of SMG_TRUSTED_PROXIES (addresses and CIDR
 *                 ranges, IPv4 and IPv6; an IPv4-mapped IPv6 peer counts as its IPv4 address),
 *                 and read the identity headers (names from the settings) into a checked
 *                 identity: the website's numeric user id, a display name made fit for the game
 *                 (letters, digits, "_", "." and "-", 3–24 characters), the website roles,
 *                 whether the e-mail is verified, whether the member may start games, and the
 *                 Discord steps (base64url JSON, at most three, each checked; a bad step or a
 *                 bad header drops them, never the sign-in). Whether the website named a guest
 *                 (`X-Acting-Guest: true`). The roles map to game roles: website admin → game_admin,
 *                 may start games → organizer (the host right), never more (O66). Only
 *                 GET <base>auth/website calls this; no other code reads the headers. No I/O.
 *                 Adapted from Bingo's websiteIdentity.ts.
 * Depends on:     node:net, node:crypto, @smg/contracts (steps), ../config/env (types)
 * Used by:        ../http/routes/websiteSignIn, ./websiteAccounts
 * Spec:           docs/spec/07-integration.md §7; docs/spec/05-security-threat-model.md §1;
 *                 Bingo 07 §2.1, §2.3; Bingo 03 §2.2
 */
import { createHash } from 'node:crypto';
import { BlockList, isIPv4, isIPv6 } from 'node:net';

import { MAX_PLAYER_STEPS, PlayerStep, type PlayerStepView } from '@smg/contracts';

import type { Env } from '../config/env.js';

export interface WebsiteIdentity {
  readonly subject: string;
  // The name as the website sent it (kept to notice a change) and as the game uses it.
  readonly websiteName: string;
  readonly displayName: string;
  readonly roles: readonly string[];
  readonly emailVerified: boolean;
  readonly canHost: boolean;
  readonly steps: readonly PlayerStepView[];
}

// "::ffff:172.18.0.3" (an IPv4 peer on a dual-stack socket) → "172.18.0.3".
const plain = (address: string): string => address.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, '');

function familyOf(address: string): 'ipv4' | 'ipv6' | null {
  if (isIPv4(address)) return 'ipv4';
  return isIPv6(address) ? 'ipv6' : null;
}

// A test for the peer address: in one of the trusted addresses or ranges. Entries that are
// no address (e.g. Fastify's "uniquelocal" keyword) trust nobody here.
export function trustedPeers(entries: readonly string[]): (peer: string | undefined) => boolean {
  const list = new BlockList();
  for (const entry of entries) {
    const [address = '', bits] = entry.split('/');
    const family = familyOf(address);
    if (family === null) continue;
    if (bits === undefined) list.addAddress(address, family);
    else list.addSubnet(address, Number(bits), family);
  }
  return (peer) => {
    if (peer === undefined) return false;
    const address = plain(peer);
    const family = familyOf(address);
    return family !== null && list.check(address, family);
  };
}

// The website's user ids are numbers, never reused; the feed names accounts by them.
const SUBJECT = /^\d{1,20}$/;
const NAME_CHARS = /[^\p{L}\p{N}_.-]+/gu;
// A high surrogate left alone at the end of a cut string.
const CUT_PAIR = /[\uD800-\uDBFF]$/;
// Three steps in compact JSON fit well within this; a longer header is not the website's.
const MAX_STEPS_HEADER = 2_048;

// The website's name in the game's characters, at most 24 (cut never inside a surrogate
// pair); a name with fewer than 3 usable characters becomes "player-" and six characters
// of the id's hash.
function gameName(websiteName: string, subject: string): string {
  const cleaned = websiteName.trim().replace(NAME_CHARS, '_').slice(0, 24).replace(CUT_PAIR, '');
  if (cleaned.replace(/_/g, '').length >= 3) return cleaned;
  return `player-${createHash('sha256').update(subject).digest('hex').slice(0, 6)}`;
}

// The steps header: base64url of a JSON array. Each step that holds is kept (at most three);
// anything else (no array, bad JSON, a foreign icon address) is dropped.
export function stepsFrom(header: string | undefined): readonly PlayerStepView[] {
  if (header === undefined || header.length === 0 || header.length > MAX_STEPS_HEADER) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((step) => PlayerStep.safeParse(step))
    .flatMap((r) => (r.success ? [r.data] : []))
    .slice(0, MAX_PLAYER_STEPS);
}

type Headers = Readonly<Record<string, string | string[] | undefined>>;

const one = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? undefined : value?.trim();

const isTrue = (value: string | string[] | undefined): boolean =>
  one(value)?.toLowerCase() === 'true';

// Whether the website named the visitor a guest (signed out, locked, or without 2FA).
export function isWebsiteGuest(headers: Headers, env: Env): boolean {
  return isTrue(headers[env.SMG_WEBSITE_HEADER_GUEST]);
}

// The identity in the headers, or null without a valid id or a name.
export function identityFrom(headers: Headers, env: Env): WebsiteIdentity | null {
  const subject = one(headers[env.SMG_WEBSITE_HEADER_ID]);
  const websiteName = one(headers[env.SMG_WEBSITE_HEADER_NAME]);
  if (subject === undefined || !SUBJECT.test(subject) || !websiteName) return null;
  const roles = (one(headers[env.SMG_WEBSITE_HEADER_ROLES]) ?? '')
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter((r) => r.length > 0);
  return {
    subject,
    websiteName: websiteName.slice(0, 128),
    displayName: gameName(websiteName, subject),
    roles,
    emailVerified: isTrue(headers[env.SMG_WEBSITE_HEADER_EMAIL_VERIFIED]),
    canHost: isTrue(headers[env.SMG_WEBSITE_HEADER_CAN_HOST]),
    steps: stepsFrom(one(headers[env.SMG_WEBSITE_HEADER_STEPS])),
  };
}

// The game roles of a website member, recomputed at every sign-in (O66): a website admin is
// a game admin; a member who may start games (X-Acting-User-Can-Host) has the host right
// (`organizer`); the role `organiser` alone grants nothing here (unlike Bingo D40). super_admin
// and security_admin are never mapped: they stay with `smg admin create-super`.
export function mappedRoles(who: Pick<WebsiteIdentity, 'roles' | 'canHost'>): readonly string[] {
  return [
    ...(who.roles.includes('admin') ? ['game_admin'] : []),
    ...(who.canHost ? ['organizer'] : []),
  ];
}
