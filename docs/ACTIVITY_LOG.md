# Activity log

Append-only. Newest at the bottom. One entry per working session. Format:
`YYYY-MM-DD | agent | what changed | how tested`

2026-11-15 | Claude | Initial build: top-N by 24h volume across Polymarket and Kalshi, live topic buckets, crypto and sports excluded, pins, settings, Kalshi relay worker, project docs. | Script syntax checked with node. Polymarket top-20 selection and bucketing run against live data (150 events fetched, 92 excluded as sports/crypto, 20 bucketed). Pin UI and Kalshi NOT tested: Kalshi returned 403 from the build sandbox (see T-001); pins need a check in a real browser.
