import { useNavigate } from 'react-router-dom'
import { usePortfolioTotals } from '../../hooks/usePortfolioTotals'
import { INR, calcGain } from '../../lib/utils'

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

interface CardProps {
  icon: string; label: string; sublabel?: string
  invested: number; actual: number; value: number
  count: number; unit: string; live?: boolean
  loading: boolean; accent: string; path: string; delay?: number
}

function AssetCard({ icon, label, sublabel, invested, actual, value, count, unit, live, loading, accent, path, delay = 0 }: CardProps) {
  const navigate = useNavigate()
  const { gain, gainPct, isPositive } = calcGain(value, invested)
  const { gainPct: actGainPct, isPositive: actPos } = calcGain(value, actual)

  return (
    <button
      onClick={() => navigate(path)}
      style={{ animationDelay: `${delay}ms` }}
      className="group animate-fade-up w-full text-left bg-surface border border-border rounded-2xl p-5
                 hover:border-ink/20 hover:shadow-cardHov transition-all duration-200 active:scale-[0.99]"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
            style={{ background: `${accent}12`, border: `1px solid ${accent}20` }}>
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
      <div className="mb-1">
        <div className="text-[10px] text-textmut uppercase tracking-wider mb-0.5">Current Value</div>
        <div className="font-bold text-xl text-textprim">
          {loading ? <span className="h-6 w-32 bg-border/60 rounded-md inline-block animate-pulse" /> : INR(value)}
        </div>
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="text-[10px] text-textmut">
          Invested <span className="text-textsec font-medium">{loading ? '…' : INR(invested)}</span>
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
      <div className="mt-3 flex items-center gap-1 text-[10px] text-textfade group-hover:text-textmut transition-colors">
        <span>View details</span>
        <span className="group-hover:translate-x-0.5 transition-transform">→</span>
      </div>
    </button>
  )
}

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

function AllocationRing({ slices }: { slices: { label: string; pct: number; color: string }[] }) {
  let cumulative = 0
  const segments = slices.map(s => { const start = cumulative; cumulative += s.pct; return { ...s, start } })
  const r = 54, cx = 64, cy = 64, stroke = 18
  const circumference = 2 * Math.PI * r
  return (
    <svg width="128" height="128" viewBox="0 0 128 128" className="rotate-[-90deg]">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E0DDD6" strokeWidth={stroke} />
      {segments.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none"
          stroke={s.color} strokeWidth={stroke}
          strokeDasharray={`${(s.pct / 100) * circumference} ${circumference}`}
          strokeDashoffset={-((s.start / 100) * circumference)}
          strokeLinecap="butt" />
      ))}
    </svg>
  )
}

