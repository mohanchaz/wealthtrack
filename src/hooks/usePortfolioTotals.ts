/**
 * usePortfolioTotals — single source of truth for all portfolio numbers.
 *
 * Both DashboardPage and AssetsOverviewPage consume this.
 * React Query deduplicates the fetches — same query keys = one request in flight.
 */
import { useMemo, useState, useEffect } from 'react'
import { useAssets }        from './useAssets'
import { useActualInvested } from './useActualInvested'
import { useNsePrices, useYahooPrices, useFxRates } from './useLivePrices'
import { useAuthStore }     from '../store/authStore'
import { supabase }         from '../lib/supabase'
import { calcGain }         from '../lib/utils'
import {
  toForeignYahooSymbol,
  getForeignLtpGbp,
  getForeignAvgGbp,
} from '../lib/foreignPriceHelpers'
import type {
  StockHolding, MfHolding, GoldHolding,
  AionionGoldHolding, CashAsset, FdAsset, EfAsset, BondAsset,
  ForeignHolding, CryptoHolding, AmcMfHolding, BankSaving,
} from '../types/assets'

const AI_GOLD_LOOKUP: { match: RegExp; yahoo: string }[] = [
  { match: /goldbees/i,     yahoo: 'GOLDBEES.NS'   },
  { match: /nippon.*gold/i, yahoo: '0P0000XVDS.BO' },
  { match: /axis.*gold/i,   yahoo: 'AXISGOLD.NS'   },
  { match: /hdfc.*gold/i,   yahoo: 'HDFCGOLD.NS'   },
  { match: /icici.*gold/i,  yahoo: 'ICICIGOLD.NS'  },
  { match: /kotak.*gold/i,  yahoo: 'KOTAKGOLD.NS'  },
  { match: /sbi.*gold/i,    yahoo: 'SBIGOLD.NS'    },
  { match: /quantum.*gold/i,yahoo: '0P0000XV6Q.BO' },
]
export const resolveAiGoldYahoo = (instrument: string): string => {
  for (const e of AI_GOLD_LOOKUP) if (e.match.test(instrument)) return e.yahoo
  return ''
}

export interface CategoryTotal {
  label:  string
  inv:    number
  val:    number
  color:  string
  path:   string
}


export interface AllocationBucket {
  key:   string
  val:   number
  inv:   number
  color: string
}

export const ALLOC_COLORS: Record<string, string> = {
  'India Equity MF':     '#0891B2',  // vivid cyan-blue  (the one you liked)
  'India Equity Stocks': '#2563EB',  // vivid blue
  'Foreign Equity/ETF':  '#7C3AED',  // vivid violet
  'Gold':                '#F59E0B',  // vivid amber
  'Bonds':               '#EF4444',  // vivid red
  'Fixed Deposit':       '#06B6D4',  // vivid sky
  'Cash':                '#10B981',  // vivid emerald
  'UK Savings':          '#A855F7',  // vivid purple
  'Crypto':              '#F97316',  // vivid orange
}

export interface PortfolioTotals {
  // Raw holdings (passed through so overview page doesn't re-fetch)
  zStocks:   StockHolding[];   zMfs:   MfHolding[];    zGold:   GoldHolding[]
  aiStocks:  StockHolding[];   aiGold: AionionGoldHolding[]
  amcMf:     AmcMfHolding[];   cash:   CashAsset[];    fds:     FdAsset[]
  ef:        EfAsset[];        bonds:  BondAsset[];    foreign: ForeignHolding[]
  crypto:    CryptoHolding[];  bankSav:BankSaving[]

  // Price maps
  nsePrices:   Record<string, { price: number; name: string | null; currency: string | null }>
  yahooPrices: Record<string, { price: number; name: string | null; currency: string | null }>

  // FX
  gbpInr: number
  gbpUsd: number
  usdInr: number

  // Section invested / value
  zStocksInv: number; zStocksVal: number
  zMfInv:     number; zMfVal:     number
  zGoldInv:   number; zGoldVal:   number
  aiStocksInv:number; aiStocksVal:number
  aiGoldInv:  number; aiGoldVal:  number
  amcMfInv:   number; amcMfVal:   number
  cashInv:    number; cashVal:    number
  fdInv:      number; fdVal:      number
  efInv:      number; efVal:      number
  bondsInv:   number; bondsVal:   number
  foreignInv: number; foreignVal: number
  cryptoInv:  number; cryptoVal:  number
  bankInv:    number; bankVal:    number

