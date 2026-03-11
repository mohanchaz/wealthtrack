import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortfolioTotals } from '../../hooks/usePortfolioTotals'
import { useAllocations } from '../../hooks/useAllocations'
import { useAuthStore } from '../../store/authStore'
import { INR } from '../../lib/utils'

// ── Helpers ────────────────────────────────────────────────────
function fmt(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`
  return INR(n)
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ── Sparkline (pure SVG) ───────────────────────────────────────
function Sparkline({ positive }: { positive: boolean }) {
  const pts = [18,22,19,28,25,31,29,36,34,40,38,44,43,48,52,50,56,54,60,58,65,63,70,72,76,74,80,78,84,88]
  const w = 400, h = 100
  const min = Math.min(...pts), max = Math.max(...pts)
  const range = max - min || 1
  const coords = pts.map((v, i) => ({
    x: (i / (pts.length - 1)) * w,
    y: h - ((v - min) / range) * (h * 0.85) - h * 0.05,
  }))
  const line = coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${line} L${w},${h} L0,${h} Z`
  const color = positive ? '#5EEAD4' : '#FCA5A5'
  const fillId = `sf-${positive ? 'pos' : 'neg'}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${fillId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Donut ──────────────────────────────────────────────────────
function DonutChart({ slices }: { slices: { pct: number; color: string }[] }) {
  const r = 44, cx = 50, cy = 50, stroke = 11
  let cumAngle = -90
  const arcs = slices.filter(s => s.pct > 0.5).map(s => {
    const start = cumAngle; cumAngle += s.pct * 3.6; const end = cumAngle
    const s1 = (start * Math.PI) / 180, e1 = (end * Math.PI) / 180
    const x1 = cx + r * Math.cos(s1), y1 = cy + r * Math.sin(s1)
    const x2 = cx + r * Math.cos(e1), y2 = cy + r * Math.sin(e1)
    return { ...s, d: `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${s.pct*3.6>180?1:0} 1 ${x2.toFixed(2)},${y2.toFixed(2)}` }
  })
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {arcs.map((a, i) => (
        <path key={i} d={a.d} fill="none" stroke={a.color} strokeWidth={stroke} strokeLinecap="butt" opacity="0.9" />
      ))}
    </svg>
  )
}

// ── Metric chip ────────────────────────────────────────────────
function MetricChip({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E0DDD6] p-4 flex flex-col gap-1 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#767676]">{label}</span>
        <span className="w-6 h-6 rounded-lg bg-[#F5F4F0] flex items-center justify-center text-[11px]">{icon}</span>
      </div>
      <div className="text-[22px] font-extrabold font-mono leading-none tracking-tight" style={{ color: color ?? '#1A1A1A' }}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-[#767676] mt-0.5">{sub}</div>}
    </div>
  )
}

// ── Category row ───────────────────────────────────────────────
function CategoryRow({ label, inv, val, color, total, path }: {
  label: string; inv: number; val: number; color: string; total: number; path: string
}) {
  const navigate = useNavigate()
  const pct  = total > 0 ? (val / total) * 100 : 0
  const gain = val - inv
  const isUp = gain >= 0
  return (
    <button onClick={() => navigate(path)}
      className="w-full flex items-center gap-3 py-2.5 px-1 rounded-xl hover:bg-black/[0.03] transition-colors group text-left">
      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="flex-1 text-[13px] font-semibold text-[#1A1A1A] leading-none">{label}</span>
      <div className="text-right">
        <div className="text-[12px] font-bold font-mono text-[#1A1A1A]">{fmt(val)}</div>
        {inv > 0 && <div className={`text-[10px] font-mono mt-0.5 ${isUp ? 'text-[#0F766E]' : 'text-[#C0392B]'}`}>
          {isUp ? '+' : ''}{fmt(gain)}
        </div>}
      </div>
      <div className="w-24 h-1.5 bg-black/[0.06] rounded-full overflow-hidden shrink-0">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
      </div>
      <span className="w-10 text-right text-[11px] font-mono text-[#767676] shrink-0">{pct.toFixed(1)}%</span>
    </button>
  )
}

// ── Nav pill ───────────────────────────────────────────────────
function NavPill({ icon, label, path }: { icon: string; label: string; path: string }) {
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate(path)}
      className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#E0DDD6] hover:border-[#1A1A1A] hover:shadow-sm transition-all group">
      <span className="text-base">{icon}</span>
      <span className="text-[12px] font-semibold text-[#1A1A1A]">{label}</span>
    </button>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function DashboardPage() {
  const user      = useAuthStore(s => s.user)
  const navigate  = useNavigate()
  const firstName = (user?.user_metadata?.full_name ?? user?.email ?? 'there').split(' ')[0]

  // ← Single hook, same React Query keys as AssetsOverviewPage → zero duplicate fetches
  const p = usePortfolioTotals()
  const { data: allocations = [] } = useAllocations()

  const isUp   = p.totalPos
  const date   = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  const donutSlices = useMemo(() =>
    p.categories.map(c => ({
      pct:   p.totalVal > 0 ? (c.val / p.totalVal) * 100 : 0,
      color: c.color,
    }))
  , [p.categories, p.totalVal])

  const topCategory = useMemo(() =>
    p.categories.length ? [...p.categories].sort((a, b) => b.val - a.val)[0] : null
  , [p.categories])

  return (
    <div className="min-h-screen bg-[#F5F4F0]">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* ── Hero banner ──────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl"
          style={{ background: 'linear-gradient(135deg, #0D4F4A 0%, #0F766E 45%, #14B8A6 100%)' }}>
          <div className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />
          <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)', transform: 'translateY(50%)' }} />

          <div className="relative z-10 p-7">
            {/* top row */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-teal-200/70 mb-1">
                  WEALTHTRACK · {date.toUpperCase()}
                </p>
                <h1 className="text-[17px] font-bold text-white/90">{greeting()}, {firstName} 👋</h1>
              </div>
              {p.anyLoading
                ? <div className="w-24 h-8 rounded-full bg-white/10 animate-pulse" />
                : <div className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold ${
                    isUp ? 'bg-white/15 text-white' : 'bg-red-500/20 text-red-200'}`}>
                    <span>{isUp ? '▲' : '▼'}</span>
                    <span>{isUp ? '+' : ''}{p.totalGainPct.toFixed(1)}%</span>
                  </div>
              }
            </div>

            {/* net worth */}
            <div className="mb-6">
              <p className="text-[11px] font-semibold tracking-widest uppercase text-teal-200/60 mb-2">NET WORTH</p>
              {p.anyLoading
                ? <div className="w-48 h-12 rounded-2xl bg-white/10 animate-pulse" />
                : <div className="flex items-end gap-4 flex-wrap">
                    <span className="text-[52px] font-black text-white leading-none tracking-tight font-mono">
                      {fmt(p.totalVal)}
                    </span>
                    <div className="mb-2">
                      <div className={`text-[16px] font-bold font-mono ${isUp ? 'text-teal-200' : 'text-red-300'}`}>
                        {isUp ? '+' : ''}{fmt(p.totalGain)}
                      </div>
                      <div className="text-[11px] text-white/50">unrealised gain</div>
                    </div>
                  </div>
              }
            </div>

            {/* sparkline */}
            <div className="h-16 w-full opacity-60 mb-5">
              <Sparkline positive={isUp} />
            </div>

            {/* bottom stats */}
            <div className="flex gap-6 flex-wrap">
              {[
                { label: 'INVESTED',   val: fmt(p.totalInv) },
                { label: 'ACTUAL INV', val: p.totalActual > 0 ? fmt(p.totalActual) : '—' },
                { label: 'POSITIONS',  val: String(p.assetCount) },
                { label: 'FX RATE',    val: `₹${p.gbpInr.toFixed(1)}/£` },
              ].map(({ label, val }) => (
                <div key={label} className="flex flex-col">
                  <span className="text-[9px] font-bold tracking-[0.18em] uppercase text-white/40 mb-1">{label}</span>
                  <span className="text-[15px] font-bold text-white/90 font-mono">
                    {p.anyLoading ? '…' : val}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 4-chip metrics ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricChip icon="₹" label="Invested"
            value={p.anyLoading ? '…' : fmt(p.totalInv)}
            sub="Total cost basis" />
          <MetricChip icon="↑" label="Gain / Loss"
            value={p.anyLoading ? '…' : `${p.totalPos ? '+' : ''}${fmt(p.totalGain)}`}
            sub={`${p.totalPos ? '+' : ''}${p.totalGainPct.toFixed(1)}% return`}
            color={isUp ? '#0F766E' : '#C0392B'} />
          <MetricChip icon="⊡" label="Actual Invested"
            value={p.anyLoading ? '…' : p.totalActual > 0 ? fmt(p.totalActual) : '—'}
            sub={p.actualPos
              ? `+${p.actualGainPct.toFixed(1)}% on cash deployed`
              : p.totalActual > 0 ? `${p.actualGainPct.toFixed(1)}% on cash deployed` : 'Log entries to track'}
            color={p.actualPos ? '#0F766E' : undefined} />
          <MetricChip icon="◈" label="Positions"
            value={p.anyLoading ? '…' : String(p.assetCount)}
            sub={topCategory ? `Top: ${topCategory.label}` : 'Across all accounts'} />
        </div>

        {/* ── Donut + breakdown ──────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Donut */}
          <div className="bg-white rounded-2xl border border-[#E0DDD6] p-5 shadow-sm flex flex-col items-center gap-4">
            <h2 className="w-full text-[12px] font-bold uppercase tracking-widest text-[#767676]">Portfolio Mix</h2>
            <div className="relative w-36 h-36">
              <DonutChart slices={p.anyLoading ? [] : donutSlices} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] text-[#767676] font-semibold uppercase tracking-wider">Total</span>
                <span className="text-[15px] font-extrabold font-mono text-[#1A1A1A]">
                  {p.anyLoading ? '…' : fmt(p.totalVal)}
                </span>
              </div>
            </div>
            <div className="w-full space-y-1.5">
              {p.categories.slice(0, 6).map(c => (
                <div key={c.label} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="text-[11px] text-[#767676] flex-1">{c.label}</span>
                  <span className="text-[11px] font-mono font-semibold text-[#1A1A1A]">
                    {p.totalVal > 0 ? ((c.val / p.totalVal) * 100).toFixed(0) : 0}%
                  </span>
                </div>
              ))}
              {p.categories.length > 6 && (
                <div className="text-[10px] text-[#767676] pl-4">+{p.categories.length - 6} more</div>
              )}
            </div>
          </div>

          {/* Breakdown */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E0DDD6] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[12px] font-bold uppercase tracking-widest text-[#767676]">Allocation Breakdown</h2>
              <button onClick={() => navigate('/assets/overview')}
                className="text-[11px] text-[#0F766E] font-semibold hover:underline">View all →</button>
            </div>

            {/* stacked bar */}
            {!p.anyLoading && p.totalVal > 0 && (
              <div className="flex h-2.5 rounded-full overflow-hidden mb-4 mt-3 gap-px">
                {p.categories.filter(c => c.val > 0).map(c => (
                  <div key={c.label}
                    style={{ width: `${(c.val / p.totalVal) * 100}%`, backgroundColor: c.color }}
                    className="transition-all duration-700 first:rounded-l-full last:rounded-r-full" />
                ))}
              </div>
            )}
            {p.anyLoading && <div className="h-2.5 rounded-full bg-[#E0DDD6] animate-pulse mb-4 mt-3" />}

            <div className="space-y-0.5">
              {p.anyLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-9 rounded-xl bg-[#F5F4F0] animate-pulse" />
                  ))
                : p.categories.map(c => (
                    <CategoryRow key={c.label}
                      label={c.label} inv={c.inv} val={c.val}
                      color={c.color} total={p.totalVal} path={c.path} />
                  ))
              }
              {!p.anyLoading && p.categories.length === 0 && (
                <p className="text-[12px] text-[#767676] py-6 text-center">No assets yet — add your first holding</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Actual vs Invested ──────────────────────────────────── */}
        {!p.anyLoading && p.totalActual > 0 && (
          <div className="bg-white rounded-2xl border border-[#E0DDD6] p-5 shadow-sm">
            <h2 className="text-[12px] font-bold uppercase tracking-widest text-[#767676] mb-4">
              Actual Cost Basis vs Current Value
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Actual Invested', val: p.totalActual,  color: '#1D4ED8', note: 'Real cash deployed' },
                { label: 'Book Invested',   val: p.totalInv,     color: '#0F766E', note: 'Avg cost × qty' },
                { label: 'Current Value',   val: p.totalVal,     color: '#0D9488', note: 'Live portfolio value' },
              ].map(({ label, val, color, note }) => (
                <div key={label} className="flex flex-col gap-1 p-4 rounded-xl bg-[#F5F4F0]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#767676]">{label}</span>
                  <span className="text-[24px] font-extrabold font-mono leading-none" style={{ color }}>{fmt(val)}</span>
                  <span className="text-[11px] text-[#767676]">{note}</span>
                </div>
              ))}
            </div>
            <div className={`mt-4 flex items-center gap-3 p-3 rounded-xl border ${
              p.actualPos ? 'bg-green-50/50 border-green-200' : 'bg-red-50/50 border-red-200'}`}>
              <span className={`text-xl ${p.actualPos ? 'text-[#0F766E]' : 'text-[#C0392B]'}`}>
                {p.actualPos ? '▲' : '▼'}
              </span>
              <span className={`text-[14px] font-extrabold font-mono ${p.actualPos ? 'text-[#0F766E]' : 'text-[#C0392B]'}`}>
                {p.actualPos ? '+' : ''}{fmt(p.actualGain)}
              </span>
              <span className="text-[12px] text-[#767676]">
                actual gain ({p.actualPos ? '+' : ''}{p.actualGainPct.toFixed(1)}% on real cash)
              </span>
            </div>
          </div>
        )}


        {/* ── Target vs Actual Allocation ─────────────────────────── */}
        <div className="bg-white rounded-2xl border border-[#E0DDD6] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h2 className="text-[13px] font-bold text-[#1A1A1A]">Target Allocation</h2>
              <p className="text-[11px] text-[#767676] mt-0.5">Target vs current portfolio weights</p>
            </div>
            <button onClick={() => navigate('/allocation')}
              className="text-[11px] text-[#0F766E] font-semibold hover:underline">
              Edit targets →
            </button>
          </div>

          {allocations.length === 0 && !p.anyLoading && (
            <div className="px-5 pb-5">
              <div className="rounded-xl bg-[#F5F4F0] border border-dashed border-[#E0DDD6] p-4 text-center">
                <p className="text-[12px] text-[#767676] mb-2">No target allocation set yet</p>
                <button onClick={() => navigate('/allocation')}
                  className="text-[11px] font-bold text-[#0F766E] hover:underline">
                  Set your targets →
                </button>
              </div>
            </div>
          )}

          {allocations.length > 0 && (
            <div className="px-5 pb-5 space-y-1">
              {allocations.map((alloc) => {
                const bucket = p.allocationBuckets.find(b => b.key === alloc.item)
                const targetPct = alloc.percentage * 100
                const actualPct = p.totalVal > 0 && bucket ? (bucket.val / p.totalVal) * 100 : 0
                const color = bucket?.color ?? '#767676'
                const diff = actualPct - targetPct
                const diffAbs = Math.abs(diff)
                const over = diff > 0.5
                const under = diff < -0.5
                const onTrack = !over && !under

                return (
                  <div key={alloc.id} className="py-2.5">
                    {/* Label row */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-[13px] font-semibold text-[#1A1A1A]">{alloc.item}</span>
                        {!p.anyLoading && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            onTrack ? 'bg-green-50 text-[#1A7A3C]'
                            : over   ? 'bg-amber-50 text-amber-700'
                            :          'bg-red-50 text-[#C0392B]'
                          }`}>
                            {onTrack ? '✓ on track'
                              : over ? `+${diffAbs.toFixed(1)}% over`
                              :        `${diffAbs.toFixed(1)}% under`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <div className="text-right">
                          <span className="text-[11px] font-mono text-[#767676]">
                            {p.anyLoading ? '…' : `${actualPct.toFixed(1)}%`}
                          </span>
                          <span className="text-[11px] text-[#C8C4BC] mx-1">/</span>
                          <span className="text-[11px] font-mono text-[#1A1A1A] font-bold">{targetPct.toFixed(1)}%</span>
                        </div>
                        {bucket && !p.anyLoading && (
                          <span className="text-[11px] font-mono text-[#767676] w-20 text-right">
                            {fmt(bucket.val)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dual progress bar */}
                    <div className="relative h-5">
                      {/* Target ghost bar */}
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full h-1.5 rounded-full bg-[#F0EEE9]">
                          <div className="h-full rounded-full opacity-25"
                            style={{ width: `${targetPct}%`, backgroundColor: color }} />
                        </div>
                      </div>
                      {/* Target tick mark */}
                      <div className="absolute top-0 bottom-0 w-px bg-[#C8C4BC] opacity-60"
                        style={{ left: `${targetPct}%` }} />
                      {/* Actual filled bar */}
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full h-2 rounded-full bg-transparent">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(actualPct, 100)}%`, backgroundColor: color, opacity: p.anyLoading ? 0.3 : 0.9 }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Legend */}
              <div className="flex items-center gap-4 pt-2 border-t border-[#F0EEE9]">
                <div className="flex items-center gap-1.5">
                  <div className="w-10 h-1.5 rounded-full bg-[#1A1A1A] opacity-90" />
                  <span className="text-[10px] text-[#767676]">Actual</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-10 h-px bg-[#C8C4BC]" />
                  <span className="text-[10px] text-[#767676]">Target mark</span>
                </div>
                <div className="ml-auto flex items-center gap-1 text-[10px] text-[#767676]">
                  <span className="font-mono">actual%</span>
                  <span className="text-[#C8C4BC]">/</span>
                  <span className="font-mono font-bold text-[#1A1A1A]">target%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Quick nav ──────────────────────────────────────────── */}
        <div>
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#767676] mb-3">Quick Access</h2>
          <div className="flex flex-wrap gap-2">
            <NavPill icon="📈" label="Zerodha"        path="/assets/zerodha" />
            <NavPill icon="📊" label="Aionion"        path="/assets/aionion" />
            <NavPill icon="💰" label="Mutual Funds"   path="/assets/mutual-funds" />
            <NavPill icon="🏅" label="Gold"           path="/assets/gold" />
            <NavPill icon="🌐" label="Foreign Stocks" path="/assets/foreign-stocks" />
            <NavPill icon="₿"  label="Crypto"         path="/assets/crypto" />
            <NavPill icon="🏦" label="Fixed Deposits" path="/assets/fd" />
            <NavPill icon="🛡" label="Emergency Fund" path="/assets/ef" />
            <NavPill icon="💵" label="Cash"           path="/assets/cash" />
            <NavPill icon="📜" label="Bonds"          path="/assets/bonds" />
            <NavPill icon="🏦" label="Bank Savings"   path="/assets/bank-savings" />
            <NavPill icon="◎"  label="Allocation"     path="/allocation" />
          </div>
        </div>

        {/* ── Empty state ───────────────────────────────────────── */}
        {!p.anyLoading && p.assetCount === 0 && (
          <div className="rounded-2xl border border-dashed border-[#E0DDD6] bg-white p-10 flex flex-col items-center gap-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#F5F4F0] flex items-center justify-center text-3xl">₹</div>
            <div>
              <h3 className="text-[16px] font-bold text-[#1A1A1A] mb-2">Your wealth journey starts here</h3>
              <p className="text-[13px] text-[#767676] max-w-sm leading-relaxed">
                Add your first asset — stocks, mutual funds, gold, FDs, or crypto — and watch your complete financial picture come alive.
              </p>
            </div>
            <button onClick={() => navigate('/assets/zerodha-stocks')}
              className="h-10 px-6 rounded-xl bg-[#1A1A1A] hover:bg-[#333] text-white text-[13px] font-bold transition-colors">
              + Add First Asset
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
