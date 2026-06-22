import { get_security_detail, shutdownWorkerPool, liveMarketData } from 'nepse-api-unofficial';

const PORT = 3000;

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // Route: GET /live-market
    if (url.pathname === '/live-market') {
      try {
        const data = await liveMarketData();
        if (!data) {
          return new Response(JSON.stringify({ error: "Failed to fetch live market data from NEPSE" }), {
            status: 502,
            headers: { "Content-Type": "application/json" }
          });
        }
        return new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    
    // Route: GET /price/:symbol
    if (url.pathname.startsWith('/price/')) {
      const symbol = url.pathname.split('/')[2]?.toUpperCase();
      
      if (!symbol) {
        return new Response(JSON.stringify({ error: "Missing stock symbol" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      try {
        // Fetch detailed security info using the library
        const data = await get_security_detail(symbol);
        
        // The library returns null on failure instead of throwing exceptions
        if (!data) {
          return new Response(JSON.stringify({ error: `Symbol '${symbol}' not found or service failed.` }), {
            status: 404,
            headers: { "Content-Type": "application/json" }
          });
        }

        const ltp = data.securityDailyTradeDto?.lastTradedPrice;
        const name = data.security?.securityName;

        if (ltp === undefined) {
          return new Response(JSON.stringify({ error: "LTP data unavailable for this symbol." }), {
            status: 422,
            headers: { "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ symbol, ltp, name }), {
          headers: { "Content-Type": "application/json" }
        });

      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    return new Response(JSON.stringify({ error: "Not Found" }), { 
      status: 404, 
      headers: { "Content-Type": "application/json" } 
    });
  },
});

console.log(`NEPSE Bun bridge running on port ${PORT}`);

// Graceful shutdown to clean up Bun worker pools
process.on('SIGINT', async () => {
  console.log("Shutting down NEPSE worker pool gracefully...");
  await shutdownWorkerPool();
  process.exit(0);
});