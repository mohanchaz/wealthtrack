import { useNavigate } from 'react-router-dom'
import { usePortfolioTotals } from '../../hooks/usePortfolioTotals'
import { INR, calcGain } from '../../lib/utils'

function fmt(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`
  return INR(n)
}

function StatPill({ label, value, sub, color, loading }: {
  label: string; value: string; sub?: string; color: string; loading: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0 shrink-0">
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/50">{label}</span>
      {loading
        ? <div className="h-6 w-20 rounded-lg animate-pulse bg-white/10" />
        : <span className="text-lg font-black font-mono leading-none" style={{ color }}>{value}</span>
      }
      {sub && !loading && <span className="text-[10px]" style={{ color, opacity: 0.7 }}>{sub}</span>}
    </div>
  )
}

interface CardProps {
  icon: string; label: string; sublabel?: string
  invested: number; actual: number; value: number
  count: number; unit: string; live?: boolean
  loading: boolean; color: string; bg: string; path: string; delay?: number
}

function AssetCard({ icon, label, sublabel, invested, actual, value, count, unit, live, loading, color, bg, path, delay = 0 }: CardProps) {
  const navigate = useNavigate()
  const { gain, gainPct, isPositive } = calcGain(value, invested)
  const hasActual = actual !== invested && actual > 0
  const { gainPct: actGainPct, isPositive: actPos } = calcGain(value, actual)

  return (
    <button
      onClick={() => navigate(path)}
      style={{ animationDelay: `${delay}ms` }}
      className="group animate-fade-up w-full h-full text-left rounded-2xl overflow-hidden
                 hover:scale-[1.015] hover:shadow-xl transition-all duration-200 active:scale-[0.98]
                 shadow-sm border border-[#E8E6E1] flex flex-col"
    >
      <div className="p-4 flex flex-col flex-1" style={{ background: bg }}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 shadow-sm"
              style={{ background: `${color}18`, border: `1.5px solid ${color}30` }}>
              {icon}
            </div>
            <div>
              <div className="font-bold text-[#1A1A1A] text-sm leading-tight">{label}</div>
              {sublabel && <div className="text-[10px] text-[#767676] mt-0.5">{sublabel}</div>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {live && <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: color }} />}
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
              style={{ color, background: `${color}12`, borderColor: `${color}25` }}>
              {loading ? '…' : `${count} ${unit}`}
            </span>
          </div>
        </div>

        <div className="mb-2">
          {loading
            ? <div className="h-7 w-28 rounded-lg animate-pulse bg-black/8" />
            : <div className="text-2xl font-black text-[#1A1A1A] font-mono leading-none">{fmt(value)}</div>
          }
        </div>

        {!loading && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#767676]">
              inv <span className="font-semibold text-[#1A1A1A]">{fmt(invested)}</span>
            </span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
            }`}>
              {isPositive ? '+' : ''}{fmt(Math.abs(gain))} ({isPositive ? '+' : ''}{gainPct.toFixed(1)}%)
            </span>
          </div>
        )}

        {!loading && hasActual && (
          <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-black/5">
            <span className="text-[10px] text-[#767676]">
              actual <span className="font-semibold text-[#1A1A1A]">{fmt(actual)}</span>
            </span>
            <span className={`text-[10px] font-bold ${actPos ? 'text-green-700' : 'text-red-600'}`}>
              {actPos ? '+' : ''}{actGainPct.toFixed(1)}% actual
            </span>
          </div>
        )}

        {!loading && (
          <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: `${color}20` }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(Math.abs(gainPct), 100)}%`, background: isPositive ? color : '#EF4444' }} />
          </div>
        )}

        <div className="mt-auto pt-2.5 flex items-center gap-1 text-[10px] font-semibold transition-opacity opacity-40 group-hover:opacity-70"
          style={{ color }}>
          <span>View details</span>
          <span className="group-hover:translate-x-0.5 transition-transform">→</span>
        </div>
      </div>
    </button>
  )
}

function SectionHeader({ label, invested, value, loading, color }: {
  label: string; invested: number; value: number; loading: boolean; color: string
}) {
  const { gainPct, isPositive } = calcGain(value, invested)
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full" style={{ background: color }} />
        <h2 className="text-[13px] font-bold text-[#1A1A1A]">{label}</h2>
      </div>
      {!loading && invested > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#767676]">{fmt(value)}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
          }`}>
            {isPositive ? '+' : ''}{gainPct.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  )
}

