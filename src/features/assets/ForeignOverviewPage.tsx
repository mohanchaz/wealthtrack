import { useMemo, useState, useEffect } from 'react'
import { useNavigate }      from 'react-router-dom'
import { useAuthStore }     from '../../store/authStore'
import { useAssets }        from '../../hooks/useAssets'
import { useYahooPrices, useFxRates } from '../../hooks/useLivePrices'
import { PageShell }        from '../../components/common/PageShell'
import { INR, calcGain }    from '../../lib/utils'
import { supabase }         from '../../lib/supabase'
import type { ForeignHolding, CryptoHolding, BankSaving } from '../../types/assets'

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
            <span className="text-[10px] text-textmut font-semibold">
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
  const foreignSyms = useMemo(() => [...new Set(foreign.map(r => r.symbol).filter(Boolean) as string[])], [foreign])
  const cryptoSyms  = useMemo(() => [...new Set(crypto.map(r => r.yahoo_symbol).filter(Boolean) as string[])], [crypto])
  const allSyms     = useMemo(() => [...new Set([...foreignSyms, ...cryptoSyms])], [foreignSyms, cryptoSyms])
  const { data: prices = {}, isFetching: pricesFetching } = useYahooPrices(allSyms)
  const yPrice = (sym?: string | null) => {
    if (!sym) return null
    const k = sym.replace(/\.(NS|BO)$/, '')
    return prices[k]?.price ?? prices[sym]?.price ?? null
  }

  // Actual invested
  const [actForeignInr, setActForeignInr] = useState(0)
  const [actCryptoInr,  setActCryptoInr]  = useState(0)
  const [actBankInr,    setActBankInr]    = useState(0)
  useEffect(() => {
    if (!userId || !gbpInr) return
    supabase.from('foreign_actual_invested').select('gbp_amount,inr_rate').eq('user_id', userId)
      .then(({ data }) => {
        const rows = (data ?? []) as { gbp_amount: number; inr_rate: number | null }[]
        setActForeignInr(rows.reduce((s, e) => s + Number(e.gbp_amount) * Number(e.inr_rate ?? gbpInr), 0))
      })
    supabase.from('crypto_actual_invested').select('gbp_amount,inr_rate').eq('user_id', userId)
      .then(({ data }) => {
        const rows = (data ?? []) as { gbp_amount: number; inr_rate: number | null }[]
        setActCryptoInr(rows.reduce((s, e) => s + Number(e.gbp_amount) * Number(e.inr_rate ?? gbpInr), 0))
      })
    supabase.from('bank_savings_actual_invested').select('gbp_amount,inr_rate').eq('user_id', userId)
      .then(({ data }) => {
        const rows = (data ?? []) as { gbp_amount: number; inr_rate: number | null }[]
        setActBankInr(rows.reduce((s, e) => s + Number(e.gbp_amount) * Number(e.inr_rate ?? gbpInr), 0))
      })
  }, [userId, gbpInr])

  // ── Computed values ──────────────────────────────────────────
  const foreignInv = useMemo(() => foreign.reduce((s, r) => {
    const rate = r.currency === 'USD' ? usdInr : (r.currency === 'GBP' || r.currency === 'GBX') ? gbpInr : 1
    const mult = r.currency === 'GBX' ? 0.01 : 1
    return s + Number(r.qty) * Number(r.avg_price) * mult * rate
  }, 0), [foreign, usdInr, gbpInr])

  const foreignVal = useMemo(() => foreign.reduce((s, r) => {
    const p    = yPrice(r.symbol)
    const rate = r.currency === 'USD' ? usdInr : (r.currency === 'GBP' || r.currency === 'GBX') ? gbpInr : 1
    const mult = r.currency === 'GBX' ? 0.01 : 1
    return s + (p != null ? Number(r.qty) * p * mult * rate : Number(r.qty) * Number(r.avg_price) * mult * rate)
  }, 0), [foreign, prices, usdInr, gbpInr])

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

  // GBP totals
  const totalValGbp    = gbpInr > 0 ? totalVal    / gbpInr : 0
  const totalInvGbp    = gbpInr > 0 ? totalInv    / gbpInr : 0
  const totalGainGbp   = gbpInr > 0 ? totalGain   / gbpInr : 0
  const actGainGbp     = gbpInr > 0 ? actGain     / gbpInr : 0
  const totalActualGbp = gbpInr > 0 ? totalActual / gbpInr : 0
  const fmtGbp = (v: number) => `£${Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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
      <div className="bg-surface border border-border rounded-2xl p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <div className="text-[10px] font-bold text-textmut uppercase tracking-widest mb-1">Total Value</div>
          <div className="text-xl font-extrabold text-textprim font-mono">{anyLoading ? '…' : INR(totalVal)}</div>
          <div className="text-[10px] text-textmut font-mono mt-0.5">{anyLoading ? '' : fmtGbp(totalValGbp)}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-textmut uppercase tracking-widest mb-1">Invested</div>
          <div className="text-xl font-extrabold text-textprim font-mono">{anyLoading ? '…' : INR(totalInv)}</div>
          <div className="text-[10px] text-textmut font-mono mt-0.5">{anyLoading ? '' : fmtGbp(totalInvGbp)}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-textmut uppercase tracking-widest mb-1">Gain / Loss</div>
          <div className={`text-xl font-extrabold font-mono ${totalPos ? 'text-green' : 'text-red'}`}>
            {anyLoading ? '…' : `${totalPos ? '+' : ''}${INR(totalGain)}`}
          </div>
          <div className={`text-[10px] font-bold font-mono mt-0.5 ${totalPos ? 'text-green' : 'text-red'}`}>
            {anyLoading ? '' : `${totalPos ? '+' : ''}${fmtGbp(totalGainGbp)} · ${totalPos ? '+' : ''}${totalGainPct.toFixed(1)}%`}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-textmut uppercase tracking-widest mb-1">Actual Invested</div>
          <div className="text-xl font-extrabold text-textprim font-mono">{anyLoading ? '…' : INR(totalActual)}</div>
          <div className="text-[10px] text-textmut font-mono mt-0.5">{anyLoading ? '' : fmtGbp(totalActualGbp)}</div>
          <div className={`text-[10px] font-bold font-mono mt-0.5 ${actPos ? 'text-green' : 'text-red'}`}>
            {anyLoading ? '' : `${actPos ? '+' : ''}${INR(actGain)}`}
          </div>
          <div className={`text-[10px] font-bold font-mono ${actPos ? 'text-green' : 'text-red'}`}>
            {anyLoading ? '' : `${actPos ? '+' : ''}${fmtGbp(actGainGbp)} · ${actPos ? '+' : ''}${actGainPct.toFixed(1)}%`}
          </div>
        </div>
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
