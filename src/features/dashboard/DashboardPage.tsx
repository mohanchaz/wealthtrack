import { useDashboardStats } from '../../hooks/useDashboardStats'
import { useAuthStore } from '../../store/authStore'
import { StatCard } from '../../components/ui/StatCard'
import { INRCompact, calcGain } from '../../lib/utils'

const QUICK_ACTIONS = [
  { icon: '+',  label: 'Add Asset',        sub: 'Stocks, MF, Gold…',  color: '#0d9488', bg: 'rgba(13,148,136,0.08)'  },
  { icon: '⇅', label: 'Log Transaction',  sub: 'Income or expense',  color: '#0891b2', bg: 'rgba(8,145,178,0.08)'   },
  { icon: '◎', label: 'Set a Goal',       sub: 'Retirement, EMF…',   color: '#059669', bg: 'rgba(5,150,105,0.08)'   },
  { icon: '⊡', label: 'Take Snapshot',    sub: 'Freeze net worth',   color: '#0369a1', bg: 'rgba(3,105,161,0.08)'   },
]

export default function DashboardPage() {
  const user      = useAuthStore(s => s.user)
  const firstName = (user?.user_metadata?.full_name ?? user?.email ?? '').split(' ')[0]
  const { data: stats, isLoading } = useDashboardStats()

  const gain = stats ? calcGain(stats.totalValue, stats.totalInvested) : null
  const date = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="animate-fade-up">
        <h1 className="text-2xl font-extrabold text-textprim tracking-tight">
          Good day, {firstName} 👋
        </h1>
        <p className="text-sm text-textmut mt-0.5">{date}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Net Worth"
          value={isLoading ? '…' : INRCompact(stats?.totalValue)}
          sub={`${stats?.assetCount ?? 0} assets tracked`}
          icon="◈"
          accentColor="#0d9488"
          loading={isLoading}
          delay={1}
        />
        <StatCard
          label="Total Value"
          value={isLoading ? '…' : INRCompact(stats?.totalValue)}
          sub={`${stats?.assetCount ?? 0} positions`}
          icon="⬡"
          accentColor="#0891b2"
          loading={isLoading}
          delay={2}
        />
        <StatCard
          label="Actual Invested"
          value={isLoading ? '…' : INRCompact(stats?.actualInvested)}
          sub={isLoading ? '' : stats?.entryLabel ?? '—'}
          icon="₹"
          accentColor="#d97706"
          loading={isLoading}
          delay={3}
        />
        <StatCard
          label="Unrealised P&L"
          value={
            isLoading ? '…' :
            gain ? `${gain.isPositive ? '+' : ''}${INRCompact(gain.gain)}` : '₹0'
          }
          sub={
            !isLoading && gain
              ? `${gain.isPositive ? '+' : ''}${gain.gainPct.toFixed(1)}% overall`
              : 'No data yet'
          }
          icon={gain?.isPositive ? '▲' : '▼'}
          accentColor={gain?.isPositive !== false ? '#059669' : '#dc2626'}
          loading={isLoading}
          delay={4}
        />
      </div>

      {/* Quick actions */}
      <div className="animate-fade-up delay-3">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-textmut mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {QUICK_ACTIONS.map((a, i) => (
            <button
              key={a.label}
              className="flex flex-col items-center gap-3 p-4 rounded-2xl border border-border bg-white hover:border-border2 hover:shadow-cardHov transition-all duration-150 group"
              style={{ animationDelay: `${(i + 4) * 0.06}s` }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl font-bold transition-transform duration-150 group-hover:scale-110"
                style={{ background: a.bg, color: a.color }}
              >
                {a.icon}
              </div>
              <div>
                <div className="text-xs font-bold text-textprim">{a.label}</div>
                <div className="text-[10px] text-textmut mt-0.5">{a.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Net worth chart placeholder */}
      <div className="rounded-2xl border border-border bg-white p-5 shadow-card animate-fade-up delay-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-textprim">Net Worth Over Time</h2>
          <span className="text-[10px] text-textmut border border-border rounded-full px-2.5 py-1 font-medium">Coming soon</span>
        </div>
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <span className="text-4xl animate-float">📈</span>
          <p className="text-xs text-textmut text-center max-w-[220px] leading-relaxed">
            Your net worth chart will appear once you start adding assets.
          </p>
        </div>
      </div>

      {/* Empty state */}
      {!isLoading && (stats?.assetCount ?? 0) === 0 && (
        <div className="rounded-2xl border border-teal/20 border-dashed bg-teal/3 p-10 flex flex-col items-center gap-5 text-center animate-fade-up delay-5">
          <div className="w-14 h-14 rounded-2xl bg-teal/10 border border-teal/20 flex items-center justify-center text-3xl">
            ₹
          </div>
          <div>
            <h3 className="text-base font-bold text-textprim mb-1.5">Your wealth journey starts here</h3>
            <p className="text-sm text-textsec max-w-sm leading-relaxed">
              Add your first asset — stocks, mutual funds, gold, real estate, EPF — and watch your complete financial picture come alive.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="h-9 px-5 rounded-xl bg-teal hover:bg-teal2 text-white text-sm font-bold transition-colors flex items-center gap-2 shadow-sm">
              <span>+</span> Add First Asset
            </button>
            <button className="h-9 px-4 rounded-xl border border-border bg-white hover:bg-surface2 text-textsec text-sm font-semibold transition-colors">
              Import from CSV
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
