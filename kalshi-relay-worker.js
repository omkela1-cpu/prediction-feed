// Prediction Feed: Kalshi relay (one small Cloudflare Worker, free plan).
// Why: Kalshi blocks requests from browsers (403), and its events are not sorted by volume.
// Setup steps for Om: docs/CLOUDFLARE_SETUP.md (dashboard only, no CLI, no keys).
// Read-only: it only makes GET requests to Kalshi's public market data. No trading, no logins, no secrets.
//
// Routes (GET only):
//   /kalshi/top?limit=N     open Kalshi events ranked by 24h volume (N from 1 to 200, default 100)
//   /kalshi/event/<TICKER>  one event with its markets (used for pinned markets)
// Only the app's own site may call it from a browser (ALLOWED_ORIGIN below).
//
// How the ranking works: Kalshi has about 20,000 open events (about 100 pages), far too many to
// read in one go on the free plan. So each refresh (at most once per CACHE_MS) reads the next
// PAGES_PER_CALL pages, remembers every event it has seen, and re-reads the current leaders so
// their prices stay fresh. The list gets more complete the longer the Worker runs.
// The response says how many events it has seen ("seen") and whether it has read every page at
// least once ("complete").

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";
const ALLOWED_ORIGIN = "https://omkela1-cpu.github.io";
const CACHE_MS = 60000;     // rebuild the ranking at most once a minute
const PAGE_LIMIT = 100;     // events per Kalshi page
const PAGES_PER_CALL = 2;   // pages read per rebuild (kept small for the free plan's CPU limit)
const LEADERS = 60;         // current top events re-read on every rebuild
const MKEYS = ["ticker", "status", "yes_sub_title", "subtitle", "title", "yes_bid_dollars", "yes_ask_dollars",
  "last_price_dollars", "previous_price_dollars", "volume_24h_fp", "open_interest_fp", "close_time", "expiration_time"];

const seen = new Map();     // event_ticker -> {ev, vol, t}
let cursor = "", cycleStart = Date.now(), fullScans = 0, top = null, building = null;
const eventCache = new Map(); // ticker -> {t, body}

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
const vol24 = ev => ev.markets.reduce((s, m) => s + (parseFloat(m.volume_24h_fp) || 0), 0);
function remember(e, markets) {
  if (!e || !e.event_ticker) return null;
  const ev = slimEvent(e, markets), vol = vol24(ev);
  if (vol > 0 && ev.markets.length) seen.set(ev.event_ticker, { ev, vol, t: Date.now() });
  else seen.delete(ev.event_ticker);
  return ev;
}
const ranked = () => [...seen.values()].sort((a, b) => b.vol - a.vol);

async function rebuild() {
  let pages = 0, failed = 0;
  for (let i = 0; i < PAGES_PER_CALL; i++) {
    let d;
    try { d = await kget(`/events?status=open&with_nested_markets=true&limit=${PAGE_LIMIT}${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`); }
    catch { failed++; break; }
    if (!d || !Array.isArray(d.events)) { failed++; break; } // Kalshi sometimes sends a page without "events"
    d.events.forEach(e => remember(e)); pages++;
    cursor = d.cursor || "";
    if (!cursor) { // finished a full pass: forget events not seen since it started, then start again
      for (const [k, v] of seen) if (v.t < cycleStart) seen.delete(k);
      fullScans++; cycleStart = Date.now(); break;
    }
  }
  const lead = ranked().slice(0, LEADERS).map(x => x.ev.event_ticker);
  if (lead.length) {
    try {
      const d = await kget(`/events?tickers=${lead.map(encodeURIComponent).join(",")}&with_nested_markets=true&limit=200`);
      const back = new Set();
      for (const e of d.events || []) { remember(e); back.add(e.event_ticker); }
      if (Array.isArray(d.events)) for (const k of lead) if (!back.has(k)) seen.delete(k);
    } catch { failed++; }
  }
  if (!seen.size && failed) throw new Error("Kalshi unavailable");
  top = { t: Date.now(), list: ranked(), pages, failed };
}

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
      if (path === "/kalshi/top") {
        const n = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit"), 10) || 100));
        if (!top || Date.now() - top.t > CACHE_MS) { building = building || rebuild().finally(() => { building = null; }); await building; }
        return send(origin, 200, { events: top.list.slice(0, n).map(x => x.ev), seen: seen.size, complete: fullScans > 0,
          updated: new Date(top.t).toISOString() });
      }
      const m = path.match(/^\/kalshi\/event\/([A-Za-z0-9._-]{1,100})$/);
      if (m) {
        const t = m[1].toUpperCase(), c = eventCache.get(t);
        if (c && Date.now() - c.t < CACHE_MS) return send(origin, 200, c.body);
        const d = await kget(`/events/${encodeURIComponent(t)}?with_nested_markets=true`);
        if (!d || !d.event) return send(origin, 502, { error: "unexpected reply from Kalshi" });
        const ev = remember(d.event, (d.event.markets && d.event.markets.length) ? d.event.markets : d.markets);
        const body = { event: ev };
        if (eventCache.size > 300) eventCache.clear();
        eventCache.set(t, { t: Date.now(), body });
        return send(origin, 200, body);
      }
      return send(origin, 404, { error: "use /kalshi/top or /kalshi/event/<ticker>" });
    } catch (e) {
      return send(origin, e.status === 404 ? 404 : 502, { error: String(e.message || "failed") });
    }
  },
};
