# Backlog

Statuses: `PROPOSED` (idea, owner has not approved) → `TODO` (approved, ready) → `IN PROGRESS` → `DONE` / `BLOCKED`.
Agents: only build `TODO` items. Add your own ideas as `PROPOSED`.

| ID | Task | Status | Owner | Req | Notes |
|----|------|--------|-------|-----|-------|
| T-001 | Verify Kalshi works from a real phone browser (CORS, response shape, price fields). If blocked, deploy the relay and document the URL. | TODO | | R-002, R-012 | Could not be tested from the build sandbox (403). Do not claim it works without seeing data. |
| T-002 | Deploy to GitHub Pages and confirm the live URL loads on a phone. | TODO | Om | R-013 | Needs repo settings: Pages, branch main, root. |
| T-003 | Add `manifest.webmanifest` and an app icon so "Add to Home Screen" looks right. | TODO | | R-009 | Original icon artwork only. |
| T-004 | Show price change since last refresh (green/red arrow or delta in points). | TODO | | R-005 | CSS classes `.up` / `.dn` already exist. |
| T-005 | Search box across the visible markets. | PROPOSED | | | |
| T-006 | Make buckets editable in the UI instead of in code. | PROPOSED | | R-006 | |
| T-007 | Improve crypto/sports exclusion using each site's tags and categories, not only keywords. | PROPOSED | | R-007 | |
| T-008 | Reduce data use: fetch only the needed pages, or use lighter endpoints. | PROPOSED | | R-014 | |
| T-009 | Treat Kalshi and Polymarket volume as comparable (Kalshi counts contracts, Polymarket counts USD). | PROPOSED | | R-003 | Roughly $1 per contract, so approximate for now. |
| T-010 | Sync pins across devices without a backend (e.g. export/import code). | PROPOSED | | R-008 | |
| T-011 | Add a small test script for `normPM` / `normKA` using saved sample JSON. | PROPOSED | | | |
| T-012 | Sparkline of recent price history per market. | PROPOSED | | | Check endpoint availability and CORS first. |
