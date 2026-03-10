import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAssets }        from '../../hooks/useAssets'
import { useAuthStore }      from '../../store/authStore'
import { useActualInvested } from '../../hooks/useActualInvested'
import { useNsePrices, useYahooPrices, useFxRates } from '../../hooks/useLivePrices'
import { INR, calcGain }    from '../../lib/utils'
import { supabase }          from '../../lib/supabase'
import type {
  StockHolding, MfHolding, GoldHolding,
  AionionGoldHolding, CashAsset, FdAsset, EfAsset, BondAsset,
  ForeignHolding, CryptoHolding, AmcMfHolding,
} from '../../types/assets'

// ── Tiny sparkline bar ────────────────────────────────────────
function MiniBar({ pct, positive }: { pct: number; positive: boolean }) {
  const w = Math.min(Math.abs(pct), 100)
  return (
    <div className="w-full h-1 rounded-full bg-border mt-2 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${positive ? 'bg-green' : 'bg-red'}`}
        style={{ width: `${w}%` }}
      />
    </div>
  )
}

// ── Asset category card ───────────────────────────────────────
interface CardProps {
  icon:      string
  label:     string
  sublabel?: string
  invested:  number
  actual:    number   // actual invested (or falls back to invested)
  value:     number
  count:     number
  unit:      string
  live?:     boolean
  loading:   boolean
  accent:    string
  path:      string
  delay?:    number
}

