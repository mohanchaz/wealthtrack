import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore }   from '../../store/authStore'
import { useAssets }      from '../../hooks/useAssets'
import { useNsePrices, useYahooPrices } from '../../hooks/useLivePrices'
import { PageShell }      from '../../components/common/PageShell'
import { useActualInvested } from '../../hooks/useActualInvested'
import { StatGrid, buildInvestedStats } from '../../components/common/StatGrid'
import { INR, calcGain }  from '../../lib/utils'
import type { StockHolding, MfHolding, GoldHolding } from '../../types/assets'

interface SectionCardProps {
  title:       string
  subtitle:    string
  invested:    number
  value:       number
  actual?:     number
  liveLabel?:  string
  loading:     boolean
  onClick:     () => void
}

function SectionCard({ title, subtitle, invested, value, actual, liveLabel, loading, onClick }: SectionCardProps) {
  const { gain, gainPct, isPositive } = calcGain(value, invested)
  const actGain = actual != null ? calcGain(value, actual) : null
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-surface border border-border rounded-2xl p-5 hover:border-ink/20 hover:shadow-card transition-all group"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="font-bold text-textprim text-base group-hover:text-ink transition-colors">{title}</div>
          <div className="text-xs text-textmut mt-0.5">{subtitle}</div>
        </div>
        <span className="text-textfade group-hover:text-textmut transition-colors text-lg">→</span>
      </div>
      <div className={`grid gap-3 ${actual != null ? 'grid-cols-3 md:grid-cols-5' : 'grid-cols-3'}`}>
        <div>
          <div className="text-[10px] text-textmut uppercase tracking-wider mb-1">Invested</div>
          <div className="font-bold text-textprim text-sm">{loading ? '…' : INR(invested)}</div>
        </div>
        <div>
          <div className="text-[10px] text-textmut uppercase tracking-wider mb-1">
            {liveLabel ? <span className="text-green">● Live</span> : 'Cur. Value'}
          </div>
          <div className={`font-bold text-sm ${!loading ? (value >= invested ? 'text-green' : 'text-red') : 'text-textprim'}`}>{loading ? '…' : INR(value)}</div>
        </div>
        <div>
          <div className="text-[10px] text-textmut uppercase tracking-wider mb-1">Gain / Loss</div>
          <div className={`font-bold text-sm ${isPositive ? 'text-green' : 'text-red'}`}>
            {loading ? '…' : `${isPositive ? '+' : ''}${INR(gain)}`}
            {!loading && <span className="text-[10px] font-medium ml-1 opacity-80">{isPositive ? '+' : ''}{gainPct.toFixed(1)}%</span>}
          </div>
        </div>
        {actual != null && (
          <>
            <div>
              <div className="text-[10px] text-textmut uppercase tracking-wider mb-1">Actual Invested</div>
              <div className="font-bold text-textprim text-sm">{loading ? '…' : INR(actual)}</div>
            </div>
            <div className="hidden md:block">
              <div className="text-[10px] text-textmut uppercase tracking-wider mb-1">Actual Gain</div>
              <div className={`font-bold text-sm ${actGain?.isPositive ? 'text-green' : 'text-red'}`}>
                {loading ? '…' : `${actGain?.isPositive ? '+' : ''}${INR(actGain?.gain ?? 0)}`}
                {!loading && actGain && <span className="text-[10px] font-medium ml-1 opacity-80">{actGain.isPositive ? '+' : ''}{actGain.gainPct.toFixed(1)}%</span>}
              </div>
            </div>
          </>
        )}
      </div>
    </button>
  )
}

