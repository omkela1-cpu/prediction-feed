# Agent instructions (Grok, Claude, any coding bot)

This repo is a **read-only** prediction market viewer. Read this file first, every session.

## Hard rules
1. **Never add trading, order placement, wallets, API keys or logins.** Read-only public data only. This is requirement R-001 and cannot be changed by an agent.
2. Keep it a **static site**: `index.html` plus plain files. No build step, no secrets in the repo. The only backend allowed is the one small Cloudflare Worker described in `docs/PLAN.md` (Kalshi relay and pin sync, read-only market data).
3. Do not break existing requirements. Check `docs/REQUIREMENTS.md` before changing behaviour.

## Workflow (ALM loop)
1. Read `docs/PLAN.md` (the overall plan), `docs/REQUIREMENTS.md` (what the app must do) and `docs/BACKLOG.md` (what to do next).
2. Pick the top `TODO` item you can finish. Change its status to `IN PROGRESS` and put your agent name as owner.
3. Make the change. Keep edits small and focused.
4. Test it (see "Testing" below).
5. Update `docs/BACKLOG.md` (status to `DONE`, or `BLOCKED` with a reason).
6. If behaviour changed, update the matching row in `docs/REQUIREMENTS.md`.
7. Append one entry to `docs/ACTIVITY_LOG.md`: date, agent name, what changed, how it was tested.
8. If you made a design choice, add it to `docs/DECISIONS.md`.

New ideas go into `docs/BACKLOG.md` as `PROPOSED` with a new ID. Do not build `PROPOSED` items until the owner (Om) moves them to `TODO`.

## Testing
- Syntax: extract the `<script>` from `index.html` and run `node --check`.
- Data: Polymarket needs `Accept-Encoding: gzip` for pages over 50 events (browsers do this automatically; with curl use `--compressed`).
- Kalshi may block browsers (CORS). If so, use the relay in `kalshi-relay-worker.js`. Never claim Kalshi works unless you actually saw data come back.

## Code map
- `index.html`: the whole app.
  - `BUCKETS` / `SKIP`: topic buckets and the crypto/sports exclusion. Edit these to change categories.
  - `normPM` / `normKA`: turn each site's data into one common item shape.
  - `refresh()`: fetches, merges, ranks, updates pins.
  - `render()` / `card()`: UI.
- `kalshi-relay-worker.js`: the Cloudflare Worker. GET only, read-only. Routes `/kalshi/top` (ranked events) and `/kalshi/event/<ticker>`; only the app's origin may call it from a browser.

## Style
Plain JavaScript, no frameworks. Escape all external text with `esc()` before putting it in HTML. Mobile first (phone screen).
