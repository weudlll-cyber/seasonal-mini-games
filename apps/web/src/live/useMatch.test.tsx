// @vitest-environment jsdom
/**
 * @file   apps/web/src/live/useMatch.test.tsx
 * @module web/live
 * @brief  The match hook watches the room afresh once the viewer joins or leaves.
 *
 * Responsibility: the server takes the viewer's place in the match at the watch, so a viewer
 *                 who joins on the page sends `match.unwatch` and `match.watch` again (and so
 *                 counts as connected, journey 36); the first load and a reload that changes
 *                 nothing send no second watch.
 * Depends on:     vitest, @testing-library/react, ./useMatch (with ../shell/http and ./socket
 *                 replaced)
 * Spec:           docs/spec/02-game-guess-the-number.md §4; docs/spec/06-data-model-api-realtime.md §4.2
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useMatch } from './useMatch.js';

let youPlayer = false;
const sent: string[] = [];
vi.mock('../shell/http.js', () => ({
  api: () => Promise.resolve({ code: 'ABC123', youPlayer }),
  ApiError: class extends Error {},
}));
vi.mock('./socket.js', () => ({
  gameSocket: () => ({ on: () => undefined, off: () => undefined }),
  intent: (t: string) => {
    sent.push(t);
    return Promise.resolve({ ok: true });
  },
}));

describe('the match hook', () => {
  it('watches the room again after the viewer joined', async () => {
    const { result } = renderHook(() => useMatch('ABC123'));
    await waitFor(() => {
      expect(result.current.match?.youPlayer).toBe(false);
    });
    await act(() => result.current.reload());
    expect(sent).toEqual(['match.watch']);
    youPlayer = true;
    await act(() => result.current.reload());
    await waitFor(() => {
      expect(sent).toEqual(['match.watch', 'match.unwatch', 'match.watch']);
    });
  });
});
