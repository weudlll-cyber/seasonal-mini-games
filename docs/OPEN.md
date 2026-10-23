# Open — short view

Full list: [BACKLOG.md](BACKLOG.md). Decisions: [DECISIONS.md](DECISIONS.md).

- Specification v1 (01–11) written on branch `spec/v1` (2026-10-24), waiting for review before it is merged. No code yet (decision O7).
- Next: Phase 0 (foundation) once the spec is merged ([spec/11-roadmap.md](spec/11-roadmap.md)).
- From the website repository: the In Season feed (with halving days), the handoff endpoint for `seasonal-mini-games` with the optional `links` claim, the chat room `mini-games`, and the route import into its Caddy.

## Owner questions

Each item below is written into the spec as a **proposal** and built as written unless the owner decides otherwise.

**(a) Fairness proof.** Publish `sha256(round seed)` when a round is created and reveal the seed (and with it the secret) at the end, so anyone can check the round afterwards? Proposal: yes, setting `fairness.commitReveal`, default on (02 §10).

**(b) Multi-accounts in shared mode.** Require a minimum account age and/or a Telegram or Discord link (website installs only) before a player may join a shared round? Proposal: both available as settings, both off by default: `antiMulti.minAccountAgeH` 0 (0–720), `antiMulti.requireLinkedChat` off (05 §6).

**(c) One shared guess engine.** Should Guess The Number, Seasonal Safecracker, Seasonal Bomb Defusal and Seasonal Target share one guess engine (secret + guess + feedback rule)? Proposal: decide before the first of those games starts; until then Guess The Number is built without that generalisation (11 §3, DECISIONS R7).

**(d) Team scoring formula.** Proposal: `wins` — the winner's team gets 1 point per round win (`teams.pointsPerWin`, 1–100); alternative `perMember` — the same divided by the team's members in that round, which favours small teams (03 §5).

**(e) Feedback rule.** Proposal: each guess is answered "higher", "lower" or "correct" (02 §6.1).

**(f) What others see in shared mode.** Proposal: `own` by default (others see only that someone guessed and missed); the host may choose `numbers` (the numbers guessed) or `full` (numbers and feedback). `full` turns the last step into a latency race (02 §6.2, 05 §7).

**(g) Placings in shared mode.** Proposal: only the winner gets a place (1st); everyone else is listed as "took part" with their number of guesses (02 §8.1).

**(h) Unsolved players in individual mode.** Proposal: listed after the placed players as "not solved", without a place (02 §8.2).

**(i) Points and leaderboard.** Proposal: shared winner 10 points; individual places 1–4 get 10 / 7 / 5 / 3 and every further solver 1; match standings are the sum, ties by wins then earliest win; league points only from matches with at least 4 distinct players (`leaderboard.minPlayersForPoints`, 2–50) (02 §9, 08 §4).

**(j) Repeated guesses.** Proposal: guessing a number you already guessed in the round is refused without cost (02 §5.1).

**(k) Who plays a round.** Proposal: the roster is every match player with an open connection when the countdown starts; players who join during a round watch it and play from the next; at least 2 players per round (1–50); at most 500 per match (2–1 000) (02 §2, §4).

**(l) Details of the seasonal specials marked "proposal" in 03.** In one place:
- Heatwave: a running cooldown keeps its end time; the new value applies from the step on (§2.2).
- Leaf Fall in individual mode: one set of removed numbers for everyone, containing nobody's number (§2.3).
- Frost: "hints" in decision O6 is read as the answer to each guess; the winner's announcement and the reveal are delayed by the same few seconds (§2.4).
- Halving: the half-size window that holds the secret sits at a random position; in individual mode each player's range halves around their own number (§4).
- Specials due at the same moment run in the order halving → Leaf Fall → Heatwave (§1).
- Teams: players without a team at countdown go to the smallest team; individual mode has no teams; teams on by default (§5).
- Spring Herald hint types: `parity` (default) or `half` (§2.1).

**(m) Default numbers (all admin settings; default, min–max; 08).**
- Range 1–1 000 (low 0–999 990, high up to 1 000 000, at least 10 numbers).
- Cooldown default 10 s (owner range 3–60 s).
- Countdown 5 s (3–30 s); longest round 10 min (1–60 min).
- Defaults per round: shared mode, In Season, season special on, teams on.
- Heatwave: −1 s (1–10 s) every 30 s (5–300 s); floor 3 s (owner).
- Leaf Fall: 10 numbers (1–100) every 20 s (5–120 s), stopping at 10 numbers left (2–1 000).
- Frost: 3 s delay (1–10 s).
- Halving: every 60 s (15–600 s), down to 8 numbers (2–100); halving days counted in UTC.
- In Season: a feed answer older than 24 h (1–168 h) is not used.
- A match without a round for 60 min (10–1 440 min) closes itself.

**(n) Sizing.** Proposal: up to 500 concurrent players in one round and 1 000 on one server; the load gate tests 500 and 1 000 (01 §2, 09 §5).

**(o) Product facts taken over from Bingo.** Confirm that they apply here too: no prizes of monetary value, standalone and embeddable, English UI (01 §2).

**(p) Showing the winning margin.** Proposal: the result shows how much earlier the winner's guess arrived than the next correct one, if there was one ("found it 0.4 s before Anna") (05 §7).
