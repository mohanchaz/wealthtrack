import { useState, useMemo } from 'react'
import { useGoals }           from '../../hooks/useGoals'
import { usePortfolioTotals } from '../../hooks/usePortfolioTotals'
import { useSnapshots }       from '../../hooks/useSnapshots'
import { useToastStore }      from '../../store/toastStore'
import { Modal }              from '../../components/ui/Modal'
import type { Goal, GoalInput } from '../../services/goalService'
import { goalTitle } from '../../services/goalService'
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'

// ── Formatters ─────────────────────────────────────────────────
function fmt(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function fmtDate(d: string | null | undefined) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-')
  return new Date(+y, +mo - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

// ── Months remaining ───────────────────────────────────────────
function monthsUntil(deadline: string | null | undefined): number | null {
  if (!deadline) return null
  const now   = new Date()
  const end   = new Date(deadline)
  const diff  = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth())
  return diff
}

// ── Radial progress ring ───────────────────────────────────────
function RingProgress({ pct, color, size = 96 }: { pct: number; color: string; size?: number }) {
  const r   = (size - 10) / 2
  const c   = 2 * Math.PI * r
  const off = c - (Math.min(pct, 100) / 100) * c

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F0EEE9" strokeWidth={8} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={8}
        strokeDasharray={c} strokeDashoffset={off}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  )
}