export default function ZerodhaOverviewPage() {
  const navigate = useNavigate()
  const userId   = useAuthStore(s => s.user?.id)!

  // Stocks
  const { data: stocks = [], isLoading: stocksLoading } = useAssets<StockHolding>('zerodha_stocks')
  const instruments = useMemo(() => stocks.map(r => r.instrument), [stocks])
  const { data: stockPrices = {}, isFetching: stocksFetching } = useNsePrices(instruments)

  // Mutual Funds
  const { data: mfs = [], isLoading: mfsLoading } = useAssets<MfHolding>('mf_holdings')
  const mfSymbols = useMemo(() => [...new Set(mfs.map(r => r.nav_symbol).filter(Boolean) as string[])], [mfs])
  const { data: mfPrices = {}, isFetching: mfsFetching } = useYahooPrices(mfSymbols)

  // Gold
  const { data: gold = [], isLoading: goldLoading } = useAssets<GoldHolding>('gold_holdings')
  const goldSymbols = useMemo(() => [...new Set(gold.map(r => r.yahoo_symbol).filter(Boolean) as string[])], [gold])
  const { data: goldPrices = {}, isFetching: goldFetching } = useYahooPrices(goldSymbols)

  // Actual invested
  const stocksActual = useActualInvested('zerodha_actual_invested')
  const mfsActual    = useActualInvested('mf_actual_invested')

  // ── Stocks totals ────────────────────────────────────────────
  const stocksInvested = useMemo(() => stocks.reduce((s, r) => s + r.qty * r.avg_cost, 0), [stocks])
  const stocksValue    = useMemo(() => stocks.reduce((s, r) => {
    const ltp = stockPrices[r.instrument]?.price ?? null
    return s + (ltp != null ? r.qty * ltp : r.qty * r.avg_cost)
  }, 0), [stocks, stockPrices])

  // ── MF totals ────────────────────────────────────────────────
  const mfsInvested = useMemo(() => mfs.reduce((s, r) => s + r.qty * r.avg_cost, 0), [mfs])
  const mfsValue    = useMemo(() => mfs.reduce((s, r) => {
    const sym = r.nav_symbol?.replace(/\.(BO|NS)$/, '')
    const nav = sym ? (mfPrices[sym]?.price ?? mfPrices[r.nav_symbol!]?.price ?? null) : null
    return s + (nav != null ? r.qty * nav : r.qty * r.avg_cost)
  }, 0), [mfs, mfPrices])

  // ── Gold totals ──────────────────────────────────────────────
  const goldInvested = useMemo(() => gold.reduce((s, r) => s + r.qty * r.avg_cost, 0), [gold])
  const goldValue    = useMemo(() => gold.reduce((s, r) => {
    const ltp = r.yahoo_symbol ? (goldPrices[r.yahoo_symbol.replace(/\.(NS|BO)$/, '')]?.price ?? null) : null
    return s + (ltp != null ? r.qty * ltp : r.qty * r.avg_cost)
  }, 0), [gold, goldPrices])

  const stocksActualTotal = stocksActual.data?.reduce((s, e) => s + e.amount, 0)
  const mfsActualTotal    = mfsActual.data?.reduce((s, e) => s + e.amount, 0)

  // ── Combined totals ──────────────────────────────────────────
  const totalInvested = stocksInvested + mfsInvested + goldInvested
  const totalValue    = stocksValue + mfsValue + goldValue
  const anyLoading    = stocksLoading || mfsLoading || goldLoading
  const anyFetching   = stocksFetching || mfsFetching || goldFetching
  const liveLabel     = anyFetching ? '🔄 Fetching…'
    : Object.keys(stockPrices).length > 0 ? `🟢 Live · ${new Date().toLocaleTimeString('en-IN')}` : undefined

  const overallStats = buildInvestedStats({
    invested:  totalInvested,
    value:     totalValue,
    loading:   anyLoading,
    liveLabel,
  }).slice(0, 3) // only Invested, Current Value, Gain/Loss — no actual invested here

  return (
    <PageShell title="Zerodha" subtitle="Overview of all Zerodha holdings">
      {/* Overall summary */}
      <StatGrid items={overallStats} cols={3} />

      {/* Section cards */}
      <div className="flex flex-col gap-3 mt-2">
        <SectionCard
          title="Stocks"
          subtitle={`${stocks.length} holding${stocks.length !== 1 ? 's' : ''}`}
          invested={stocksInvested}
          value={stocksValue}
          actual={stocksActualTotal}
          liveLabel={Object.keys(stockPrices).length > 0 ? 'live' : undefined}
          loading={stocksLoading}
          onClick={() => navigate('/assets/zerodha-stocks')}
        />
        <SectionCard
          title="Mutual Funds"
          subtitle={`${mfs.length} fund${mfs.length !== 1 ? 's' : ''}`}
          invested={mfsInvested}
          value={mfsValue}
          actual={mfsActualTotal}
          liveLabel={Object.keys(mfPrices).length > 0 ? 'live' : undefined}
          loading={mfsLoading}
          onClick={() => navigate('/assets/mutual-funds')}
        />
        <SectionCard
          title="Gold"
          subtitle={`${gold.length} holding${gold.length !== 1 ? 's' : ''}`}
          invested={goldInvested}
          value={goldValue}
          liveLabel={Object.keys(goldPrices).length > 0 ? 'live' : undefined}
          loading={goldLoading}
          onClick={() => navigate('/assets/gold')}
        />
      </div>
    </PageShell>
  )
}
