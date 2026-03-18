/**
 * Cloudflare Pages Function: /api/trading212
 * Proxies Trading212 portfolio API to avoid CORS.
 *
 * POST /api/trading212
 * Headers: { X-Trading212-Key: <api-key> }
 * Returns: { holdings: [{ symbol, quantity, avg_price, currency }], count }
 *
 * Symbol cleaning mirrors the PowerShell script exactly.
 * Currency detection:
 *   - Ticker ending in lowercase letter + _EQ  (e.g. ABCl_EQ) → GBX (London)
 *   - Ticker ending in _US_EQ                                  → USD
 *   - Everything else                                          → USD
 */
export async function onRequestPost(context) {
  const apiKey = context.request.headers.get('X-Trading212-Key')
  if (!apiKey) return json({ error: 'Missing X-Trading212-Key header' }, 400)

  let response
  try {
    response = await fetch('https://live.trading212.com/api/v0/equity/portfolio', {
      headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return json({ error: `Network error: ${err.message}` }, 502)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    return json({ error: `Trading212 API error ${response.status}: ${body || response.statusText}` }, response.status)
  }

  let data
  try { data = await response.json() }
  catch { return json({ error: 'Invalid JSON from Trading212' }, 502) }

  if (!Array.isArray(data)) return json({ error: 'Unexpected response format from Trading212' }, 502)

  const holdings = data
    .map(item => {
      const raw = (item.ticker ?? '').trim()

      // Currency detection — before any cleaning
      let currency = 'USD'
      if (/[a-z]_EQ$/.test(raw)) currency = 'GBX'  // London Stock Exchange (GBX pence)

      // Symbol cleaning — same as PowerShell script
      const symbol = raw
        .replace(/l_EQ$/i,   '')
        .replace(/_US_EQ$/i, '')
        .replace(/_EQ$/i,    '')
        .replace('BRK_B',    'BRK-B')
        .trim()
        .toUpperCase()

      const quantity  = parseFloat(item.quantity      ?? 0)
      const avg_price = parseFloat(item.averagePrice  ?? 0)

      return { symbol, quantity, avg_price, currency }
    })
    .filter(h => h.symbol && h.quantity > 0)
    .sort((a, b) => a.symbol.localeCompare(b.symbol))

  return json({ holdings, count: holdings.length })
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Trading212-Key',
    },
  })
}
