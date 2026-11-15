// Builds the Kalshi "hot list": reads every open Kalshi event, ranks them by 24h volume and
// writes the top ones to a small JSON file. Run by .github/workflows/kalshi-top.yml on a timer.
// Read-only: public market data, no keys, no trading.
// Usage: node scripts/kalshi-top.mjs <output file>
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";
const TOP = 150;          // events kept in the file
const MAX_PAGES = 400;    // safety stop
const MAX_MARKETS = 15;   // markets kept per event (totals below still count all of them)
const MKEYS = ["ticker", "status", "yes_sub_title", "subtitle", "title", "yes_bid_dollars", "yes_ask_dollars",
  "last_price_dollars", "previous_price_dollars", "volume_24h_fp", "open_interest_fp", "close_time", "expiration_time"];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const activeM = m => !m.status || m.status === "active" || m.status === "open";
const vol = m => parseFloat(m.volume_24h_fp) || 0;

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
    const markets = ms.sort((a, b) => vol(b) - vol(a)).slice(0, MAX_MARKETS).map(m => {
      const o = {}; for (const k of MKEYS) if (m[k] != null) o[k] = m[k]; return o;
    });
    const oi = ms.reduce((s, m) => s + (parseFloat(m.open_interest_fp) || 0), 0);
    ranked.push({ v, ev: { event_ticker: e.event_ticker, series_ticker: e.series_ticker, title: e.title, sub_title: e.sub_title,
      category: e.category, vol24_total: Math.round(v), oi_total: Math.round(oi), markets } });
  }
  cursor = d.cursor || "";
  await sleep(250);
} while (cursor && pages < MAX_PAGES);
if (cursor) { console.error("stopped at the page limit; not publishing a partial list"); process.exit(1); }

ranked.sort((a, b) => b.v - a.v);
const body = { updated: new Date().toISOString(), events_read: total, pages, events: ranked.slice(0, TOP).map(x => x.ev) };
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(body));
console.log(`read ${total} events on ${pages} pages in ${Math.round((Date.now() - started) / 1000)}s; kept ${body.events.length}; top: ${body.events.slice(0, 3).map(e => e.title).join(" / ")}`);
