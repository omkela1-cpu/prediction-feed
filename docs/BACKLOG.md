# Backlog

Statuses: `PROPOSED` (idea, owner has not approved) → `TODO` (approved, ready) → `IN PROGRESS` → `DONE` / `BLOCKED`.
Agents: only build `TODO` items, top to bottom. Add your own ideas as `PROPOSED`. Phases are explained in `PLAN.md`.

| ID | Phase | Task | Status | Owner | Req | Notes / done when |
|----|-------|------|--------|-------|-----|-------------------|
| T-002 | 0 | Switch on GitHub Pages and confirm the app loads on a phone. | DONE | Om | R-013 | Pages on, per Om: https://omkela1-cpu.github.io/prediction-feed/ . Phone check of pins still to do. |
| T-001 | 1 | Verify Kalshi API. | DONE | Claude | R-002 | Works server to server; field names match `normKA`. Returns 403 when a browser `Origin` header is sent, so the relay is needed. Real-phone confirmation moves to T-015. |
| T-013 | 1 | Upgrade the Worker: `/kalshi/top` (page through open events, rank by 24h volume, cache about 60s), `/kalshi/event/<ticker>`, GET only, allow only the app's origin. | DONE | Grok | R-012 | Kalshi events are not volume-sorted, so ranking happens in the Worker. Update `fetchKA` / `oneKA` to match. Built 2026-11-15: relay URL is the `KALSHI_RELAY_URL` constant in `index.html`. Kalshi has about 20,000 open events (about 100 pages), too many for one call on the free plan, so the Worker reads 2 pages a minute and re-reads the top 60 each time; the ranking is only complete after about 100 minutes of use (see DECISIONS, T-025). Tested in Node against live Kalshi. NOT yet run on Cloudflare or a phone. |
| T-014 | 1 | Create a free Cloudflare account and deploy the Worker. Share the Worker URL. | TODO | Om | R-012 | Agent writes step-by-step instructions first. Instructions written: `docs/CLOUDFLARE_SETUP.md` (Grok, 2026-11-15). |
| T-015 | 1 | Make the Worker URL the app default. Confirm Kalshi on a phone against kalshi.com for 3 markets. | TODO | | R-002 | Blocked until T-014. |
| T-016 | 2 | Change buckets to: Macro / Politics & Geopolitics / Tech & AI / Companies, Energy & Commodities / Other. | DONE | Grok | R-006 | Done 2026-11-15. Title is checked first, then tags / Kalshi category. Old pins move to the new buckets. Checked on live data in Node; not yet seen on a phone. |
| T-007 | 2 | Exclude crypto and sports using each site's tags and categories, not only keywords. | TODO | | R-007 | |
| T-017 | 2 | Movers section: biggest 24h price change among liquid markets. | TODO | | R-015 | Kalshi: `previous_price_dollars`. Polymarket: check for a 1-day change field, else compute from history. |
| T-004 | 2 | Show price change since last refresh (green/red delta in points). | TODO | | R-005 | Classes `.up` / `.dn` exist. |
| T-003 | 2 | Add `manifest.webmanifest` and an original app icon. | DONE | Claude | R-009 | Original icon (three bars and a rising line). Home screen install not yet checked on a phone. |
| T-009 | 2 | Make volume comparable across sites (Kalshi contracts vs Polymarket dollars). | TODO | | R-003 | Record the method in DECISIONS. |
| T-018 | 3 | Market detail screen: tap a card to see all outcomes and a chart area. | DONE | Claude | R-016 | Tapping a headline opens the market inside the app (hash `#m=<id>`). Up to 12 outcomes; tap one to chart it. Tested in a phone-sized Chrome, not on a real phone. |
| T-012 | 3 | Scrubbable price chart for Polymarket: drag to read price and time; ranges 1D / 1W / 1M / All. | DONE | Claude | R-016 | Plain canvas, pointer events, `clob.polymarket.com/prices-history`. Tested with a mouse drag in phone-sized Chrome; finger drag on a real phone NOT yet checked. |
| T-019 | 3 | Kalshi price history through the Worker, same chart. | TODO | | R-016 | Verify the candlesticks endpoint first. |
| T-020 | 3 | Small sparkline on each card. | TODO | | R-016 | Watch data use. |
| T-005 | 4 | Search any market on either site. | TODO | | R-017 | Verify search endpoints and CORS first. Kalshi via Worker. |
| T-021 | 4 | Pin from search results, so the watchlist can include markets outside the top 20. | TODO | | R-017 | |
| T-022 | 5 | Cross-site pairs: suggest likely matches, Om confirms, store confirmed pairs. | TODO | | R-018 | |
| T-023 | 5 | Show both prices and the gap for confirmed pairs, with a resolution-rules warning. | TODO | | R-018 | |
| T-010 | 6 | Sync pins and pairs across devices with a random sync code (Worker KV). | TODO | | R-019 | No personal data. |
| T-011 | 7 | Test script for `normPM` / `normKA` on saved sample JSON. | TODO | | | |
| T-008 | 7 | Reduce mobile data use. | TODO | | R-014 | |
| T-026 | 2 | Redesign to match Om's Short Seller Feed (FT style): salmon paper, Newsreader serif headlines, Hanken Grotesk sans, light only, no badges or filler. | DONE | Claude | R-020 | Requested by Om 2026-11-15. Design tokens copied from his Short Seller Feed page. |
| T-006 | | Make buckets editable in the app. | PROPOSED | | R-006 | |
| T-024 | | Price alerts (notification when a pinned market moves). | PROPOSED | | | Likely needs a native app or web push. |
| T-025 | | Faster, complete Kalshi ranking in the Worker. | PROPOSED | Grok | R-003 | Options for Om: (a) Cloudflare paid plan ($5 a month) so the Worker can read all ~100 pages every few minutes; (b) Workers KV plus a scheduled trigger so the ranking survives Worker restarts; (c) Kalshi's website search endpoint, which sorts by volume but is undocumented and may change; (d) added by Claude in review: a scheduled GitHub Actions job in this repo pages all Kalshi events every 10 to 15 minutes and publishes the top ~150 tickers as a small JSON file (for example on a `data` branch); the app reads that file, and the Worker only fetches live prices for those tickers (one Kalshi call, well inside the free plan). Free, no Worker state. To verify first: Kalshi answers GitHub's servers; schedule delays are acceptable. Needs Om's approval because it adds a second moving part. |
