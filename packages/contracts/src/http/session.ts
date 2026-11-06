/**
 * @file   packages/contracts/src/http/session.ts
 * @module contracts/http
 * @brief  The session answer (GET /session) and a website member's Discord steps.
 *
 * Responsibility: what GET /session tells the client: who is signed in, the permissions, the
 *                 CSRF token, the feature flags, and how players sign in here (`authMode`;
 *                 `signInPath` in website mode, O66). A step is one of at most three Discord
 *                 ladder steps the website names beside a member's name (its icon a path on
 *                 the website's own origin, or null: then the step's name is shown); the
 *                 server checks the website's header with `PlayerStep` and drops what does
 *                 not hold. Standalone installs send no steps.
 * Depends on:     zod
 * Used by:        ../index, ./play, ./boards, apps/server, apps/web
 * Spec:           docs/spec/06-data-model-api-realtime.md §3; docs/spec/07-integration.md §7
 */
import { z } from 'zod';

// A path on the same origin: "/" then no "/" or "\" (no protocol-relative address), only the
// characters of the website's icon paths (/media/step-icons/<32 hex>.webp).
const SITE_PATH = /^\/(?![/\\])[\w.~/-]{0,255}$/;

export const PlayerStep = z.object({
  ladder: z.enum(['holder', 'farmer', 'investor']),
  name: z.string().trim().min(1).max(40),
  icon: z.string().regex(SITE_PATH).nullable(),
});
export type PlayerStepView = z.infer<typeof PlayerStep>;

// At most three steps a member; none in a standalone install.
export const MAX_PLAYER_STEPS = 3;

export interface SessionView {
  readonly signedIn: boolean;
  readonly kind: 'player' | 'admin' | 'guest' | null;
  // `hasPassword`: whether the account page offers "Change password" (T201).
  readonly account: {
    readonly id: string;
    readonly displayName: string;
    readonly hasPassword: boolean;
  } | null;
  readonly permissions: readonly string[];
  readonly csrfToken: string | null;
  readonly features: Readonly<Record<string, boolean>>;
  // `local`: the game's own accounts; `website`: only through the website's login (O66).
  readonly authMode: 'local' | 'website';
  // Website mode: the sign-in route (`<base>auth/website`), to be opened with `?next=<page>`;
  // a visitor the website does not know is sent on to its login. Null in local mode.
  readonly signInPath: string | null;
}