export default function AssetsOverviewPage() {
  const navigate = useNavigate()
  const p = usePortfolioTotals()
  const anyLive = !p.nFetching && !p.yFetching && Object.keys(p.nsePrices).length > 0
  const { gain: totalGain, gainPct: totalGainPct, isPositive: totalPos } = calcGain(p.totalVal, p.totalInv)
  const { gain: actualGain, gainPct: actualGainPct, isPositive: actualPos } = calcGain(p.totalVal, p.totalActual)

  return (
    <div className="pb-8">

      {/* PAGE HEADER */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-black text-[#1A1A1A] tracking-tight">Portfolio Overview</h1>
          <p className="text-[11px] text-[#767676] mt-0.5">All assets across brokers and asset classes</p>
        </div>
        <div className={`flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-xl border ${
          p.nFetching || p.yFetching ? 'text-amber-600 bg-amber-50 border-amber-200'
          : anyLive ? 'text-green-700 bg-green-50 border-green-200'
          : 'text-[#767676] bg-[#F5F4F0] border-[#E0DDD6]'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            p.nFetching || p.yFetching ? 'bg-amber-400 animate-pulse'
            : anyLive ? 'bg-green-500 animate-pulse-dot'
            : 'bg-[#ABABAB]'
          }`} />
          <span className="hidden sm:inline">
            {p.nFetching || p.yFetching ? 'Loading…' : anyLive ? 'Live prices' : 'Prices unavailable'}
          </span>
        </div>
      </div>

      {/* HERO BANNER */}
      <div className="rounded-2xl overflow-hidden mb-5 shadow-sm"
        style={{ background: 'linear-gradient(135deg, #0D4F4A 0%, #0F766E 50%, #0891B2 100%)' }}>
        <div className="p-5">
          <div className="mb-4">
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/50 mb-1">NET WORTH</p>
            {p.anyLoading
              ? <div className="h-10 w-40 rounded-xl bg-white/10 animate-pulse" />
              : <div className="flex items-end gap-3 flex-wrap">
                  <span className="text-4xl font-black text-white font-mono leading-none">{fmt(p.totalVal)}</span>
                  <span className={`text-base font-bold font-mono mb-0.5 ${totalPos ? 'text-teal-200' : 'text-red-300'}`}>
                    {totalPos ? '+' : ''}{fmt(totalGain)}
                  </span>
                </div>
            }
          </div>
          <div className="flex gap-5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <StatPill label="Invested"   value={fmt(p.totalInv)} color="rgba(255,255,255,0.9)" loading={p.anyLoading} />
            <div className="w-px bg-white/15 shrink-0" />
            <StatPill label="Book gain"
              value={`${totalPos?'+':''}${fmt(totalGain)}`}
              sub={`${totalPos?'+':''}${totalGainPct.toFixed(1)}%`}
              color={totalPos ? '#6EE7B7' : '#FCA5A5'} loading={p.anyLoading} />
            {p.totalActual > 0 && <>
              <div className="w-px bg-white/15 shrink-0" />
              <StatPill label="Actual inv" value={fmt(p.totalActual)} color="rgba(255,255,255,0.8)" loading={p.anyLoading} />
              <div className="w-px bg-white/15 shrink-0" />
              <StatPill label="Actual gain"
                value={`${actualPos?'+':''}${fmt(actualGain)}`}
                sub={`${actualPos?'+':''}${actualGainPct.toFixed(1)}%`}
                color={actualPos ? '#6EE7B7' : '#FCA5A5'} loading={p.anyLoading} />
            </>}
            <div className="w-px bg-white/15 shrink-0" />
            <StatPill label="FX rate" value={`₹${p.gbpInr.toFixed(0)}/£`} color="rgba(255,255,255,0.7)" loading={p.anyLoading} />
          </div>
        </div>
        {!p.anyLoading && p.totalVal > 0 && (
          <div className="flex h-2 w-full">
            {p.allocationBuckets.filter(b => b.val > 0).map(b => (
              <div key={b.key}
                style={{ width: `${(b.val / p.totalVal) * 100}%`, background: b.color }}
                className="transition-all duration-700" />
            ))}
          </div>
        )}
      </div>

      {/* EQUITY & MUTUAL FUNDS */}
      <section className="mb-6">
        <SectionHeader label="Equity & Mutual Funds"
          invested={p.zerodhaTotalInv + p.aionionTotalInv + p.amcMfInv}
          value={p.zerodhaTotalVal + p.aionionTotalVal + p.amcMfVal}
          color="#0F766E" loading={p.anyLoading} />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
          <AssetCard icon="📈" label="Zerodha Stocks" sublabel="NSE · Live prices"
            invested={p.zStocksInv} actual={p.actZStocksAmt ?? p.zStocksInv} value={p.zStocksVal}
            count={p.zStocks.filter(r => Number(r.qty) > 0).length} unit="stocks"
            live={Object.keys(p.nsePrices).length > 0} loading={p.anyLoading}
            color="#0F766E" bg="#FFFFFF" path="/assets/zerodha-stocks" delay={0} />
          <AssetCard icon="◈" label="Zerodha MF" sublabel="BSE NAV · Live"
            invested={p.zMfInv} actual={p.actZMfAmt ?? p.zMfInv} value={p.zMfVal}
            count={p.zMfs.filter(r => Number(r.qty) > 0).length} unit="funds"
            live={Object.keys(p.yahooPrices).length > 0} loading={p.anyLoading}
            color="#2563EB" bg="#FFFFFF" path="/assets/mutual-funds" delay={50} />
          <AssetCard icon="⬡" label="Zerodha Gold" sublabel="ETF / MF"
            invested={p.zGoldInv} actual={p.actZGoldAmt ?? p.zGoldInv} value={p.zGoldVal}
            count={p.zGold.filter(r => Number(r.qty) > 0).length} unit="holdings"
            live={Object.keys(p.yahooPrices).length > 0} loading={p.anyLoading}
            color="#D97706" bg="#FFFFFF" path="/assets/gold" delay={100} />
          <AssetCard icon="📊" label="Aionion Stocks" sublabel="NSE · Live"
            invested={p.aiStocksInv} actual={p.actAiStocksAmt ?? p.aiStocksInv} value={p.aiStocksVal}
            count={p.aiStocks.filter(r => Number(r.qty) > 0).length} unit="stocks"
            live={Object.keys(p.nsePrices).length > 0} loading={p.anyLoading}
            color="#7C3AED" bg="#FFFFFF" path="/assets/aionion-stocks" delay={150} />
          <AssetCard icon="◎" label="Aionion Gold" sublabel="SGB / Gold MF"
            invested={p.aiGoldInv} actual={p.actAiGoldAmt ?? p.aiGoldInv} value={p.aiGoldVal}
            count={p.aiGold.filter(r => Number(r.qty) > 0).length} unit="holdings"
            loading={p.anyLoading}
            color="#F59E0B" bg="#FFFFFF" path="/assets/aionion-gold" delay={200} />
          <AssetCard icon="◆" label="AMC Mutual Funds" sublabel="Direct · Live NAV"
            invested={p.amcMfInv} actual={p.actAmcMfAmt ?? p.amcMfInv} value={p.amcMfVal}
            count={p.amcMf.filter(r => Number(r.qty) > 0).length} unit="funds"
            live={Object.keys(p.yahooPrices).length > 0} loading={p.anyLoading}
            color="#DB2777" bg="#FFFFFF" path="/assets/amc-mf" delay={250} />
        </div>
      </section>

      {/* FIXED INCOME */}
      <section className="mb-6">
        <SectionHeader label="Fixed Income & Savings"
          invested={p.cashInv + p.fdInv + p.efInv + p.bondsInv}
          value={p.cashVal + p.fdVal + p.efVal + p.bondsVal}
          color="#059669" loading={p.anyLoading} />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 items-stretch">
          <AssetCard icon="💰" label="Cash" sublabel="Savings / Wallets"
            invested={p.cashInv} actual={p.cashActual} value={p.cashVal}
            count={p.cash.length} unit="accounts" loading={p.anyLoading}
            color="#059669" bg="#FFFFFF" path="/assets/cash" delay={0} />
          <AssetCard icon="🏦" label="Fixed Deposits" sublabel="Bank / NBFC"
            invested={p.fdInv} actual={p.actFdAmt ?? p.fdInv} value={p.fdVal}
            count={p.fds.length} unit="FDs" loading={p.anyLoading}
            color="#0891B2" bg="#FFFFFF" path="/assets/fd" delay={50} />
          <AssetCard icon="🛡" label="Emergency Fund" sublabel="Liquid safety net"
            invested={p.efInv} actual={p.actEfAmt ?? p.efInv} value={p.efVal}
            count={p.ef.length} unit="entries" loading={p.anyLoading}
            color="#6366F1" bg="#FFFFFF" path="/assets/ef" delay={100} />
          <AssetCard icon="📜" label="Bonds" sublabel="G-Sec / NCD / SGB"
            invested={p.bondsInv} actual={p.bondsActual} value={p.bondsVal}
            count={p.bonds.length} unit="bonds" loading={p.anyLoading}
            color="#B45309" bg="#FFFFFF" path="/assets/bonds" delay={150} />
        </div>
      </section>

      {/* FOREIGN & CRYPTO */}
      <section className="mb-6">
        <SectionHeader label="Foreign & Crypto"
          invested={p.foreignInv + p.cryptoInv + p.bankInv}
          value={p.foreignVal + p.cryptoVal + p.bankVal}
          color="#0891B2" loading={p.anyLoading} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
          <AssetCard icon="🌐" label="Foreign Stocks" sublabel="USD / GBP · Live"
            invested={p.foreignInv} actual={p.actForeignAmt ?? p.foreignInv} value={p.foreignVal}
            count={p.foreign.filter(r => Number(r.qty) > 0).length} unit="stocks"
            live={Object.keys(p.yahooPrices).length > 0} loading={p.anyLoading}
            color="#0891B2" bg="#FFFFFF" path="/assets/foreign" delay={0} />
          <AssetCard icon="₿" label="Crypto" sublabel="GBP pairs · Live"
            invested={p.cryptoInv} actual={p.actCryptoAmt ?? p.cryptoInv} value={p.cryptoVal}
            count={p.crypto.filter(r => Number(r.qty) > 0).length} unit="coins"
            live={Object.keys(p.yahooPrices).length > 0} loading={p.anyLoading}
            color="#EA580C" bg="#FFFFFF" path="/assets/crypto" delay={50} />
          <AssetCard icon="🏦" label="Bank Savings" sublabel="GBP · UK Accounts"
            invested={p.bankInv} actual={p.actBankAmt ?? p.bankInv} value={p.bankVal}
            count={p.bankSav.length} unit="accounts" loading={p.anyLoading}
            color="#9333EA" bg="#FFFFFF" path="/assets/bank-savings" delay={100} />
        </div>
      </section>

      {/* QUICK NAVIGATE */}
      <section>
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#767676] mb-2.5">Quick Navigate</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Zerodha', path: '/assets/zerodha', color: '#0F766E' },
            { label: 'Aionion', path: '/assets/aionion', color: '#7C3AED' },
            { label: 'MF (Zerodha)', path: '/assets/mutual-funds', color: '#2563EB' },
            { label: 'MF (AMC)', path: '/assets/amc-mf', color: '#DB2777' },
            { label: 'Gold', path: '/assets/gold', color: '#D97706' },
            { label: 'Cash', path: '/assets/cash', color: '#059669' },
            { label: 'FD', path: '/assets/fd', color: '#0891B2' },
            { label: 'Emergency Fund', path: '/assets/ef', color: '#6366F1' },
            { label: 'Bonds', path: '/assets/bonds', color: '#B45309' },
            { label: 'Foreign', path: '/assets/foreign', color: '#0891B2' },
            { label: 'Crypto', path: '/assets/crypto', color: '#EA580C' },
            { label: 'Bank Savings', path: '/assets/bank-savings', color: '#9333EA' },
          ].map(l => (
            <button key={l.path} onClick={() => navigate(l.path)}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-xl border transition-all hover:scale-105 active:scale-95"
              style={{ color: l.color, background: `${l.color}10`, borderColor: `${l.color}30` }}>
              {l.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
