export interface PriceEntry { price: number; name: string | null }
export type PriceMap = Record<string, PriceEntry>

/** Fetch prices from Cloudflare Pages Function (/api/prices) */
export async function fetchLivePrices(symbols: string[]): Promise<PriceMap> {
  if (!symbols.length) return {}
  try {
    const res = await fetch(`/api/prices?symbols=${encodeURIComponent(symbols.join(','))}`)
    if (!res.ok) return {}
    return await res.json() as PriceMap
  } catch {
    return {}
  }
}

/** NSE stocks: append .NS suffix */
export async function fetchNsePrices(instruments: string[]): Promise<PriceMap> {
  return fetchLivePrices(instruments.map(i => `${i}.NS`))
}

/** Arbitrary yahoo symbols (already fully qualified, e.g. GOLDBEES.NS, BTC-GBP) */
export async function fetchYahooPrices(yahooSymbols: string[]): Promise<PriceMap> {
  return fetchLivePrices(yahooSymbols)
}

export const getLTP = (map: PriceMap, key: string): number | null =>
  map[key]?.price ?? null

export const getName = (map: PriceMap, key: string): string | null =>
  map[key]?.name ?? null

/** FX helpers — fetch GBPUSD=X and USDINR=X from same endpoint */
export interface FxRates { gbpUsd: number; usdInr: number; gbpInr: number }

export async function fetchFxRates(): Promise<FxRates> {
  const map = await fetchLivePrices(['GBPUSD=X', 'USDINR=X'])
  const gbpUsd = map['GBPUSD=X']?.price ?? 1.27
  const usdInr = map['USDINR=X']?.price ?? 83.5
  return { gbpUsd, usdInr, gbpInr: gbpUsd * usdInr }
}
