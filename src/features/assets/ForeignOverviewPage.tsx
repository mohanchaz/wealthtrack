import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate }      from 'react-router-dom'
import { useAuthStore }     from '../../store/authStore'
import { useAssets }        from '../../hooks/useAssets'
import { useYahooPrices, useFxRates } from '../../hooks/useLivePrices'
import {
  toForeignYahooSymbol, getForeignLtpGbp, getForeignAvgGbp,
} from '../../lib/foreignPriceHelpers'
import { PageShell }        from '../../components/common/PageShell'
import { INR, calcGain }    from '../../lib/utils'
import { supabase }         from '../../lib/supabase'
import type { ForeignHolding, CryptoHolding, BankSaving } from '../../types/assets'

// ── Shared types ──────────────────────────────────────────────
type ActRow = { gbp_amount: number; inr_rate: number | null }

// ── Asset Section Card ────────────────────────────────────────
interface SectionCardProps {
  icon:      string
  label:     string
  sublabel:  string
  accent:    string
  accentBg:  string
  invested:  number
  value:     number
  actual:    number | null
  count:     number
  unit:      string
  live:      boolean
  loading:   boolean
  extra?:    { label: string; value: string; color?: string }
  gbpVal?:   number
  gbpInvested?: number
  path:      string
}

