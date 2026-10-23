# Open — short view

Full list: [BACKLOG.md](BACKLOG.md). Decisions: [DECISIONS.md](DECISIONS.md).

- Specification v1 (01–11) merged into `master` on 2026-10-24, with the owner's answers (DECISIONS O8–O15).
- Next: the foundation and Guess The Number on branch `feat/guess-the-number` (roadmap phases 0–3).
- From the website repository: the In Season feed (with halving days), the handoff endpoint for `seasonal-mini-games` with the optional `links` claim, the chat room `mini-games`, and the route import into its Caddy.

## Owner questions

The first draft's questions (a)–(p) were answered on 2026-10-24 (DECISIONS O8–O15, T21). New proposals are listed here, and each one is built as written unless the owner decides otherwise.

**(q) Winning-margin window.** The round closes at the winning guess, so "the next correct guess" has to arrive within a window to count for the margin. Proposal: `round.marginWindowS` 2 s (0.5–10 s); without a correct guess in that window, the result says "nobody else was close" (02 §9).
