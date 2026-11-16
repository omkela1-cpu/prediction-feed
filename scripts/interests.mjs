// Builds the interest list: every open market on Polymarket and Kalshi that matches one of Om's
// interests (scripts/interests-config.mjs), has at least FLOOR dollars of open interest, is not a
// routine repeat and is not already settled. Writes a small JSON file; the app fetches live prices
// for the markets in it. Run hourly by .github/workflows/kalshi-top.yml. Read-only public data.
// Usage: node scripts/interests.mjs <output file>
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { FLOOR, SETTLED, SECTIONS, ROUTINE, INTERESTS, SKIP } from "./interests-config.mjs";

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";
const GAMMA = "https://gamma-api.polymarket.com/events";
const KEEP = 8;                    // markets kept per interest in the file (the app shows fewer)
const MAX_MARKETS = 12;            // Kalshi markets kept per event
const REPEATS = new Set(["daily", "weekly", "monthly", "hourly", "fifteen_min", "15m", "5m", "1m"]);
const MKEYS = ["ticker", "status", "yes_sub_title", "subtitle", "title", "yes_bid_dollars", "yes_ask_dollars",
  "last_price_dollars", "previous_price_dollars", "volume_24h_fp", "open_interest_fp", "close_time", "expiration_time"];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : NaN; };
const out = process.argv[2];
if (!out) { console.error("give an output file"); process.exit(2); }

async function get(url, what) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (r.ok) return r.json();
      console.error(`${what} attempt ${attempt}: HTTP ${r.status}`);
    } catch (e) { console.error(`${what} attempt ${attempt}: ${e.message}`); }
    await sleep(1500 * attempt);
  }
  throw new Error(what + " failed 5 times");
}
function interestOf(title) {
  for (const it of INTERESTS) if (it.re.test(title) && !(it.not && it.not.test(title))) return it;
  return null;
}
// true when at least one outcome is still open to doubt
const contested = ps => ps.some(p => p > SETTLED && p < 1 - SETTLED);

const started = Date.now();
const kept = [];

/* ---------- Polymarket: the 2,100 events with the most money at stake (the API stops paging there) ---------- */
let pmRead = 0;
for (let off = 0; off <= 2000; off += 100) {
  const d = await get(`${GAMMA}?active=true&closed=false&limit=100&offset=${off}&order=openInterest&ascending=false`, "polymarket page");
  pmRead += d.length;
  for (const e of d) {
    const oi = num(e.openInterest) || 0;
    if (oi < FLOOR) continue;
    const t = e.title || "";
    if (SKIP.test(t) || ROUTINE.test(t)) continue;
    if ((e.series || []).some(s => REPEATS.has(String(s.recurrence || "").toLowerCase()))) continue;
    const it = interestOf(t);
    if (!it) continue;
    const ms = (e.markets || []).filter(m => !m.closed && m.active !== false);
    const ps = ms.length === 1 ? JSON.parse(ms[0].outcomePrices || "[]").map(Number)
                               : ms.map(m => Number(JSON.parse(m.outcomePrices || "[]")[0]));
    if (!contested(ps)) continue;
    kept.push({ src: "pm", id: String(e.id), slug: e.slug, title: t, interest: it.name, section: it.section, oi: Math.round(oi) });
  }
  if (d.length < 100) break;
  await sleep(100);
}

