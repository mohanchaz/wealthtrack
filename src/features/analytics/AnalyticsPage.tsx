import { useSnapshots } from '../../hooks/useSnapshots'
import type { SnapshotWithDerived } from '../../services/snapshotService'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'

function fmt(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-')
  return new Date(+y, +mo - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d: SnapshotWithDerived = payload[0]?.payload
  return (
    <div className="bg-white border border-[#E0DDD6] rounded-xl shadow-lg p-3 text-[12px]">
      <div className="font-bold text-[#1A1A1A] mb-1.5">{monthLabel(label)}</div>
      <div className="flex flex-col gap-1">
        <div className="flex justify-between gap-4">
          <span className="text-[#767676]">Net Worth</span>
          <span className="font-bold text-[#0F766E]">{fmt(d.net_worth)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#767676]">Invested</span>
          <span className="font-semibold text-[#1A1A1A]">{fmt(d.invested)}</span>
        </div>
        {d.actual_invested > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-[#767676]">Actual Inv</span>
            <span className="font-semibold text-[#2563EB]">{fmt(d.actual_invested)}</span>
          </div>
        )}
        <div className="flex justify-between gap-4 pt-1 border-t border-[#F0EEE9]">
          <span className="text-[#767676]">Book Gain</span>
          <span className={`font-bold ${d.gain >= 0 ? 'text-[#1A7A3C]' : 'text-[#C0392B]'}`}>
            {d.gain >= 0 ? '+' : ''}{fmt(d.gain)} ({d.gain_pct >= 0 ? '+' : ''}{d.gain_pct.toFixed(1)}%)
          </span>
        </div>
        {d.actual_invested > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-[#767676]">Actual Gain</span>
            <span className={`font-bold ${d.actual_gain >= 0 ? 'text-[#1A7A3C]' : 'text-[#C0392B]'}`}>
              {d.actual_gain >= 0 ? '+' : ''}{fmt(d.actual_gain)} ({d.actual_gain_pct >= 0 ? '+' : ''}{d.actual_gain_pct.toFixed(1)}%)
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const { data: snapshots = [], isLoading, deleteMutation } = useSnapshots()

  const chartData = snapshots.map(s => ({ ...s }))

  const growthRows = snapshots.map((s, i) => {
    const prev = i > 0 ? snapshots[i - 1] : null
    const mom  = prev ? ((s.net_worth - prev.net_worth) / prev.net_worth) * 100 : null
    return { ...s, mom }
  })

  const hasActual = snapshots.some(s => s.actual_invested > 0)

  return (
    <div className="pb-8">
      <div className="mb-5">
        <h1 className="text-xl font-black text-[#1A1A1A] tracking-tight">Analytics</h1>
        <p className="text-[11px] text-[#767676] mt-0.5">Net worth snapshots and growth over time</p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-[12px] text-[#767676] py-8">
          <div className="w-4 h-4 rounded-full border-2 border-[#0F766E] border-t-transparent animate-spin" />
          Loading snapshots…
        </div>
      )}

      {!isLoading && snapshots.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#E0DDD6] bg-white p-10 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F4F0] flex items-center justify-center text-2xl">📸</div>
          <div>
            <h3 className="text-[15px] font-bold text-[#1A1A1A] mb-1">No snapshots yet</h3>
            <p className="text-[12px] text-[#767676] max-w-xs leading-relaxed">
              Click the <strong>Snapshot</strong> button on the Dashboard to save your current net worth. Do it once a month to track growth.
            </p>
          </div>
        </div>
      )}

      {!isLoading && snapshots.length > 0 && (
        <>
          {/* ── Chart ─────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-[#E0DDD6] shadow-sm p-5 mb-5">
            <h2 className="text-[12px] font-bold text-[#1A1A1A] uppercase tracking-widest mb-4">Net Worth Growth</h2>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#0F766E" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#0F766E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" />
                <XAxis dataKey="month" tickFormatter={monthLabel}
                  tick={{ fontSize: 10, fill: '#767676' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => fmt(v)}
                  tick={{ fontSize: 10, fill: '#767676' }} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="net_worth" stroke="#0F766E" strokeWidth={2.5}
                  fill="url(#nwGrad)" dot={{ r: 4, fill: '#0F766E', strokeWidth: 0 }}
                  activeDot={{ r: 6 }} name="Net Worth" />
                <Line type="monotone" dataKey="invested" stroke="#2563EB" strokeWidth={1.5}
                  strokeDasharray="4 3" dot={false} name="Invested" />
                {hasActual && (
                  <Line type="monotone" dataKey="actual_invested" stroke="#D97706" strokeWidth={1.5}
                    strokeDasharray="4 3" dot={false} name="Actual Invested" />
                )}
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-[#F0EEE9]">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-[3px] rounded bg-[#0F766E]" />
                <span className="text-[10px] text-[#767676]">Net Worth</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 border-t-2 border-dashed border-[#2563EB]" />
                <span className="text-[10px] text-[#767676]">Invested</span>
              </div>
              {hasActual && (
                <div className="flex items-center gap-1.5">
                  <div className="w-5 border-t-2 border-dashed border-[#D97706]" />
                  <span className="text-[10px] text-[#767676]">Actual Invested</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Table ─────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-[#E0DDD6] shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EEE9]">
              <h2 className="text-[12px] font-bold text-[#1A1A1A] uppercase tracking-widest">Snapshot History</h2>
              <span className="text-[10px] text-[#767676]">{snapshots.length} entries</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[#F5F4F0] text-[10px] font-bold uppercase tracking-widest text-[#767676]">
                    <th className="text-left px-4 py-2.5">Month</th>
                    <th className="text-right px-3 py-2.5">Net Worth</th>
                    <th className="text-right px-3 py-2.5">Invested</th>
                    {hasActual && <th className="text-right px-3 py-2.5 hidden sm:table-cell">Actual Inv</th>}
                    <th className="text-right px-3 py-2.5">Gain</th>
                    <th className="text-right px-3 py-2.5 hidden sm:table-cell">Gain %</th>
                    {hasActual && <>
                      <th className="text-right px-3 py-2.5 hidden md:table-cell">Actual Gain</th>
                      <th className="text-right px-3 py-2.5 hidden md:table-cell">Act %</th>
                    </>}
                    <th className="text-right px-3 py-2.5 hidden lg:table-cell">MoM</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F4F0]">
                  {[...growthRows].reverse().map(row => (
                    <tr key={row.id} className="hover:bg-[#FAFAF8] transition-colors group">
                      <td className="px-4 py-3 font-bold text-[#1A1A1A]">{monthLabel(row.month)}</td>
                      <td className="px-3 py-3 text-right font-bold text-[#0F766E] font-mono">{fmt(row.net_worth)}</td>
                      <td className="px-3 py-3 text-right text-[#1A1A1A] font-mono">{fmt(row.invested)}</td>
                      {hasActual && (
                        <td className="px-3 py-3 text-right text-[#767676] font-mono hidden sm:table-cell">
                          {row.actual_invested > 0 ? fmt(row.actual_invested) : '—'}
                        </td>
                      )}
                      <td className={`px-3 py-3 text-right font-bold font-mono ${row.gain >= 0 ? 'text-[#1A7A3C]' : 'text-[#C0392B]'}`}>
                        {row.gain >= 0 ? '+' : ''}{fmt(row.gain)}
                      </td>
                      <td className={`px-3 py-3 text-right font-bold hidden sm:table-cell ${row.gain_pct >= 0 ? 'text-[#1A7A3C]' : 'text-[#C0392B]'}`}>
                        {row.gain_pct >= 0 ? '+' : ''}{row.gain_pct.toFixed(1)}%
                      </td>
                      {hasActual && <>
                        <td className={`px-3 py-3 text-right font-bold font-mono hidden md:table-cell ${row.actual_gain >= 0 ? 'text-[#1A7A3C]' : 'text-[#C0392B]'}`}>
                          {row.actual_invested > 0 ? `${row.actual_gain >= 0 ? '+' : ''}${fmt(row.actual_gain)}` : '—'}
                        </td>
                        <td className={`px-3 py-3 text-right font-bold hidden md:table-cell ${row.actual_gain_pct >= 0 ? 'text-[#1A7A3C]' : 'text-[#C0392B]'}`}>
                          {row.actual_invested > 0 ? `${row.actual_gain_pct >= 0 ? '+' : ''}${row.actual_gain_pct.toFixed(1)}%` : '—'}
                        </td>
                      </>}
                      <td className="px-3 py-3 text-right hidden lg:table-cell">
                        {row.mom !== null
                          ? <span className={`font-bold ${row.mom >= 0 ? 'text-[#1A7A3C]' : 'text-[#C0392B]'}`}>
                              {row.mom >= 0 ? '+' : ''}{row.mom.toFixed(1)}%
                            </span>
                          : <span className="text-[#ABABAB]">—</span>
                        }
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => { if (confirm(`Delete ${monthLabel(row.month)} snapshot?`)) deleteMutation.mutate(row.id) }}
                          className="opacity-0 group-hover:opacity-100 text-[#ABABAB] hover:text-[#C0392B] transition-all text-[11px] font-bold">
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
