# Requirements

Status: `MET` (built and tested), `BUILT` (built, not fully verified), `OPEN` (not built).

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| R-001 | Read-only. No orders, trading, wallets, keys or logins. | MET | Public endpoints only. Cannot be changed by an agent. |
| R-002 | Pull markets from Polymarket and Kalshi. | BUILT | Polymarket verified on live data. Kalshi NOT yet verified in a real browser (see T-001). |
| R-003 | Show the top N highest-volume markets (default 20) across both sites. | BUILT | Ranked by 24h volume. Setting for 10/20/30/50. |
| R-004 | Optionally rank by liquidity (Polymarket) / open interest (Kalshi). | BUILT | Settings. |
| R-005 | Live prices: auto refresh and refresh on returning to the app. | BUILT | Every 60s while visible. |
| R-006 | Group the top markets live into topic buckets. | BUILT | Fed & Rates, Economy, Tech & AI, Geopolitics, US Politics, Markets, Other. |
| R-007 | Exclude crypto and sports markets. | BUILT | Keyword regex `SKIP`. May miss odd titles (see T-007). |
| R-008 | Pin markets so they stay on top and never vanish. | BUILT | Stored in the browser (localStorage). Refreshed by direct lookup even if they leave the top N. |
| R-009 | Phone first: works as a home-screen web app. | BUILT | No icon/manifest yet (T-003). |
| R-010 | Each market shows top outcomes with % price, 24h volume, liquidity/OI, days to end, source and bucket, and links to the original page. | BUILT | |
| R-011 | If one source fails, show a warning and keep showing the other. | BUILT | |
| R-012 | Works if Kalshi blocks browsers, via an optional relay URL in Settings. | BUILT | Relay in `kalshi-relay-worker.js`, untested. |
| R-013 | Free hosting, no backend, no secrets. | MET | GitHub Pages. |
| R-014 | Reasonable mobile data use. | BUILT | 3 Polymarket pages per refresh (gzip). See T-008. |

## Non-goals
Trading, alerts that place orders, user accounts, paid APIs.
