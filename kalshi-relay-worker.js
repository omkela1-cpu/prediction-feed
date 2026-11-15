// Optional: only needed if Kalshi blocks requests from your phone's browser (CORS).
// Deploy on Cloudflare Workers (free): dash.cloudflare.com > Workers > Create > paste this > Deploy.
// Then paste the worker URL into the app's Settings > "Kalshi relay URL".
// Read-only: it only forwards GET requests to Kalshi's public events endpoint.

const UPSTREAM = "https://api.elections.kalshi.com/trade-api/v2/events";

export default {
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "GET") return new Response("GET only", { status: 405, headers: cors });

    const url = new URL(request.url);
    const upstream = UPSTREAM + url.pathname.replace(/\/+$/, "") + url.search;
    const r = await fetch(upstream, { headers: { Accept: "application/json" }, cf: { cacheTtl: 15 } });
    return new Response(r.body, {
      status: r.status,
      headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=15" },
    });
  },
};
