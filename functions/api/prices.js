/**
 * Cloudflare Pages Function: /api/prices
 * Fetches live NSE stock prices from Yahoo Finance server-side (no CORS issues).
 * Query param: ?symbols=RELIANCE.NS,TCS.NS,WIPRO.NS
 * Returns: { RELIANCE: 1358.5, TCS: 2613.2, ... }
 */
export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const symbols = (url.searchParams.get('symbols') || '').split(',').filter(Boolean);

    if (!symbols.length) {
        return json({ error: 'No symbols provided' }, 400);
    }

    // Fetch each symbol from Yahoo Finance v8/chart in parallel (auth-free endpoint)
    const settled = await Promise.allSettled(
        symbols.map(async sym => {
            const yfUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=1d&interval=1d`;
            const res = await fetch(yfUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WealthTrack/1.0)' }
            });
            if (!res.ok) throw new Error(`${sym}: HTTP ${res.status}`);
            const data = await res.json();
            const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
            if (!price) throw new Error(`${sym}: no price`);
            return { sym: sym.replace(/\.(NS|BO)$/, ''), price };
        })
    );

    const priceMap = {};
    settled.forEach(r => {
        if (r.status === 'fulfilled') priceMap[r.value.sym] = r.value.price;
        else console.error('[prices fn]', r.reason?.message ?? r.reason);
    });

    return json(priceMap);
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=30', // cache for 30 s
        },
    });
}