  // Group totals
  zerodhaTotalInv: number; zerodhaTotalVal: number
  aionionTotalInv: number; aionionTotalVal: number

  // Grand totals
  totalInv:    number
  totalVal:    number
  totalActual: number
  totalGain:   number; totalGainPct:  number; totalPos:   boolean
  actualGain:  number; actualGainPct: number; actualPos:  boolean

  // Actual invested per section (null = no entries logged)
  actZStocksAmt:  number | null
  actZMfAmt:      number | null
  actZGoldAmt:    number | null
  actAiStocksAmt: number | null
  actAiGoldAmt:   number | null
  actAmcMfAmt:    number | null
  actFdAmt:       number | null
  actEfAmt:       number | null
  actBondsAmt:    number | null
  actForeignAmt:  number | null
  actCryptoAmt:   number | null
  actBankAmt:     number | null
  cashActual:     number
  bondsActual:    number

  // Categories for dashboard donut / breakdown
  categories:        CategoryTotal[]
  allocationBuckets: AllocationBucket[]

  // Loading flags
  anyLoading:  boolean
  nFetching:   boolean
  yFetching:   boolean
  assetCount:  number
}

export function usePortfolioTotals(): PortfolioTotals {
  const userId = useAuthStore(s => s.user?.id)

  // ── Holdings ─────────────────────────────────────────────────
  const { data: zStocks   = [], isLoading: l1  } = useAssets<StockHolding>('zerodha_stocks')
  const { data: zMfs      = [], isLoading: l2  } = useAssets<MfHolding>('mf_holdings')
  const { data: zGold     = [], isLoading: l3  } = useAssets<GoldHolding>('gold_holdings')
  const { data: aiStocks  = [], isLoading: l4  } = useAssets<StockHolding>('aionion_stocks')
  const { data: aiGold    = [], isLoading: l5  } = useAssets<AionionGoldHolding>('aionion_gold')
  const { data: amcMf     = [], isLoading: l6  } = useAssets<AmcMfHolding>('amc_mf_holdings')
  const { data: cash      = [], isLoading: l7  } = useAssets<CashAsset>('cash_assets')
  const { data: fds       = [], isLoading: l8  } = useAssets<FdAsset>('bank_fd_assets')
  const { data: ef        = [], isLoading: l9  } = useAssets<EfAsset>('emergency_funds')
  const { data: bonds     = [], isLoading: l10 } = useAssets<BondAsset>('bonds')
  const { data: foreign   = [], isLoading: l11 } = useAssets<ForeignHolding>('foreign_stock_holdings')
  const { data: crypto    = [], isLoading: l12 } = useAssets<CryptoHolding>('crypto_holdings')
  const { data: bankSav   = [], isLoading: l13 } = useAssets<BankSaving>('bank_savings')

  // ── Actual invested hooks ────────────────────────────────────
  const actZStocks  = useActualInvested('zerodha_actual_invested')
  const actZMf      = useActualInvested('mf_actual_invested')
  const actAiStocks = useActualInvested('aionion_actual_invested')
  const actAmcMf    = useActualInvested('amc_mf_actual_invested')
  const actFd       = useActualInvested('fd_actual_invested')
  const actEf       = useActualInvested('ef_actual_invested')
  const actBonds    = useActualInvested('bonds_actual_invested')

  const sumAct = (hook: ReturnType<typeof useActualInvested>) => {
    if (!hook.data) return null
    const t = hook.data.reduce((s, e) => s + e.amount, 0)
    return t > 0 ? t : null
  }

  // ── GBP-schema actual invested (custom tables) ───────────────
  const [actCryptoInr,  setActCryptoInr]  = useState(0)
  const [actForeignInr, setActForeignInr] = useState(0)
  const [actBankInr,    setActBankInr]    = useState(0)

  const { data: fx } = useFxRates()
  const usdInr = fx?.usdInr ?? 83.5
  const gbpInr = fx?.gbpInr ?? (fx?.gbpUsd ?? 1.27) * usdInr
  const gbpUsd = fx?.gbpUsd ?? (gbpInr / usdInr)

  useEffect(() => {
    if (!userId) return
    const toInr = (rows: { gbp_amount: number; inr_rate: number | null }[]) =>
      rows.reduce((s, e) => s + Number(e.gbp_amount) * Number(e.inr_rate ?? gbpInr), 0)

    supabase.from('crypto_actual_invested').select('gbp_amount,inr_rate').eq('user_id', userId)
      .then(({ data }) => setActCryptoInr(toInr((data ?? []) as never)))
    supabase.from('foreign_actual_invested').select('gbp_amount,inr_rate').eq('user_id', userId)
      .then(({ data }) => setActForeignInr(toInr((data ?? []) as never)))
    supabase.from('bank_savings_actual_invested').select('gbp_amount,inr_rate').eq('user_id', userId)
      .then(({ data }) => setActBankInr(toInr((data ?? []) as never)))
  }, [userId, gbpInr])

  // ── Live prices ──────────────────────────────────────────────
  const zInstruments  = useMemo(() => zStocks.map(r => r.instrument), [zStocks])
  const aiInstruments = useMemo(() => aiStocks.map(r => r.instrument), [aiStocks])
  const allNse        = useMemo(() => [...new Set([...zInstruments, ...aiInstruments])], [zInstruments, aiInstruments])
  const { data: nsePrices = {}, isFetching: nFetching } = useNsePrices(allNse)

  const mfSymbols     = useMemo(() => [...new Set([...zMfs.map(r => r.nav_symbol), ...amcMf.map(r => r.nav_symbol)].filter(Boolean) as string[])], [zMfs, amcMf])
  const goldSymbols   = useMemo(() => [...new Set(zGold.map(r => r.yahoo_symbol).filter(Boolean) as string[])], [zGold])
  const aiGoldSymbols = useMemo(() => [...new Set(aiGold.map(r => resolveAiGoldYahoo(r.instrument)).filter(Boolean))], [aiGold])
  const cryptoSyms    = useMemo(() => [...new Set(crypto.map(r => r.yahoo_symbol).filter(Boolean) as string[])], [crypto])
  const foreignSyms   = useMemo(() => [...new Set(foreign.map(r => toForeignYahooSymbol(r.symbol, r.currency)).filter(Boolean))], [foreign])
  const allYahoo      = useMemo(() => [...new Set([...mfSymbols, ...goldSymbols, ...aiGoldSymbols, ...cryptoSyms, ...foreignSyms])], [mfSymbols, goldSymbols, aiGoldSymbols, cryptoSyms, foreignSyms])
  const { data: yahooPrices = {}, isFetching: yFetching } = useYahooPrices(allYahoo)

  // ── Yahoo price helper ───────────────────────────────────────
  const yPrice = (sym: string | null | undefined) => {
    if (!sym) return null
    const k = sym.replace(/\.(BO|NS|L|US)$/, '').replace(/-(GBP|USD|EUR|USDT)$/i, '')
    return yahooPrices[k]?.price ?? yahooPrices[sym]?.price ?? null
  }

  // ── Section calcs ─────────────────────────────────────────────
  const zStocksInv = useMemo(() => zStocks.reduce((s, r) => s + Number(r.qty) * Number(r.avg_cost), 0), [zStocks])
  const zStocksVal = useMemo(() => zStocks.reduce((s, r) => {
    const p = nsePrices[r.instrument]?.price ?? null
    return s + (p != null ? Number(r.qty) * p : Number(r.qty) * Number(r.avg_cost))
  }, 0), [zStocks, nsePrices])

  const zMfInv = useMemo(() => zMfs.reduce((s, r) => s + Number(r.qty) * Number(r.avg_cost), 0), [zMfs])
  const zMfVal = useMemo(() => zMfs.reduce((s, r) => {
    const p = yPrice(r.nav_symbol)
    return s + (p != null ? Number(r.qty) * p : Number(r.qty) * Number(r.avg_cost))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, 0), [zMfs, yahooPrices])

  const zGoldInv = useMemo(() => zGold.reduce((s, r) => s + Number(r.qty) * Number(r.avg_cost), 0), [zGold])
  const zGoldVal = useMemo(() => zGold.reduce((s, r) => {
    const p = yPrice(r.yahoo_symbol)
    return s + (p != null ? Number(r.qty) * p : Number(r.qty) * Number(r.avg_cost))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, 0), [zGold, yahooPrices])

  const zerodhaTotalInv = zStocksInv + zMfInv + zGoldInv
  const zerodhaTotalVal = zStocksVal + zMfVal + zGoldVal

  const aiStocksInv = useMemo(() => aiStocks.reduce((s, r) => s + Number(r.qty) * Number(r.avg_cost), 0), [aiStocks])
  const aiStocksVal = useMemo(() => aiStocks.reduce((s, r) => {
    const p = nsePrices[r.instrument]?.price ?? null
    return s + (p != null ? Number(r.qty) * p : Number(r.qty) * Number(r.avg_cost))
  }, 0), [aiStocks, nsePrices])

  const aiGoldInv = useMemo(() => aiGold.reduce((s, r) => s + Number(r.qty) * Number(r.avg_cost), 0), [aiGold])
  const aiGoldVal = useMemo(() => aiGold.reduce((s, r) => {
    const yahoo = resolveAiGoldYahoo(r.instrument)
    const key   = yahoo.replace(/\.(NS|BO)$/, '')
    const p     = yahoo ? (yahooPrices[key]?.price ?? yahooPrices[yahoo]?.price ?? null) : null
    return s + (p != null ? Number(r.qty) * p : Number(r.qty) * Number(r.avg_cost))
  }, 0), [aiGold, yahooPrices])

  const aionionTotalInv = aiStocksInv + aiGoldInv
  const aionionTotalVal = aiStocksVal + aiGoldVal

  const amcMfInv = useMemo(() => amcMf.reduce((s, r) => s + Number(r.qty) * Number(r.avg_cost), 0), [amcMf])
  const amcMfVal = useMemo(() => amcMf.reduce((s, r) => {
    const p = yPrice(r.nav_symbol)
    return s + (p != null ? Number(r.qty) * p : Number(r.qty) * Number(r.avg_cost))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, 0), [amcMf, yahooPrices])

  const cashInv = useMemo(() => cash.reduce((s, r) => s + Number(r.invested), 0), [cash])
  const cashVal = useMemo(() => cash.reduce((s, r) => s + Number(r.current_value ?? r.invested), 0), [cash])

  const fdInv = useMemo(() => fds.reduce((s, r) => s + Number(r.invested), 0), [fds])
  const fdVal = fdInv

  const efInv = useMemo(() => ef.reduce((s, r) => s + Number(r.invested), 0), [ef])
  const efVal = efInv

  const bondsInv = useMemo(() => bonds.reduce((s, r) => s + Number(r.invested), 0), [bonds])
  const bondsVal = useMemo(() => bonds.reduce((s, r) => s + Number(r.face_value ?? r.invested), 0), [bonds])

  const foreignInv = useMemo(() => foreign.reduce((s, r) =>
    s + Number(r.qty) * getForeignAvgGbp(r, gbpUsd) * gbpInr
  , 0), [foreign, gbpUsd, gbpInr])

  const foreignVal = useMemo(() => foreign.reduce((s, r) => {
    const ltpGbp = getForeignLtpGbp(r, yahooPrices, gbpUsd)
    const avgGbp = getForeignAvgGbp(r, gbpUsd)
    return s + Number(r.qty) * (ltpGbp ?? avgGbp) * gbpInr
  }, 0), [foreign, yahooPrices, gbpUsd, gbpInr])

  const cryptoInv = useMemo(() => crypto.reduce((s, r) => s + Number(r.qty) * Number(r.avg_price_gbp) * gbpInr, 0), [crypto, gbpInr])
  const cryptoVal = useMemo(() => crypto.reduce((s, r) => {
    const key = r.yahoo_symbol.replace(/-(GBP|USD|EUR|USDT)$/i, '')
    const p = yahooPrices[key]?.price ?? null
    return s + (p != null ? Number(r.qty) * p * gbpInr : Number(r.qty) * Number(r.avg_price_gbp) * gbpInr)
  }, 0), [crypto, yahooPrices, gbpInr])

  const bankInv = useMemo(() => bankSav.reduce((s, r) => s + Number(r.amount_gbp) * gbpInr, 0), [bankSav, gbpInr])
  const bankVal = bankInv

  // ── Actual amounts ────────────────────────────────────────────
  const actZStocksAmt  = sumAct(actZStocks)
  const actZMfAmt      = sumAct(actZMf)
  const actZGoldAmt    = null   // no gold_actual_invested table
  const actAiStocksAmt = sumAct(actAiStocks)
  const actAiGoldAmt   = null   // no aionion_gold_actual_invested table
  const actAmcMfAmt    = sumAct(actAmcMf)
  const actFdAmt       = sumAct(actFd)
  const actEfAmt       = sumAct(actEf)
  const actBondsAmt    = sumAct(actBonds)
  const actForeignAmt  = actForeignInr > 0 ? actForeignInr : null
  const actCryptoAmt   = actCryptoInr  > 0 ? actCryptoInr  : null
  const actBankAmt     = actBankInr    > 0 ? actBankInr    : null
  const cashActual     = cashInv
  const bondsActual    = actBondsAmt ?? bondsInv

  // ── Grand totals ──────────────────────────────────────────────
  const totalInv =
    zerodhaTotalInv + aionionTotalInv + amcMfInv +
    cashInv + fdInv + efInv + bondsInv +
    foreignInv + cryptoInv + bankInv

  const totalVal =
    zerodhaTotalVal + aionionTotalVal + amcMfVal +
    cashVal + fdVal + efVal + bondsVal +
    foreignVal + cryptoVal + bankVal

  // ── Actual Invested Logic ────────────────────────────────────
  // HAS OWN TABLE  → use table sum (0 if no entries; never fall back to book)
  //   Zerodha Stocks, Zerodha MF, Aionion Stocks, AMC MF,
  //   Fixed Deposits, Emergency Fund, Bonds,
  //   Foreign Stocks, Crypto, Bank Savings (GBP × rate)
  //
  // EXCLUDED (gold is price-based, not cash-in tracking)
  //   Zerodha Gold → 0, Aionion Gold → 0
  //
  // NO TABLE → use book invested as proxy
  //   Cash → cashInv
  const totalActual =
    (actZStocksAmt  ?? 0) +   // zerodha_actual_invested
    (actZMfAmt      ?? 0) +   // mf_actual_invested
    (actAiStocksAmt ?? 0) +   // aionion_actual_invested
    (actAmcMfAmt    ?? 0) +   // amc_mf_actual_invested
    (actFdAmt       ?? 0) +   // fd_actual_invested
    (actEfAmt       ?? 0) +   // ef_actual_invested
    (actBondsAmt    ?? 0) +   // bonds_actual_invested
    (actForeignAmt  ?? 0) +   // foreign_actual_invested
    (actCryptoAmt   ?? 0) +   // crypto_actual_invested
    (actBankAmt     ?? 0) +   // bank_savings_actual_invested
    cashInv                    // no table — use book invested
    // Zerodha Gold + Aionion Gold intentionally excluded

  const { gain: totalGain,  gainPct: totalGainPct,  isPositive: totalPos  } = calcGain(totalVal, totalInv)
  const { gain: actualGain, gainPct: actualGainPct, isPositive: actualPos } = calcGain(totalVal, totalActual)

  const anyLoading = l1||l2||l3||l4||l5||l6||l7||l8||l9||l10||l11||l12||l13

  const assetCount =
    zStocks.length + zMfs.length + zGold.length +
    aiStocks.length + aiGold.length + amcMf.length +
    cash.length + fds.length + ef.length + bonds.length +
    foreign.length + crypto.length + bankSav.length

  // ── Categories for dashboard ──────────────────────────────────
  const categories: CategoryTotal[] = useMemo(() => [
    { label: 'Zerodha Stocks', inv: zStocksInv,        val: zStocksVal,        color: '#1A7A3C', path: '/assets/zerodha-stocks' },
    { label: 'Zerodha MF',     inv: zMfInv,            val: zMfVal,            color: '#0891b2', path: '/assets/mutual-funds'   },
    { label: 'Zerodha Gold',   inv: zGoldInv,          val: zGoldVal,          color: '#D97706', path: '/assets/gold'           },
    { label: 'Aionion Stocks', inv: aiStocksInv,       val: aiStocksVal,       color: '#7C3AED', path: '/assets/aionion-stocks' },
    { label: 'Aionion Gold',   inv: aiGoldInv,         val: aiGoldVal,         color: '#F59E0B', path: '/assets/aionion-gold'   },
    { label: 'AMC MF',         inv: amcMfInv,          val: amcMfVal,          color: '#DB2777', path: '/assets/amc-mf'         },
    { label: 'Cash',           inv: cashInv,           val: cashVal,           color: '#059669', path: '/assets/cash'           },
    { label: 'Fixed Deposits', inv: fdInv,             val: fdVal,             color: '#0891b2', path: '/assets/fd'             },
    { label: 'Emergency Fund', inv: efInv,             val: efVal,             color: '#6366F1', path: '/assets/ef'             },
    { label: 'Bonds',          inv: bondsInv,          val: bondsVal,          color: '#B45309', path: '/assets/bonds'          },
    { label: 'Foreign Stocks', inv: foreignInv,        val: foreignVal,        color: '#DB2777', path: '/assets/foreign-stocks' },
    { label: 'Crypto',         inv: cryptoInv,         val: cryptoVal,         color: '#F59E0B', path: '/assets/crypto'         },
    { label: 'Bank Savings',   inv: bankInv,           val: bankVal,           color: '#0EA5E9', path: '/assets/bank-savings'   },
  ].filter(c => c.inv > 0 || c.val > 0),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [
    zStocksInv, zStocksVal, zMfInv, zMfVal, zGoldInv, zGoldVal,
    aiStocksInv, aiStocksVal, aiGoldInv, aiGoldVal,
    amcMfInv, amcMfVal, cashInv, cashVal, fdInv, efInv, bondsInv, bondsVal,
    foreignInv, foreignVal, cryptoInv, cryptoVal, bankInv,
  ])

  // ── Allocation buckets (grouped by ideal_allocations keys) ──
  const allocationBuckets: AllocationBucket[] = useMemo(() => {
    const b = [
      { key: 'India Equity MF',     val: zMfVal  + amcMfVal,                inv: zMfInv  + amcMfInv,               color: ALLOC_COLORS['India Equity MF']     },
      { key: 'India Equity Stocks', val: zStocksVal + aiStocksVal,           inv: zStocksInv + aiStocksInv,         color: ALLOC_COLORS['India Equity Stocks'] },
      { key: 'Foreign Equity/ETF',  val: foreignVal,                         inv: foreignInv,                       color: ALLOC_COLORS['Foreign Equity/ETF']  },
      { key: 'Gold',                val: zGoldVal + aiGoldVal,               inv: zGoldInv + aiGoldInv,             color: ALLOC_COLORS['Gold']                },
      { key: 'Bonds',               val: bondsVal,                           inv: bondsInv,                         color: ALLOC_COLORS['Bonds']               },
      { key: 'Fixed Deposit',       val: fdVal + efVal,                      inv: fdInv + efInv,                    color: ALLOC_COLORS['Fixed Deposit']       },
      { key: 'Cash',                val: cashVal,                            inv: cashInv,                          color: ALLOC_COLORS['Cash']                },
      { key: 'UK Savings',          val: bankVal,                            inv: bankInv,                          color: ALLOC_COLORS['UK Savings']          },
      { key: 'Crypto',              val: cryptoVal,                          inv: cryptoInv,                        color: ALLOC_COLORS['Crypto']              },
    ]
    return b
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    zMfVal, amcMfVal, zMfInv, amcMfInv,
    zStocksVal, aiStocksVal, zStocksInv, aiStocksInv,
    foreignVal, foreignInv,
    zGoldVal, aiGoldVal, zGoldInv, aiGoldInv,
    bondsVal, bondsInv, fdVal, fdInv, efVal, efInv,
    cashVal, cashInv, bankVal, bankInv, cryptoVal, cryptoInv,
  ])

  return {
    zStocks, zMfs, zGold, aiStocks, aiGold, amcMf,
    cash, fds, ef, bonds, foreign, crypto, bankSav,
    nsePrices, yahooPrices,
    gbpInr, gbpUsd, usdInr,
    zStocksInv, zStocksVal,
    zMfInv, zMfVal,
    zGoldInv, zGoldVal,
    aiStocksInv, aiStocksVal,
    aiGoldInv, aiGoldVal,
    amcMfInv, amcMfVal,
    cashInv, cashVal,
    fdInv, fdVal,
    efInv, efVal,
    bondsInv, bondsVal,
    foreignInv, foreignVal,
    cryptoInv, cryptoVal,
    bankInv, bankVal,
    zerodhaTotalInv, zerodhaTotalVal,
    aionionTotalInv, aionionTotalVal,
    totalInv, totalVal, totalActual,
    totalGain, totalGainPct, totalPos,
    actualGain, actualGainPct, actualPos,
    actZStocksAmt, actZMfAmt, actZGoldAmt,
    actAiStocksAmt, actAiGoldAmt, actAmcMfAmt,
    actFdAmt, actEfAmt, actBondsAmt,
    actForeignAmt, actCryptoAmt, actBankAmt,
    cashActual, bondsActual,
    categories, allocationBuckets,
    anyLoading, nFetching, yFetching,
    assetCount,
  }
}
