import { useDashboardStats } from '../../hooks/useDashboardStats'
import { useAuthStore } from '../../store/authStore'
import { StatCard } from '../../components/ui/StatCard'
import { INRCompact, INR, calcGain } from '../../lib/utils'

const QUICK_ACTIONS = [
  { icon: '+', label: 'Add Asset',       sub: 'Stocks, MF, Gold…',   color: '#22c55e',  bg: 'rgba(34,197,94,0.08)'  },
  { icon: '⇅', label: 'Log Transaction', sub: 'Income or expense',   color: '#3b82f6',  bg: 'rgba(59,130,246,0.08)' },
  { icon: '◎', label: 'Set a Goal',      sub: 'Retirement, EMF…',    color: '#818cf8',  bg: 'rgba(129,140,248,0.08)'},
  { icon: '⊡', label: 'Take Snapshot',   sub: 'Freeze net worth',    color: '#14b8a6',  bg: 'rgba(20,184,166,0.08)' },
]

function DateBadge() {
  const date = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  return <p className="text-sm text-textsec">{date}</p>
}

export default function DashboardPage() {
  const user  = useAuthStore(s => s.user)
  const firstName = (user?.user_metadata?.full_name ?? user?.email ?? '').split(' ')[0]
  const { data: stats, isLoading } = useDashboardStats()

  const gain = stats ? calcGain(stats.totalValue, stats.totalInvested) : null

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-start justify-between animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold text-textprim tracking-tight">
            Good day, {firstName} 👋
          </h1>
          <DateBadge />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Net Worth"
          value={isLoading ? '…' : INRCompact(stats?.totalValue)}
          sub={isLoading ? '' : `${stats?.assetCount ?? 0} assets tracked`}
          icon="◈"
          accentColor="#14b8a6"
          loading={isLoading}
          delay={1}
        />
        <StatCard
          label="Total Assets"
          value={isLoading ? '…' : INRCompact(stats?.totalValue)}
          sub={isLoading ? '' : `${stats?.assetCount ?? 0} positions`}
          icon="⬡"
          accentColor="#3b82f6"
          loading={isLoading}
          delay={2}
        />
        <StatCard
          label="Actual Invested"
          value={isLoading ? '…' : INRCompact(stats?.actualInvested)}
          sub={isLoading ? '' : stats?.entryLabel ?? '—'}
          icon="₹"
          accentColor="#f59e0b"
          loading={isLoading}
          delay={3}
        />
        <StatCard
          label="Unrealised P&L"
          value={
            isLoading ? '…' :
            gain
              ? `${gain.isPositive ? '+' : ''}${INRCompact(gain.gain)}`
              : '₹0'
          }
          sub={
            !isLoading && gain
              ? `${gain.isPositive ? '+' : ''}${gain.gainPct.toFixed(1)}% overall`
              : 'No data yet'
          }
          icon="▲"
          accentColor={gain?.isPositive ? '#22c55e' : '#ef4444'}
          loading={isLoading}
          delay={4}
        />
      </div>

      {/* Quick actions */}
      <div className="animate-fade-up delay-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-textmut mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {QUICK_ACTIONS.map((a, i) => (
            <button
              key={a.label}
              className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-border bg-surface hover:border-border2 hover:bg-surface2 transition-all duration-150 group"
              style={{ animationDelay: `${(i + 4) * 0.05}s` }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold transition-transform duration-150 group-hover:scale-110"
                style={{ background: a.bg, color: a.color }}
              >
                {a.icon}
              </div>
              <div>
                <div className="text-xs font-semibold text-textprim">{a.label}</div>
                <div className="text-[10px] text-textmut mt-0.5">{a.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Net worth chart placeholder */}
      <div className="rounded-xl border border-border bg-surface p-5 animate-fade-up delay-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-textprim">Net Worth Over Time</h2>
          <span className="text-[10px] text-textmut border border-border rounded-full px-2.5 py-1">Coming soon</span>
        </div>
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <span className="text-4xl animate-float">📈</span>
          <p className="text-xs text-textmut text-center max-w-[220px] leading-relaxed">
            Your net worth chart will appear here once you start adding assets.
          </p>
        </div>
      </div>

      {/* Empty state */}
      {!isLoading && (stats?.assetCount ?? 0) === 0 && (
        <div className="rounded-xl border border-border border-dashed bg-surface/50 p-10 flex flex-col items-center gap-4 text-center animate-fade-up delay-5">
          <div className="w-12 h-12 rounded-xl bg-amber/10 border border-amber/20 flex items-center justify-center text-2xl">
            ₹
          </div>
          <div>
            <h3 className="text-base font-semibold text-textprim mb-1">Your wealth journey starts here</h3>
            <p className="text-sm text-textsec max-w-sm leading-relaxed">
              Add your first asset — stocks, mutual funds, gold, real estate, EPF — and watch your complete financial picture come alive.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="h-9 px-4 rounded-lg bg-accent hover:bg-accent2 text-white text-sm font-medium transition-colors flex items-center gap-2">
              <span>+</span> Add First Asset
            </button>
            <button className="h-9 px-4 rounded-lg border border-border bg-surface hover:bg-surface2 text-textsec text-sm font-medium transition-colors">
              Import from CSV
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