export default function AssetsOverviewPage() {
  const navigate = useNavigate()
  const p = usePortfolioTotals()

  const anyLive = !p.nFetching && !p.yFetching && Object.keys(p.nsePrices).length > 0

  const allocationData = [
    { label: 'Zerodha',   value: p.zerodhaTotalVal, color: '#1A7A3C' },
    { label: 'Aionion',   value: p.aionionTotalVal, color: '#0891b2' },
    { label: 'AMC MF',    value: p.amcMfVal,        color: '#7C3AED' },
    { label: 'Cash',      value: p.cashVal,         color: '#D97706' },
    { label: 'FD',        value: p.fdVal,           color: '#B45309' },
    { label: 'EF',        value: p.efVal,           color: '#059669' },
    { label: 'Bonds',     value: p.bondsVal,        color: '#6366F1' },
    { label: 'Foreign',   value: p.foreignVal,      color: '#DB2777' },
    { label: 'Crypto',    value: p.cryptoVal,       color: '#F59E0B' },
  ].filter(s => s.value > 0)
  const totalForAlloc = allocationData.reduce((s, d) => s + d.value, 0)
  const allocSlices   = allocationData.map(d => ({ ...d, pct: totalForAlloc > 0 ? (d.value / totalForAlloc) * 100 : 0 }))

  const { gain: totalGain, gainPct: totalGainPct, isPositive: totalPos } = calcGain(p.totalVal, p.totalInv)
  const { gain: actualGain, gainPct: actualGainPct, isPositive: actualPos } = calcGain(p.totalVal, p.totalActual)

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* PAGE HEADER */}
        <div className="animate-fade-up mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-ink tracking-tight">Portfolio Overview</h1>
              <p className="text-sm text-textmut mt-0.5">All assets across brokers and asset classes</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-textmut bg-surface border border-border rounded-xl px-3 py-2">
              {p.nFetching || p.yFetching
                ? <><span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" /><span>Fetching live prices…</span></>
                : anyLive
                  ? <><span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse-dot" /><span>Live · {new Date().toLocaleTimeString('en-IN')}</span></>
                  : <><span className="w-1.5 h-1.5 rounded-full bg-textfade" /><span>Prices unavailable</span></>
              }
            </div>
          </div>
        </div>

        {/* HERO BANNER */}
        <div className="animate-fade-up rounded-2xl p-6 mb-8 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #EDEBE8 0%, #E6E4E0 100%)', border: '1px solid #C8C4BE' }}>
          <div className="relative grid grid-cols-2 md:grid-cols-5 gap-6">
            <HeroStat label="Total Portfolio" value={INR(p.totalVal)} loading={p.anyLoading} />
            <HeroStat label="Total Invested"  value={INR(p.totalInv)} loading={p.anyLoading} />
            <div>
              <div className="text-[10px] text-textmut uppercase tracking-widest mb-1">Gain (Avg Cost)</div>
              {p.anyLoading
                ? <div className="h-9 w-32 bg-border/60 rounded-lg animate-pulse" />
                : <div>
                    <div className={`font-bold text-3xl tracking-tight ${totalPos ? 'text-green' : 'text-red'}`}>
                      {totalPos ? '+' : ''}{INR(totalGain)}
                    </div>
                    <div className={`text-sm font-semibold mt-0.5 ${totalPos ? 'text-green/70' : 'text-red/70'}`}>
                      {totalPos ? '+' : ''}{totalGainPct.toFixed(2)}%
                    </div>
                  </div>
              }
            </div>
            <div>
              <div className="text-[10px] text-textmut uppercase tracking-widest mb-1">Gain (Actual)</div>
              {p.anyLoading
                ? <div className="h-9 w-32 bg-border/60 rounded-lg animate-pulse" />
                : <div>
                    <div className="text-[10px] text-textmut mb-1">Actual <span className="text-textsec font-mono">{INR(p.totalActual)}</span></div>
                    <div className={`font-bold text-2xl tracking-tight ${actualPos ? 'text-green' : 'text-red'}`}>
                      {actualPos ? '+' : ''}{INR(actualGain)}
                    </div>
                    <div className={`text-sm font-semibold mt-0.5 ${actualPos ? 'text-green/70' : 'text-red/70'}`}>
                      {actualPos ? '+' : ''}{actualGainPct.toFixed(2)}%
                    </div>
                  </div>
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
                      <span className="text-[9px] text-textmut">{s.label}</span>
                      <span className="text-[9px] text-textsec font-mono ml-auto">{s.pct.toFixed(0)}%</span>
                    </div>
                  ))}
                  {allocSlices.length > 4 && <div className="text-[9px] text-textfade">+{allocSlices.length - 4} more</div>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* EQUITY GROUP */}
        <section className="mb-8">
          <GroupHeader label="Equity & Mutual Funds"
            invested={p.zerodhaTotalInv + p.aionionTotalInv + p.amcMfInv}
            value={p.zerodhaTotalVal + p.aionionTotalVal + p.amcMfVal} loading={p.anyLoading} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <AssetCard icon="📈" label="Zerodha Stocks" sublabel="NSE · Live" invested={p.zStocksInv} actual={p.actZStocksAmt ?? p.zStocksInv} value={p.zStocksVal} count={p.zStocks.filter(r => Number(r.qty) > 0).length} unit="stocks" live={Object.keys(p.nsePrices).length > 0} loading={p.anyLoading} accent="#1A7A3C" path="/assets/zerodha-stocks" delay={0} />
            <AssetCard icon="◈" label="Zerodha MF" sublabel="BSE NAV · Live" invested={p.zMfInv} actual={p.actZMfAmt ?? p.zMfInv} value={p.zMfVal} count={p.zMfs.filter(r => Number(r.qty) > 0).length} unit="funds" live={Object.keys(p.yahooPrices).length > 0} loading={p.anyLoading} accent="#0891b2" path="/assets/mutual-funds" delay={60} />
            <AssetCard icon="⬡" label="Zerodha Gold" sublabel="ETF / MF" invested={p.zGoldInv} actual={p.actZGoldAmt ?? p.zGoldInv} value={p.zGoldVal} count={p.zGold.filter(r => Number(r.qty) > 0).length} unit="holdings" live={Object.keys(p.yahooPrices).length > 0} loading={p.anyLoading} accent="#D97706" path="/assets/gold" delay={120} />
            <AssetCard icon="📊" label="Aionion Stocks" sublabel="NSE · Live" invested={p.aiStocksInv} actual={p.actAiStocksAmt ?? p.aiStocksInv} value={p.aiStocksVal} count={p.aiStocks.filter(r => Number(r.qty) > 0).length} unit="stocks" live={Object.keys(p.nsePrices).length > 0} loading={p.anyLoading} accent="#7C3AED" path="/assets/aionion-stocks" delay={180} />
            <AssetCard icon="◎" label="Aionion Gold" sublabel="SGB / Gold" invested={p.aiGoldInv} actual={p.actAiGoldAmt ?? p.aiGoldInv} value={p.aiGoldVal} count={p.aiGold.filter(r => Number(r.qty) > 0).length} unit="holdings" loading={p.anyLoading} accent="#F59E0B" path="/assets/aionion-gold" delay={240} />
            <AssetCard icon="◆" label="AMC Mutual Funds" sublabel="Direct · Live NAV" invested={p.amcMfInv} actual={p.actAmcMfAmt ?? p.amcMfInv} value={p.amcMfVal} count={p.amcMf.filter(r => Number(r.qty) > 0).length} unit="funds" live={Object.keys(p.yahooPrices).length > 0} loading={p.anyLoading} accent="#DB2777" path="/assets/amc-mf" delay={300} />
          </div>
        </section>

        {/* FIXED INCOME GROUP */}
        <section className="mb-8">
          <GroupHeader label="Fixed Income & Savings"
            invested={p.cashInv + p.fdInv + p.efInv + p.bondsInv}
            value={p.cashVal + p.fdVal + p.efVal + p.bondsVal} loading={p.anyLoading} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <AssetCard icon="💰" label="Cash" sublabel="Savings / Wallets" invested={p.cashInv} actual={p.cashActual} value={p.cashVal} count={p.cash.length} unit="accounts" loading={p.anyLoading} accent="#059669" path="/assets/cash" delay={0} />
            <AssetCard icon="🏦" label="Fixed Deposits" sublabel="Bank / NBFC" invested={p.fdInv} actual={p.actFdAmt ?? p.fdInv} value={p.fdVal} count={p.fds.length} unit="FDs" loading={p.anyLoading} accent="#0891b2" path="/assets/fd" delay={60} />
            <AssetCard icon="🛡" label="Emergency Fund" sublabel="Liquid safety net" invested={p.efInv} actual={p.actEfAmt ?? p.efInv} value={p.efVal} count={p.ef.length} unit="entries" loading={p.anyLoading} accent="#6366F1" path="/assets/ef" delay={120} />
            <AssetCard icon="📜" label="Bonds" sublabel="G-Sec / NCD / SGB" invested={p.bondsInv} actual={p.bondsActual} value={p.bondsVal} count={p.bonds.length} unit="bonds" loading={p.anyLoading} accent="#B45309" path="/assets/bonds" delay={180} />
          </div>
        </section>

        {/* GLOBAL GROUP */}
        <section className="mb-8">
          <GroupHeader label="Foreign Assets"
            invested={p.foreignInv + p.cryptoInv + p.bankInv}
            value={p.foreignVal + p.cryptoVal + p.bankVal} loading={p.anyLoading} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AssetCard icon="🌐" label="Foreign Stocks" sublabel="USD / GBP · Live" invested={p.foreignInv} actual={p.actForeignAmt ?? p.foreignInv} value={p.foreignVal} count={p.foreign.filter(r => Number(r.qty) > 0).length} unit="stocks" live={Object.keys(p.yahooPrices).length > 0} loading={p.anyLoading} accent="#DB2777" path="/assets/foreign" delay={0} />
            <AssetCard icon="₿" label="Crypto" sublabel="GBP pairs · Live" invested={p.cryptoInv} actual={p.actCryptoAmt ?? p.cryptoInv} value={p.cryptoVal} count={p.crypto.filter(r => Number(r.qty) > 0).length} unit="coins" live={Object.keys(p.yahooPrices).length > 0} loading={p.anyLoading} accent="#F59E0B" path="/assets/crypto" delay={60} />
            <AssetCard icon="🏦" label="Bank Savings" sublabel="GBP · UK Accounts" invested={p.bankInv} actual={p.actBankAmt ?? p.bankInv} value={p.bankVal} count={p.bankSav.length} unit="accounts" loading={p.anyLoading} accent="#0EA5E9" path="/assets/bank-savings" delay={90} />
          </div>
        </section>

        {/* QUICK NAVIGATE */}
        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-textmut mb-3">Quick Navigate</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Zerodha', path: '/assets/zerodha' }, { label: 'Aionion', path: '/assets/aionion' },
              { label: 'MF (Zerodha)', path: '/assets/mutual-funds' }, { label: 'MF (AMC)', path: '/assets/amc-mf' },
              { label: 'Gold', path: '/assets/gold' }, { label: 'Cash', path: '/assets/cash' },
              { label: 'FD', path: '/assets/fd' }, { label: 'Emergency Fund', path: '/assets/ef' },
              { label: 'Bonds', path: '/assets/bonds' }, { label: 'Foreign Assets', path: '/assets/foreign' },
              { label: 'Crypto', path: '/assets/crypto' }, { label: 'Bank Savings', path: '/assets/bank-savings' },
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
