/**
 * @file   packages/domain/src/audit/hashChain.test.ts
 * @module domain/audit
 * @brief  The audit chain is canonical, links every entry and exposes tampering.
 *
 * Responsibility: key order does not change the hash; a chain of entries verifies; changing
 *                 any field, removing an entry or reordering two is found at the right index.
 * Depends on:     vitest, ./hashChain
 * Spec:           docs/spec/05-security-threat-model.md §8
 */
import { describe, expect, it } from 'vitest';

import {
  brokenLink,
  canonicalJson,
  chainHash,
  type AuditRecord,
  type ChainLink,
} from './hashChain.js';

const record = (action: string): AuditRecord => ({
  occurredAt: '2026-10-24T20:00:00.000Z',
  actorAccountId: 'a1',
  actorRoles: ['game_admin'],
  action,
  targetType: 'settings',
  targetId: 'matchmaking',
  diff: { before: { x: 1 }, after: { x: 2 } },
  requestId: 'r1',
});

function chain(actions: readonly string[]): ChainLink[] {
  const links: ChainLink[] = [];
  for (const a of actions) {
    const r = record(a);
    links.push({ record: r, hash: chainHash(links.at(-1)?.hash ?? null, r) });
  }
  return links;
}

describe('the audit hash chain', () => {
  it('ignores key order and undefined fields', () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 3, c: undefined }] })).toBe('{"a":[2,{"d":3}],"b":1}');
  });

  it('writes values JSON cannot hold as null', () => {
    expect(canonicalJson([undefined, () => 1, Symbol('s'), 'x'])).toBe('[null,null,null,"x"]');
  });

  it('verifies an intact chain and finds a changed, missing or swapped entry', () => {
    const links = chain(['one', 'two', 'three']);
    expect(brokenLink(links)).toBe(-1);
    const changed = links.map((l, i) => (i === 1 ? { ...l, record: record('other') } : l));
    expect(brokenLink(changed)).toBe(1);
    expect(brokenLink([links[0], links[2]] as ChainLink[])).toBe(1);
    expect(brokenLink([links[1], links[0]] as ChainLink[])).toBe(0);
  });
});
