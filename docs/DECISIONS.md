# Decisions

| Date | Decision | Why |
|------|----------|-----|
| 2026-11-15 | Static site on GitHub Pages; the browser calls the APIs directly. | Free, no backend, genuinely live prices on a phone. Claude-hosted pages cannot call outside sites, so they were ruled out. |
| 2026-11-15 | Read-only, public endpoints only. | The owner does not want to trade. Removes any need for keys. |
| 2026-11-15 | Top N by 24h volume, then bucket (instead of fixed topics first). | Owner wants the hottest markets, categorised live. |
| 2026-11-15 | Crypto and sports excluded. | Owner request (crypto); sports volume would swamp everything else. |
| 2026-11-15 | Pins in localStorage; pinned markets refreshed by direct lookup. | No backend. Limitation: pins are per browser, and the home-screen app can have separate storage from Safari. |
| 2026-11-15 | Polymarket pages of 50 events. | The API only serves pages over 50 events with gzip. |
| 2026-11-15 | Optional Kalshi relay (Cloudflare Worker). | Kalshi browser access (CORS) is unverified. |
