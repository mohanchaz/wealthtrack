export interface PriceEntry { price: number; name: string | null }
export type PriceMap = Record<string, PriceEntry>

// Yahoo Symbol overrides for Foreign Stocks
export const YAHOO_SYMBOL_MAP: Record<string, string> = {
  BRK:  'BRK-B',
  CNDX: 'CNDX.L',
  IGLN: 'IGLN.L',
  MKS:  'MKS.L',
  SPXS: 'SPXS.L',
}

// GBX (pence) symbols — price is in pence, divide by 100 to get GBP
export const GBX_SYMBOLS = new Set(['MKS'])

export function isLondonSymbol(sym: string): boolean {
  return GBX_SYMBOLS.has(sym.toUpperCase().replace(/\.L$/i, ''))
}

/** Fetch NSE prices — appends .NS to each bare instrument symbol */
export async function fetchLivePrices(instruments: string[]): Promise<PriceMap | null> {
  if (!instruments.length) return null
  const symbols = instruments.map(i => `${i}.NS`)
  return _fetchRaw(symbols)
}

/** Fetch prices for symbols that already carry exchange suffixes */
export async function fetchLivePricesRaw(symbols: string[]): Promise<PriceMap | null> {
  if (!symbols.length) return null
  return _fetchRaw(symbols)
}

async function _fetchRaw(symbols: string[]): Promise<PriceMap | null> {
  try {
    const res = await fetch(`/api/prices?symbols=${encodeURIComponent(symbols.join(','))}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const map = await res.json() as Record<string, number | PriceEntry>
    if ((map as { error?: string }).error) throw new Error((map as { error: string }).error)
    // normalise: support both plain numbers and {price,name} objects
    const normalised: PriceMap = {}
    for (const [k, v] of Object.entries(map)) {
      if (typeof v === 'number') normalised[k] = { price: v, name: null }
      else if (v && typeof v === 'object') normalised[k] = { price: (v as PriceEntry).price, name: (v as PriceEntry).name }
    }
    return Object.keys(normalised).length > 0 ? normalised : null
  } catch (err) {
    console.warn('[priceService]', err)
    return null
  }
}

export const getLTP = (map: PriceMap | null, instrument: string): number | null =>
  map?.[instrument]?.price ?? null

export const getCompanyName = (map: PriceMap | null, instrument: string): string | null =>
  map?.[instrument]?.name ?? null
