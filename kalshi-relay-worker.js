// Prediction Feed: Kalshi relay (one small Cloudflare Worker, free plan).
// Why: Kalshi blocks requests from browsers (403), so the app cannot ask Kalshi for live prices itself.
// Setup steps for Om: docs/CLOUDFLARE_SETUP.md (dashboard only, no CLI, no keys).
// Read-only: it only makes GET requests to Kalshi's public market data. No trading, no logins, no secrets.
//
// Which markets are "hot" is NOT decided here. A scheduled GitHub job (scripts/kalshi-top.mjs)
// reads all of Kalshi every 10 minutes and publishes the hot list. The app reads that list and
// asks this Worker only for live prices of those events. The Worker keeps nothing in memory
// that matters, so it does not care when Cloudflare restarts it.
//
// Routes (GET only):
//   /kalshi/events?tickers=A,B,C   live data for up to 120 events
//   /kalshi/event/<TICKER>         one event (used for pinned markets)
// Only the app's own site may call it from a browser (ALLOWED_ORIGIN below).

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";
const ALLOWED_ORIGIN = "https://omkela1-cpu.github.io";
const CACHE_MS = 20000;     // identical requests within 20s reuse the last answer
const MAX_TICKERS = 120, CHUNK = 40;
const TICKER = /^[A-Za-z0-9._-]{1,100}$/;
const MKEYS = ["ticker", "status", "yes_sub_title", "subtitle", "title", "yes_bid_dollars", "yes_ask_dollars",
  "last_price_dollars", "previous_price_dollars", "volume_24h_fp", "open_interest_fp", "close_time", "expiration_time"];
const cache = new Map();    // key -> {t, body}; a convenience only, safe to lose

async function kget(path) {
  const r = await fetch(KALSHI + path, { headers: { Accept: "application/json" } });
  if (!r.ok) { const e = new Error("Kalshi HTTP " + r.status); e.status = r.status; throw e; }
  return r.json();
}
const activeM = m => !m.status || m.status === "active" || m.status === "open";
function slimEvent(e, markets) {
  const ms = (markets || e.markets || []).filter(activeM).map(m => {
    const o = {}; for (const k of MKEYS) if (m[k] != null) o[k] = m[k]; return o;
  });
  return { event_ticker: e.event_ticker, series_ticker: e.series_ticker, title: e.title, sub_title: e.sub_title,
    category: e.category, markets: ms };
}
function remember(key, body) { if (cache.size > 300) cache.clear(); cache.set(key, { t: Date.now(), body }); return body; }
const fresh = key => { const c = cache.get(key); return c && Date.now() - c.t < CACHE_MS ? c.body : null; };

function headers(origin, extra) {
  const h = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=15", Vary: "Origin", ...extra };
  if (origin === ALLOWED_ORIGIN) { h["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN; h["Access-Control-Allow-Methods"] = "GET, OPTIONS"; }
  return h;
}
const send = (origin, status, obj) => new Response(JSON.stringify(obj), { status, headers: headers(origin) });

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin");
    // Browsers send an Origin header on cross-site calls. Refuse any site other than the app.
    // Opening a URL directly in the address bar sends none, so Om can still check it by hand.
    if (origin && origin !== ALLOWED_ORIGIN) return send(null, 403, { error: "origin not allowed" });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin, { "Access-Control-Max-Age": "86400" }) });
    if (request.method !== "GET") return send(origin, 405, { error: "GET only" });

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    try {
      if (path === "/kalshi/events") {
        const tickers = [...new Set((url.searchParams.get("tickers") || "").split(",").map(s => s.trim().toUpperCase()).filter(s => TICKER.test(s)))].slice(0, MAX_TICKERS);
        if (!tickers.length) return send(origin, 400, { error: "give ?tickers=A,B,C" });
        const key = "L:" + tickers.join(","), hit = fresh(key);
        if (hit) return send(origin, 200, hit);
        const chunks = []; for (let i = 0; i < tickers.length; i += CHUNK) chunks.push(tickers.slice(i, i + CHUNK));
        const parts = await Promise.all(chunks.map(c => kget(`/events?tickers=${c.map(encodeURIComponent).join(",")}&with_nested_markets=true&limit=200`)));
        const got = new Map();
        for (const d of parts) for (const e of d.events || []) got.set(e.event_ticker, slimEvent(e));
        // keep the order asked for; events Kalshi no longer returns (closed) are simply left out
        const events = tickers.map(t => got.get(t)).filter(e => e && e.markets.length);
        return send(origin, 200, remember(key, { events, updated: new Date().toISOString() }));
      }
      const m = path.match(/^\/kalshi\/event\/([A-Za-z0-9._-]{1,100})$/);
      if (m) {
        const t = m[1].toUpperCase(), key = "E:" + t, hit = fresh(key);
        if (hit) return send(origin, 200, hit);
        const d = await kget(`/events/${encodeURIComponent(t)}?with_nested_markets=true`);
        if (!d || !d.event) return send(origin, 502, { error: "unexpected reply from Kalshi" });
        const ev = slimEvent(d.event, (d.event.markets && d.event.markets.length) ? d.event.markets : d.markets);
        return send(origin, 200, remember(key, { event: ev }));
      }
      return send(origin, 404, { error: "use /kalshi/events?tickers=... or /kalshi/event/<ticker>" });
    } catch (e) {
      return send(origin, e.status === 404 ? 404 : 502, { error: String(e.message || "failed") });
    }
  },
};
