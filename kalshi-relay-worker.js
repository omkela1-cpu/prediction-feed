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
//   /kalshi/history?series=S&ticker=T&r=1d|1w|1m|max   price history for one market, as [[unix_seconds, yes_price_0_to_1], ...]
//   /kalshi/search?q=words         open events matching the words (T-005), same shape as /kalshi/events.
//                                  Kalshi's trade API has no search, so this uses the public search the
//                                  kalshi.com site itself uses (/v1/search/series), then reads the events normally.
// Pin sync (T-010), GET and PUT:
//   /sync/<CODE>                   the list of pinned market ids saved under a random sync code, as {"ids":[...],"updated":...}
//   Stored in a Workers KV namespace bound to this Worker as SYNC (docs/CLOUDFLARE_SETUP.md). Only market ids
//   like "pm:some-slug" or "ka:TICKER" are accepted: no names, emails or anything personal. Without the
//   binding, /sync answers 503 and everything else still works.
// Only the app's own site may call it from a browser (ALLOWED_ORIGIN below).

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";
const KALSHI_SEARCH = "https://api.elections.kalshi.com/v1/search/series";
const SEARCH_MAX = 12;      // events per search
const ALLOWED_ORIGIN = "https://omkela1-cpu.github.io";
const CACHE_MS = 20000;     // identical requests within 20s reuse the last answer
const MAX_TICKERS = 120, CHUNK = 40;
const TICKER = /^[A-Za-z0-9._-]{1,100}$/;
const MKEYS = ["ticker", "status", "yes_sub_title", "subtitle", "title", "yes_bid_dollars", "yes_ask_dollars",
  "last_price_dollars", "previous_price_dollars", "volume_24h_fp", "open_interest_fp", "close_time", "expiration_time"];
const RANGE = { "1d": [86400, 1], "1w": [604800, 60], "1m": [2592000, 60], "max": [63072000, 1440] }; // seconds back, minutes per point
const cache = new Map();    // key -> {t, body}; a convenience only, safe to lose
const SYNC_CODE = /^[a-z0-9]{16,64}$/, PIN_ID = /^(pm|ka):[A-Za-z0-9._-]{1,150}$/;
const MAX_SYNC_BYTES = 8192, MAX_PINS = 200; // free KV plan: 1000 writes a day, so keep it small; the app only writes on change
const SYNC_METHODS = "GET, PUT, OPTIONS";

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

