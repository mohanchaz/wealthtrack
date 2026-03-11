/**
 * Shared helpers for foreign stock price resolution.
 * Used by both ForeignStocksPage and ForeignOverviewPage.
 */
import type { ForeignHolding } from '../types/assets'

// ── Yahoo symbol overrides ────────────────────────────────────
export const FOREIGN_YAHOO_MAP: Record<string, string> = {
  BRK:  'BRK-B',
  CNDX: 'CNDX.L',
  IGLN: 'IGLN.L',
  MKS:  'MKS.L',
  SPXS: 'SPXS.L',
}

/** Convert a stored symbol + currency into the Yahoo Finance ticker to fetch. */
export function toForeignYahooSymbol(symbol: string, currency: string): string {
  if (FOREIGN_YAHOO_MAP[symbol]) return FOREIGN_YAHOO_MAP[symbol]
  if (currency === 'GBP' || currency === 'GBX') return `${symbol}.L`
  return symbol
}

/** Strip Yahoo suffix to get the price-map key (API returns bare keys). */
export function foreignPriceKey(yahooSymbol: string): string {
  return yahooSymbol.replace(/\.(L|US)$/, '')
}

type PriceMap = Record<string, { price: number; name?: string | null; currency?: string | null } | undefined>

/** Get the raw price map entry for a holding. */
export function getForeignPriceEntry(
  r: Pick<ForeignHolding, 'symbol' | 'currency'>,
  priceMap: PriceMap,
) {
  const ySym = toForeignYahooSymbol(r.symbol, r.currency)
  const key  = foreignPriceKey(ySym)
  return priceMap[key] ?? priceMap[ySym] ?? null
}

/** True if Yahoo is reporting this price in pence (GBp currency marker). */
export function isForeignGbxLive(
  r: Pick<ForeignHolding, 'symbol' | 'currency'>,
  priceMap: PriceMap,
): boolean {
  if (r.currency === 'GBX') return true
  const entry = getForeignPriceEntry(r, priceMap)
  return entry?.currency === 'GBp'
}

/** Live price in GBP (never pence, never USD). Returns null if no live price. */
export function getForeignLtpGbp(
  r: Pick<ForeignHolding, 'symbol' | 'currency'>,
  priceMap: PriceMap,
  gbpUsd: number,
): number | null {
  const entry = getForeignPriceEntry(r, priceMap)
  if (!entry) return null
  if (isForeignGbxLive(r, priceMap)) return entry.price / 100   // pence → GBP
  if (r.currency === 'USD')          return entry.price / gbpUsd // USD   → GBP
  return entry.price                                              // already GBP
}

/** Avg cost in GBP (normalises GBX pence and USD). */
export function getForeignAvgGbp(
  r: Pick<ForeignHolding, 'avg_price' | 'currency'>,
  gbpUsd: number,
): number {
  if (r.currency === 'GBX') return r.avg_price / 100
  if (r.currency === 'USD') return r.avg_price / gbpUsd
  return r.avg_price
}
