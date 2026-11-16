// Om's interests. The hourly job (scripts/interests.mjs) keeps a market when its title matches an
// interest, enough money is at stake (FLOOR), it is not a routine repeat, and it is not settled.
// Edit this file to change what the app shows. Order matters: a market goes to the FIRST interest
// it matches. `max` is how many markets one interest may put in its section (default 2), so one
// story (say, six Anthropic IPO variants) cannot fill a section. `not` drops matches you don't want.
// Sections appear in the app in the order of SECTIONS.

export const FLOOR = 25000;        // minimum open interest in dollars (money at stake now)
export const SETTLED = 0.03;       // drop a market when no outcome is between 3% and 97%

export const SECTIONS = ["AI & Tech", "Power & Infrastructure", "Deals & Regulation", "Macro", "Geopolitics"];

// Repeating markets (daily, weekly, monthly prints, counts of tweets or words said) are dropped
// everywhere. The sites' own repeat flags are used too; this catches the rest by title.
export const ROUTINE = /\b(today|tonight|tomorrow|this week|next week|this month|weekly|daily|hourly|on (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{1,2}\b|# of|number of tweets|tweets?|posts?\b|mentions?|say during|said during|say in|rotten tomatoes|box office|views|\d{1,2}\/\d{1,2} ?- ?\d{1,2}\/\d{1,2})/i;

export const INTERESTS = [
  // AI & Tech
  { name: "AI policy",        section: "AI & Tech", re: /(\bai\b|artificial intelligence|chatbot|deepfake).*\b(bill|act|law|regulat\w*|ban|copyright|safety|moratorium|preempt\w*|executive order|lawsuit|licen[cs]\w*)\b|\b(bill|act|law|regulat\w*|ban|copyright|safety|moratorium|preempt\w*|executive order|lawsuit)\b.*(\bai\b|artificial intelligence)|sandbox escape/i },
  { name: "AI labs",          section: "AI & Tech", re: /\b(anthropic|openai|xai|mistral|deepmind|perplexity|safe superintelligence|thinking machines)\b/i, not: /\b(ceo|affair|bankrupt\w*|sam altman out)\b/i, max: 3 },
  { name: "AI models",        section: "AI & Tech", re: /\b(agi|asi|best ai|top[- ]ranked ai|ai model|frontier model|coding model|gpt-?\d|claude|gemini \d|grok \d|llama \d)\b/i },
  { name: "Chips",            section: "AI & Tech", re: /\b(nvidia|tsmc|semiconductors?|chips?|export controls?|asml|amd|intel|blackwell|h20)\b/i, not: /\b(ceo|vp|affair|rejoins?|huang|earnings call|resign\w*|removal|fired)\b/i },
  { name: "IPOs",             section: "AI & Tech", re: /\b(ipo|go(es)? public|listing)\b/i },
  { name: "Cyber security",   section: "AI & Tech", re: /\b(cyber ?attacks?|cyber ?security|ransomware|data breach|hack(ed|ers?|ing)?)\b/i },
  // Power & Infrastructure
  { name: "Data centres",     section: "Power & Infrastructure", re: /\b(data cent(er|re)s?|hyperscal\w*|coreweave|nebius|stargate|ai capex|capex)\b/i, max: 3 },
  { name: "Power and grid",   section: "Power & Infrastructure", re: /\b(electricity|power (prices?|grid|demand|plants?|outage|shortage)|grid|ercot|pjm|blackouts?|peak demand|utilit(y|ies)|transformers?)\b/i, not: /\b(average residential|residential electricity price)\b/i },
  { name: "Nuclear power",    section: "Power & Infrastructure", re: /\b(nuclear (reactors?|power|plants?|energy|licen[cs]\w*)|reactors?|small modular|smr|fusion|uranium)\b/i, not: /\b(iran|russia|north korea|weapons?|test|enriched)\b/i },
  { name: "Energy",           section: "Power & Infrastructure", re: /\b(opec|lng|oil (production|output|embargo|exports?|sanctions|supply)|energy (bill|policy|emergency|prices?)|strategic petroleum|natural gas)\b/i },
  { name: "Metals and cables",section: "Power & Infrastructure", re: /\b(copper|alumin(i)?um|steel|rare earths?|lithium|critical minerals?|cables?|fib(re|er) optic)\b/i },
  // Deals & Regulation
  { name: "M&A and antitrust",section: "Deals & Regulation", re: /\b(merger|merge|acquir\w*|acquisition|takeover|buyout|antitrust|ftc|doj sues|monopoly|break ?up|deal (closes?|completes?|approved|blocked))\b/i, not: /\b(greenland|panama|canada|territory|island)\b/i, max: 3 },
  { name: "Tariffs and trade",section: "Deals & Regulation", re: /\b(tariffs?|section 232|trade (deal|war|agreement|talks)|de minimis|import (ban|duties)|export ban)\b/i, max: 3 },
  { name: "Laws and rules",   section: "Deals & Regulation", re: /\b(signed into law|becomes? law|bill passes|act\b|regulat\w*|supreme court (rules?|strikes)|executive order|sec (approves?|sues|charges))\b/i, not: /\b(insurrection|onion)\b/i, max: 3 },
  // Macro
  { name: "Fed",              section: "Macro", re: /\b(fed|fomc|federal reserve|rate (cuts?|hikes?)|interest rates?|powell|fed chair)\b/i, not: /\b(kimberly|nvidia)\b/i, max: 1 },
  { name: "Inflation",        section: "Macro", re: /\b(inflation|cpi|pce)\b/i, not: /minimum wage/i, max: 1 },
  { name: "Growth and jobs",  section: "Macro", re: /\b(recession|gdp|unemployment|jobs|layoffs|depression)\b/i },
  { name: "UK and Europe",    section: "Macro", re: /\b(bank of england|boe|uk (economy|budget|inflation|recession|gilts?)|gilts?|reeves|ecb|lagarde|eurozone|euro area)\b/i },
  { name: "Debt and dollar",  section: "Macro", re: /\b(treasur(y|ies)|10[- ]?y(ear)? (treasury|yield)|bond yields?|debt ceiling|default|dollar|credit rating|downgrade)\b/i },
  // Geopolitics
  { name: "Middle East",      section: "Geopolitics", re: /\b(iran|israel|gaza|hezbollah|houthis?|hormuz|saudi|lebanon|syria)\b/i },
  { name: "Russia and Ukraine", section: "Geopolitics", re: /\b(russia|ukraine|putin|zelensky|crimea|donbas|kremlin)\b/i },
  { name: "China and Taiwan", section: "Geopolitics", re: /\b(china|chinese|taiwan|xi jinping|beijing)\b/i },
  { name: "NATO and defence", section: "Geopolitics", re: /\b(nato|defen[cs]e (spending|budget)|military spending|article 5|rearm\w*)\b/i },
];

// Crypto and sports are excluded everywhere (same idea as SKIP in index.html).
export const SKIP = /\b(bitcoin|btc|ethereum|eth|solana|xrp|crypto|stablecoins?|coinbase|kraken|dogecoin|memecoin|nba|nfl|mlb|nhl|ncaa|ufc|mma|wnba|premier league|la liga|serie a|bundesliga|champions league|europa league|world cup|super bowl|stanley cup|world series|nascar|formula 1|f1|tennis|atp|wta|esports|cricket|golf|boxing|vs\.?|sports|soccer|football|basketball|baseball|hockey)\b/i;
