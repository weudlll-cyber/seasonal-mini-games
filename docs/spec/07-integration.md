# 07 — Integration

> Part of the Seasonal Mini Games specification. Index: [README](README.md). Bingo references: see [README](README.md) §2.
> Integration is adopted from Bingo (owner, decision 1). This section lists what is adopted and writes out only what differs or is new.

## 1. Adopted from Bingo

| Topic | Bingo reference | Difference here |
|---|---|---|
| Goals: standalone with zero external services; integrated without a second account; both at once | Bingo 07 §1 | None. |
| Identity adapters `local`, `oidc`, `jwt-handoff`, `proxy-header` behind the `IdentityProvider` port | Bingo 07 §2 | Built: `local` (standalone), `proxy-header` (the Seasonal Entertainment website, §7, owner decision 66) and `jwt-handoff` (an option for third-party host sites). `oidc` is not built. |
| Account linking rules (`(issuer, sub)` only, no silent e-mail linking, role mapping that can never grant `security_admin` or `super_admin`) | Bingo 07 §2.1 | None. |
| JWT handoff contract (host backend signs, ≤ 60 s, single-use `jti`, fragment or `postMessage` delivery) | Bingo 07 §2.2 | `aud` is `seasonal-mini-games`. Optional extra claim `links` (§4). |
| Embed modes (same-site iframe, third-party iframe with token flow, link-out) | Bingo 07 §3.1 | None. |
| Embed loader `embed.js` | Bingo 07 §3.2 | Markup `data-smg-embed`. Views: `lobby`, `match`, `leaderboard`, `profile`. `match` shows the running round of that match. |
| postMessage protocol | Bingo 07 §3.3 | `source: "smg"`, types `smg:ready`, `smg:resize`, `smg:auth:request`, `smg:auth:token`, `smg:auth:logout`, `smg:navigate`, `smg:event`. |
| Embed allowlist driving `frame-ancestors`, postMessage origins, WS `Origin` and CORS | Bingo 07 §3.4, Bingo D4 | None. |
| Seasonal Entertainment mapping and the website's login | Bingo 07 §2.3, §4 (D37, D40–D43) | The website signs players in through its proxy's identity headers (`proxy-header`, §7), as Bingo does, no longer through `jwt-handoff` (owner decision 66). Mapping: website admin → `game_admin`; a member the website lets start games (`X-Acting-User-Can-Host`) → `organizer` (the host right); everyone `player`; `organiser` alone grants nothing here (Bingo D40 maps it to hosting). Base path `/games/mini-games` (DECISIONS T2). Cookie path `/games/mini-games`. Telegram and Discord stay on the website; the members' Discord steps are shown beside their names. |
| Outbound webhooks (HMAC-signed, through `SafeHttpClient`, feature flag off by default) | Bingo 07 §5 | Events in §3.2. |
| Public read API for host widgets (unauthenticated, cached 60 s, CORS for allowlisted origins) | Bingo 07 §7 | Routes: `GET /api/v1/public/matches/open`, `GET /api/v1/public/rounds/current?match=`, `GET /api/v1/public/leaderboards/current?limit=10` (with team standing), `GET /api/v1/public/rounds/:id/result`. |
| Live call link (Bingo 01 §12a, 07 §6a) | — | **Not adopted** in v1. There is no `host_call_ref`. It can come back as its own task. |

## 2. Chat

The chat UI sits behind a `ChatPanel` component boundary, as in Bingo 07 §6. The setting `integrations.chatProvider` has three values. Bingo has two; `none` is new:

| Value | What players get | Default for |
|---|---|---|
| `none` | No chat panel. Round announcements still show in the game's own announcement strip. | Third-party embeds where the host site has its own chat |
| `builtin` | The platform's own chat (Bingo 06 §7, 03 §12): one room per match plus the lobby room | Standalone installs |
| `hostEmbed` | One dedicated room of the host's chat, embedded by URL (`integrations.hostChatUrl`). On the Seasonal Entertainment website: room slug `mini-games` through the website's `/embed/chat?room=mini-games` | Website installs |

