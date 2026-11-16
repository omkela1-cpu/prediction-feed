// Tests for normPM / normKA (T-011). Plain Node, no packages. Run from the repo root:
//   node tests/normalise.test.mjs
// It copies the needed constants and functions out of the <script> in index.html (so the app itself is
// not restructured) and runs them on saved, trimmed sample data from live Polymarket and Kalshi
// (tests/samples/, saved 2026-11-16, public market data only, nothing personal).
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

// Find "function NAME(" or "const NAME =" and take the whole statement, counting brackets
// (skipping strings and regex literals in the simple form this file uses).
function grab(name) {
  const m = new RegExp(`(^|\\n)(function ${name}\\(|const ${name}\\s*=)`).exec(script);
  if (!m) throw new Error("not found in index.html: " + name);
  const start = m.index + m[1].length, isFn = m[2].startsWith("function");
  let depth = 0, seenBody = false;
  for (let i = start; i < script.length; i++) {
    const c = script[i];
    if (c === '"' || c === "'" || c === "`") { const q = c; for (i++; i < script.length && script[i] !== q; i++) if (script[i] === "\\") i++; continue; }
    if (c === "/" && /[=(,:|&!?]\s*$/.test(script.slice(Math.max(0, i - 3), i)) ) { // regex literal
      for (i++; i < script.length && script[i] !== "/"; i++) { if (script[i] === "\\") i++; else if (script[i] === "[") { for (i++; script[i] !== "]"; i++) if (script[i] === "\\") i++; } }
      continue;
    }
    if ("([{".includes(c)) { depth++; if (c === "{") seenBody = true; }
    else if (")]}".includes(c)) { depth--; if (isFn && seenBody && depth === 0 && c === "}") return script.slice(start, i + 1); }
    else if (!isFn && depth === 0 && (c === ";" || c === "\n") && i > start + name.length + 8) {
      if (c === ";" || !/[,+\-*/?:=&|(\[{]\s*$/.test(script.slice(start, i))) return script.slice(start, i + 1);
    }
  }
  throw new Error("could not cut out " + name);
}
// Start from the two functions; any other constant or helper they use is added the first time it is missing.
const names = ["normPM", "normKA"];
let ctx;
for (let tries = 0; ; tries++) {
  ctx = vm.createContext({});
  vm.runInContext(names.map(grab).join("\n") + "\n;globalThis.T = {normPM, normKA};", ctx);
  const s = JSON.parse(readFileSync(new URL("tests/samples/polymarket-events.json", root), "utf8"))[0];
  try { ctx.T.normPM(s); ctx.T.normKA(JSON.parse(readFileSync(new URL("tests/samples/kalshi-events.json", root), "utf8")).hot_list_event); break; }
  catch (e) {
    const miss = /^(\w+) is not defined/.exec(e.message);
    if (!miss || tries > 40) throw e;
    names.unshift(miss[1]);
  }
}
const { normPM, normKA } = ctx.T;

const sample = f => JSON.parse(readFileSync(new URL("tests/samples/" + f, root), "utf8"));
const pm = sample("polymarket-events.json"), ka = sample("kalshi-events.json");
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("ok   " + name); } catch (e) { console.log("FAIL " + name + "\n     " + e.message); process.exitCode = 1; } }
const sortedDesc = a => a.every((x, i) => i === 0 || a[i - 1].p >= x.p);
const near = (a, b) => Math.abs(a - b) < 1e-9;

/* ---------- Polymarket ---------- */
const [single, multi, sport, crypto, esports] = pm;
test("normPM: single market keeps both outcomes with prices, token ids and opposite 24h changes", () => {
  const it = normPM(single), m = single.markets[0], p = JSON.parse(m.outcomePrices).map(Number);
  assert.equal(it.id, "pm:" + single.slug); assert.equal(it.ref, single.slug); assert.equal(it.src, "pm");
  assert.equal(it.all.length, 2); assert.ok(sortedDesc(it.all));
  const yes = it.all.find(o => o.name === "Yes"), no = it.all.find(o => o.name === "No");
  assert.ok(near(yes.p, p[0]) && near(no.p, p[1]));
  assert.ok(near(yes.d1, Number(m.oneDayPriceChange)) && near(no.d1, -Number(m.oneDayPriceChange)));
  assert.ok(yes.tok && no.tok && yes.tok !== no.tok);
  assert.equal(it.vol24, +single.volume24hr); assert.equal(it.liq, +single.openInterest); // open interest since T-028
  assert.equal(it.url, "https://polymarket.com/event/" + single.slug); assert.equal(it.skip, false);
});
test("normPM: multi-outcome event lists each market's Yes price, sorted, top 3 as outcomes", () => {
  const it = normPM(multi);
  assert.equal(it.all.length, multi.markets.length); assert.ok(sortedDesc(it.all));
  assert.deepEqual(it.outcomes, it.all.slice(0, 3));
  for (const m of multi.markets) {
    const o = it.all.find(x => x.name === m.groupItemTitle);
    assert.ok(o, "missing " + m.groupItemTitle); assert.ok(near(o.p, Number(JSON.parse(m.outcomePrices)[0])));
    assert.equal(o.tok, JSON.parse(m.clobTokenIds)[0]);
  }
  assert.equal(it.topic, "Macro"); assert.equal(it.skip, false);
});
test("normPM: closed markets are left out, all closed gives null", () => {
  const e = structuredClone(multi); e.markets[0].closed = true;
  assert.equal(normPM(e).all.length, multi.markets.length - 1);
  for (const m of e.markets) m.closed = true;
  assert.equal(normPM(e), null);
});
test("normPM: sports and crypto events are skipped", () => {
  assert.equal(normPM(sport).skip, true); assert.equal(normPM(crypto).skip, true); assert.equal(normPM(esports).skip, true);
});
test("normPM: a sports tag slug alone is enough (T-007), even when no keyword matches", () => {
  const e = structuredClone(esports); e.title = "PGL Major Singapore 2026: Winner";
  e.tags = e.tags.map(t => ({ ...t, label: "Pro gaming" }));
  assert.ok(e.tags.some(t => t.slug === "esports"));
  assert.equal(normPM(e).skip, true);
  e.tags = [{ label: "Pro gaming", slug: "pro-gaming" }];
  assert.equal(normPM(e).skip, false);
});

test("normPM: routine repeats are flagged by series recurrence or title words (T-028)", () => {
  assert.equal(normPM(single).routine, false);
  assert.equal(normPM(multi).routine, true, "the Fed event is a monthly series");
  const e = structuredClone(single); e.series = []; e.title = "Elon Musk # tweets November 14 - November 16, 2026?";
  assert.equal(normPM(e).routine, true);
});

/* ---------- Kalshi ---------- */
test("normKA: hot-list event uses cash volume, mid prices and last minus previous for 24h change", () => {
  const e = ka.hot_list_event, it = normKA(e);
  assert.equal(it.id, "ka:" + e.event_ticker); assert.equal(it.series, e.series_ticker);
  assert.equal(it.vol24, e.usd24_total); assert.equal(it.vol24unit, "usd"); assert.equal(it.liq, e.oi_total);
  assert.equal(it.url, "https://kalshi.com/events/" + e.event_ticker.toLowerCase());
  assert.ok(sortedDesc(it.all)); assert.equal(it.all.length, e.markets.length);
  for (const m of e.markets) {
    const o = it.all.find(x => x.tk === m.ticker), b = +m.yes_bid_dollars, a = +m.yes_ask_dollars;
    if (a > 0 && a - b <= 0.1) assert.ok(near(o.p, (a + b) / 2), m.ticker + " should be the middle of bid and ask");
    assert.ok(near(o.d1, +m.last_price_dollars - +m.previous_price_dollars));
  }
  assert.equal(it.skip, false);
});
test("normKA: relay event without totals counts contracts", () => {
  const e = ka.relay_event, it = normKA(e);
  assert.equal(it.vol24unit, "contracts");
  assert.ok(near(it.vol24, e.markets.reduce((s, m) => s + (parseFloat(m.volume_24h_fp) || 0), 0)));
  for (const m of e.markets) assert.equal(it.all.find(o => o.tk === m.ticker).name, m.yes_sub_title || m.subtitle || (e.markets.length === 1 ? "Yes" : m.title));
});
test("normKA: settled markets are dropped, none left gives null", () => {
  const e = structuredClone(ka.hot_list_event); e.markets[0].status = "settled";
  assert.equal(normKA(e).all.length, ka.hot_list_event.markets.length - 1);
  for (const m of e.markets) m.status = "settled";
  assert.equal(normKA(e), null);
});
test("normKA: Sports and Crypto categories are skipped", () => {
  assert.equal(normKA(ka.sports_event).skip, true); assert.equal(normKA(ka.crypto_event).skip, true);
});
test("normKA: routine flag from series frequency (T-028)", () => {
  const e = structuredClone(ka.relay_event);
  assert.equal(normKA(e).routine, false); e.frequency = "daily"; assert.equal(normKA(e).routine, true);
});
test("normKA: wide spread uses the last trade instead of the middle", () => {
  const e = structuredClone(ka.relay_event); const m = e.markets[0];
  Object.assign(m, { yes_bid_dollars: "0.2000", yes_ask_dollars: "0.6000", last_price_dollars: "0.3300" });
  assert.ok(near(normKA(e).all.find(o => o.tk === m.ticker).p, 0.33));
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