function AssetCard({ icon, label, sublabel, invested, actual, value, count, unit, live, loading, accent, path, delay = 0 }: CardProps) {
  const navigate = useNavigate()
  const { gain, gainPct, isPositive } = calcGain(value, invested)
  const { gain: actGain, gainPct: actGainPct, isPositive: actPos } = calcGain(value, actual)
  const style = { animationDelay: `${delay}ms` }

  return (
    <button
      onClick={() => navigate(path)}
      style={style}
      className="group animate-fade-up w-full text-left bg-surface border border-border rounded-2xl p-5
                 hover:border-ink/20 hover:shadow-cardHov transition-all duration-200 active:scale-[0.99]"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
            style={{ background: `${accent}12`, border: `1px solid ${accent}20` }}
          >
            {icon}
          </div>
          <div>
            <div className="font-bold text-textprim text-sm leading-tight">{label}</div>
            {sublabel && <div className="text-[10px] text-textmut mt-0.5">{sublabel}</div>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {live && <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse-dot" />}
          <span className="text-[10px] font-medium text-textmut bg-bg px-2 py-0.5 rounded-full border border-border">
            {loading ? '…' : `${count} ${unit}`}
          </span>
        </div>
      </div>

      {/* Value */}
      <div className="mb-1">
        <div className="text-[10px] text-textmut uppercase tracking-wider mb-0.5">Current Value</div>
        <div className={`font-bold text-xl ${loading ? 'text-textfade' : value >= invested ? 'text-textprim' : 'text-textprim'}`}>
          {loading ? <span className="h-6 w-32 bg-border/60 rounded-md inline-block animate-pulse" /> : INR(value)}
        </div>
      </div>

      {/* Gain rows */}
      <div className="flex items-center justify-between mt-2">
        <div className="text-[10px] text-textmut">
          Avg cost <span className="text-textsec font-medium">{loading ? '…' : INR(invested)}</span>
        </div>
        {!loading && (
          <div className={`text-xs font-bold ${isPositive ? 'text-green' : 'text-red'}`}>
            {isPositive ? '+' : ''}{gainPct.toFixed(1)}%
          </div>
        )}
      </div>
      {!loading && actual !== invested && (
        <div className="flex items-center justify-between mt-1">
          <div className="text-[10px] text-textmut">
            Actual <span className="text-textsec font-medium">{INR(actual)}</span>
          </div>
          <div className={`text-xs font-bold ${actPos ? 'text-green' : 'text-red'}`}>
            {actPos ? '+' : ''}{actGainPct.toFixed(1)}%
          </div>
        </div>
      )}

      <MiniBar pct={actGainPct} positive={actPos} />

      {/* Arrow */}
      <div className="mt-3 flex items-center gap-1 text-[10px] text-textfade group-hover:text-textmut transition-colors">
        <span>View details</span>
        <span className="group-hover:translate-x-0.5 transition-transform">→</span>
      </div>
    </button>
  )
}

// ── Big total hero ────────────────────────────────────────────
function HeroStat({ label, value, sub, loading, accent }: {
  label: string; value: string; sub?: string; loading: boolean; accent?: string
}) {
  return (
    <div className="flex flex-col">
      <div className="text-[10px] text-textmut uppercase tracking-widest mb-1">{label}</div>
      {loading
        ? <div className="h-8 w-36 bg-border/50 rounded-lg animate-pulse" />
        : <div className="font-bold text-3xl tracking-tight" style={{ color: accent ?? '#1A1A1A' }}>{value}</div>
      }
      {sub && !loading && <div className="text-xs text-textmut mt-0.5">{sub}</div>}
    </div>
  )
}

// ── Category group header ─────────────────────────────────────
function GroupHeader({ label, invested, value, loading }: {
  label: string; invested: number; value: number; loading: boolean
}) {
  const { gainPct, isPositive } = calcGain(value, invested)
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-textmut">{label}</h2>
      {!loading && invested > 0 && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          isPositive ? 'bg-green/8 text-green' : 'bg-red/8 text-red'
        }`}>
          {isPositive ? '+' : ''}{gainPct.toFixed(1)}%
        </span>
      )}
    </div>
  )
}

// ── Allocation donut (pure CSS) ───────────────────────────────
function AllocationRing({ slices }: { slices: { label: string; pct: number; color: string }[] }) {
  let cumulative = 0
  const segments = slices.map(s => {
    const start = cumulative
    cumulative += s.pct
    return { ...s, start }
  })

  const r = 54, cx = 64, cy = 64, stroke = 18
  const circumference = 2 * Math.PI * r

  return (
    <svg width="128" height="128" viewBox="0 0 128 128" className="rotate-[-90deg]">
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E0DDD6" strokeWidth={stroke} />
      {segments.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none"
          stroke={s.color}
          strokeWidth={stroke}
          strokeDasharray={`${(s.pct / 100) * circumference} ${circumference}`}
          strokeDashoffset={-((s.start / 100) * circumference)}
          strokeLinecap="butt"
        />
      ))}
    </svg>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function AssetsOverviewPage() {
  const navigate = useNavigate()

  // ── Load all asset tables ────────────────────────────────────
  const userId = useAuthStore(s => s.user?.id)

  const { data: zStocks  = [], isLoading: l1 } = useAssets<StockHolding>('zerodha_stocks')
  const { data: zMfs     = [], isLoading: l2 } = useAssets<MfHolding>('mf_holdings')
  const { data: zGold    = [], isLoading: l3 } = useAssets<GoldHolding>('gold_holdings')
  const { data: aiStocks = [], isLoading: l4 } = useAssets<StockHolding>('aionion_stocks')
  const { data: aiGold   = [], isLoading: l5 } = useAssets<AionionGoldHolding>('aionion_gold')
  const { data: amcMf    = [], isLoading: l6 } = useAssets<AmcMfHolding>('amc_mf_holdings')
  const { data: cash     = [], isLoading: l7 } = useAssets<CashAsset>('cash_assets')
  const { data: fds      = [], isLoading: l8 } = useAssets<FdAsset>('bank_fd_assets')
  const { data: ef       = [], isLoading: l9 } = useAssets<EfAsset>('emergency_funds')
  const { data: bonds    = [], isLoading: l10 } = useAssets<BondAsset>('bonds')
  const { data: foreign  = [], isLoading: l11 } = useAssets<ForeignHolding>('foreign_stock_holdings')
  const { data: crypto   = [], isLoading: l12 } = useAssets<CryptoHolding>('crypto_holdings')

  // ── Actual invested hooks ───────────────────────────────────
  const actZStocks  = useActualInvested('zerodha_actual_invested')
  const actZMf      = useActualInvested('mf_actual_invested')
  const actZGold    = useActualInvested('gold_actual_invested')
  const actAiStocks = useActualInvested('aionion_actual_invested')
  const actAiGold   = useActualInvested('aionion_gold_actual_invested')
  const actAmcMf    = useActualInvested('amc_mf_actual_invested')
  const actFd       = useActualInvested('fd_actual_invested')
  const actEf       = useActualInvested('ef_actual_invested')
  // foreign_actual_invested uses custom schema (gbp_amount+inr_rate) — not wired to overview yet
  // const actForeign  = useActualInvested('foreign_actual_invested')
  // crypto actual — defined after gbpInr below

  const sum = (hook: ReturnType<typeof useActualInvested>) =>
    hook.data?.reduce((s, e) => s + e.amount, 0) ?? null

  // ── Live prices ──────────────────────────────────────────────
  const zInstruments  = useMemo(() => zStocks.map(r => r.instrument), [zStocks])
  const aiInstruments = useMemo(() => aiStocks.map(r => r.instrument), [aiStocks])
  const allNse        = useMemo(() => [...new Set([...zInstruments, ...aiInstruments])], [zInstruments, aiInstruments])
  const { data: nsePrices = {}, isFetching: nFetching } = useNsePrices(allNse)

  const mfSymbols  = useMemo(() => [...new Set([...zMfs.map(r => r.nav_symbol), ...amcMf.map(r => r.nav_symbol)].filter(Boolean) as string[])], [zMfs, amcMf])
  const goldSymbols = useMemo(() => [...new Set(zGold.map(r => r.yahoo_symbol).filter(Boolean) as string[])], [zGold])
  const cryptoSyms  = useMemo(() => [...new Set(crypto.map(r => r.yahoo_symbol).filter(Boolean) as string[])], [crypto])
  const foreignSyms = useMemo(() => [...new Set(foreign.map(r => r.symbol).filter(Boolean) as string[])], [foreign])
  const allYahoo    = useMemo(() => [...new Set([...mfSymbols, ...goldSymbols, ...cryptoSyms, ...foreignSyms])], [mfSymbols, goldSymbols, cryptoSyms, foreignSyms])
  const { data: yahooPrices = {}, isFetching: yFetching } = useYahooPrices(allYahoo)

  const { data: fx } = useFxRates()
  const usdInr = fx?.usdInr ?? 83.5
  const gbpInr = fx?.gbpInr ?? (fx?.gbpUsd ?? 1.27) * usdInr

  // crypto_actual_invested has custom schema (gbp_amount+inr_rate) — fetch directly
  const [actCryptoGbp, setActCryptoGbp] = useState(0)
  const [actCryptoInr, setActCryptoInr] = useState(0)
  useEffect(() => {
    if (!userId) return
    supabase.from('crypto_actual_invested').select('gbp_amount,inr_rate').eq('user_id', userId)
      .then(({ data }) => {
        const rows = (data ?? []) as {gbp_amount: number; inr_rate: number | null}[]
        setActCryptoGbp(rows.reduce((s, e) => s + Number(e.gbp_amount), 0))
        setActCryptoInr(rows.reduce((s, e) => s + Number(e.gbp_amount) * Number(e.inr_rate ?? gbpInr), 0))
      })
  }, [userId, gbpInr])

  // ── Helper: get yahoo price ──────────────────────────────────
  const yPrice = (sym: string | null | undefined) => {
    if (!sym) return null
    const k = sym.replace(/\.(BO|NS)$/, '')
    return yahooPrices[k]?.price ?? yahooPrices[sym]?.price ?? null
  }

  // ── Section totals ───────────────────────────────────────────
  // Zerodha stocks
  const zStocksInv = useMemo(() => zStocks.reduce((s, r) => s + Number(r.qty) * Number(r.avg_cost), 0), [zStocks])
  const zStocksVal = useMemo(() => zStocks.reduce((s, r) => {
    const p = nsePrices[`${r.instrument}.NS`]?.price ?? null
    return s + (p != null ? Number(r.qty) * p : Number(r.qty) * Number(r.avg_cost))
  }, 0), [zStocks, nsePrices])

  // Zerodha MF
  const zMfInv = useMemo(() => zMfs.reduce((s, r) => s + Number(r.qty) * Number(r.avg_cost), 0), [zMfs])
  const zMfVal = useMemo(() => zMfs.reduce((s, r) => {
    const p = yPrice(r.nav_symbol)
    return s + (p != null ? Number(r.qty) * p : Number(r.qty) * Number(r.avg_cost))
  }, 0), [zMfs, yahooPrices])

  // Zerodha Gold
  const zGoldInv = useMemo(() => zGold.reduce((s, r) => s + Number(r.qty) * Number(r.avg_cost), 0), [zGold])
  const zGoldVal = useMemo(() => zGold.reduce((s, r) => {
    const p = yPrice(r.yahoo_symbol)
    return s + (p != null ? Number(r.qty) * p : Number(r.qty) * Number(r.avg_cost))
  }, 0), [zGold, yahooPrices])

  const zerodhaTotalInv = zStocksInv + zMfInv + zGoldInv
  const zerodhaTotalVal = zStocksVal + zMfVal + zGoldVal

  // Aionion stocks
  const aiStocksInv = useMemo(() => aiStocks.reduce((s, r) => s + Number(r.qty) * Number(r.avg_cost), 0), [aiStocks])
  const aiStocksVal = useMemo(() => aiStocks.reduce((s, r) => {
    const p = nsePrices[`${r.instrument}.NS`]?.price ?? null
    return s + (p != null ? Number(r.qty) * p : Number(r.qty) * Number(r.avg_cost))
  }, 0), [aiStocks, nsePrices])

  // Aionion Gold
  const aiGoldInv = useMemo(() => aiGold.reduce((s, r) => s + Number(r.qty) * Number(r.avg_cost), 0), [aiGold])
  const aiGoldVal = aiGoldInv // no live price for aionion gold
  const aionionTotalInv = aiStocksInv + aiGoldInv
  const aionionTotalVal = aiStocksVal + aiGoldVal

  // AMC MF
  const amcMfInv = useMemo(() => amcMf.reduce((s, r) => s + Number(r.qty) * Number(r.avg_cost), 0), [amcMf])
  const amcMfVal = useMemo(() => amcMf.reduce((s, r) => {
    const p = yPrice(r.nav_symbol)
    return s + (p != null ? Number(r.qty) * p : Number(r.qty) * Number(r.avg_cost))
  }, 0), [amcMf, yahooPrices])

  // Cash
  const cashInv = useMemo(() => cash.reduce((s, r) => s + Number(r.invested), 0), [cash])
  const cashVal = useMemo(() => cash.reduce((s, r) => s + Number(r.current_value ?? r.invested), 0), [cash])

  // FDs
  const fdInv = useMemo(() => fds.reduce((s, r) => s + Number(r.invested), 0), [fds])
  const fdVal = fdInv  // current value = invested (interest only realised at maturity)

  // EF
  const efInv = useMemo(() => ef.reduce((s, r) => s + Number(r.invested), 0), [ef])
  const efVal = efInv  // current value = invested (interest only realised at maturity)

  // Bonds
  const bondsInv = useMemo(() => bonds.reduce((s, r) => s + Number(r.invested), 0), [bonds])
  const bondsVal = useMemo(() => bonds.reduce((s, r) => s + Number(r.face_value ?? r.invested), 0), [bonds])

  // Foreign
  const foreignInv = useMemo(() => foreign.reduce((s, r) => {
    const rate = (r.currency === 'USD') ? usdInr : (r.currency === 'GBP' || r.currency === 'GBX') ? gbpInr : 1
    return s + Number(r.qty) * Number(r.avg_price) * (r.currency === 'GBX' ? 0.01 : 1) * rate
  }, 0), [foreign, usdInr, gbpInr])
  const foreignVal = useMemo(() => foreign.reduce((s, r) => {
    const p = yPrice(r.symbol)
    const rate = (r.currency === 'USD') ? usdInr : (r.currency === 'GBP' || r.currency === 'GBX') ? gbpInr : 1
    const qty = Number(r.qty); const unitMult = r.currency === 'GBX' ? 0.01 : 1
    return s + (p != null ? qty * p * unitMult * rate : qty * Number(r.avg_price) * unitMult * rate)
  }, 0), [foreign, yahooPrices, usdInr, gbpInr])

  // Crypto
  const cryptoInv = useMemo(() => crypto.reduce((s, r) => s + Number(r.qty) * Number(r.avg_price_gbp) * gbpInr, 0), [crypto, gbpInr])
  const cryptoVal = useMemo(() => crypto.reduce((s, r) => {
    const p = yPrice(r.yahoo_symbol)
    return s + (p != null ? Number(r.qty) * p * gbpInr : Number(r.qty) * Number(r.avg_price_gbp) * gbpInr)
  }, 0), [crypto, yahooPrices, gbpInr])

  // ── Grand totals ─────────────────────────────────────────────
  const totalInv = zerodhaTotalInv + aionionTotalInv + amcMfInv + cashInv + fdInv + efInv + bondsInv + foreignInv + cryptoInv
  const totalVal = zerodhaTotalVal + aionionTotalVal + amcMfVal + cashVal + fdVal + efVal + bondsVal + foreignVal + cryptoVal
  const { gain: totalGain, gainPct: totalGainPct, isPositive: totalPos } = calcGain(totalVal, totalInv)

  // ── Actual invested per section (null = not applicable → use invested) ──
  const actZStocksAmt  = sum(actZStocks)
  const actZMfAmt      = sum(actZMf)
  const actZGoldAmt    = sum(actZGold)
  const actAiStocksAmt = sum(actAiStocks)
  const actAiGoldAmt   = sum(actAiGold)
  const actAmcMfAmt    = sum(actAmcMf)
  const actFdAmt       = sum(actFd)
  const actEfAmt       = sum(actEf)
  const actForeignAmt  = null // custom schema — see ForeignStocksPage
  const actCryptoAmt   = actCryptoInr > 0 ? actCryptoInr : null
  // No actual tables: cash, bonds, aionion gold → use invested as actual
  const cashActual     = cashInv
  const bondsActual    = bondsInv

  // Grand actual total: use actual where available, else invested
  const totalActual =
    (actZStocksAmt  ?? zStocksInv) +
    (actZMfAmt      ?? zMfInv) +
    (actZGoldAmt    ?? zGoldInv) +
    (actAiStocksAmt ?? aiStocksInv) +
    (actAiGoldAmt   ?? aiGoldInv) +
    (actAmcMfAmt    ?? amcMfInv) +
    cashActual +
    (actFdAmt       ?? fdInv) +
    (actEfAmt       ?? efInv) +
    bondsActual +
    (actForeignAmt  ?? foreignInv) +
    (actCryptoAmt   ?? cryptoInv)

  const { gain: actualGain, gainPct: actualGainPct, isPositive: actualPos } = calcGain(totalVal, totalActual)

  const anyLoading = l1||l2||l3||l4||l5||l6||l7||l8||l9||l10||l11||l12
  const anyLive    = !nFetching && !yFetching && Object.keys(nsePrices).length > 0

  // ── Allocation slices (for donut) ────────────────────────────
  const allocationData = [
    { label: 'Zerodha',   value: zerodhaTotalVal, color: '#1A7A3C' },
    { label: 'Aionion',   value: aionionTotalVal, color: '#0891b2' },
    { label: 'AMC MF',    value: amcMfVal,        color: '#7C3AED' },
    { label: 'Cash',      value: cashVal,         color: '#D97706' },
    { label: 'FD',        value: fdVal,           color: '#B45309' },
    { label: 'EF',        value: efVal,           color: '#059669' },
    { label: 'Bonds',     value: bondsVal,        color: '#6366F1' },
    { label: 'Foreign',   value: foreignVal,      color: '#DB2777' },
    { label: 'Crypto',    value: cryptoVal,       color: '#F59E0B' },
  ].filter(s => s.value > 0)

  const totalForAlloc = allocationData.reduce((s, d) => s + d.value, 0)
  const allocSlices = allocationData.map(d => ({
    ...d,
    pct: totalForAlloc > 0 ? (d.value / totalForAlloc) * 100 : 0,
  }))

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* ── PAGE HEADER ─────────────────────────────────────── */}
        <div className="animate-fade-up mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-ink tracking-tight">Portfolio Overview</h1>
              <p className="text-sm text-textmut mt-0.5">All assets across brokers and asset classes</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-textmut bg-surface border border-border rounded-xl px-3 py-2">
              {nFetching || yFetching
                ? <><span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" /><span>Fetching live prices…</span></>
                : anyLive
                  ? <><span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse-dot" /><span>Live · {new Date().toLocaleTimeString('en-IN')}</span></>
                  : <><span className="w-1.5 h-1.5 rounded-full bg-textfade" /><span>Prices unavailable</span></>
              }
            </div>
          </div>
        </div>

        {/* ── HERO BANNER ─────────────────────────────────────── */}
        <div className="animate-fade-up rounded-2xl p-6 mb-8 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #EDEBE8 0%, #E6E4E0 100%)', border: '1px solid #C8C4BE' }}>

          <div className="relative grid grid-cols-2 md:grid-cols-5 gap-6">
            <div>
              <div className="text-[10px] text-textmut uppercase tracking-widest mb-1">Total Portfolio</div>
              {anyLoading
                ? <div className="h-9 w-40 bg-border/60 rounded-lg animate-pulse" />
                : <div className="font-bold text-3xl text-ink tracking-tight">{INR(totalVal)}</div>
              }
              {!anyLoading && anyLive && <div className="text-[10px] text-textfade mt-1">Live valuation</div>}
            </div>
            <div>
              <div className="text-[10px] text-textmut uppercase tracking-widest mb-1">Total Invested</div>
              {anyLoading
                ? <div className="h-9 w-36 bg-border/60 rounded-lg animate-pulse" />
                : <div className="font-bold text-3xl text-textsec tracking-tight">{INR(totalInv)}</div>
              }
            </div>
            <div>
              <div className="text-[10px] text-textmut uppercase tracking-widest mb-1">Gain (Avg Cost)</div>
              {anyLoading
                ? <div className="h-9 w-32 bg-border/60 rounded-lg animate-pulse" />
                : (
                  <div>
                    <div className={`font-bold text-3xl tracking-tight ${totalPos ? 'text-green' : 'text-red'}`}>
                      {totalPos ? '+' : ''}{INR(totalGain)}
                    </div>
                    <div className={`text-sm font-semibold mt-0.5 ${totalPos ? 'text-green/70' : 'text-red/70'}`}>
                      {totalPos ? '+' : ''}{totalGainPct.toFixed(2)}%
                    </div>
                  </div>
                )
              }
            </div>
            <div>
              <div className="text-[10px] text-textmut uppercase tracking-widest mb-1">Gain (Actual)</div>
              {anyLoading
                ? <div className="h-9 w-32 bg-border/60 rounded-lg animate-pulse" />
                : (
                  <div>
                    <div className="text-[10px] text-textmut mb-1">Actual <span className="text-textsec font-mono">{INR(totalActual)}</span></div>
                    <div className={`font-bold text-2xl tracking-tight ${actualPos ? 'text-green' : 'text-red'}`}>
                      {actualPos ? '+' : ''}{INR(actualGain)}
                    </div>
                    <div className={`text-sm font-semibold mt-0.5 ${actualPos ? 'text-green/70' : 'text-red/70'}`}>
                      {actualPos ? '+' : ''}{actualGainPct.toFixed(2)}%
                    </div>
                  </div>
                )
              }
            </div>
            <div>
              <div className="text-[10px] text-textmut uppercase tracking-widest mb-2">Allocation</div>
              <div className="flex items-center gap-3">
                <AllocationRing slices={allocSlices} />
                <div className="flex flex-col gap-1">
                  {allocSlices.slice(0, 4).map(s => (
                    <div key={s.label} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="text-[9px] text-white/50">{s.label}</span>
                      <span className="text-[9px] text-white/70 font-mono ml-auto">{s.pct.toFixed(0)}%</span>
                    </div>
                  ))}
                  {allocSlices.length > 4 && (
                    <div className="text-[9px] text-white/30">+{allocSlices.length - 4} more</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── EQUITY GROUP ────────────────────────────────────── */}
        <section className="mb-8">
          <GroupHeader label="Equity & Mutual Funds" invested={zerodhaTotalInv + aionionTotalInv + amcMfInv} value={zerodhaTotalVal + aionionTotalVal + amcMfVal} loading={anyLoading} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <AssetCard icon="📈" label="Zerodha Stocks" sublabel="NSE · Live" invested={zStocksInv} actual={actZStocksAmt ?? zStocksInv} value={zStocksVal}
              count={zStocks.filter(r => Number(r.qty) > 0).length} unit="stocks"
              live={Object.keys(nsePrices).length > 0} loading={l1} accent="#1A7A3C"
              path="/assets/zerodha-stocks" delay={0} />
            <AssetCard icon="◈" label="Zerodha MF" sublabel="BSE NAV · Live" invested={zMfInv} actual={actZMfAmt ?? zMfInv} value={zMfVal}
              count={zMfs.filter(r => Number(r.qty) > 0).length} unit="funds"
              live={Object.keys(yahooPrices).length > 0} loading={l2} accent="#0891b2"
              path="/assets/mutual-funds" delay={60} />
            <AssetCard icon="⬡" label="Zerodha Gold" sublabel="ETF / MF" invested={zGoldInv} actual={actZGoldAmt ?? zGoldInv} value={zGoldVal}
              count={zGold.filter(r => Number(r.qty) > 0).length} unit="holdings"
              live={Object.keys(yahooPrices).length > 0} loading={l3} accent="#D97706"
              path="/assets/gold" delay={120} />
            <AssetCard icon="📊" label="Aionion Stocks" sublabel="NSE · Live" invested={aiStocksInv} actual={actAiStocksAmt ?? aiStocksInv} value={aiStocksVal}
              count={aiStocks.filter(r => Number(r.qty) > 0).length} unit="stocks"
              live={Object.keys(nsePrices).length > 0} loading={l4} accent="#7C3AED"
              path="/assets/aionion-stocks" delay={180} />
            <AssetCard icon="◎" label="Aionion Gold" sublabel="SGB / Gold" invested={aiGoldInv} actual={actAiGoldAmt ?? aiGoldInv} value={aiGoldVal}
              count={aiGold.filter(r => Number(r.qty) > 0).length} unit="holdings"
              loading={l5} accent="#F59E0B"
              path="/assets/aionion-gold" delay={240} />
            <AssetCard icon="◆" label="AMC Mutual Funds" sublabel="Direct · Live NAV" invested={amcMfInv} actual={actAmcMfAmt ?? amcMfInv} value={amcMfVal}
              count={amcMf.filter(r => Number(r.qty) > 0).length} unit="funds"
              live={Object.keys(yahooPrices).length > 0} loading={l6} accent="#DB2777"
              path="/assets/amc-mf" delay={300} />
          </div>
        </section>

        {/* ── FIXED INCOME GROUP ──────────────────────────────── */}
        <section className="mb-8">
          <GroupHeader label="Fixed Income & Savings" invested={cashInv + fdInv + efInv + bondsInv} value={cashVal + fdVal + efVal + bondsVal} loading={anyLoading} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <AssetCard icon="💰" label="Cash" sublabel="Savings / Wallets" invested={cashInv} actual={cashActual} value={cashVal}
              count={cash.length} unit="accounts" loading={l7} accent="#059669"
              path="/assets/cash" delay={0} />
            <AssetCard icon="🏦" label="Fixed Deposits" sublabel="Bank / NBFC" invested={fdInv} actual={actFdAmt ?? fdInv} value={fdVal}
              count={fds.length} unit="FDs" loading={l8} accent="#0891b2"
              path="/assets/fd" delay={60} />
            <AssetCard icon="🛡" label="Emergency Fund" sublabel="Liquid safety net" invested={efInv} actual={actEfAmt ?? efInv} value={efVal}
              count={ef.length} unit="entries" loading={l9} accent="#6366F1"
              path="/assets/ef" delay={120} />
            <AssetCard icon="📜" label="Bonds" sublabel="G-Sec / NCD / SGB" invested={bondsInv} actual={bondsActual} value={bondsVal}
              count={bonds.length} unit="bonds" loading={l10} accent="#B45309"
              path="/assets/bonds" delay={180} />
          </div>
        </section>

        {/* ── GLOBAL GROUP ────────────────────────────────────── */}
        <section className="mb-8">
          <GroupHeader label="Global Assets" invested={foreignInv + cryptoInv} value={foreignVal + cryptoVal} loading={anyLoading} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AssetCard icon="🌐" label="Foreign Stocks" sublabel="USD / GBP · Live" invested={foreignInv} actual={actForeignAmt ?? foreignInv} value={foreignVal}
              count={foreign.filter(r => Number(r.qty) > 0).length} unit="stocks"
              live={Object.keys(yahooPrices).length > 0} loading={l11} accent="#DB2777"
              path="/assets/foreign-stocks" delay={0} />
            <AssetCard icon="₿" label="Crypto" sublabel="GBP pairs · Live" invested={cryptoInv} actual={actCryptoAmt ?? cryptoInv} value={cryptoVal}
              count={crypto.filter(r => Number(r.qty) > 0).length} unit="coins"
              live={Object.keys(yahooPrices).length > 0} loading={l12} accent="#F59E0B"
              path="/assets/crypto" delay={60} />
          </div>
        </section>

        {/* ── QUICK NAVIGATE ──────────────────────────────────── */}
        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-textmut mb-3">Quick Navigate</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Zerodha', path: '/assets/zerodha' },
              { label: 'Aionion', path: '/assets/aionion' },
              { label: 'MF (Zerodha)', path: '/assets/mutual-funds' },
              { label: 'MF (AMC)', path: '/assets/amc-mf' },
              { label: 'Gold', path: '/assets/gold' },
              { label: 'Cash', path: '/assets/cash' },
              { label: 'FD', path: '/assets/fd' },
              { label: 'Emergency Fund', path: '/assets/ef' },
              { label: 'Bonds', path: '/assets/bonds' },
              { label: 'Foreign Stocks', path: '/assets/foreign-stocks' },
              { label: 'Crypto', path: '/assets/crypto' },
            ].map(l => (
              <button key={l.path} onClick={() => navigate(l.path)}
                className="text-xs font-medium text-textmut bg-surface border border-border rounded-xl px-3 py-1.5
                           hover:border-ink/30 hover:text-textprim transition-all">
                {l.label}
              </button>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
