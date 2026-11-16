# Requirements

Status: `MET` (built and tested), `BUILT` (built, not fully verified), `OPEN` (not built).

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| R-001 | Read-only. No orders, trading, wallets, keys or logins. | MET | Public endpoints only. Cannot be changed by an agent. |
| R-002 | Pull markets from Polymarket and Kalshi. | BUILT | Polymarket verified on live data. Kalshi hot list built by a scheduled GitHub job (T-025); live prices need the relay (T-014, T-015). Not yet checked on a phone. |
| R-003 | Default view "My interests": markets on both sites that match Om's interests (scripts/interests-config.mjs), with at least $25k open interest, not routine repeats and not settled; 8 per section, at most 2 (or the interest's `max`) per interest, biggest open interest first. Setting "Show" switches to "Most traded" (8 per section by 24h volume). | BUILT | T-028 (2026-11-16, Om: volume alone gave "slop"). Most traded: T-027, T-009. Setting 5/8/10/15 per section. |
| R-004 | Optionally rank by liquidity (Polymarket) / open interest (Kalshi). | BUILT | Settings. |
| R-005 | Live prices: auto refresh and refresh on returning to the app. | BUILT | Every 60s while visible. Cards also show the 24h change (T-004). |
| R-006 | Group the top markets live into topic buckets: Macro / Politics & Geopolitics / Tech & AI / Companies, Energy & Commodities / Other. | BUILT | New list built (T-016). Keyword rules in `BUCKETS`; checked on live Polymarket and Kalshi data in Node, not yet on a phone. |
| R-007 | Exclude crypto and sports markets. | BUILT | Keyword regex `SKIP`, plus Polymarket tag slugs (`SKIP_TAGS`) and Kalshi category Sports or Crypto (`SKIP_CATS`), T-007. |
| R-008 | Pin markets so they stay on top and never vanish. | BUILT | Stored in the browser (localStorage). Refreshed by direct lookup even if they leave the top N. |
| R-009 | Phone first: works as a home-screen web app. | BUILT | Manifest and icon added (T-003). Install not yet checked on a phone. |
| R-010 | Each market shows top outcomes with % price, 24h volume, liquidity/OI, days to end, source and bucket, and links to the original page. | BUILT | |
| R-011 | If one source fails, show a warning and keep showing the other. | BUILT | |
| R-012 | Works if Kalshi blocks browsers, via an optional relay URL in Settings. | BUILT | Relay in `kalshi-relay-worker.js` (`/kalshi/top`, `/kalshi/event/<ticker>`), URL set in `KALSHI_RELAY_URL` or Settings. Tested in Node against live Kalshi; not yet deployed or checked on a phone (T-014, T-015). |
| R-013 | Free hosting, no secrets. Only backend allowed: one free Cloudflare Worker (Kalshi relay, pin sync). | BUILT | GitHub Pages. Worker not deployed yet. |
| R-014 | Reasonable mobile data use. | BUILT | 3 Polymarket pages per refresh (gzip). See T-008. |
| R-015 | Movers section: biggest 24h price moves among liquid markets. | BUILT | T-017 (Grok): Movers tab, 10 biggest moves among markets with at least $50k 24h volume, the moving outcome itself traded and still between 3% and 97%. T-028 (Claude): also draws on the interest list; routine repeats, entertainment and the "Other" pile left out. |
| R-016 | Market detail screen with a scrubbable price chart (drag to read price and time; 1D / 1W / 1M / All), plus sparklines on cards. | BUILT | Polymarket detail screen and scrubbable chart built (T-018, T-012). Kalshi history (T-019) and sparklines (T-020) built. Not yet checked on a real phone. |
| R-017 | Search any market on either site and pin it to a watchlist. | BUILT | T-005, T-021. Kalshi search needs the Worker redeployed with `/kalshi/search`. |
| R-018 | Show Kalshi and Polymarket prices side by side for the same event, with the gap and a resolution-rules warning. | DROPPED | Om 2026-11-15: markets are rarely like for like. T-022, T-023 dropped. |
| R-019 | Pins sync across devices. | BUILT | T-010. Pins only, by sync code. Needs the KV binding on the Worker before it can be confirmed. |
| R-020 | Visual style matches Om's Short Seller Feed: FT-like, light mode only, serif headlines, no badges, all-caps labels or filler text. | BUILT | T-026. Keep this style in all new screens. |

## Non-goals
Trading, alerts that place orders, user accounts, paid APIs, a native iOS app (unless Om asks later).
| R-021 | Om can change his interests without touching the app: edit `scripts/interests-config.mjs` (names, sections, match words, exclusions, per-interest max, money floor). Takes effect at the next hourly run. | BUILT | T-028. The repo is public, so interests are topics, nothing personal. |