/* ---------- Kalshi: which series repeat, then every open event ---------- */
const freq = {};
for (const s of (await get(`${KALSHI}/series`, "kalshi series")).series || []) freq[s.ticker] = s.frequency;
let kaRead = 0, cursor = "";
const kaKept = [];
do {
  const d = await get(`${KALSHI}/events?status=open&with_nested_markets=true&limit=200${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`, "kalshi page");
  if (!Array.isArray(d.events)) throw new Error("kalshi page without events");
  kaRead += d.events.length;
  for (const e of d.events) {
    const t = e.title || "";
    if (/^(sports|crypto)$/i.test(e.category || "") || SKIP.test(t) || ROUTINE.test(t)) continue;
    if (REPEATS.has(String(freq[e.series_ticker] || "").toLowerCase())) continue;
    const it = interestOf(t);
    if (!it) continue;
    const ms = (e.markets || []).filter(m => !m.status || m.status === "active" || m.status === "open");
    const oi = ms.reduce((s, m) => s + (num(m.open_interest_fp) || 0), 0);   // contracts; each pays $1, so this is dollars at stake
    if (oi < FLOOR) continue;
    const price = m => { const l = num(m.last_price_dollars); if (l > 0) return l;
      const b = num(m.yes_bid_dollars), a = num(m.yes_ask_dollars); return isFinite(a) && isFinite(b) ? (a + b) / 2 : NaN; };
    if (!contested(ms.map(price).filter(isFinite))) continue;
    ms.sort((a, b) => (num(b.open_interest_fp) || 0) - (num(a.open_interest_fp) || 0));
    kaKept.push({ src: "ka", event_ticker: e.event_ticker, series_ticker: e.series_ticker, title: t, sub_title: e.sub_title,
      category: e.category, frequency: freq[e.series_ticker] || null, interest: it.name, section: it.section,
      oi: Math.round(oi), oi_total: Math.round(oi), vol24_total: Math.round(ms.reduce((s, m) => s + (num(m.volume_24h_fp) || 0), 0)),
      markets: ms.slice(0, MAX_MARKETS).map(m => { const o = {}; for (const k of MKEYS) if (m[k] != null) o[k] = m[k]; return o; }) });
  }
  cursor = d.cursor || "";
  await sleep(250);
} while (cursor);

/* ---------- keep the biggest per interest, then price the Kalshi ones in cash (24h trades) ---------- */
const all = [...kept, ...kaKept].sort((a, b) => b.oi - a.oi);
const per = {};
const events = all.filter(x => (per[x.interest] = (per[x.interest] || 0) + 1) <= KEEP);

async function cash24(ticker) {     // cash the takers paid over the last 24h, as in kalshi-top.mjs
  const since = Math.floor(Date.now() / 1000) - 86400;
  let c = "", cash = 0, pages = 0;
  do {
    const d = await get(`${KALSHI}/markets/trades?ticker=${encodeURIComponent(ticker)}&min_ts=${since}&limit=1000${c ? "&cursor=" + encodeURIComponent(c) : ""}`, "trades " + ticker);
    for (const x of d.trades || []) {
      const p = num(x.taker_outcome_side === "yes" ? x.yes_price_dollars : x.no_price_dollars);
      if (isFinite(p)) cash += (num(x.count_fp) || 0) * p;
    }
    c = d.cursor || ""; pages++;
    await sleep(120);
  } while (c && pages < 10);
  return cash;
}
const pricing = Date.now();
for (const e of events) {
  if (e.src !== "ka" || Date.now() - pricing > 3 * 60 * 1000) continue;
  let usd = 0;
  for (const m of e.markets) if ((num(m.volume_24h_fp) || 0) > 0) { m.usd24 = Math.round(await cash24(m.ticker)); usd += m.usd24; }
  e.usd24_total = Math.round(usd);   // markets beyond the first 12 are left out; they are small
}

const body = { updated: new Date().toISOString(), floor: FLOOR, sections: SECTIONS,
  interests: INTERESTS.map(i => ({ name: i.name, section: i.section, max: i.max || 2 })),
  read: { polymarket: pmRead, kalshi: kaRead }, events };
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(body));
const by = {}; for (const e of events) by[e.section] = (by[e.section] || 0) + 1;
console.log(`read ${pmRead} Polymarket and ${kaRead} Kalshi events in ${Math.round((Date.now() - started) / 1000)}s; kept ${events.length}: ${JSON.stringify(by)}`);