- **Which provider applies:** the admin's stored `integrations.chatProvider`; while none is stored, `SMG_CHAT_PROVIDER` (`none`, `builtin`, `hostEmbed`), and in website mode (§7) `hostEmbed` even without it. An empty `integrations.hostChatUrl` then means the website's own room, `/embed/chat?room=mini-games` on the game's origin (DECISIONS T236). The admin app's Integrations page shows the provider and address in effect with the reason (owner decision 68, T240).
- **The website's room in the game** (website mode, owner decision 66; the website's docs/EMBED.md): the chat panel (the desktop drawer and the phone's sheet of the round bar, the panel between rounds and in the lobby) frames `/embed/chat?room=mini-games&theme=<light|dark>`, titled "Chat"; `theme` follows the game's light/dark theme and a switch reloads the frame. The website's session cookie applies, so the frame shows the member or the website's own guest view; for a visitor not signed in to the game the panel also shows "Log in", the game's sign-in route for the page shown (§7; it passes through the website's `/login?next=`, DECISIONS T238).
- **CSP:** in website mode `frame-src` admits only `<site>/embed/chat` (by path; an admin's own host chat by its origin; `'none'` without a host chat). Standalone installs keep the host chat's origin with `hostEmbed`, else `'self'` (DECISIONS T91, T236).
- **The unread badge with `hostEmbed`** (owner decision 68): behind the round bar's Chat button the game tells the frame whether the panel is in sight (`visible`, again on each `ready`) and shows the frame's `unread` count on the badge, as the website's docs/EMBED.md defines; it acts only on messages from the frame's own window at the chat's origin with `source` `seasonal-chat` (DECISIONS T237). The frame's request carries the page's origin as its referrer (`referrerpolicy="strict-origin"`; the page itself sends none), which the embed needs in Firefox (T242). The lobby and the waiting area tell the frame nothing.
- With `none` and `hostEmbed`, the platform posts nothing into any chat. Winners, solves and specials appear in the announcement strip only.
- With `builtin`, the platform writes one system line per round end that names the number (owner, decision 32): "Round 4: Walter found it first — the number was 731", in individual mode "— their number was 731" (the winner's), and "Round 4 ended: nobody found it — the number was 731" (without a number in individual mode). The game words the number through its optional `reveal` hook (04 §4; DECISIONS T90).
- A chat mute applies to the whole chat (owner, decision 32): the moderator's inline mute and the admin API's mute both cover every room; only a ban may be kept to one room.
- Teams have no chat of their own in v1. Whatever players share in the match chat is their choice. The rules give no team any information the others lack ([03](03-seasonal-specials.md) §5).
- The `mini-games` room is created by a website admin. Nothing in this platform creates it.

## 3. Notifications

Differences from Bingo (Bingo 01 §11, 06 §6), which plans e-mail digests for asynchronous play. There is no asynchronous play in v1, so:

### 3.1 To players

| Channel | When | Default |
|---|---|---|
| In-app | A match you are in starts a countdown; you won or placed; the host closed the match | on |
| Web Push (opt-in per player) | A match you joined starts a round countdown while your tab is in the background or closed | off |
| E-mail | Account mails only (verification, password reset). No game mails. | — |

Never one notification per guess, per special or per feedback.

### 3.2 Into the host site

Webhook events (Bingo 07 §5 mechanics): `match.opened`, `round.countdown` (with `opensAt`), `round.ended` (winner or placings, season, halving), `match.closed`. The website can use them to post into its Telegram and Discord channels.

## 4. Identity claims used by the platform

- The handoff token may carry an optional claim `links`: an array with `telegram` and/or `discord` when the website user has linked those accounts. It carries only the fact of the link, never the handles.
- It is read only for the multi-account rule `antiMulti.requireLinkedChat` ([05](05-security-threat-model.md) §6, owner decision 10), stored as `external_identities.last_claims.links`, and refreshed at every login.
- Standalone installs have no such claim, so the rule cannot be switched on there: the admin form disables it with its reason, and the server refuses it (`SETTING_UNAVAILABLE`). An install counts as a website install when it has an enabled JWT handoff provider (DECISIONS T103).
- An account the handoff created has no password: `DELETE /me` asks it to type its display name instead (`{ confirm }`, DECISIONS T105), and `GET /session` says so (`account.hasPassword: false`), so the account page offers no "Change password" (T201).
- Adding the claim is a website task (BACKLOG, "Needed from the website repository").
- The website's proxy headers (§7) carry no such fact, so in website mode the rule is not shown in the admin app and has no effect, a JWT handoff provider or not (owner decision 68, DECISIONS T222).

## 5. The In Season feed (new)

The In Season season ([03](03-seasonal-specials.md) §3) and, where available, the halving days ([03](03-seasonal-specials.md) §4) come from the Seasonal Entertainment website.

**Contract proposed to the website** (a website task; its exact form is agreed there):

```jsonc
// GET https://<website>/api/public/season   (no auth, cacheable 60 s)
{
  "v": 1,
  "inSeason": { "season": "autumn", "token": "AUTUMN", "since": "2026-09-22T00:00:00Z" },
  "halvingDays": [ { "day": "2026-11-02", "token": "SUMMER" } ]   // optional
}
```

- **Fetching:** the server polls the URL in `seasons.feedUrl` every `inSeason.pollS` through `SafeHttpClient` (Bingo 03 §10): HTTPS only; the host of `seasons.feedUrl`, which only a security admin sets, is the one host allowed, and every address it resolves to must be public (no loopback, private, link-local or unique-local range); no redirects, 5 s timeout, 64 KiB limit (DECISIONS T266; a list of hosts joins only with a second outside source). The answer is validated with a zod schema, and unknown fields are ignored.
- **Keeping:** a valid answer replaces `season_feed_state` ([06](06-data-model-api-realtime.md) §2.6). Halving days from the feed are merged into `halving_days` with `source = feed`. Admin entries (`source = admin`) are never overwritten.
- **Failing:** an invalid or missing answer keeps the last good one and records the error. The admin dashboard shows the feed's age. When the age passes `inSeason.staleAfterH`, In Season is no longer offered ([03](03-seasonal-specials.md) §3).
- **Standalone installs** without a feed URL: In Season is not offered. Halving days come from the admin list only.
- **When embedded on the website,** the feed is read server to server as well. The game never trusts a season passed in by the embedding page.

## 6. Standalone and embedded: what differs for the player

| Aspect | Standalone | Embedded on the website |
|---|---|---|
| Sign-in | Local accounts | Only the website's login, through its proxy's identity headers (§7); no registration, password sign-in or password change in the game |
| Guests | A guest session watches | The same: without a game sign-in a visitor watches matches and reads the boards through a guest session; every action needs a sign-in |
| Names | Display name | Display name with the member's Discord steps (at most three) |
| A deleted account | Its own deletion (`DELETE /me`) | Also through the website's feed: "Deleted player" in past rounds, gone from the boards (§7.3) |
| Address | Own domain, base path `/` | `/games/mini-games` on the website's domain |
| Chat | `builtin` | `hostEmbed`, room `mini-games` |
| In Season | Only with a configured feed | From the website feed |
| Halving days | Admin list | Website feed plus admin list |
| Multi-account rule `requireLinkedChat` | Not available | Not shown and without effect (§4; the proxy headers carry no links, DECISIONS T222) |
| Game rules, cooldowns, specials, ordering | Identical | Identical |

## 7. Website mode: proxy headers and the account-changes feed (new)

Owner decision 66: inside the Seasonal Entertainment website the game runs at `https://<site>/games/mini-games` (`SMG_BASE_PATH=/games/mini-games/`, `SMG_AUTH_MODE=website`), and players sign in only through the website's login. The design is Bingo's (Bingo 07 §2.3, D37, D40–D43); this section names what differs. Standalone installs keep `SMG_AUTH_MODE=local` (the default) unchanged: the routes below answer 404 there.

### 7.1 Proxy header contract

```
browser ──GET /games/mini-games/auth/website?next=…──► website proxy (nginx / Caddy)
                                                         │ auth_request / forward_auth:
                                                         │ GET /api/games/mini-games/authorize with the browser's Cookie
                                                         ▼
                                                       website ── 204 + X-Acting-User-* (a member) or X-Acting-Guest: true
                                                         │
          proxy clears any client-sent X-Acting-User*, X-Acting-Guest and X-Smg-Proxy-Secret,
          copies the answer's headers, adds X-Smg-Proxy-Secret ──► game app
```

- **One route reads identity headers:** `GET <base>auth/website`. The proxy protects exactly this route; every other path of the game is proxied without asking the website and without those headers, and no other code reads them.
- **Headers** (names configurable, `SMG_WEBSITE_HEADER_*`; the defaults are the website's): `X-Acting-User-Id` (numeric, never reused), `X-Acting-User` (username), `X-Acting-User-Roles` (`member`, `organiser`, `admin`, comma-separated), `X-Acting-User-Email-Verified` (`true` for a member in good standing), `X-Acting-User-Can-Host` (`true` or `false`), `X-Acting-User-Steps` (base64url of compact JSON: at most three `{ ladder: holder|farmer|investor, name, icon }`, `icon` a site path `/media/step-icons/<32 hex>.webp` or null). The authorize endpoint always answers 204; anyone who is not a member in good standing (signed out, locked, no 2FA) gets only `X-Acting-Guest: true`.
- **Trust:** only in website mode, only from a TCP peer in `SMG_TRUSTED_PROXIES`, and only with the proxy secret in `X-Smg-Proxy-Secret` (`SMG_WEBSITE_PROXY_SECRET`, generated by the installer, compared in constant time); otherwise 403 and nobody is signed in. A trusted request that names a guest is sent on to the website's login, as from `<base>auth/website/login` (DECISIONS T215); a trusted request without a valid numeric id or a name and without the guest header is 403.
- **Account:** found or created by `(site origin, X-Acting-User-Id)` on the website's `proxy_header` identity provider (created at its first sign-in; the admin app's JWT providers never list or change it): no password, no e-mail stored. The display name follows the website at each sign-in, made fit for the game (letters, digits, `_ . -`, 3–24 characters), with `-2`, `-3`, … when another account has it. Roles are mapped and recomputed at every sign-in (`source=idp_mapping`, §1): `admin` → `game_admin`, `X-Acting-User-Can-Host: true` → `organizer`, everyone `player`; `super_admin` and `security_admin` are never granted by mapping. The e-mail verification is mirrored for league points. A suspended game account is refused (403).
- **Steps:** decoded and checked at each sign-in (zod `PlayerStep` in `packages/contracts/src/http/session.ts`); a step that does not hold (an unknown ladder, an icon that is no same-origin path) is dropped, and a bad header drops them all, never the sign-in. They are stored with the account (`accounts.steps`) and sent as an optional `steps` field beside the name: the match's players and standings, the round state (`steps` by player key, beside `names`), leaderboard rows and the public profile; a standalone install sends none. The client shows them after every other player's name (not after "You"): a small icon named by the step, or the step's name (DECISIONS T239). Icons are same-origin paths, so the CSP's `img-src 'self'` covers them; a step without an icon shows its name.
- **Session:** a fresh, rotated game session (05 §1) and a redirect to `next` when it is a same-origin path under the base path in printable ASCII without a scheme, host, `//` or backslash; anything else goes to the base path (the lobby) (Bingo D43).
- **Login hop:** `GET <base>auth/website/login?next=<page>` answers 302 to `SMG_WEBSITE_LOGIN_PATH` (default `/login?next=`) followed by the URL-encoded `<base>auth/website?next=<URL-encoded page>`, so after signing in the member comes back through the sign-in route to the page they wanted.
- **What website mode switches off:** `POST /auth/register`, `POST /auth/login`, `POST /me/password` and the development sign-in do not exist (404). `GET /session` reports `authMode: "website"` and `signInPath: "<base>auth/website"` (`"local"` and null in local mode); the client's sign-in link is `signInPath?next=<page>`, and it shows no Register, password form or development sign-in. Guests watch with a guest session (`POST /auth/guest`, DECISIONS T221), which the client starts when a signed-out visitor opens a match (DECISIONS T239).
- **Rate limits:** the sign-in 30 a minute and the login hop 600 a minute per address.

### 7.2 Settings

`SMG_AUTH_MODE` (`local` or `website`, default `local`), `SMG_TRUSTED_PROXIES`, `SMG_WEBSITE_PROXY_SECRET`, `SMG_WEBSITE_LOGIN_PATH` (default `/login?next=`), `SMG_WEBSITE_LOCAL_URL` (the website's local address; the installer writes `http://site:3800`, the website's container on its Docker network, DECISIONS T233), `SMG_WEBSITE_SYNC_TOKEN`, and the header names `SMG_WEBSITE_HEADER_ID`, `…_NAME`, `…_ROLES`, `…_EMAIL_VERIFIED`, `…_CAN_HOST`, `…_STEPS`, `…_GUEST`. In website mode the server refuses to start without `SMG_PUBLIC_URL`, the trusted proxies, the secret, the local address and the token. The installer writes them.

### 7.3 The account-changes feed

- A background poller (website mode only) reads `GET /api/games/mini-games/account-changes?since=<cursor>` from `SMG_WEBSITE_LOCAL_URL` every 15 s with `X-Games-Sync-Token`. The website answers `{"changes":[{"id":<user id>,"kind":"deleted|locked|unlocked|rights"}],"next":"<cursor>"}` in order, at most 500 an answer; the poller asks again with `next` until it stops changing. `since` absent or `0` means from the start. A wrong or missing token is 401; the website limits the feed to 60 requests a minute.
- The cursor, the last successful poll and the last failure are kept in `website_feed` ([06](06-data-model-api-realtime.md) §2.9). In website mode `GET /readyz` names the last success (`websiteFeed.lastSuccessAt`, ISO time or null) for `smg status`; it never decides readiness (DECISIONS T218).
- `deleted`: the account is anonymised, not removed (DECISIONS T216): it reads "Deleted player", its status is `deleted`, its roles, steps and website link go, and its sessions end. Its round results and match places keep their points under that name; the boards and profiles, which skip deleted accounts, drop it.
- `locked`: its sessions end (the website refuses its next sign-in). `rights`: its sessions end, so the next sign-in recomputes the roles. `unlocked`: nothing. A change for an id the game does not know does nothing. Each change is safe to apply twice.
- The fetch is a plain HTTP request with a 10 s timeout, no redirects and a 256 KiB cap, not `SafeHttpClient`, which takes public https addresses only: this is the operator's own local address (DECISIONS T217). Errors back off from 30 s, doubling up to 10 minutes, and are logged by their message only, never with the token.
