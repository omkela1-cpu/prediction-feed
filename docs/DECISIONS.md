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
| 2026-11-15 | One Cloudflare Worker is allowed as the only backend (Kalshi relay, pin sync). | Kalshi returned 403 to a request carrying a browser Origin header, and its events are not volume-sorted. Om agreed to a free Cloudflare account. |
| 2026-11-15 | Stay a web app; build the scrubbable chart on a canvas. | Polymarket price history is open to browsers. A native app is not needed for touch charts. |
| 2026-11-15 | Cross-site matching starts with pairs Om confirms. | Automatic title matching makes mistakes, and resolution rules can differ between sites. |
| 2026-11-15 | "Hottest" = top 20 by 24h volume plus a Movers section. | Owner choice. |
| 2026-11-15 | Worker ranks Kalshi with a rolling scan: 2 pages of 100 events per refresh, remembers events with 24h volume, re-reads the top 60 every time. | Tested: about 20,000 open Kalshi events in about 100 pages (about 3 minutes to read), with high-volume events spread across all pages. One call cannot read them all within the free plan limits (about 50 outgoing requests and 10 ms CPU per call). Trade-off: the list is incomplete for about the first 100 minutes, and again after Cloudflare restarts the Worker. See T-025. |
| 2026-11-15 | Relay URL lives in one constant, `KALSHI_RELAY_URL` in `index.html`; Settings can override it. When empty, the app shows Polymarket only with a short note. | Kalshi blocks direct browser calls, so there is no useful fallback. |
| 2026-11-15 | Worker refuses browser calls from any site except https://omkela1-cpu.github.io, but allows calls with no Origin header. | Keeps other sites from using it, while Om can still open the URL in a browser to check it. |