function headers(origin, extra, methods) {
  const h = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=15", Vary: "Origin", ...extra };
  if (origin === ALLOWED_ORIGIN) {
    h["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN; h["Access-Control-Allow-Methods"] = methods || "GET, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type";
  }
  return h;
}
const send = (origin, status, obj, extra, methods) => new Response(JSON.stringify(obj), { status, headers: headers(origin, extra, methods) });

async function sync(request, env, origin, code) {
  const out = (status, obj) => send(origin, status, obj, { "Cache-Control": "no-store" }, SYNC_METHODS);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin, { "Access-Control-Max-Age": "86400" }, SYNC_METHODS) });
  if (request.method !== "GET" && request.method !== "PUT") return out(405, { error: "GET or PUT only" });
  if (!SYNC_CODE.test(code)) return out(400, { error: "a sync code is 16 to 64 lowercase letters or digits" });
  if (!env || !env.SYNC) return out(503, { error: "pin sync is not set up: this Worker has no KV binding named SYNC" });
  const key = "pins:" + code;
  if (request.method === "GET") {
    const v = await env.SYNC.get(key, "json");
    return out(200, v && Array.isArray(v.ids) ? v : { ids: [], updated: null });
  }
  if (+(request.headers.get("Content-Length") || 0) > MAX_SYNC_BYTES) return out(413, { error: "too big" });
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_SYNC_BYTES) return out(413, { error: "too big" });
  let d; try { d = JSON.parse(text); } catch { d = null; }
  const ids = d && Array.isArray(d.ids) ? d.ids : null;
  if (!ids || ids.length > MAX_PINS || !ids.every(x => typeof x === "string" && PIN_ID.test(x)))
    return out(400, { error: 'send {"ids":["pm:slug","ka:TICKER",...]}, at most ' + MAX_PINS });
  const v = { ids: [...new Set(ids)], updated: new Date().toISOString() };
  await env.SYNC.put(key, JSON.stringify(v));
  return out(200, v);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    // Browsers send an Origin header on cross-site calls. Refuse any site other than the app.
    // Opening a URL directly in the address bar sends none, so Om can still check it by hand.
    if (origin && origin !== ALLOWED_ORIGIN) return send(null, 403, { error: "origin not allowed" });
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    const sc = path.match(/^\/sync\/([^/]*)$/);
    if (sc) {
      try { return await sync(request, env, origin, sc[1]); }
      catch (e) { return send(origin, 502, { error: "sync storage failed: " + String(e.message || "unknown") }, { "Cache-Control": "no-store" }, SYNC_METHODS); }
    }
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin, { "Access-Control-Max-Age": "86400" }) });
    if (request.method !== "GET") return send(origin, 405, { error: "GET only" });

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
      if (path === "/kalshi/search") {
        // letters, digits and a little punctuation only; Kalshi's firewall refuses things like "<"
        const q = (url.searchParams.get("q") || "").replace(/[^\p{L}\p{N} .,'&%$-]/gu, " ").replace(/\s+/g, " ").trim();
        if (q.length < 2 || q.length > 60) return send(origin, 400, { error: "give ?q=words (2 to 60 characters)" });
        const key = "S:" + q.toLowerCase(), hit = fresh(key);
        if (hit) return send(origin, 200, hit);
        const r = await fetch(`${KALSHI_SEARCH}?query=${encodeURIComponent(q)}&page_size=${SEARCH_MAX}`, { headers: { Accept: "application/json" } });
        if (!r.ok) { const e = new Error("Kalshi search HTTP " + r.status); e.status = r.status === 404 ? 502 : r.status; throw e; }
        const found = (await r.json()).current_page || [];
        // the app leaves out sports and crypto anyway (R-007); dropping them here also saves data (a crypto event can have 188 markets)
        const tickers = [...new Set(found.filter(c => c && c.active_market_count > 0 && TICKER.test(c.event_ticker || "") && !/^(sports|crypto)$/i.test(c.category || ""))
          .map(c => c.event_ticker.toUpperCase()))].slice(0, SEARCH_MAX);
        if (!tickers.length) return send(origin, 200, remember(key, { events: [] }));
        const d = await kget(`/events?tickers=${tickers.map(encodeURIComponent).join(",")}&with_nested_markets=true&limit=200`);
        const got = new Map(); for (const e of d.events || []) got.set(e.event_ticker, slimEvent(e));
        const events = tickers.map(t => got.get(t)).filter(e => e && e.markets.length);
        return send(origin, 200, remember(key, { events }));
      }
      if (path === "/kalshi/history") {
        const series = (url.searchParams.get("series") || "").toUpperCase(), ticker = (url.searchParams.get("ticker") || "").toUpperCase();
        const rg = RANGE[url.searchParams.get("r") || "1w"];
        if (!TICKER.test(series) || !TICKER.test(ticker) || !rg) return send(origin, 400, { error: "give ?series=S&ticker=T&r=1d|1w|1m|max" });
        const key = "H:" + series + ":" + ticker + ":" + url.searchParams.get("r"), hit = fresh(key);
        if (hit) return send(origin, 200, hit);
        const end = Math.floor(Date.now() / 1000);
        const d = await kget(`/series/${encodeURIComponent(series)}/markets/${encodeURIComponent(ticker)}/candlesticks?start_ts=${end - rg[0]}&end_ts=${end}&period_interval=${rg[1]}`);
        const pts = [];
        for (const c of d.candlesticks || []) {
          // price is the last trade in the period; when nothing traded, use the middle of the best bid and ask
          let p = parseFloat(c.price && c.price.close_dollars);
          if (!isFinite(p)) {
            const b = parseFloat(c.yes_bid && c.yes_bid.close_dollars), a = parseFloat(c.yes_ask && c.yes_ask.close_dollars);
            p = isFinite(b) && isFinite(a) ? (a + b) / 2 : NaN;
          }
          if (isFinite(p) && c.end_period_ts) pts.push([c.end_period_ts, Math.round(p * 10000) / 10000]);
        }
        return send(origin, 200, remember(key, { pts }));
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
      return send(origin, 404, { error: "use /kalshi/events?tickers=..., /kalshi/event/<ticker> or /kalshi/history?series=..&ticker=..&r=1w, /kalshi/search?q=.. or /sync/<code>" });
    } catch (e) {
      return send(origin, e.status === 404 ? 404 : 502, { error: String(e.message || "failed") });
    }
  },
};
