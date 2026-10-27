/**
 * @file   apps/server/src/chat/filter.test.ts
 * @module server/chat
 * @brief  The chat's text rules: normalization, links, and the block, mask and flag lists.
 *
 * Responsibility: normalization folds case, diacritics and leetspeak and drops zero-width
 *                 characters, keeping where each character came from; terms match whole words
 *                 only; a block term refuses, mask terms become *** in the original text (also
 *                 when written in leetspeak or split by a zero-width space), a flag term
 *                 delivers and names the flag; web addresses are found.
 * Depends on:     vitest, ./filter
 * Spec:           Bingo 03 §12
 */
import { describe, expect, it } from 'vitest';

import { applyWordLists, hasLink, normalize } from './filter.js';

const none = { block: [], mask: [], flag: [] };

describe('normalize', () => {
  it('folds case, diacritics and leetspeak and drops zero-width characters', () => {
    expect(normalize('BÄD').text).toBe('bad');
    expect(normalize('h3ll0 w@rld').text).toBe('hello warld');
    expect(normalize('b\u200Bad').text).toBe('bad');
    expect(normalize('Crème').text).toBe('creme');
  });

  it('remembers the original index of every character', () => {
    expect(normalize('a\u200Bb').from).toEqual([0, 2]);
  });
});

describe('the word lists', () => {
  it('lets a clean message through unchanged', () => {
    expect(applyWordLists('Good luck everyone', none)).toEqual({
      blocked: false,
      shown: 'Good luck everyone',
      flags: [],
    });
  });

  it('refuses a message with a block term, however it is written', () => {
    const lists = { ...none, block: ['rotten'] };
    expect(applyWordLists('you are R0TT3N', lists)).toEqual({ blocked: true });
    expect(applyWordLists('ro\u200Btten', lists)).toEqual({ blocked: true });
  });

  it('matches whole words only', () => {
    expect(applyWordLists('a classic pass', { ...none, block: ['ass'] })).toMatchObject({
      blocked: false,
    });
  });

  it('masks every mask term in the original text', () => {
    const lists = { ...none, mask: ['darn', 'heck'] };
    expect(applyWordLists('Darn it, what the h3ck, DARN', lists)).toEqual({
      blocked: false,
      shown: '*** it, what the ***, ***',
      flags: ['masked'],
    });
    expect(applyWordLists('da\u200Brn!', lists)).toMatchObject({ shown: '***!' });
  });

  it('delivers a flagged message and names the flag', () => {
    expect(applyWordLists('meet me outside', { ...none, flag: ['outside'] })).toEqual({
      blocked: false,
      shown: 'meet me outside',
      flags: ['flagged'],
    });
  });

  it('blocks before it masks or flags', () => {
    expect(applyWordLists('bad word', { block: ['bad'], mask: ['word'], flag: ['bad'] })).toEqual({
      blocked: true,
    });
  });
});

describe('links', () => {
  it('finds web addresses and leaves plain text alone', () => {
    for (const text of ['see https://x.example', 'go to www.thing', 'visit cheats.com now']) {
      expect(hasLink(text)).toBe(true);
    }
    for (const text of ['I guessed 731.', 'e.g. higher', 'well...ok']) {
      expect(hasLink(text)).toBe(false);
    }
  });
});
