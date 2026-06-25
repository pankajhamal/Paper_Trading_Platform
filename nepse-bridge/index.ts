// nepse-bridge/index.ts
import {
  liveMarketData,
  getMarket_depth,
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
