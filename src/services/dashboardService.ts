import { supabase }                                    from '../lib/supabase'
import { fetchLivePrices, getLTP, fetchFxRates }       from './priceService'
import { toForeignYahooSymbol, getForeignLtpGbp, getForeignAvgGbp } from '../lib/foreignPriceHelpers'
import type { DashboardStats } from '../types'

export async function loadDashboardStats(userId: string): Promise<DashboardStats> {
  const [
    cashRes, fdRes, efRes, bondsRes, amcMfRes,
    zerodhaRes, aionionRes, aionionGoldRes, mfRes, goldRes,
    foreignRes, cryptoRes, bankSavRes,
    fdActualRes, efActualRes, zaiRes, aaiRes, agaiRes, mfaiRes, gaiRes,
  ] = await Promise.all([
    supabase.from('cash_assets').select('invested, current_value').eq('user_id', userId),
    supabase.from('bank_fd_assets').select('invested').eq('user_id', userId),
    supabase.from('emergency_funds').select('invested').eq('user_id', userId),
    supabase.from('bonds').select('invested, face_value').eq('user_id', userId),
    supabase.from('amc_mf_holdings').select('qty, avg_cost').eq('user_id', userId),
    supabase.from('zerodha_stocks').select('qty, avg_cost, instrument').eq('user_id', userId),
    supabase.from('aionion_stocks').select('qty, avg_cost, instrument').eq('user_id', userId),
    supabase.from('aionion_gold').select('qty, avg_cost, instrument').eq('user_id', userId),
    supabase.from('mf_holdings').select('qty, avg_cost').eq('user_id', userId),
    supabase.from('gold_holdings').select('qty, avg_cost').eq('user_id', userId),
    supabase.from('foreign_stock_holdings').select('qty, avg_price, symbol, currency').eq('user_id', userId),
    supabase.from('crypto_holdings').select('qty, avg_price_gbp, yahoo_symbol').eq('user_id', userId),
    supabase.from('bank_savings').select('amount_gbp').eq('user_id', userId),
    supabase.from('fd_actual_invested').select('amount').eq('user_id', userId),
    supabase.from('ef_actual_invested').select('amount').eq('user_id', userId),
    supabase.from('zerodha_actual_invested').select('amount').eq('user_id', userId),
    supabase.from('aionion_actual_invested').select('amount').eq('user_id', userId),
    supabase.from('aionion_gold_actual_invested').select('amount').eq('user_id', userId),
    supabase.from('mf_actual_invested').select('amount').eq('user_id', userId),
    supabase.from('gold_actual_invested').select('amount').eq('user_id', userId),
  ])

  // FX rates
  const fx       = await fetchFxRates()
  const gbpInr   = fx.gbpInr
  const gbpUsd   = fx.gbpUsd

  const sum = (data: { amount: string | number }[] | null) =>
    (data ?? []).reduce((s, r) => s + (+r.amount || 0), 0)

  // ── Per-category invested / value ─────────────────────────
  // Cash
  const cashInv = (cashRes.data ?? []).reduce((s, r) => s + (+r.invested || 0), 0)
  const cashVal = (cashRes.data ?? []).reduce((s, r) => s + (+r.current_value || 0), 0)

  // FD
  const fdInv = (fdRes.data ?? []).reduce((s, r) => s + (+r.invested || 0), 0)
  // EF
  const efInv = (efRes.data ?? []).reduce((s, r) => s + (+r.invested || 0), 0)
  // Bonds
  const bondsInv = (bondsRes.data ?? []).reduce((s, r) => s + (+r.invested || 0), 0)
  const bondsVal = (bondsRes.data ?? []).reduce((s, r) => s + (+r.face_value || +r.invested || 0), 0)
  // AMC MF
  const amcMfInv = (amcMfRes.data ?? []).reduce((s, r) => s + (+r.qty || 0) * (+r.avg_cost || 0), 0)
  // MF (zerodha)
  const mfInv = (mfRes.data ?? []).reduce((s, r) => s + (+r.qty || 0) * (+r.avg_cost || 0), 0)
  // Gold (zerodha)
  const goldInvZ = (goldRes.data ?? []).reduce((s, r) => s + (+r.qty || 0) * (+r.avg_cost || 0), 0)

  // Zerodha stocks — live prices
  const zerodhaAssets = zerodhaRes.data ?? []
  const zPrices = await fetchLivePrices(zerodhaAssets.map(r => `${r.instrument}.NS`))
  let zerodhaStocksInv = 0, zerodhaStocksVal = 0
  zerodhaAssets.forEach(r => {
    const qty = +r.qty || 0
    const ltp = getLTP(zPrices, `${r.instrument}.NS`) ?? getLTP(zPrices, r.instrument) ?? +r.avg_cost
    zerodhaStocksInv += qty * (+r.avg_cost || 0)
    zerodhaStocksVal += qty * ltp
  })

  // Aionion stocks — live prices
  const aionionAssets = aionionRes.data ?? []
  const aPrices = await fetchLivePrices(aionionAssets.map(r => `${r.instrument}.NS`))
  let aionionStocksInv = 0, aionionStocksVal = 0
  aionionAssets.forEach(r => {
    const qty = +r.qty || 0
    const ltp = getLTP(aPrices, `${r.instrument}.NS`) ?? getLTP(aPrices, r.instrument) ?? +r.avg_cost
    aionionStocksInv += qty * (+r.avg_cost || 0)
    aionionStocksVal += qty * ltp
  })

  // Aionion gold — live
  const agAssets = aionionGoldRes.data ?? []
  const agPrices = await fetchLivePrices(agAssets.map(r => r.instrument))
  let aionionGoldInv = 0, aionionGoldVal = 0
  agAssets.forEach(r => {
    const qty = +r.qty || 0
    const ltp = getLTP(agPrices, r.instrument) ?? +r.avg_cost
    aionionGoldInv += qty * (+r.avg_cost || 0)
    aionionGoldVal += qty * ltp
  })

  // Foreign stocks — live via Yahoo
  const foreignRows = (foreignRes.data ?? []) as { qty: number; avg_price: number; symbol: string; currency: string }[]
  const foreignYahooSyms = [...new Set(foreignRows.map(r => toForeignYahooSymbol(r.symbol, r.currency)))]
  const fPrices = await fetchLivePrices(foreignYahooSyms)
  let foreignInv = 0, foreignVal = 0
  foreignRows.forEach(r => {
    const avgGbp = getForeignAvgGbp(r, gbpUsd)
    const ltpGbp = getForeignLtpGbp(r, fPrices, gbpUsd)
    foreignInv += (+r.qty || 0) * avgGbp * gbpInr
    foreignVal += (+r.qty || 0) * (ltpGbp ?? avgGbp) * gbpInr
  })

  // Crypto — live
  const cryptoRows = (cryptoRes.data ?? []) as { qty: number; avg_price_gbp: number; yahoo_symbol: string }[]
  const cryptoSyms = [...new Set(cryptoRows.map(r => r.yahoo_symbol))]
  const cPrices = await fetchLivePrices(cryptoSyms)
  let cryptoInv = 0, cryptoVal = 0
  cryptoRows.forEach(r => {
    const key = r.yahoo_symbol.replace(/-(GBP|USD|EUR|USDT)$/i, '')
    const ltp = cPrices[key]?.price ?? null
    cryptoInv += (+r.qty || 0) * (+r.avg_price_gbp || 0) * gbpInr
    cryptoVal += (+r.qty || 0) * (ltp ?? +r.avg_price_gbp) * gbpInr
  })

  // Bank savings (no live price)
  const bankInv = (bankSavRes.data ?? []).reduce((s, r) => s + (+r.amount_gbp || 0) * gbpInr, 0)

  // ── Combine into categories ────────────────────────────────
  const stocksInv = zerodhaStocksInv + aionionStocksInv
  const stocksVal = zerodhaStocksVal + aionionStocksVal
  const mfTotalInv = mfInv + amcMfInv
  const mfTotalVal = mfTotalInv  // no live NAV
  const goldTotalInv = goldInvZ + aionionGoldInv
  const goldTotalVal = goldInvZ + aionionGoldVal  // zerodha gold uses avg_cost

  const totalInvested =
    cashInv + fdInv + efInv + bondsInv +
    stocksInv + mfTotalInv + goldTotalInv +
    foreignInv + cryptoInv + bankInv

  const totalValue =
    cashVal + fdInv + efInv + bondsVal +
    stocksVal + mfTotalVal + goldTotalVal +
    foreignVal + cryptoVal + bankInv

  const assetCount =
    (cashRes.data ?? []).length + (fdRes.data ?? []).length + (efRes.data ?? []).length +
    (bondsRes.data ?? []).length + zerodhaAssets.length + aionionAssets.length +
    agAssets.length + (mfRes.data ?? []).length + (amcMfRes.data ?? []).length +
    (goldRes.data ?? []).length + foreignRows.length + cryptoRows.length +
    (bankSavRes.data ?? []).length

  // Actual invested
  const actualInvested =
    sum(fdActualRes.data) + sum(efActualRes.data) + sum(zaiRes.data) +
    sum(aaiRes.data) + sum(agaiRes.data) + sum(mfaiRes.data) + sum(gaiRes.data)

  const entryLabel = [
    (fdActualRes.data ?? []).length && `${(fdActualRes.data ?? []).length} FD`,
    (zaiRes.data ?? []).length && `${(zaiRes.data ?? []).length} Zerodha`,
    (aaiRes.data ?? []).length && `${(aaiRes.data ?? []).length} Aionion`,
    (mfaiRes.data ?? []).length && `${(mfaiRes.data ?? []).length} MF`,
    (gaiRes.data ?? []).length && `${(gaiRes.data ?? []).length} Gold`,
  ].filter(Boolean).join(' · ') || '—'

  // ── Category breakdown ─────────────────────────────────────
  const categories: DashboardStats['categories'] = [
    { label: 'Stocks',        inv: stocksInv,   val: stocksVal,    color: '#0F766E' },
    { label: 'Mutual Funds',  inv: mfTotalInv,  val: mfTotalVal,   color: '#0D9488' },
    { label: 'Gold',          inv: goldTotalInv,val: goldTotalVal,  color: '#B45309' },
    { label: 'Fixed Deposits',inv: fdInv,       val: fdInv,         color: '#1D4ED8' },
    { label: 'Foreign',       inv: foreignInv,  val: foreignVal,    color: '#7C3AED' },
    { label: 'Crypto',        inv: cryptoInv,   val: cryptoVal,     color: '#EA580C' },
    { label: 'Cash & Bank',   inv: cashInv + bankInv, val: cashVal + bankInv, color: '#64748B' },
    { label: 'Emergency Fund',inv: efInv,       val: efInv,         color: '#0891B2' },
    { label: 'Bonds',         inv: bondsInv,    val: bondsVal,      color: '#4F46E5' },
  ].filter(c => c.inv > 0 || c.val > 0)

  return {
    totalValue, totalInvested, actualInvested, assetCount, entryLabel,
    categories, gbpInr,
  }
}
