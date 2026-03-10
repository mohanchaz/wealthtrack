import { useMemo, useState } from 'react'
import { useNavigate }        from 'react-router-dom'
import { useAssets }          from '../../hooks/useAssets'
import { useNsePrices, useYahooPrices } from '../../hooks/useLivePrices'
import { PageShell }          from '../../components/common/PageShell'
import { useActualInvested }  from '../../hooks/useActualInvested'
import { INR, calcGain }      from '../../lib/utils'
import { ZerodhaImportModal } from '../../components/common/ZerodhaImportModal'
import type { StockHolding, MfHolding, GoldHolding } from '../../types/assets'

function SectionCard({ icon, label, sublabel, accent, accentBg, invested, value, actual, count, unit, live, loading, path }: {
  icon: string; label: string; sublabel: string; accent: string; accentBg: string
  invested: number; value: number; actual?: number; count: number; unit: string
  live: boolean; loading: boolean; path: string
}) {
  const navigate = useNavigate()
  const { gain, gainPct, isPositive } = calcGain(value, invested)
  const actCalc = actual != null ? calcGain(value, actual) : null
  return (
    <button onClick={() => navigate(path)}
      className="w-full text-left bg-surface border border-border border-t-[3px] rounded-2xl hover:border-ink/30 hover:shadow-card transition-all group"
      style={{ borderTopColor: accent }}>
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: accentBg }}>{icon}</div>
            <div>
              <div className="font-bold text-sm text-textprim group-hover:text-ink transition-colors">{label}</div>
              <div className="text-[10px] text-textmut mt-0.5 flex items-center gap-1.5">
                {live && <span className="w-1.5 h-1.5 rounded-full bg-green inline-block animate-pulse" />}
                {sublabel}<span className="text-textfade">· {count} {unit}</span>
              </div>
            </div>
          </div>
          <span className="text-textfade group-hover:text-textmut transition-colors text-base">→</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-textmut uppercase tracking-wider font-semibold">Invested</span>
            <span className="text-xs font-bold text-textprim">{loading ? '…' : INR(invested)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-textmut uppercase tracking-wider font-semibold">
              {live ? <span className="text-green">● Live</span> : 'Cur. Value'}
            </span>
            <span className={`text-xs font-bold ${!loading ? (isPositive ? 'text-green' : 'text-red') : 'text-textprim'}`}>{loading ? '…' : INR(value)}</span>
          </div>
          {actual != null && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-textmut uppercase tracking-wider font-semibold">Actual Inv</span>
              <span className="text-xs font-bold text-textprim">{loading ? '…' : INR(actual)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border">
          {!loading && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPositive ? 'bg-green/10 text-green' : 'text-red bg-red/10'}`}>{isPositive ? '+' : ''}{gainPct.toFixed(1)}%</span>}
          {actCalc && !loading && <span className={`text-[10px] font-semibold ${actCalc.isPositive ? 'text-green' : 'text-red'}`}>Actual {actCalc.isPositive ? '+' : ''}{actCalc.gainPct.toFixed(1)}%</span>}
        </div>
      </div>
    </button>
  )
}

export default function ZerodhaOverviewPage() {
  const [importing, setImporting] = useState(false)
  const navigate = useNavigate()

  const { data: stocks = [], isLoading: l1 } = useAssets<StockHolding>('zerodha_stocks')
  const { data: mfs    = [], isLoading: l2 } = useAssets<MfHolding>('mf_holdings')
  const { data: gold   = [], isLoading: l3 } = useAssets<GoldHolding>('gold_holdings')

  const instruments = useMemo(() => stocks.map(r => r.instrument), [stocks])
  const { data: stockPrices = {}, isFetching: sf } = useNsePrices(instruments)
  const mfSymbols = useMemo(() => [...new Set(mfs.map(r => r.nav_symbol).filter(Boolean) as string[])], [mfs])
  const { data: mfPrices = {}, isFetching: mf } = useYahooPrices(mfSymbols)
  const goldSymbols = useMemo(() => [...new Set(gold.map(r => r.yahoo_symbol).filter(Boolean) as string[])], [gold])
  const { data: goldPrices = {}, isFetching: gf } = useYahooPrices(goldSymbols)

  const stocksActual = useActualInvested('zerodha_actual_invested')
  const mfsActual    = useActualInvested('mf_actual_invested')
  const stocksActualTotal = stocksActual.data?.reduce((s, e) => s + e.amount, 0)
  const mfsActualTotal    = mfsActual.data?.reduce((s, e) => s + e.amount, 0)

  const stocksInv = useMemo(() => stocks.reduce((s, r) => s + r.qty * r.avg_cost, 0), [stocks])
  const stocksVal = useMemo(() => stocks.reduce((s, r) => {
    const p = stockPrices[r.instrument]?.price ?? null
    return s + (p != null ? r.qty * p : r.qty * r.avg_cost)
  }, 0), [stocks, stockPrices])

  const mfsInv = useMemo(() => mfs.reduce((s, r) => s + r.qty * r.avg_cost, 0), [mfs])
  const mfsVal = useMemo(() => mfs.reduce((s, r) => {
    const sym = r.nav_symbol?.replace(/\.(BO|NS)$/, '')
    const nav = sym ? (mfPrices[sym]?.price ?? mfPrices[r.nav_symbol!]?.price ?? null) : null
    return s + (nav != null ? r.qty * nav : r.qty * r.avg_cost)
  }, 0), [mfs, mfPrices])

  const goldInv = useMemo(() => gold.reduce((s, r) => s + r.qty * r.avg_cost, 0), [gold])
  const goldVal = useMemo(() => gold.reduce((s, r) => {
    const ltp = r.yahoo_symbol ? (goldPrices[r.yahoo_symbol.replace(/\.(NS|BO)$/, '')]?.price ?? null) : null
    return s + (ltp != null ? r.qty * ltp : r.qty * r.avg_cost)
  }, 0), [gold, goldPrices])

  const totalInv = stocksInv + mfsInv + goldInv
  const totalVal = stocksVal + mfsVal + goldVal
  const anyLoading = l1 || l2 || l3
  const { gain: totalGain, gainPct: totalGainPct, isPositive: totalPos } = calcGain(totalVal, totalInv)

  const hasActual = (stocksActualTotal ?? 0) > 0 || (mfsActualTotal ?? 0) > 0
  const totalActual = (stocksActualTotal ?? stocksInv) + (mfsActualTotal ?? mfsInv) + goldInv
  const { gain: actGain, gainPct: actGainPct, isPositive: actPos } = calcGain(totalVal, totalActual)

  const liveTag = (sf || mf || gf) ? '🔄 Fetching…'
    : Object.keys(stockPrices).length > 0 ? `🟢 Live · ${new Date().toLocaleTimeString('en-IN')}` : undefined

  return (
    <PageShell title="Zerodha" subtitle="Overview of all Zerodha holdings"
      actions={[{ label: 'Import from Zerodha', onClick: () => setImporting(true) }]}>

      <div className={`bg-surface border border-border rounded-2xl p-4 mb-4 grid grid-cols-2 gap-4 ${hasActual ? 'sm:grid-cols-5' : 'sm:grid-cols-3'}`}>
        <div>
          <div className="text-[10px] font-bold text-textmut uppercase tracking-widest mb-1">Total Value</div>
          <div className="text-xl font-extrabold text-textprim font-mono">{anyLoading ? '…' : INR(totalVal)}</div>
          <div className="text-[10px] text-textmut mt-0.5">{liveTag ?? 'Across 3 asset types'}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-textmut uppercase tracking-widest mb-1">Invested</div>
          <div className="text-xl font-extrabold text-textprim font-mono">{anyLoading ? '…' : INR(totalInv)}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-textmut uppercase tracking-widest mb-1">Gain / Loss</div>
          <div className={`text-xl font-extrabold font-mono ${totalPos ? 'text-green' : 'text-red'}`}>{anyLoading ? '…' : `${totalPos ? '+' : ''}${INR(totalGain)}`}</div>
          <div className={`text-[10px] font-bold font-mono mt-0.5 ${totalPos ? 'text-green' : 'text-red'}`}>{anyLoading ? '' : `${totalPos ? '+' : ''}${totalGainPct.toFixed(1)}%`}</div>
        </div>
        {hasActual && <>
          <div>
            <div className="text-[10px] font-bold text-textmut uppercase tracking-widest mb-1">Actual Invested</div>
            <div className="text-xl font-extrabold text-textprim font-mono">{anyLoading ? '…' : INR(totalActual)}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-textmut uppercase tracking-widest mb-1">Actual Gain</div>
            <div className={`text-xl font-extrabold font-mono ${actPos ? 'text-green' : 'text-red'}`}>{anyLoading ? '…' : `${actPos ? '+' : ''}${INR(actGain)}`}</div>
            <div className={`text-[10px] font-bold font-mono mt-0.5 ${actPos ? 'text-green' : 'text-red'}`}>{anyLoading ? '' : `${actPos ? '+' : ''}${actGainPct.toFixed(1)}%`}</div>
          </div>
        </>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SectionCard icon="📈" label="Stocks" sublabel="NSE / BSE" accent="#1A1A1A" accentBg="#F8F8F6"
          invested={stocksInv} value={stocksVal} actual={stocksActualTotal}
          count={stocks.filter(r => r.qty > 0).length} unit="stocks"
          live={Object.keys(stockPrices).length > 0} loading={l1} path="/assets/zerodha-stocks" />
        <SectionCard icon="📊" label="Mutual Funds" sublabel="NAV prices" accent="#1A1A1A" accentBg="#F8F8F6"
          invested={mfsInv} value={mfsVal} actual={mfsActualTotal}
          count={mfs.filter(r => r.qty > 0).length} unit="funds"
          live={Object.keys(mfPrices).length > 0} loading={l2} path="/assets/mutual-funds" />
        <SectionCard icon="🥇" label="Gold" sublabel="Sovereign / ETF" accent="#1A1A1A" accentBg="#FFFBEB"
          invested={goldInv} value={goldVal}
          count={gold.filter(r => r.qty > 0).length} unit="holdings"
          live={Object.keys(goldPrices).length > 0} loading={l3} path="/assets/gold" />
      </div>

      {importing && <ZerodhaImportModal onClose={() => setImporting(false)} />}
    </PageShell>
  )
}
