/**
 * @file   packages/ui/src/websiteSignIn.ts
 * @module ui
 * @brief  Website mode: the sign-in route for the page shown, and signing in again after the
 *         game session ended.
 *
 * Responsibility: `websiteSignInHref` is the sign-in route with the page shown now (path,
 *                 query and hash) as `next` (07 §7, Bingo D43). `signInAgain` goes there, and
 *                 `signInAgainAfter` for the API clients when an answer says the account's game session ended (X-Smg-Session-Ended, its
 *                 value the sign-in route, DECISIONS T282): the website still knows the member,
 *                 so they come back to the same page signed in, without a form. At most once a
 *                 minute per tab (sessionStorage), so a sign-in that does not hold never loops.
 * Depends on:     nothing (the browser's location and sessionStorage)
 * Used by:        ./index (apps/web shell/http and account/SignIn, apps/admin http and App)
 * Spec:           docs/spec/07-integration.md §7; DECISIONS T282
 */

// The answer header the server sets after an account's session ended (website mode).
const SESSION_ENDED_HEADER = 'x-smg-session-ended';

const LAST_KEY = 'smg.signInAgainAt';
const AT_MOST_EVERY_MS = 60_000;

// Website mode: the sign-in route with the page shown now as `next`; a visitor the website
// does not know goes on to its login and comes back here signed in.
export function websiteSignInHref(signInPath: string): string {
  const { pathname, search, hash } = window.location;
  return `${signInPath}?next=${encodeURIComponent(`${pathname}${search}${hash}`)}`;
}

function lastTry(): number {
  try {
    return Number(window.sessionStorage.getItem(LAST_KEY) ?? 0);
  } catch {
    return 0;
  }
}

// True when the page is on its way to the sign-in route; false when it went there less than
// a minute ago (the answer is then handled as it is). `go` leaves the page (tests watch it).
export function signInAgain(
  signInPath: string,
  go: (href: string) => void = (href) => {
    window.location.assign(href);
  },
): boolean {
  const now = Date.now();
  if (now - lastTry() < AT_MOST_EVERY_MS) return false;
  try {
    window.sessionStorage.setItem(LAST_KEY, String(now));
  } catch {
    // Without storage there is no loop guard: then no automatic sign-in either.
    return false;
  }
  go(websiteSignInHref(signInPath));
  return true;
}

// An API answer: true when it says the account's session ended and the page is on its way
// to the website's sign-in (the caller then lets its call never settle).
export function signInAgainAfter(
  response: Pick<Response, 'headers'>,
  go?: (href: string) => void,
): boolean {
  const signInPath = response.headers.get(SESSION_ENDED_HEADER);
  return signInPath !== null && signInAgain(signInPath, go);
}
