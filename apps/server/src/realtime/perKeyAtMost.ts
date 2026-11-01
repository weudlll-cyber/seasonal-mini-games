/**
 * @file   apps/server/src/realtime/perKeyAtMost.ts
 * @module server/realtime
 * @brief  Calls a function at most once a window per key: the first at once, the rest as one.
 *
 * Responsibility: the first call for a key runs at once; calls for that key in the following
 *                 window are folded into one call at the window's end, so the last change is
 *                 never lost. The gateway sends "match changed" this way: a thousand players
 *                 entering a match would otherwise make every page reload it a thousand times
 *                 (found by the 1 000-player load check). Timers never keep the process alive.
 * Depends on:     nothing
 * Used by:        ./gateway
 * Spec:           docs/spec/06-data-model-api-realtime.md §4; docs/spec/09-testing-strategy.md §5
 */

export function perKeyAtMost(windowMs: number, run: (key: string) => void): (key: string) => void {
  // A key with an open window, and whether a call came in during it.
  const open = new Map<string, { again: boolean }>();
  function call(key: string): void {
    open.set(key, { again: false });
    setTimeout(() => {
      const window = open.get(key);
      open.delete(key);
      if (window?.again === true) call(key);
    }, windowMs).unref();
    run(key);
  }
  return (key) => {
    const window = open.get(key);
    if (window === undefined) call(key);
    else window.again = true;
  };
}
