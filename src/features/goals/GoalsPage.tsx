import { useState, useMemo } from 'react'
import { useGoals }           from '../../hooks/useGoals'
import { usePortfolioTotals } from '../../hooks/usePortfolioTotals'
import { useSnapshots }       from '../../hooks/useSnapshots'
import { useToastStore }      from '../../store/toastStore'
import { Modal }              from '../../components/ui/Modal'
import type { Goal, GoalInput, GoalType } from '../../services/goalService'
import { goalTitle } from '../../services/goalService'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'

function fmt(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}
function fmtDate(d: string | null | undefined) {
  if (!d) return null
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function monthLabel(m: string) {
  const [y, mo] = m.split('-')
  return new Date(+y, +mo - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}
function monthsUntil(deadline: string | null | undefined): number | null {
  if (!deadline) return null
  const now = new Date()
  const end = new Date(deadline)
  return (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth())
}
function monthsBetween(start: string, end: string): string[] {
  const result: string[] = []
  const s = new Date(start.slice(0, 7) + '-01')
  const e = new Date(end.slice(0, 7) + '-01')
  while (s <= e) { result.push(s.toISOString().slice(0, 7)); s.setMonth(s.getMonth() + 1) }
  return result
}

function RingProgress({ pct, color, size = 88 }: { pct: number; color: string; size?: number }) {
  const r = (size - 10) / 2, c = 2 * Math.PI * r
  const off = c - (Math.min(pct, 100) / 100) * c
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F0EEE9" strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
    </svg>
  )
}

function TypeToggle({ value, onChange }: { value: GoalType; onChange: (t: GoalType) => void }) {
  return (
    <div className="flex items-center border border-[#E0DDD6] rounded-xl overflow-hidden text-[12px] font-semibold mb-4">
      {([['networth', '📈 Net Worth Goal'], ['investment', '💰 Investment Goal']] as [GoalType, string][]).map(([t, label]) => (
        <button key={t} onClick={() => onChange(t)}
          className={`flex-1 py-2 transition-colors ${value === t ? 'bg-[#1A1A1A] text-white' : 'bg-white text-[#767676] hover:bg-[#F5F4F0]'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

function GoalForm({ initial, onSave, onClose, saving }: {
  initial?: Partial<Goal>; onSave: (input: GoalInput) => void; onClose: () => void; saving: boolean
}) {
  const [type,      setType]      = useState<GoalType>(initial?.goal_type ?? 'networth')
  const [amount,    setAmount]    = useState(initial?.target_amount?.toString() ?? '')
  const [deadline,  setDeadline]  = useState(initial?.deadline ?? '')
  const [invTarget, setInvTarget] = useState(initial?.invest_target?.toString() ?? '')
  const [invStart,  setInvStart]  = useState(initial?.invest_start ?? '')
  const [invEnd,    setInvEnd]    = useState(initial?.invest_end ?? '')
  const [error,     setError]     = useState('')

  function handleSave() {
    setError('')
    if (type === 'networth') {
      if (!amount || isNaN(+amount) || +amount <= 0) return setError('Enter a valid target amount.')
      onSave({ goal_type: 'networth', target_amount: +amount, deadline: deadline || null })
    } else {
      if (!invTarget || isNaN(+invTarget) || +invTarget <= 0) return setError('Enter a valid investment target.')
      if (!invStart) return setError('Please select a start date.')
      if (!invEnd)   return setError('Please select an end date.')
      if (invEnd <= invStart) return setError('End date must be after start date.')
      onSave({ goal_type: 'investment', target_amount: +invTarget, invest_target: +invTarget, invest_start: invStart, invest_end: invEnd, deadline: invEnd })
    }
  }

  const lbl = 'text-[10px] font-bold uppercase tracking-widest text-[#767676] mb-1.5 block'
  const inp = 'w-full border border-[#E0DDD6] rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E]/20 transition-all'

  return (
    <div className="flex flex-col gap-4">
      <TypeToggle value={type} onChange={t => { setType(t); setError('') }} />
      {type === 'networth' ? (
        <>
          <div>
            <label className={lbl}>Target net worth (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[#767676]">₹</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 10000000" className={`${inp} pl-7 font-mono`} />
            </div>
            {amount && !isNaN(+amount) && +amount > 0 && <p className="text-[10px] text-[#ABABAB] mt-1">= {fmt(+amount)}</p>}
          </div>
          <div>
            <label className={lbl}>Target date <span className="normal-case font-normal text-[#ABABAB]">optional</span></label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} min={new Date().toISOString().split('T')[0]} className={inp} />
          </div>
        </>
      ) : (
        <>
          <div>
            <label className={lbl}>Amount to invest (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[#767676]">₹</span>
              <input type="number" value={invTarget} onChange={e => setInvTarget(e.target.value)} placeholder="e.g. 1600000" className={`${inp} pl-7 font-mono`} />
            </div>
            {invTarget && !isNaN(+invTarget) && +invTarget > 0 && <p className="text-[10px] text-[#ABABAB] mt-1">= {fmt(+invTarget)}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Start date</label>
              <input type="date" value={invStart} onChange={e => setInvStart(e.target.value)} max={invEnd || undefined} className={inp} />
            </div>
            <div>
              <label className={lbl}>End date</label>
              <input type="date" value={invEnd} onChange={e => setInvEnd(e.target.value)} min={invStart || undefined} className={inp} />
            </div>
          </div>
          {invStart && invEnd && invTarget && +invTarget > 0 && (
            <div className="bg-[#F5F4F0] rounded-xl px-4 py-3 text-[11px] text-[#767676]">
              {(() => {
                const months = monthsBetween(invStart, invEnd).length
                return <><span className="font-semibold text-[#1A1A1A]">{months} months</span> · needs <span className="font-semibold text-[#0F766E]">{fmt(+invTarget / months)}/month</span> to hit target</>
              })()}
            </div>
          )}
        </>
      )}
      {error && <p className="text-[11px] text-[#C0392B] font-semibold">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-[#E0DDD6] bg-[#F5F4F0] text-[#767676] text-[13px] font-semibold hover:bg-[#EFEDE8] transition-all">Cancel</button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 h-10 rounded-xl bg-[#0F766E] text-white text-[13px] font-bold hover:bg-[#0D4F4A] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Saving…</> : initial?.id ? 'Update goal' : 'Create goal'}
        </button>
      </div>
    </div>
  )
}

function InvestmentGoalCard({ goal, snapshots, onEdit, onDelete }: {
  goal: Goal; snapshots: { month: string; actual_invested: number }[]
  onEdit: (g: Goal) => void; onDelete: (g: Goal) => void
}) {
  const target    = goal.invest_target ?? 0
  const startDate = goal.invest_start  ?? ''
  const endDate   = goal.invest_end    ?? ''
  const today     = new Date().toISOString().slice(0, 7)

  const allMonths = useMemo(() => startDate && endDate ? monthsBetween(startDate, endDate) : [], [startDate, endDate])
  const totalMonths     = allMonths.length
  const perMonthTarget  = totalMonths > 0 ? target / totalMonths : 0

  const relevantSnaps = useMemo(() => {
    if (!allMonths.length) return []
    const sm = startDate.slice(0, 7), em = endDate.slice(0, 7)
    return snapshots.filter(s => s.month >= sm && s.month <= em && s.actual_invested > 0)
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [snapshots, startDate, endDate, allMonths])

  const monthlyData = useMemo(() => allMonths.map((month, i) => {
    const snap     = relevantSnaps.find(s => s.month === month)
    const prevSnap = relevantSnaps.filter(s => s.month < month).slice(-1)[0]
    let invested = 0
    if (snap && i > 0) invested = prevSnap ? snap.actual_invested - prevSnap.actual_invested : 0
    return {
      month, label: monthLabel(month), invested, target: perMonthTarget,
      hasData: !!snap, isFuture: month > today, isCurrent: month === today,
    }
  }), [allMonths, relevantSnaps, perMonthTarget, today])

  // Total invested = last snap - first snap in window
  const firstSnap = relevantSnaps[0], lastSnap = relevantSnaps[relevantSnaps.length - 1]
  const totalInvested = firstSnap && lastSnap ? lastSnap.actual_invested - firstSnap.actual_invested : 0
  const pct        = target > 0 ? Math.min((totalInvested / target) * 100, 100) : 0
  const remaining  = Math.max(0, target - totalInvested)
  const isAchieved = totalInvested >= target
  const monthsLeft = monthsUntil(endDate)
  const elapsed    = allMonths.filter(m => m <= today).length

  const ringColor = isAchieved ? '#16A34A' : pct >= 75 ? '#0F766E' : pct >= 40 ? '#2563EB' : '#F59E0B'

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isAchieved ? 'border-green-200' : 'border-[#E0DDD6]'}`}>
      <div className="px-5 pt-4 pb-0 flex items-center gap-2">
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 uppercase tracking-wider">💰 Investment Goal</span>
        {isAchieved && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Achieved 🏆</span>}
      </div>

      <div className="p-5 flex items-start gap-4">
        <div className="relative shrink-0">
          <RingProgress pct={pct} color={ringColor} size={88} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[16px] font-black font-mono leading-none" style={{ color: ringColor }}>{pct.toFixed(0)}%</span>
            <span className="text-[8px] text-[#ABABAB] font-semibold uppercase tracking-wider mt-0.5">done</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-black text-[#1A1A1A] leading-tight mb-2">{goalTitle(goal)}</h3>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {[
              { label: 'Target',         value: fmt(target),           color: '#1A1A1A' },
              { label: 'Invested',       value: fmt(totalInvested),    color: '#0F766E' },
              ...(!isAchieved ? [{ label: 'Remaining', value: fmt(remaining), color: '#C0392B' }] : []),
              { label: 'Monthly target', value: `${fmt(perMonthTarget)}/mo`, color: '#767676' },
              { label: 'Progress',       value: `${elapsed} / ${totalMonths} months`, color: '#767676' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#ABABAB]">{label}</p>
                <p className="text-[13px] font-black font-mono" style={{ color }}>{value}</p>
              </div>
            ))}
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#ABABAB]">Period</p>
              <p className="text-[12px] font-bold text-[#1A1A1A]">
                {fmtDate(startDate)} — {fmtDate(endDate)}
                {monthsLeft != null && !isAchieved && (
                  <span className={`ml-1.5 text-[10px] font-mono ${monthsLeft < 0 ? 'text-[#C0392B]' : monthsLeft < 3 ? 'text-amber-600' : 'text-[#767676]'}`}>
                    {monthsLeft < 0 ? `${Math.abs(monthsLeft)}m overdue` : monthsLeft === 0 ? 'ends this month' : `${monthsLeft}m left`}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={() => onEdit(goal)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#767676] hover:bg-[#F5F4F0] hover:text-[#1A1A1A] transition-colors text-sm">✏️</button>
          <button onClick={() => onDelete(goal)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#767676] hover:bg-red-50 hover:text-[#C0392B] transition-colors text-sm">🗑</button>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="px-5 pb-3">
        <div className="h-2 w-full bg-[#F0EEE9] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: ringColor }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-[#ABABAB] font-mono">₹0</span>
          <span className="text-[9px] text-[#ABABAB] font-mono">{fmt(target)}</span>
        </div>
      </div>

      {/* Monthly bar chart */}
      {monthlyData.length > 0 && (
        <div className="border-t border-[#F5F4F0] px-5 pt-4 pb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#ABABAB]">Month-by-month invested vs target</p>
            <div className="flex items-center gap-3 text-[9px] text-[#ABABAB]">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: '#0F766E' }} />On target</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: '#F59E0B' }} />Below</span>
              <span className="flex items-center gap-1"><span className="w-5 border-t-2 border-dashed border-[#ABABAB] inline-block" />Target/mo</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#ABABAB' }} axisLine={false} tickLine={false}
                interval={Math.max(0, Math.floor(monthlyData.length / 6) - 1)} />
              <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 8, fill: '#ABABAB' }} axisLine={false} tickLine={false} width={54} />
              <ReferenceLine y={perMonthTarget} stroke="#ABABAB" strokeDasharray="4 3" strokeWidth={1.5} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload
                const diff = d.invested - d.target
                return (
                  <div className="bg-white border border-[#E0DDD6] rounded-xl shadow-lg px-3 py-2 text-[11px]">
                    <div className="font-bold text-[#1A1A1A] mb-1.5">{d.label}</div>
                    <div className="flex justify-between gap-4"><span className="text-[#767676]">Invested</span><span className="font-mono font-bold text-[#0F766E]">{fmt(d.invested)}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-[#767676]">Monthly target</span><span className="font-mono text-[#767676]">{fmt(d.target)}</span></div>
                    {d.hasData && (
                      <div className="flex justify-between gap-4 border-t border-[#F0EEE9] pt-1 mt-1">
                        <span className="text-[#767676]">vs target</span>
                        <span className={`font-mono font-bold ${diff >= 0 ? 'text-[#0F766E]' : 'text-[#C0392B]'}`}>{diff >= 0 ? '+' : ''}{fmt(diff)}</span>
                      </div>
                    )}
                    {d.isFuture && <p className="text-[9px] text-[#ABABAB] mt-1">Future month</p>}
                    {!d.hasData && !d.isFuture && <p className="text-[9px] text-amber-600 mt-1">No snapshot for this month</p>}
                  </div>
                )
              }} />
              <Bar dataKey="invested" radius={[3, 3, 0, 0]} maxBarSize={30}>
                {monthlyData.map((d, i) => (
                  <Cell key={i}
                    fill={d.isFuture ? '#F0EEE9' : d.hasData && d.invested >= perMonthTarget ? '#0F766E' : d.hasData ? '#F59E0B' : '#E0DDD6'}
                    fillOpacity={d.isFuture ? 0.5 : 0.9} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {relevantSnaps.length === 0 && (
            <p className="text-[11px] text-[#ABABAB] mt-3 text-center">Take monthly snapshots with actual invested data to track progress here.</p>
          )}
        </div>
      )}
    </div>
  )
}

function NetWorthGoalCard({ goal, currentNetWorth, snapshots, onEdit, onDelete }: {
  goal: Goal; currentNetWorth: number
  snapshots: { month: string; net_worth: number }[]
  onEdit: (g: Goal) => void; onDelete: (g: Goal) => void
}) {
  const pct = currentNetWorth > 0 ? Math.min((currentNetWorth / goal.target_amount) * 100, 100) : 0
  const remaining = Math.max(0, goal.target_amount - currentNetWorth)
  const months    = monthsUntil(goal.deadline)
  const isAchieved = currentNetWorth >= goal.target_amount

  const projection = useMemo(() => {
    if (snapshots.length < 2 || !goal.deadline) return []
    const last3 = snapshots.slice(-3)
    const rates = last3.slice(1).map((s, i) => { const p = last3[i].net_worth; return p > 0 ? (s.net_worth - p) / p : 0 })
    const avg   = rates.reduce((a, b) => a + b, 0) / rates.length
    const end   = new Date(goal.deadline), now = new Date()
    const left  = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth())
    if (left <= 0) return []
    const pts: { label: string; projected: number; target: number }[] = []
    let val = currentNetWorth
    for (let i = 1; i <= Math.min(left, 24); i++) {
      val *= (1 + avg)
      const d = new Date(now); d.setMonth(d.getMonth() + i)
      pts.push({ label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), projected: Math.round(val), target: goal.target_amount })
    }
    return pts
  }, [snapshots, goal.deadline, goal.target_amount, currentNetWorth])

  const projectedHit = projection.find(p => p.projected >= goal.target_amount)
  const ringColor = isAchieved ? '#16A34A' : pct >= 75 ? '#0F766E' : pct >= 40 ? '#2563EB' : '#F59E0B'

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isAchieved ? 'border-green-200' : 'border-[#E0DDD6]'}`}>
      <div className="px-5 pt-4 pb-0 flex items-center gap-2">
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 uppercase tracking-wider">📈 Net Worth Goal</span>
        {isAchieved && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Achieved 🏆</span>}
      </div>

      <div className="p-5 flex items-start gap-4">
        <div className="relative shrink-0">
          <RingProgress pct={pct} color={ringColor} size={88} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[16px] font-black font-mono leading-none" style={{ color: ringColor }}>{pct.toFixed(0)}%</span>
            <span className="text-[8px] text-[#ABABAB] font-semibold uppercase tracking-wider mt-0.5">done</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-black text-[#1A1A1A] leading-tight mb-2">{goalTitle(goal)}</h3>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {[
              { label: 'Target',    value: fmt(goal.target_amount), color: '#1A1A1A' },
              { label: 'Current',   value: fmt(currentNetWorth),    color: '#0F766E' },
              ...(!isAchieved ? [{ label: 'Remaining', value: fmt(remaining), color: '#C0392B' }] : []),
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#ABABAB]">{label}</p>
                <p className="text-[13px] font-black font-mono" style={{ color }}>{value}</p>
              </div>
            ))}
            {goal.deadline && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#ABABAB]">Deadline</p>
                <p className="text-[13px] font-bold text-[#1A1A1A]">
                  {fmtDate(goal.deadline)}
                  {months != null && !isAchieved && (
                    <span className={`ml-1.5 text-[10px] font-mono ${months < 0 ? 'text-[#C0392B]' : months < 6 ? 'text-amber-600' : 'text-[#767676]'}`}>
                      {months < 0 ? `${Math.abs(months)}m overdue` : months === 0 ? 'this month' : `${months}m left`}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
          {projectedHit && !isAchieved && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 bg-[#E1F5EE] rounded-lg px-2.5 py-1">
              <span style={{ fontSize: 10 }}>📈</span>
              <span className="text-[10px] font-semibold text-[#0F766E]">On track to hit target by {projectedHit.label}</span>
            </div>
          )}
          {months != null && months > 0 && !projectedHit && !isAchieved && snapshots.length >= 2 && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 bg-amber-50 rounded-lg px-2.5 py-1">
              <span style={{ fontSize: 10 }}>⚠️</span>
              <span className="text-[10px] font-semibold text-amber-700">Projected to fall short at current growth rate</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={() => onEdit(goal)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#767676] hover:bg-[#F5F4F0] hover:text-[#1A1A1A] transition-colors text-sm">✏️</button>
          <button onClick={() => onDelete(goal)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#767676] hover:bg-red-50 hover:text-[#C0392B] transition-colors text-sm">🗑</button>
        </div>
      </div>

      <div className="px-5 pb-3">
        <div className="h-2 w-full bg-[#F0EEE9] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: ringColor }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-[#ABABAB] font-mono">₹0</span>
          <span className="text-[9px] text-[#ABABAB] font-mono">{fmt(goal.target_amount)}</span>
        </div>
      </div>

      {projection.length > 1 && !isAchieved && (
        <div className="border-t border-[#F5F4F0] px-5 pt-3 pb-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-[#ABABAB] mb-2">Growth trajectory</p>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={projection} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#ABABAB' }} axisLine={false} tickLine={false} interval={Math.floor(projection.length / 4)} />
              <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 8, fill: '#ABABAB' }} axisLine={false} tickLine={false} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="bg-white border border-[#E0DDD6] rounded-xl shadow-lg px-3 py-2 text-[11px]">
                    <div className="font-bold mb-1">{payload[0].payload.label}</div>
                    {payload.map((p: any) => (
                      <div key={p.dataKey} className="flex justify-between gap-4">
                        <span className="text-[#767676]">{p.name}</span>
                        <span className="font-mono font-bold" style={{ color: p.color }}>{fmt(p.value)}</span>
                      </div>
                    ))}
                  </div>
                )
              }} />
              <Line type="monotone" dataKey="projected" stroke={ringColor} strokeWidth={2} dot={false} name="Projected" />
              <Line type="monotone" dataKey="target" stroke="#E0DDD6" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Target" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function SummaryBar({ goals, currentNetWorth }: { goals: Goal[]; currentNetWorth: number }) {
  const nwGoals   = goals.filter(g => g.goal_type === 'networth')
  const invGoals  = goals.filter(g => g.goal_type === 'investment')
  const achieved  = nwGoals.filter(g => currentNetWorth >= g.target_amount).length
  const inProgress = nwGoals.filter(g => currentNetWorth < g.target_amount).length
  const nearest   = nwGoals.filter(g => currentNetWorth < g.target_amount).sort((a, b) => a.target_amount - b.target_amount)[0]
  // Best NW progress %
  const bestPct   = nwGoals.length > 0
    ? Math.max(...nwGoals.map(g => Math.min((currentNetWorth / g.target_amount) * 100, 100)))
    : 0

  const cards = [
    { label: 'NW Goals',      value: nwGoals.length.toString(),                                icon: '🎯' },
    { label: 'Invest. Goals', value: invGoals.length.toString(),                               icon: '💰' },
    { label: 'Best Progress', value: nwGoals.length > 0 ? `${bestPct.toFixed(0)}%` : '—',     icon: '📊' },
    { label: 'Next Target',   value: nearest ? fmt(nearest.target_amount) : achieved > 0 ? '✓ All done!' : '—', icon: '📍' },
  ] as { label: string; value: string; icon: string }[]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map(({ label, value, icon }) => (
        <div key={label} className="bg-white rounded-2xl border border-[#E0DDD6] shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#767676]">{label}</span>
            <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
          </div>
          <div className="text-[20px] font-extrabold font-mono text-[#1A1A1A] leading-none">{value}</div>
        </div>
      ))}
    </div>
  )
}

export default function GoalsPage() {
  const { data: goals = [], isLoading, createMutation, updateMutation, deleteMutation } = useGoals()
  const p = usePortfolioTotals()
  const { data: snapshots = [] } = useSnapshots()
  const showToast = useToastStore(s => s.show)

  const [addOpen,    setAddOpen]    = useState(false)
  const [editGoal,   setEditGoal]   = useState<Goal | null>(null)
  const [deleteGoal, setDeleteGoal] = useState<Goal | null>(null)

  const snapsForInvest = snapshots.map(s => ({ month: s.month, actual_invested: s.actual_invested }))

  async function handleCreate(input: GoalInput) {
    try { await createMutation.mutateAsync(input); showToast('Goal created!', 'success'); setAddOpen(false) }
    catch { showToast('Failed to create goal', 'error') }
  }
  async function handleUpdate(input: GoalInput) {
    if (!editGoal) return
    try { await updateMutation.mutateAsync({ id: editGoal.id, input }); showToast('Goal updated', 'success'); setEditGoal(null) }
    catch { showToast('Failed to update goal', 'error') }
  }
  async function handleDelete() {
    if (!deleteGoal) return
    try { await deleteMutation.mutateAsync(deleteGoal.id); showToast('Goal deleted', 'info'); setDeleteGoal(null) }
    catch { showToast('Failed to delete goal', 'error') }
  }

  if (isLoading || p.anyLoading) return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-2xl bg-[#F5F4F0] animate-pulse" />)}
      </div>
      {[1,2].map(i => <div key={i} className="h-44 rounded-2xl bg-[#F5F4F0] animate-pulse" />)}
    </div>
  )

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-[#1A1A1A] tracking-tight">Goals</h1>
          <p className="text-[11px] text-[#767676] mt-0.5">Net worth targets and investment goals</p>
        </div>
        <button onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F766E] text-white text-[13px] font-bold hover:bg-[#0D4F4A] active:scale-95 transition-all shadow-sm">
          + New goal
        </button>
      </div>

      {goals.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#E0DDD6] bg-white p-12 flex flex-col items-center gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#F5F4F0] flex items-center justify-center text-3xl">🎯</div>
          <div>
            <h3 className="text-[16px] font-bold text-[#1A1A1A] mb-2">No goals yet</h3>
            <p className="text-[13px] text-[#767676] max-w-sm leading-relaxed">
              Set a net worth milestone like ₹1Cr, or an investment goal like "invest ₹16L this financial year."
            </p>
          </div>
          <button onClick={() => setAddOpen(true)} className="h-10 px-6 rounded-xl bg-[#1A1A1A] hover:bg-[#333] text-white text-[13px] font-bold transition-colors">
            + Create your first goal
          </button>
        </div>
      )}

      {goals.length > 0 && (
        <>
          <SummaryBar goals={goals} currentNetWorth={p.totalVal} />
          <div className="flex flex-col gap-4">
            {goals.map(goal => goal.goal_type === 'investment'
              ? <InvestmentGoalCard key={goal.id} goal={goal} snapshots={snapsForInvest} onEdit={setEditGoal} onDelete={setDeleteGoal} />
              : <NetWorthGoalCard key={goal.id} goal={goal} currentNetWorth={p.totalVal} snapshots={snapshots} onEdit={setEditGoal} onDelete={setDeleteGoal} />
            )}
          </div>
        </>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New goal" maxWidth="max-w-md">
        <GoalForm onSave={handleCreate} onClose={() => setAddOpen(false)} saving={createMutation.isPending} />
      </Modal>
      <Modal open={!!editGoal} onClose={() => setEditGoal(null)} title="Edit goal" maxWidth="max-w-md">
        {editGoal && <GoalForm initial={editGoal} onSave={handleUpdate} onClose={() => setEditGoal(null)} saving={updateMutation.isPending} />}
      </Modal>
      <Modal open={!!deleteGoal} onClose={() => setDeleteGoal(null)} title="Delete goal" maxWidth="max-w-sm">
        {deleteGoal && (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-[#3D3D3D] leading-relaxed">Delete <strong>"{goalTitle(deleteGoal)}"</strong>? This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteGoal(null)} className="flex-1 h-10 rounded-xl border border-[#E0DDD6] bg-[#F5F4F0] text-[#767676] text-[13px] font-semibold hover:bg-[#EFEDE8] transition-all">Cancel</button>
              <button onClick={handleDelete} disabled={deleteMutation.isPending} className="flex-1 h-10 rounded-xl bg-[#C0392B] text-white text-[13px] font-bold hover:bg-[#A93226] transition-all disabled:opacity-50">
                {deleteMutation.isPending ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
