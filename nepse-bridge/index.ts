// nepse-bridge/index.ts
import {
  liveMarketData,
  getMarket_depth,
  getNepseIndexIntraday,
  getIndexPriceVolumeHistory,
  getNepseIndex,
  getSummary,
  get_market_status,
  shutdownWorkerPool,
} from "nepse-api-unofficial";

const PORT = 3000;

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // 1. Route: GET /live-market (Fetches pure live market data)
    if (url.pathname === "/live-market") {
      try {
        const data = await liveMarketData();
        if (!data) {
          return new Response(
            JSON.stringify({
              error: "Failed to fetch live market data from NEPSE",
            }),
            {
              status: 502,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        return new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // 1b. Route: GET /nepse-index (Intraday NEPSE index time-series for today).
    //     Falls back to daily history when intraday is empty (e.g. market closed).
    if (url.pathname === "/nepse-index") {
      try {
        const intraday = await getNepseIndexIntraday();
        if (intraday && Array.isArray(intraday) && intraday.length > 0) {
          return new Response(
            JSON.stringify({ granularity: "intraday", data: intraday }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        // Fallback: recent daily history so the chart is never empty
        const history = await getIndexPriceVolumeHistory("NEPSE Index", 90);
        return new Response(
          JSON.stringify({ granularity: "daily", data: history ?? [] }),
          { headers: { "Content-Type": "application/json" } },
        );
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // 1c. Route: GET /market-summary (NEPSE headline: index point/change +
    //     whole-market turnover/volume + live open/closed status). Used by the
    //     top navbar ticker. Fetches the three sources concurrently.
    if (url.pathname === "/market-summary") {
      try {
        const [index, summary, marketStatus] = await Promise.all([
          getNepseIndex(),
          getSummary(),
          get_market_status(),
        ]);
        return new Response(
          JSON.stringify({ index, summary, marketStatus }),
          { headers: { "Content-Type": "application/json" } },
        );
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // 2. Route: GET /depth/:symbol (Fetches real-time market depth)
    if (url.pathname.startsWith("/depth/")) {
      const symbol = url.pathname.split("/")[2]?.toUpperCase();

      if (!symbol) {
        return new Response(JSON.stringify({ error: "Missing stock symbol" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      try {
        const depth = await getMarket_depth(symbol);
        if (!depth) {
          return new Response(
            JSON.stringify({
              error: `Market depth for symbol '${symbol}' is currently unavailable.`,
            }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        return new Response(JSON.stringify(depth), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
});

console.log(`NEPSE Bun bridge running on port ${PORT}`);

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down NEPSE worker pool gracefully...");
  await shutdownWorkerPool();
  process.exit(0);
});
