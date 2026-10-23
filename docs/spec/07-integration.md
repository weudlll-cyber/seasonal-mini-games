# 07 — Integration

> Part of the Seasonal Mini Games specification. Index: [README](README.md). Bingo references: see [README](README.md) §2.
> Integration is adopted from Bingo (owner, decision 1). This section lists what is adopted and writes out only what differs or is new.

## 1. Adopted from Bingo

| Topic | Bingo reference | Difference here |
|---|---|---|
| Goals: standalone with zero external services; integrated without a second account; both at once | Bingo 07 §1 | None. |
| Identity adapters `local`, `oidc`, `jwt-handoff` behind the `IdentityProvider` port | Bingo 07 §2 | None. |
| Account linking rules (`(issuer, sub)` only, no silent e-mail linking, role mapping that can never grant `security_admin` or `super_admin`) | Bingo 07 §2.1 | None. |
| JWT handoff contract (host backend signs, ≤ 60 s, single-use `jti`, fragment or `postMessage` delivery) | Bingo 07 §2.2 | `aud` is `seasonal-mini-games`. Optional extra claim `links` (§4). |
| Embed modes (same-site iframe, third-party iframe with token flow, link-out) | Bingo 07 §3.1 | None. |
| Embed loader `embed.js` | Bingo 07 §3.2 | Markup `data-smg-embed`. Views: `lobby`, `match`, `leaderboard`, `profile`. `match` shows the running round of that match. |
| postMessage protocol | Bingo 07 §3.3 | `source: "smg"`, types `smg:ready`, `smg:resize`, `smg:auth:request`, `smg:auth:token`, `smg:auth:logout`, `smg:navigate`, `smg:event`. |
| Embed allowlist driving `frame-ancestors`, postMessage origins, WS `Origin` and CORS | Bingo 07 §3.4, Bingo D4 | None. |
| Seasonal Entertainment mapping (members → `player`, organizers → `organizer`, website admins not mapped to admin roles, Telegram/Discord stay on the website) and `jwt-handoff` as the website's login (Bingo D3) | Bingo 07 §4 | Base path `/games/mini-games` (DECISIONS T2). Planned website endpoint `POST /api/games/mini-games/handoff`. Cookie path `/games/mini-games`. |
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

- With `none` and `hostEmbed`, the platform posts nothing into any chat. Winners, solves and specials appear in the announcement strip only.
- With `builtin`, the platform writes one system line per round end ("Round 4: Walter found 731 first").
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
- It is read only for the multi-account rule `antiMulti.requireLinkedChat` ([05](05-security-threat-model.md) §6, owner question (b)), stored as `external_identities.last_claims.links`, and refreshed at every login.
- Standalone installs have no such claim, so the rule cannot be switched on there (the admin form says why).
- Adding the claim is a website task (BACKLOG, "Needed from the website repository").

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

- **Fetching:** the server polls the URL in `seasons.feedUrl` every `inSeason.pollS` through `SafeHttpClient` (Bingo 03 §10): HTTPS only, host on the allowlist, 5 s timeout, 64 KiB limit. The answer is validated with a zod schema, and unknown fields are ignored.
- **Keeping:** a valid answer replaces `season_feed_state` ([06](06-data-model-api-realtime.md) §2.6). Halving days from the feed are merged into `halving_days` with `source = feed`. Admin entries (`source = admin`) are never overwritten.
- **Failing:** an invalid or missing answer keeps the last good one and records the error. The admin dashboard shows the feed's age. When the age passes `inSeason.staleAfterH`, In Season is no longer offered ([03](03-seasonal-specials.md) §3).
- **Standalone installs** without a feed URL: In Season is not offered. Halving days come from the admin list only.
- **When embedded on the website,** the feed is read server to server as well. The game never trusts a season passed in by the embedding page.

## 6. Standalone and embedded: what differs for the player

| Aspect | Standalone | Embedded on the website |
|---|---|---|
| Sign-in | Local accounts | Website login through `jwt-handoff`; local accounts optional |
| Address | Own domain, base path `/` | `/games/mini-games` on the website's domain |
| Chat | `builtin` | `hostEmbed`, room `mini-games` |
| In Season | Only with a configured feed | From the website feed |
| Halving days | Admin list | Website feed plus admin list |
| Multi-account rule `requireLinkedChat` | Not available | Available |
| Game rules, cooldowns, specials, ordering | Identical | Identical |
