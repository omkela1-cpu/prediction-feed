# Activity log

Append-only. Newest at the bottom. One entry per working session. Format:
`YYYY-MM-DD | agent | what changed | how tested`

2026-11-15 | Claude | Initial build: top-N by 24h volume across Polymarket and Kalshi, live topic buckets, crypto and sports excluded, pins, settings, Kalshi relay worker, project docs. | Script syntax checked with node. Polymarket top-20 selection and bucketing run against live data (150 events fetched, 92 excluded as sports/crypto, 20 bucketed). Pin UI and Kalshi NOT tested: Kalshi returned 403 from the build sandbox (see T-001); pins need a check in a real browser.
2026-11-15 | Claude | Wrote docs/PLAN.md from Om's answers; rebuilt backlog into phases; added R-015 to R-019; allowed one Cloudflare Worker; closed T-001. No app code changed. | Kalshi: 200 without Origin header, 403 with one; field names checked against normKA. Polymarket prices-history returned data with CORS open. Kalshi history and search endpoints NOT checked.
