# Plan

Last updated: 2026-11-15 by Claude, from Om's answers. This is the master plan. `BACKLOG.md` holds the same work as individual tasks.

## Goal
A read-only phone app showing the hottest prediction markets on Polymarket and Kalshi, sorted into buckets, with pins, search, price charts you can scrub with a finger, and side-by-side prices where both sites list the same event. No trading, ever.

## What Om decided (2026-11-15)
- **Buckets:** Macro (Fed, rates, economy) / Politics & Geopolitics / Tech & AI / Companies, Energy & Commodities / Other. Crypto and sports excluded.
- **"Hottest" means:** top 20 by 24h volume, plus a separate Movers section (biggest 24h price change).
- **Approved features:** cross-site price gaps, price history charts (full scrubbable chart like the official apps), search with custom watchlist, pins synced across devices.
- **Kalshi:** Om will create a free Cloudflare account for the relay.

## What we know (tested 2026-11-15)
| Fact | Evidence |
|------|----------|
| Polymarket event data works from browsers | 200 with `access-control-allow-origin: *` |
| Polymarket price history works from browsers | `clob.polymarket.com/prices-history?market=<tokenId>&interval=1w&fidelity=60` returned points, CORS `*`. Token IDs come from each market's `clobTokenIds`. |
| Polymarket gives weekly and monthly price change per market | Fields `oneWeekPriceChange`, `oneMonthPriceChange`. `oneDayPriceChange` was empty on the market checked, so 24h change may need computing from history. |
| Kalshi data works server to server | 200, fields `yes_bid_dollars`, `yes_ask_dollars`, `last_price_dollars`, `previous_price_dollars`, `volume_24h_fp`, `open_interest_fp`. These match `normKA`. |
| Kalshi very likely blocks browsers | Same request with a browser `Origin` header returned 403. So the relay is needed. Not yet confirmed on a real phone. |
| Kalshi events are not sorted by volume | The relay must page through open events and rank them itself. |

Not yet verified: Kalshi price history (candlesticks) endpoint, search endpoints on either site, the pin buttons in a real browser.

## Architecture
- **App:** static `index.html` on GitHub Pages. Unchanged principle: no build step.
- **One small Cloudflare Worker (free tier)** doing three read-only jobs:
  1. Kalshi relay: top events by volume (cached about 60s), single event lookup, price history, search.
  2. Pin sync: stores a pin list under a random sync code (Workers KV).
  3. Nothing else. No trading endpoints, no Kalshi or Polymarket keys.
- **Do we need a native iOS app?** No. A scrubbable chart works well in a web app (touch events on a canvas). Stay on the web app. Revisit only if push notifications or widgets are wanted later.

## Phases
Each phase ends with something Om can open on his phone.

### Phase 0: Go live (Om, 2 minutes)
Switch on GitHub Pages. Open the app on the phone, add to home screen.
**Done when:** the Polymarket feed loads on the phone and a pin survives closing the app.

### Phase 1: Kalshi through the relay
Upgrade the Worker (ranked top events with caching, single event lookup, only accepts requests from the app's address). Om creates the Cloudflare account and pastes the Worker in. The Worker URL becomes the app's default.
**Done when:** Kalshi cards show on the phone with prices that match kalshi.com for 3 spot-checked markets.

### Phase 2: Feed quality
New buckets as decided. Exclude crypto and sports using each site's own tags and categories, not only keywords. Movers section. Price change since last refresh. Home screen icon. Make Kalshi and Polymarket volume comparable (Kalshi counts contracts, Polymarket counts dollars).
**Done when:** top 20 has no crypto or sports for 3 days running, and Movers matches what the sites show.

### Phase 3: Market detail and scrubbable chart
Tap a card to open a detail screen: all outcomes, and a price chart you drag a finger across to read price and time. Ranges 1D / 1W / 1M / All. Polymarket first (endpoint verified), then Kalshi through the relay (endpoint to verify). Small sparkline on each card.
**Done when:** scrubbing is smooth on the phone and chart values match the official site for 3 markets per source.

### Phase 4: Search and watchlist
Search any market on either site and pin it, even outside the top 20. Verify the search endpoints first.
**Done when:** a market outside the top 20 can be found, pinned, and stays updated.

### Phase 5: Cross-site price gaps
Show Kalshi and Polymarket prices side by side for the same event, with the gap in points. Matching is the hard part: start with pairs confirmed by Om (the app suggests likely matches, Om approves), then add automatic matching only for high-confidence cases.
**Warning shown in the app:** the two sites can have different resolution rules, so a gap is not automatically free money.
**Done when:** at least 10 confirmed pairs show both prices and the gap.

### Phase 6: Pin sync
Pins and confirmed pairs sync between phone and laptop using a random sync code typed once per device.
**Done when:** a pin added on one device appears on the other within a minute.

### Phase 7: Hardening
Automated tests on saved sample data, lower mobile data use, clear error messages.

## Roles
- **Om:** owns priorities. Moves tasks to `TODO`. Does the account steps (GitHub Pages, Cloudflare). Checks each phase on his phone.
- **Building agent (Grok or Claude):** takes `TODO` tasks in order, one per commit, follows `AGENTS.md`.
- **Reviewing agent (the other one):** reads the activity log and the diff, re-runs the tests, and reports anything claimed but not proven.

## Risks
| Risk | Plan |
|------|------|
| Kalshi changes or limits its public API | Relay caches results; app keeps working on Polymarket alone. |
| Free Worker limits (100,000 requests a day) | Cache for 60s. One user is far below the limit. |
| Wrong cross-site matches | Human-confirmed pairs first. |
| Sync code leaks | It only exposes a list of pinned markets. No personal data stored. |
| An agent claims untested work is done | Rule in `AGENTS.md`: mark `BUILT` unless seen working; reviewer checks. |

## Needed from Om
1. Switch on GitHub Pages (Phase 0).
2. Create a free Cloudflare account, when Phase 1 reaches that step.
3. Phone checks at the end of each phase.