// ── Projected trajectory from snapshots ───────────────────────
function ProjectedTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-[#E0DDD6] rounded-xl shadow-lg px-3 py-2 text-[11px]">
      <div className="font-bold text-[#1A1A1A] mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span className="text-[#767676]">{p.name}</span>
          <span className="font-mono font-bold" style={{ color: p.color }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Goal form modal ────────────────────────────────────────────
interface GoalFormProps {
  initial?:  Partial<Goal>
  onSave:    (input: GoalInput) => void
  onClose:   () => void
  saving:    boolean
}

function GoalForm({ initial, onSave, onClose, saving }: GoalFormProps) {
  const [amount,   setAmount]   = useState(initial?.target_amount?.toString() ?? '')
  const [deadline, setDeadline] = useState(initial?.deadline ?? '')
  const [error,    setError]    = useState('')

  function handleSave() {
    setError('')
    if (!amount || isNaN(+amount) || +amount <= 0) return setError('Enter a valid target amount.')
    onSave({
      target_amount: +amount,
      deadline:      deadline || null,
    })
  }

  const labelCls = 'text-[10px] font-bold uppercase tracking-widest text-[#767676] mb-1.5 block'
  const inputCls = 'w-full border border-[#E0DDD6] rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E]/20 transition-all'

  return (
    <div className="flex flex-col gap-4">

      <div>
        <label className={labelCls}>Target amount (₹)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[#767676]">₹</span>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="e.g. 10000000" className={`${inputCls} pl-7 font-mono`} />
        </div>
        <p className="text-[10px] text-[#ABABAB] mt-1">
          {amount && !isNaN(+amount) && +amount > 0 ? `= ${fmt(+amount)}` : ''}
        </p>
      </div>

      <div>
        <label className={labelCls}>Target date <span className="normal-case font-normal text-[#ABABAB]">optional</span></label>
        <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className={inputCls} />
      </div>

      {error && <p className="text-[11px] text-[#C0392B] font-semibold">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button onClick={onClose}
          className="flex-1 h-10 rounded-xl border border-[#E0DDD6] bg-[#F5F4F0] text-[#767676] text-[13px] font-semibold hover:bg-[#EFEDE8] transition-all">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 h-10 rounded-xl bg-[#0F766E] text-white text-[13px] font-bold hover:bg-[#0D4F4A] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {saving
            ? <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Saving…</>
            : initial?.id ? 'Update goal' : 'Create goal'
          }
        </button>
      </div>

    </div>
  )
}

// ── Delete confirm ─────────────────────────────────────────────
function DeleteConfirm({ goal, onConfirm, onCancel, deleting }: {
  goal: Goal; onConfirm: () => void; onCancel: () => void; deleting: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-[#3D3D3D] leading-relaxed">
        Delete <strong>"{ goalTitle(goal.target_amount) }"</strong>? This cannot be undone.
      </p>
      <div className="flex gap-2">
        <button onClick={onCancel}
          className="flex-1 h-10 rounded-xl border border-[#E0DDD6] bg-[#F5F4F0] text-[#767676] text-[13px] font-semibold hover:bg-[#EFEDE8] transition-all">
          Cancel
        </button>
        <button onClick={onConfirm} disabled={deleting}
          className="flex-1 h-10 rounded-xl bg-[#C0392B] text-white text-[13px] font-bold hover:bg-[#A93226] transition-all disabled:opacity-50">
          {deleting ? 'Deleting…' : 'Yes, delete'}
        </button>
      </div>
    </div>
  )
}

// ── Goal card ──────────────────────────────────────────────────
function GoalCard({
  goal, currentNetWorth, snapshots,
  onEdit, onDelete,
}: {
  goal:            Goal
  currentNetWorth: number
  snapshots:       { month: string; net_worth: number }[]
  onEdit:          (g: Goal) => void
  onDelete:        (g: Goal) => void
}) {
  const pct       = currentNetWorth > 0 ? Math.min((currentNetWorth / goal.target_amount) * 100, 100) : 0
  const remaining = Math.max(0, goal.target_amount - currentNetWorth)
  const months    = monthsUntil(goal.deadline)
  const isAchieved = currentNetWorth >= goal.target_amount

  // Monthly growth rate from snapshots for projection
  const projection = useMemo(() => {
    if (snapshots.length < 2 || !goal.deadline) return []
    const last3 = snapshots.slice(-3)
    const growthRates = last3.slice(1).map((s, i) => {
      const prev = last3[i].net_worth
      return prev > 0 ? (s.net_worth - prev) / prev : 0
    })
    const avgMonthlyGrowth = growthRates.reduce((a, b) => a + b, 0) / growthRates.length

    const endDate    = new Date(goal.deadline)
    const today      = new Date()
    const monthsLeft = (endDate.getFullYear() - today.getFullYear()) * 12 +
                       (endDate.getMonth() - today.getMonth())
    if (monthsLeft <= 0) return []

    const points: { label: string; projected: number; target: number }[] = []
    let val = currentNetWorth
    for (let i = 1; i <= Math.min(monthsLeft, 24); i++) {
      val *= (1 + avgMonthlyGrowth)
      const d = new Date(today)
      d.setMonth(d.getMonth() + i)
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
      points.push({ label, projected: Math.round(val), target: goal.target_amount })
    }
    return points
  }, [snapshots, goal.deadline, goal.target_amount, currentNetWorth])

  const projectedHit = projection.find(p => p.projected >= goal.target_amount)

  const ringColor = isAchieved ? '#16A34A'
    : pct >= 75   ? '#0F766E'
    : pct >= 40   ? '#2563EB'
    : '#F59E0B'

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
      isAchieved ? 'border-green-200' : 'border-[#E0DDD6]'
    }`}>

      {/* Card header */}
      <div className="p-5 flex items-start gap-4">

        {/* Ring */}
        <div className="relative shrink-0">
          <RingProgress pct={pct} color={ringColor} size={88} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[16px] font-black font-mono leading-none" style={{ color: ringColor }}>
              {pct.toFixed(0)}%
            </span>
            <span className="text-[8px] text-[#ABABAB] font-semibold uppercase tracking-wider mt-0.5">done</span>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-[15px] font-black text-[#1A1A1A] leading-tight">{ goalTitle(goal.target_amount) }</h3>
            {isAchieved && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                Achieved 🏆
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#ABABAB]">Target</p>
              <p className="text-[13px] font-black font-mono text-[#1A1A1A]">{fmt(goal.target_amount)}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#ABABAB]">Current</p>
              <p className="text-[13px] font-black font-mono text-[#0F766E]">{fmt(currentNetWorth)}</p>
            </div>
            {!isAchieved && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#ABABAB]">Remaining</p>
                <p className="text-[13px] font-black font-mono text-[#C0392B]">{fmt(remaining)}</p>
              </div>
            )}
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

          {/* Projection callout */}
          {projectedHit && !isAchieved && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 bg-[#E1F5EE] rounded-lg px-2.5 py-1">
              <span className="text-[#0F766E]" style={{ fontSize: 10 }}>📈</span>
              <span className="text-[10px] font-semibold text-[#0F766E]">
                On track to hit target by {projectedHit.label}
              </span>
            </div>
          )}
          {months != null && months > 0 && !projectedHit && !isAchieved && snapshots.length >= 2 && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 bg-amber-50 rounded-lg px-2.5 py-1">
              <span style={{ fontSize: 10 }}>⚠️</span>
              <span className="text-[10px] font-semibold text-amber-700">
                Projected to fall short at current growth rate
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={() => onEdit(goal)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#767676] hover:bg-[#F5F4F0] hover:text-[#1A1A1A] transition-colors text-sm">
            ✏️
          </button>
          <button onClick={() => onDelete(goal)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#767676] hover:bg-red-50 hover:text-[#C0392B] transition-colors text-sm">
            🗑
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-2">
        <div className="h-2 w-full bg-[#F0EEE9] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: ringColor }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-[#ABABAB] font-mono">₹0</span>
          <span className="text-[9px] text-[#ABABAB] font-mono">{fmt(goal.target_amount)}</span>
        </div>
      </div>

      {/* Projection mini-chart */}
      {projection.length > 1 && !isAchieved && (
        <div className="border-t border-[#F5F4F0] px-5 pt-3 pb-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-[#ABABAB] mb-2">
            Growth trajectory (based on recent trend)
          </p>
          <ResponsiveContainer width="100%" height={90}>
            <LineChart data={projection} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#ABABAB' }} axisLine={false} tickLine={false}
                interval={Math.floor(projection.length / 4)} />
              <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 8, fill: '#ABABAB' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ProjectedTooltip />} />
              <Line type="monotone" dataKey="projected" stroke={ringColor} strokeWidth={2}
                dot={false} name="Projected" />
              <Line type="monotone" dataKey="target" stroke="#E0DDD6" strokeWidth={1.5}
                strokeDasharray="4 3" dot={false} name="Target" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  )
}

// ── Summary stats ──────────────────────────────────────────────
function SummaryBar({ goals, currentNetWorth }: { goals: Goal[]; currentNetWorth: number }) {
  const achieved = goals.filter(g => currentNetWorth >= g.target_amount)
  const pending  = goals.filter(g => currentNetWorth < g.target_amount)
  const nearest  = pending.sort((a, b) => a.target_amount - b.target_amount)[0]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {([
        { label: 'Total goals', value: goals.length.toString(),    icon: '🎯' },
        { label: 'In progress', value: pending.length.toString(),  icon: '🏃' },
        { label: 'Achieved',    value: achieved.length.toString(), icon: '🏆' },
        { label: 'Next target', value: nearest ? fmt(nearest.target_amount) : '—', icon: '📍' },
      ] as { label: string; value: string; icon: string }[]).map(({ label, value, icon }) => (
        <div key={label} className="bg-white rounded-2xl border border-[#E0DDD6] shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#767676]">{label}</span>
            <span className="text-sm">{icon}</span>
          </div>
          <div className="text-[20px] font-extrabold font-mono text-[#1A1A1A] leading-none">{value}</div>
        </div>
      ))}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────
export default function GoalsPage() {
  const { data: goals = [], isLoading, createMutation, updateMutation, deleteMutation } = useGoals()
  const p         = usePortfolioTotals()
  const { data: snapshots = [] } = useSnapshots()
  const showToast = useToastStore(s => s.show)

  const [addOpen,    setAddOpen]    = useState(false)
  const [editGoal,   setEditGoal]   = useState<Goal | null>(null)
  const [deleteGoal, setDeleteGoal] = useState<Goal | null>(null)

  const currentNetWorth = p.totalVal

  async function handleCreate(input: GoalInput) {
    try {
      await createMutation.mutateAsync(input)
      showToast('Goal created!', 'success')
      setAddOpen(false)
    } catch {
      showToast('Failed to create goal', 'error')
    }
  }

  async function handleUpdate(input: GoalInput) {
    if (!editGoal) return
    try {
      await updateMutation.mutateAsync({ id: editGoal.id, input })
      showToast('Goal updated', 'success')
      setEditGoal(null)
    } catch {
      showToast('Failed to update goal', 'error')
    }
  }

  async function handleDelete() {
    if (!deleteGoal) return
    try {
      await deleteMutation.mutateAsync(deleteGoal.id)
      showToast('Goal deleted', 'info')
      setDeleteGoal(null)
    } catch {
      showToast('Failed to delete goal', 'error')
    }
  }

  if (isLoading || p.anyLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-2xl bg-[#F5F4F0] animate-pulse" />)}
        </div>
        {[1,2].map(i => <div key={i} className="h-44 rounded-2xl bg-[#F5F4F0] animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-[#1A1A1A] tracking-tight">Goals</h1>
          <p className="text-[11px] text-[#767676] mt-0.5">Set targets, track progress, stay motivated</p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F766E] text-white text-[13px] font-bold hover:bg-[#0D4F4A] active:scale-95 transition-all shadow-sm"
        >
          + New goal
        </button>
      </div>

      {/* Empty state */}
      {goals.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#E0DDD6] bg-white p-12 flex flex-col items-center gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#F5F4F0] flex items-center justify-center text-3xl">🎯</div>
          <div>
            <h3 className="text-[16px] font-bold text-[#1A1A1A] mb-2">No goals yet</h3>
            <p className="text-[13px] text-[#767676] max-w-sm leading-relaxed">
              Set a net worth milestone — like reaching ₹1Cr, building an emergency fund,
              or a retirement number — and track your progress over time.
            </p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="h-10 px-6 rounded-xl bg-[#1A1A1A] hover:bg-[#333] text-white text-[13px] font-bold transition-colors"
          >
            + Create your first goal
          </button>
        </div>
      )}

      {goals.length > 0 && (
        <>
          {/* Summary stats */}
          <SummaryBar goals={goals} currentNetWorth={currentNetWorth} />

          {/* Goal cards */}
          <div className="flex flex-col gap-4">
            {goals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                currentNetWorth={currentNetWorth}
                snapshots={snapshots}
                onEdit={setEditGoal}
                onDelete={setDeleteGoal}
              />
            ))}
          </div>
        </>
      )}

      {/* Add modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New goal" maxWidth="max-w-md">
        <GoalForm
          onSave={handleCreate}
          onClose={() => setAddOpen(false)}
          saving={createMutation.isPending}
        />
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editGoal} onClose={() => setEditGoal(null)} title="Edit goal" maxWidth="max-w-md">
        {editGoal && (
          <GoalForm
            initial={editGoal}
            onSave={handleUpdate}
            onClose={() => setEditGoal(null)}
            saving={updateMutation.isPending}
          />
        )}
      </Modal>

      {/* Delete modal */}
      <Modal open={!!deleteGoal} onClose={() => setDeleteGoal(null)} title="Delete goal" maxWidth="max-w-sm">
        {deleteGoal && (
          <DeleteConfirm
            goal={deleteGoal}
            onConfirm={handleDelete}
            onCancel={() => setDeleteGoal(null)}
            deleting={deleteMutation.isPending}
          />
        )}
      </Modal>

    </div>
  )
}