function SectionCard({
  icon, label, sublabel, accent, accentBg,
  invested, value, actual, count, unit,
  live, loading, extra, gbpVal, gbpInvested, path,
}: SectionCardProps) {
  const navigate = useNavigate()
  const { gain, gainPct, isPositive } = calcGain(value, invested)
  const actCalc = actual != null ? calcGain(value, actual) : null

  return (
    <button
      onClick={() => navigate(path)}
      className="w-full text-left bg-surface border border-border border-t-[3px] rounded-2xl hover:border-ink/30 hover:shadow-card transition-all group"
      style={{ borderTopColor: accent }}
    >

      <div className="p-4">
        {/* Head */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: accentBg }}>
              {icon}
            </div>
            <div>
              <div className="font-bold text-sm text-textprim group-hover:text-ink transition-colors">{label}</div>
              <div className="text-[10px] text-textmut mt-0.5 flex items-center gap-1.5">
                {live && <span className="w-1.5 h-1.5 rounded-full bg-green inline-block animate-pulse" />}
                {sublabel}
                <span className="text-textfade">· {count} {unit}</span>
              </div>
            </div>
          </div>
          <span className="text-textfade group-hover:text-textmut transition-colors text-base">→</span>
        </div>

        {/* Rows */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-textmut uppercase tracking-wider font-semibold">Invested (₹)</span>
            <span className="text-xs font-bold text-textprim">{loading ? '…' : INR(invested)}</span>
          </div>
          {gbpInvested != null && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-textmut uppercase tracking-wider font-semibold">Invested (£)</span>
              <span className="text-xs font-bold text-textprim">{loading ? '…' : `£${gbpInvested.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-textmut uppercase tracking-wider font-semibold">
              {live ? <span className="text-green">● Live (₹)</span> : 'Cur. Value (₹)'}
            </span>
            <span className={`text-xs font-bold ${!loading ? (isPositive ? 'text-green' : 'text-red') : 'text-textprim'}`}>
              {loading ? '…' : INR(value)}
            </span>
          </div>
          {gbpVal != null && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-textmut uppercase tracking-wider font-semibold">
                {live ? <span className="text-green">● Live (£)</span> : 'Cur. Value (£)'}
              </span>
              <span className={`text-xs font-bold ${!loading ? (isPositive ? 'text-green' : 'text-red') : 'text-textprim'}`}>
                {loading ? '…' : `£${gbpVal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </span>
            </div>
          )}
          {actual != null && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-textmut uppercase tracking-wider font-semibold">Actual Inv</span>
              <span className="text-xs font-bold text-textprim">{loading ? '…' : INR(actual)}</span>
            </div>
          )}
          {extra && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-textmut uppercase tracking-wider font-semibold">{extra.label}</span>
              <span className="text-xs font-bold" style={{ color: extra.color ?? 'inherit' }}>{extra.value}</span>
            </div>
          )}
        </div>

        {/* Footer pill + gain */}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border">
          {!loading && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPositive ? 'bg-green/10 text-green' : 'text-red bg-red/10'}`}>
              {isPositive ? '+' : ''}{gainPct.toFixed(1)}%
            </span>
          )}
          {actCalc && !loading && (
            <span className={`text-[10px] font-semibold ${actCalc.isPositive ? 'text-green' : 'text-red'}`}>
              Actual {actCalc.isPositive ? '+' : ''}{actCalc.gainPct.toFixed(1)}%
            </span>
          )}
          {extra && !actCalc && !loading && (
            <span className="text-[10px] text-textmut font-semibold">{extra.value}</span>
          )}
        </div>
      </div>
    </button>
  )
}

// ── FX Rate Chip ─────────────────────────────────────────────
function FxChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 bg-surface border border-border rounded-xl px-3 py-2">
      <span className="text-[9px] font-700 text-textmut uppercase tracking-widest">{label}</span>
      <span className="text-sm font-extrabold font-mono text-textprim">{value}</span>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function ForeignOverviewPage() {
  const navigate = useNavigate()
  const userId   = useAuthStore(s => s.user?.id)!

  // Data
  const { data: foreign  = [], isLoading: l1 } = useAssets<ForeignHolding>('foreign_stock_holdings')
  const { data: crypto   = [], isLoading: l2 } = useAssets<CryptoHolding>('crypto_holdings')
  const { data: bankSav  = [], isLoading: l3 } = useAssets<BankSaving>('bank_savings')

  // FX rates
  const { data: fx } = useFxRates()
  const usdInr = fx?.usdInr ?? 83.5
  const gbpInr = fx?.gbpInr ?? (fx?.gbpUsd ?? 1.27) * usdInr
  const gbpUsd = fx?.gbpUsd ?? (gbpInr / usdInr)

  // Yahoo prices
  const foreignSyms = useMemo(() => [...new Set(foreign.map(r => toForeignYahooSymbol(r.symbol, r.currency)).filter(Boolean))], [foreign])
  const cryptoSyms  = useMemo(() => [...new Set(crypto.map(r => r.yahoo_symbol).filter(Boolean) as string[])], [crypto])
  const allSyms     = useMemo(() => [...new Set([...foreignSyms, ...cryptoSyms])], [foreignSyms, cryptoSyms])
  const { data: prices = {}, isFetching: pricesFetching } = useYahooPrices(allSyms)
  const yPrice = (sym?: string | null) => {
    if (!sym) return null
    const k = sym.replace(/\.(NS|BO|L|US)$/, '').replace(/-(GBP|USD|EUR|USDT)$/i, '')
    return prices[k]?.price ?? prices[sym]?.price ?? null
  }

  // Actual invested — reactive via React Query (same keys invalidated by detail pages)
  const { data: foreignActRows = [] } = useQuery<ActRow[]>({
    queryKey: ['foreign_actual_invested', userId],
    queryFn: async () => {
      const { data } = await supabase.from('foreign_actual_invested').select('gbp_amount,inr_rate').eq('user_id', userId)
      return (data ?? []) as ActRow[]
    },
    enabled: !!userId,
  })
  const { data: cryptoActRows = [] } = useQuery<ActRow[]>({
    queryKey: ['crypto_actual_invested', userId],
    queryFn: async () => {
      const { data } = await supabase.from('crypto_actual_invested').select('gbp_amount,inr_rate').eq('user_id', userId)
      return (data ?? []) as ActRow[]
    },
    enabled: !!userId,
  })
  const { data: bankActRows = [] } = useQuery<ActRow[]>({
    queryKey: ['bank_savings_actual_invested', userId],
    queryFn: async () => {
      const { data } = await supabase.from('bank_savings_actual_invested').select('gbp_amount,inr_rate').eq('user_id', userId)
      return (data ?? []) as ActRow[]
    },
    enabled: !!userId,
  })
  const actForeignGbp = useMemo(() => foreignActRows.reduce((s: number, e: ActRow) => s + Number(e.gbp_amount), 0), [foreignActRows])
  const actForeignInr = useMemo(() => foreignActRows.reduce((s: number, e: ActRow) => s + Number(e.gbp_amount) * Number(e.inr_rate ?? gbpInr), 0), [foreignActRows, gbpInr])
  const actCryptoGbp  = useMemo(() => cryptoActRows.reduce((s: number, e: ActRow) => s + Number(e.gbp_amount), 0), [cryptoActRows])
  const actCryptoInr  = useMemo(() => cryptoActRows.reduce((s: number, e: ActRow) => s + Number(e.gbp_amount) * Number(e.inr_rate ?? gbpInr), 0), [cryptoActRows, gbpInr])
  const actBankGbp    = useMemo(() => bankActRows.reduce((s: number, e: ActRow) => s + Number(e.gbp_amount), 0), [bankActRows])
  const actBankInr    = useMemo(() => bankActRows.reduce((s: number, e: ActRow) => s + Number(e.gbp_amount) * Number(e.inr_rate ?? gbpInr), 0), [bankActRows, gbpInr])

  // ── Computed values ──────────────────────────────────────────
  const foreignInv = useMemo(() => foreign.reduce((s, r) => {
    return s + Number(r.qty) * getForeignAvgGbp(r, gbpUsd) * gbpInr
  }, 0), [foreign, gbpUsd, gbpInr])

  const foreignVal = useMemo(() => foreign.reduce((s, r) => {
    const ltpGbp = getForeignLtpGbp(r, prices, gbpUsd)
    const avgGbp = getForeignAvgGbp(r, gbpUsd)
    return s + Number(r.qty) * (ltpGbp ?? avgGbp) * gbpInr
  }, 0), [foreign, prices, gbpUsd, gbpInr])

  const cryptoInv = useMemo(() => crypto.reduce((s, r) => s + Number(r.qty) * Number(r.avg_price_gbp) * gbpInr, 0), [crypto, gbpInr])
  const cryptoVal = useMemo(() => crypto.reduce((s, r) => {
    const p = yPrice(r.yahoo_symbol)
    return s + (p != null ? Number(r.qty) * p * gbpInr : Number(r.qty) * Number(r.avg_price_gbp) * gbpInr)
  }, 0), [crypto, prices, gbpInr])

  const bankInv = useMemo(() => bankSav.reduce((s, r) => s + Number(r.amount_gbp) * gbpInr, 0), [bankSav, gbpInr])
  const bankVal = bankInv
  const bankGbp = useMemo(() => bankSav.reduce((s, r) => s + Number(r.amount_gbp), 0), [bankSav])

  // GBP equivalents for foreign stocks and crypto
  const foreignInvGbp = gbpInr > 0 ? foreignInv / gbpInr : 0
  const foreignValGbp = gbpInr > 0 ? foreignVal / gbpInr : 0
  const cryptoInvGbp  = useMemo(() => crypto.reduce((s, r) => s + Number(r.qty) * Number(r.avg_price_gbp), 0), [crypto])
  const cryptoValGbp  = useMemo(() => crypto.reduce((s, r) => {
    const p = yPrice(r.yahoo_symbol)
    return s + (p != null ? Number(r.qty) * p : Number(r.qty) * Number(r.avg_price_gbp))
  }, 0), [crypto, prices])

  const totalInv = foreignInv + cryptoInv + bankInv
  const totalVal = foreignVal + cryptoVal + bankVal
  const { gain: totalGain, gainPct: totalGainPct, isPositive: totalPos } = calcGain(totalVal, totalInv)

  const actForeignAmt = actForeignInr > 0 ? actForeignInr : null
  const actCryptoAmt  = actCryptoInr  > 0 ? actCryptoInr  : null
  const actBankAmt    = actBankInr    > 0 ? actBankInr    : null

  const totalActual = (actForeignAmt ?? foreignInv) + (actCryptoAmt ?? cryptoInv) + (actBankAmt ?? bankInv)
  const { gain: actGain, gainPct: actGainPct, isPositive: actPos } = calcGain(totalVal, totalActual)

  // Native GBP totals — computed directly from asset values, not converted from INR
  const nativeValGbp = foreignValGbp + cryptoValGbp + bankGbp
  const nativeInvGbp = foreignInvGbp + cryptoInvGbp + bankGbp
  const nativeGainGbp = nativeValGbp - nativeInvGbp
  const nativeGainPos = nativeGainGbp >= 0
  const nativeGainPct = nativeInvGbp > 0 ? (nativeGainGbp / nativeInvGbp) * 100 : 0

  // Native GBP actual invested (sum of gbp_amount across all actual tables)
  const hasActualGbp    = actForeignGbp + actCryptoGbp + actBankGbp > 0
  const nativeActualGbp = (actForeignGbp > 0 ? actForeignGbp : foreignInvGbp)
                        + (actCryptoGbp  > 0 ? actCryptoGbp  : cryptoInvGbp)
                        + (actBankGbp    > 0 ? actBankGbp    : bankGbp)
  const nativeActGainGbp = nativeValGbp - nativeActualGbp
  const nativeActGainPos = nativeActGainGbp >= 0
  const nativeActGainPct = nativeActualGbp > 0 ? (nativeActGainGbp / nativeActualGbp) * 100 : 0

  // INR-converted GBP (for display sub-labels under INR figures)
  const fmtGbp = (v: number) => `£${Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtGbpSigned = (v: number) => `${v >= 0 ? '+' : '-'}£${Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const liveLabel = pricesFetching ? '🔄 Fetching…'
    : Object.keys(prices).length > 0 ? `🟢 Live · ${new Date().toLocaleTimeString('en-IN')}` : undefined

  const anyLoading = l1 || l2 || l3

  return (
    <PageShell
      title="Foreign Assets"
      subtitle="Global Portfolio"
      actions={[{ label: 'Foreign Stocks', onClick: () => navigate('/assets/foreign-stocks'), variant: 'secondary' }]}
    >
      {/* FX ticker strip */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className="flex items-center gap-1.5 bg-ink rounded-full px-3 py-1.5 mr-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
          <span className="text-[10px] font-bold text-chalk uppercase tracking-wider">Live</span>
        </div>
        <FxChip label="GBP / INR" value={`₹${gbpInr.toFixed(2)}`} />
        <FxChip label="USD / INR" value={`₹${usdInr.toFixed(2)}`} />
        <FxChip label="GBP / USD" value={gbpUsd.toFixed(3)} />
        {liveLabel && (
          <span className="text-[10px] text-textmut font-semibold ml-auto">{liveLabel}</span>
        )}
      </div>

      {/* Summary totals bar */}
      <div className="bg-surface border border-border rounded-2xl p-4 mb-2 grid grid-cols-2 sm:flex sm:items-stretch sm:divide-x sm:divide-border gap-3 sm:gap-0 w-full">
        <div className="flex flex-col justify-center sm:pr-6 flex-1">
          <div className="text-[10px] font-bold text-textmut uppercase tracking-widest mb-1">Total Value</div>
          <div className="text-xl font-extrabold text-textprim font-mono">{anyLoading ? '…' : INR(totalVal)}</div>
        </div>
        <div className="flex flex-col justify-center sm:px-6 flex-1">
          <div className="text-[10px] font-bold text-textmut uppercase tracking-widest mb-1">Invested</div>
          <div className="text-xl font-extrabold text-textprim font-mono">{anyLoading ? '…' : INR(totalInv)}</div>
        </div>
        <div className="flex flex-col justify-center sm:px-6 flex-1">
          <div className="text-[10px] font-bold text-textmut uppercase tracking-widest mb-1">Gain / Loss</div>
          <div className={`text-xl font-extrabold font-mono ${totalPos ? 'text-green' : 'text-red'}`}>
            {anyLoading ? '…' : `${totalPos ? '+' : ''}${INR(totalGain)}`}
          </div>
          <div className={`text-[10px] font-bold font-mono mt-0.5 ${totalPos ? 'text-green' : 'text-red'}`}>
            {anyLoading ? '' : `${totalPos ? '+' : ''}${totalGainPct.toFixed(1)}%`}
          </div>
        </div>
        <div className="flex flex-col justify-center sm:px-6 flex-1">
          <div className="text-[10px] font-bold text-textmut uppercase tracking-widest mb-1">Actual Invested</div>
          <div className="text-xl font-extrabold text-textprim font-mono">{anyLoading ? '…' : INR(totalActual)}</div>
        </div>
        <div className="flex flex-col justify-center sm:pl-6 flex-1">
          <div className="text-[10px] font-bold text-textmut uppercase tracking-widest mb-1">Actual Gain</div>
          <div className={`text-xl font-extrabold font-mono ${actPos ? 'text-green' : 'text-red'}`}>
            {anyLoading ? '…' : `${actPos ? '+' : ''}${INR(actGain)}`}
          </div>
          <div className={`text-[10px] font-bold font-mono mt-0.5 ${actPos ? 'text-green' : 'text-red'}`}>
            {anyLoading ? '' : `${actPos ? '+' : ''}${actGainPct.toFixed(1)}%`}
          </div>
        </div>
      </div>

      {/* GBP bar */}
      <div className="bg-surface border border-border rounded-2xl px-4 py-3 mb-4 flex flex-wrap items-center gap-y-1">
        <span className="text-[10px] font-bold text-textmut uppercase tracking-widest pr-4">£ GBP</span>
        {[
          { label: 'Portfolio',       val: fmtGbp(nativeValGbp),                                                                                                  color: 'text-textprim' },
          { label: 'Invested',        val: fmtGbp(nativeInvGbp),                                                                                                  color: 'text-textprim' },
          { label: 'Gain',            val: `${nativeGainPos?'+':'-'}${fmtGbp(Math.abs(nativeGainGbp))} (${nativeGainPos?'+':''}${nativeGainPct.toFixed(1)}%)`,     color: nativeGainPos ? 'text-green' : 'text-red' },
          ...(hasActualGbp ? [
            { label: 'Actual Inv',    val: fmtGbp(nativeActualGbp),                                                                                               color: 'text-textprim' },
            { label: 'Actual Gain',   val: `${nativeActGainPos?'+':'-'}${fmtGbp(Math.abs(nativeActGainGbp))} (${nativeActGainPos?'+':''}${nativeActGainPct.toFixed(1)}%)`, color: nativeActGainPos ? 'text-green' : 'text-red' },
          ] : []),
        ].map(({ label, val, color }, i) => (
          <div key={label} className={`flex items-center gap-1.5 px-3 ${i > 0 ? 'border-l border-border' : ''}`}>
            <span className="text-[10px] text-textmut">{label}</span>
            <span className={`text-[12px] font-extrabold font-mono ${color}`}>{anyLoading ? '…' : val}</span>
          </div>
        ))}
        <span className="text-[9px] text-textfade ml-auto pl-4">@ ₹{gbpInr.toFixed(1)}/£</span>
      </div>

      {/* Section cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SectionCard
          icon="🌐" label="Foreign Stocks" sublabel="USD / GBP"
          accent="#1A1A1A" accentBg="#FDF2F8"
          invested={foreignInv} value={foreignVal}
          actual={actForeignAmt}
          gbpInvested={foreignInvGbp} gbpVal={foreignValGbp}
          count={foreign.filter(r => Number(r.qty) > 0).length} unit="stocks"
          live={Object.keys(prices).length > 0} loading={l1}
          path="/assets/foreign-stocks"
        />
        <SectionCard
          icon="₿" label="Crypto" sublabel="GBP pairs"
          accent="#1A1A1A" accentBg="#FFFBEB"
          invested={cryptoInv} value={cryptoVal}
          actual={actCryptoAmt}
          gbpInvested={cryptoInvGbp} gbpVal={cryptoValGbp}
          count={crypto.filter(r => Number(r.qty) > 0).length} unit="coins"
          live={Object.keys(prices).length > 0} loading={l2}
          path="/assets/crypto"
        />
        <SectionCard
          icon="🏦" label="Bank Savings" sublabel="GBP · UK"
          accent="#1A1A1A" accentBg="#F0F9FF"
          invested={bankInv} value={bankVal}
          actual={actBankAmt}
          gbpInvested={bankGbp} gbpVal={bankGbp}
          count={bankSav.length} unit="accounts"
          live={false} loading={l3}
          path="/assets/bank-savings"
        />
      </div>
    </PageShell>
  )
}
