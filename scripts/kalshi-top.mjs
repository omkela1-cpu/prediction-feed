// Builds the Kalshi "hot list": reads every open Kalshi event, ranks them by 24h volume and
// writes the top ones to a small JSON file.
// Volume is made comparable with Polymarket: Kalshi reports contracts (each worth $1 at the end),
// Polymarket reports cash traded. So for the busiest events this script reads the last 24 hours of
// trades and adds up the cash the taker paid for each contract (usd24_total). Contracts alone can
// overstate cash by 5x or more in lopsided markets. Run by .github/workflows/kalshi-top.yml on a timer.
// Read-only: public market data, no keys, no trading.
// Usage: node scripts/kalshi-top.mjs <output file>
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";
const TOP = 120;          // events kept in the file
const MAX_PAGES = 400;    // safety stop
const MAX_MARKETS = 12;   // markets kept per event (totals below still count all of them)
const MKEYS = ["ticker", "status", "yes_sub_title", "subtitle", "title", "yes_bid_dollars", "yes_ask_dollars",
  "last_price_dollars", "previous_price_dollars", "volume_24h_fp", "open_interest_fp", "close_time", "expiration_time"];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const activeM = m => !m.status || m.status === "active" || m.status === "open";
const vol = m => parseFloat(m.volume_24h_fp) || 0;
const WANT = 100;                 // events whose cash volume must be known before we may stop
const CAP = 250;                  // never price more than this many events
const BUDGET_MS = 6 * 60 * 1000;  // time limit for the trade reading
const EXACT_SHARE = 0.01;         // markets under 1% of an event's contracts are estimated, not read
const MAX_TRADE_PAGES = 30;       // per market; beyond this the cash is scaled up from what was read

async function page(cursor) {
  const url = `${KALSHI}/events?status=open&with_nested_markets=true&limit=200${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (r.ok) { const d = await r.json(); if (Array.isArray(d.events)) return d; }
      console.error(`page attempt ${attempt}: HTTP ${r.status}`);
    } catch (e) { console.error(`page attempt ${attempt}: ${e.message}`); }
    await sleep(1500 * attempt);
  }
  throw new Error("Kalshi page failed 5 times");
}

async function trades(ticker, since, cursor) {
  const url = `${KALSHI}/markets/trades?ticker=${encodeURIComponent(ticker)}&min_ts=${since}&limit=1000${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (r.ok) return r.json();
      if (r.status === 404) return { trades: [] };
      console.error(`trades ${ticker} attempt ${attempt}: HTTP ${r.status}`);
    } catch (e) { console.error(`trades ${ticker} attempt ${attempt}: ${e.message}`); }
    await sleep(1500 * attempt);
  }
  throw new Error("Kalshi trades failed 5 times for " + ticker);
}
// Cash the takers paid for one market over the last 24 hours (a yes taker pays the yes price, a no taker the no price).
async function marketCash(ticker, face) {
  const since = Math.floor(Date.now() / 1000) - 86400;
  let cursor = "", cash = 0, seen = 0, pages = 0;
  do {
    const d = await trades(ticker, since, cursor);
    for (const x of d.trades || []) {
      const c = parseFloat(x.count_fp) || 0;
      const p = parseFloat(x.taker_outcome_side === "yes" ? x.yes_price_dollars : x.no_price_dollars);
      if (isFinite(p)) { cash += c * p; seen += c; }
    }
    cursor = d.cursor || ""; pages++;
    await sleep(150);
  } while (cursor && pages < MAX_TRADE_PAGES);
  if (cursor && seen > 0) cash *= face / seen;
  return cash;
}
async function eventCash(r) {
  const face = r.ms.reduce((s, m) => s + vol(m), 0);
  let exactFace = 0, exactCash = 0;
  for (const m of r.ms) if (vol(m) >= face * EXACT_SHARE) {
    m._usd = await marketCash(m.ticker, vol(m)); exactFace += vol(m); exactCash += m._usd;
  }
  const ratio = exactFace > 0 ? exactCash / exactFace : 0.5;   // small markets: same cash per contract as the big ones
  for (const m of r.ms) if (m._usd == null) m._usd = vol(m) * ratio;
  return r.ms.reduce((s, m) => s + m._usd, 0);
}

const out = process.argv[2];
if (!out) { console.error("give an output file"); process.exit(2); }
const started = Date.now();
const ranked = [];
let cursor = "", pages = 0, total = 0;
do {
  const d = await page(cursor);
  pages++; total += d.events.length;
  for (const e of d.events) {
    if (/^(sports|crypto)$/i.test(e.category || "")) continue; // the app excludes these anyway
    const ms = (e.markets || []).filter(activeM);
    const v = ms.reduce((s, m) => s + vol(m), 0);
    if (!ms.length || v <= 0) continue;
    ms.sort((a, b) => vol(b) - vol(a));
    const oi = ms.reduce((s, m) => s + (parseFloat(m.open_interest_fp) || 0), 0);
    ranked.push({ v, oi, e, ms });
  }
  cursor = d.cursor || "";
  await sleep(250);
} while (cursor && pages < MAX_PAGES);
if (cursor) { console.error("stopped at the page limit; not publishing a partial list"); process.exit(1); }

// Stage 2: price the busiest events in cash. Cash can never exceed contracts, so once the cash of the
// WANT-th best event is above the contracts of the next event, nothing further down can get in.
ranked.sort((a, b) => b.v - a.v);
const priced = [], cashes = [], stage2 = Date.now();
for (const r of ranked) {
  if (priced.length >= WANT && r.v <= cashes[WANT - 1]) break;
  if (priced.length >= CAP || Date.now() - stage2 > BUDGET_MS) { console.error(`stopped pricing at ${priced.length} events (limit reached)`); break; }
  r.cash = await eventCash(r);
  priced.push(r); cashes.push(r.cash); cashes.sort((a, b) => b - a);
}
priced.sort((a, b) => b.cash - a.cash);
const events = priced.slice(0, TOP).map(r => ({
  event_ticker: r.e.event_ticker, series_ticker: r.e.series_ticker, title: r.e.title, sub_title: r.e.sub_title, category: r.e.category,
  usd24_total: Math.round(r.cash), vol24_total: Math.round(r.v), oi_total: Math.round(r.oi),
  markets: r.ms.slice(0, MAX_MARKETS).map(m => { const o = {}; for (const k of MKEYS) if (m[k] != null) o[k] = m[k]; o.usd24 = Math.round(m._usd); return o; }),
}));
const body = { updated: new Date().toISOString(), events_read: total, pages, priced: priced.length, events };
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(body));
console.log(`read ${total} events on ${pages} pages, priced ${priced.length} in cash, in ${Math.round((Date.now() - started) / 1000)}s; kept ${body.events.length}; top: ${body.events.slice(0, 3).map(e => e.title + " $" + e.usd24_total).join(" / ")}`);
