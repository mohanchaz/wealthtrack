import { useState } from 'react'
import { useSnapshots } from '../../hooks/useSnapshots'
import type { SnapshotWithDerived } from '../../services/snapshotService'
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function fmt(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-')
  return new Date(+y, +mo - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

// ── Chart tooltip ────────────────────────────────────────────────
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

// ── Add Entry Modal ──────────────────────────────────────────────
function AddEntryModal({ existingMonths, onSave, onClose, saving }: {
  existingMonths: string[]
  onSave: (data: { month: string; net_worth: number; invested: number; actual_invested: number }) => void
  onClose: () => void
  saving: boolean
}) {
  const [month,          setMonth]          = useState('')
  const [netWorth,       setNetWorth]       = useState('')
  const [invested,       setInvested]       = useState('')
  const [actualInvested, setActualInvested] = useState('')
  const [error,          setError]          = useState('')

  const isDuplicate = existingMonths.includes(month)

  function handleSubmit() {
    setError('')
    if (!month)                        return setError('Please select a month.')
    if (!netWorth || isNaN(+netWorth)) return setError('Enter a valid net worth.')
    if (!invested  || isNaN(+invested)) return setError('Enter a valid invested amount.')
    if (isDuplicate)                   return setError(`A snapshot for ${monthLabel(month)} already exists.`)
    onSave({
      month,
      net_worth:       +netWorth,
      invested:        +invested,
      actual_invested: actualInvested ? +actualInvested : 0,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-black text-[#1A1A1A]">Add Snapshot Entry</h2>
          <button onClick={onClose} className="text-[#ABABAB] hover:text-[#1A1A1A] transition-colors text-lg leading-none">✕</button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Month */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#767676] mb-1.5 block">Month</label>
            <input
              type="month"
              value={month}
              onChange={e => { setMonth(e.target.value); setError('') }}
              max={new Date().toISOString().slice(0, 7)}
              className="w-full border border-[#E0DDD6] rounded-xl px-3 py-2.5 text-[13px] text-[#1A1A1A] outline-none focus:border-[#0F766E] transition-colors"
            />
            {isDuplicate && month && (
              <p className="text-[10px] text-amber-600 mt-1">⚠ A snapshot already exists for this month.</p>
            )}
          </div>

          {/* Net Worth */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#767676] mb-1.5 block">Net Worth (₹)</label>
            <input
              type="number"
              value={netWorth}
              onChange={e => setNetWorth(e.target.value)}
              placeholder="e.g. 2500000"
              className="w-full border border-[#E0DDD6] rounded-xl px-3 py-2.5 text-[13px] text-[#1A1A1A] outline-none focus:border-[#0F766E] transition-colors font-mono"
            />
          </div>

          {/* Invested */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#767676] mb-1.5 block">Invested (₹)</label>
            <input
              type="number"
              value={invested}
              onChange={e => setInvested(e.target.value)}
              placeholder="e.g. 2000000"
              className="w-full border border-[#E0DDD6] rounded-xl px-3 py-2.5 text-[13px] text-[#1A1A1A] outline-none focus:border-[#0F766E] transition-colors font-mono"
            />
          </div>

          {/* Actual Invested */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#767676] mb-1.5 block">
              Actual Invested (₹) <span className="normal-case font-normal text-[#ABABAB]">optional</span>
            </label>
            <input
              type="number"
              value={actualInvested}
              onChange={e => setActualInvested(e.target.value)}
              placeholder="Leave blank if unknown"
              className="w-full border border-[#E0DDD6] rounded-xl px-3 py-2.5 text-[13px] text-[#1A1A1A] outline-none focus:border-[#0F766E] transition-colors font-mono"
            />
          </div>

          {error && <p className="text-[11px] text-[#C0392B] font-semibold">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={saving || isDuplicate}
            className="w-full bg-[#0F766E] text-white font-bold text-[13px] py-3 rounded-xl
                       hover:bg-[#0D4F4A] active:scale-[0.98] transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving
              ? <><span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />Saving…</>
              : 'Save Entry'
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { data: snapshots = [], isLoading, saveMutation } = useSnapshots()
  const [showModal, setShowModal] = useState(false)

  const existingMonths = snapshots.map(s => s.month)
  const hasActual      = snapshots.some(s => s.actual_invested > 0)

  const growthRows = snapshots.map((s, i) => {
    const prev = i > 0 ? snapshots[i - 1] : null
    const mom  = prev ? ((s.net_worth - prev.net_worth) / prev.net_worth) * 100 : null
    return { ...s, mom }
  })

  async function handleManualSave(data: { month: string; net_worth: number; invested: number; actual_invested: number }) {
    await saveMutation.mutateAsync(data)
    setShowModal(false)
  }

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-[#1A1A1A] tracking-tight">Analytics</h1>
          <p className="text-[11px] text-[#767676] mt-0.5">Net worth snapshots and growth over time</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-2 rounded-xl
                     bg-[#0F766E] text-white hover:bg-[#0D4F4A] active:scale-95 transition-all"
        >
          <span>+</span><span>Add Entry</span>
        </button>
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
              Click <strong>Snapshot</strong> on the Dashboard or <strong>Add Entry</strong> above to record your first data point.
            </p>
          </div>
        </div>
      )}

      {!isLoading && snapshots.length > 0 && (
        <>
          {/* ── Chart ─────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-[#E0DDD6] shadow-sm p-5 mb-5">
            <h2 className="text-[12px] font-bold text-[#1A1A1A] uppercase tracking-widest mb-4">Net Worth Growth</h2>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={growthRows} margin={{ top: 4, right: 60, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#0F766E" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0F766E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" />
                <XAxis dataKey="month" tickFormatter={monthLabel}
                  tick={{ fontSize: 10, fill: '#767676' }} axisLine={false} tickLine={false} />
                {/* Left axis — net worth */}
                <YAxis yAxisId="left" tickFormatter={v => fmt(v)}
                  tick={{ fontSize: 10, fill: '#0F766E' }} axisLine={false} tickLine={false} width={62}
                  domain={[
                    (dataMin: number) => Math.floor(dataMin * 0.92 / 100000) * 100000,
                    (dataMax: number) => Math.ceil(dataMax * 1.05 / 100000) * 100000,
                  ]} />
                {/* Right axis — invested / actual invested */}
                <YAxis yAxisId="right" orientation="right" tickFormatter={v => fmt(v)}
                  tick={{ fontSize: 10, fill: '#2563EB' }} axisLine={false} tickLine={false} width={62}
                  domain={[
                    (dataMin: number) => Math.floor(dataMin * 0.85 / 100000) * 100000,
                    (dataMax: number) => Math.ceil(dataMax * 1.15 / 100000) * 100000,
                  ]} />
                <Tooltip content={<ChartTooltip />} />
                <Area yAxisId="left" type="monotone" dataKey="net_worth" stroke="#0F766E" strokeWidth={2.5}
                  fill="url(#nwGrad)" dot={{ r: 4, fill: '#0F766E', strokeWidth: 0 }}
                  activeDot={{ r: 6 }} name="Net Worth" />
                <Line yAxisId="right" type="monotone" dataKey="invested" stroke="#2563EB" strokeWidth={2}
                  strokeDasharray="5 3" dot={{ r: 3, fill: '#2563EB', strokeWidth: 0 }} name="Invested" />
                {hasActual && (
                  <Line yAxisId="right" type="monotone" dataKey="actual_invested" stroke="#D97706" strokeWidth={2}
                    strokeDasharray="5 3" dot={{ r: 3, fill: '#D97706', strokeWidth: 0 }} name="Actual Invested" />
                )}
              </ComposedChart>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F4F0]">
                  {[...growthRows].reverse().map(row => (
                    <tr key={row.id} className="hover:bg-[#FAFAF8] transition-colors">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showModal && (
        <AddEntryModal
          existingMonths={existingMonths}
          onSave={handleManualSave}
          onClose={() => setShowModal(false)}
          saving={saveMutation.isPending}
        />
      )}
    </div>
  )
}
