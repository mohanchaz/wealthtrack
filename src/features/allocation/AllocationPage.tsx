import { useState } from 'react'
import { useAllocations } from '../../hooks/useAllocations'
import { usePortfolioTotals, ALLOC_COLORS } from '../../hooks/usePortfolioTotals'
import { EditAllocationModal } from './EditAllocationModal'
import { Button } from '../../components/ui/Button'
import { PageSpinner } from '../../components/ui/Spinner'
import { INR } from '../../lib/utils'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

function fmt(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`
  return INR(n)
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="bg-white border border-[#E0DDD6] rounded-xl shadow-lg px-3 py-2 text-[11px]">
      <div className="font-bold text-[#1A1A1A]">{name}</div>
      <div className="text-[#767676]">{value.toFixed(1)}%</div>
    </div>
  )
}

function MiniDonut({ data, label }: { data: { name: string; value: number; color: string }[]; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#767676] mb-1">{label}</p>
      <ResponsiveContainer width="100%" height={140}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={38} outerRadius={58}
            paddingAngle={2} dataKey="value">
            {data.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
          </Pie>
          <Tooltip content={<PieTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-x-2 gap-y-0.5 mt-1">
        {data.filter(d => d.value > 0.1).map(d => (
          <div key={d.name} className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-[9px] text-[#767676]">{d.name} {d.value.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AllocationPage() {
  const { data: allocations = [], isLoading, error, seedMutation, saveMutation } = useAllocations()
  const p = usePortfolioTotals()
  const [editOpen, setEditOpen] = useState(false)

  if (isLoading) return <PageSpinner />
  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
      <p className="text-sm text-red">{String(error)}</p>
    </div>
  )

  if (!allocations.length) return (
    <div className="flex flex-col items-center justify-center min-h-[420px] gap-5 text-center">
      <div className="w-14 h-14 rounded-2xl bg-teal/10 border border-teal/20 flex items-center justify-center text-3xl">◎</div>
      <div>
        <h3 className="text-base font-bold text-textprim mb-1.5">No allocation set yet</h3>
        <p className="text-sm text-textsec max-w-xs leading-relaxed">
          Define your ideal portfolio mix to see how your holdings compare to your targets.
        </p>
      </div>
      <Button onClick={() => seedMutation.mutate()} loading={seedMutation.isPending}>
        Load default allocation →
      </Button>
    </div>
  )

  const actualPieData = allocations.map(alloc => {
    const bucket = p.allocationBuckets.find(b => b.key === alloc.item)
    const color  = ALLOC_COLORS[alloc.item] ?? '#767676'
    const pct    = p.totalVal > 0 && bucket ? (bucket.val / p.totalVal) * 100 : 0
    return { name: alloc.item, value: pct, color }
  }).filter(d => d.value > 0.1)

  const targetPieData = allocations.map(alloc => ({
    name:  alloc.item,
    value: alloc.percentage * 100,
    color: ALLOC_COLORS[alloc.item] ?? '#767676',
  })).filter(d => d.value > 0.1)

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-xl font-black text-[#1A1A1A] tracking-tight">Allocation</h1>
          <p className="text-[11px] text-[#767676] mt-0.5">Target vs actual portfolio weights</p>
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)} size="sm">
          ✏️ Edit targets
        </Button>
      </div>

      {/* Pie charts + Target vs Actual side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-up">

        {/* ── Two donuts ─────────────────────────────────── */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-[#E0DDD6] shadow-sm p-4">
          <div className="grid grid-cols-2 gap-2">
            <MiniDonut data={actualPieData} label="Actual" />
            <MiniDonut data={targetPieData} label="Target" />
          </div>
        </div>

        {/* ── Target vs Actual compact table ─────────────── */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E0DDD6] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[#F0EEE9] flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#1A1A1A]">Target vs Actual</h2>
            <span className="text-[10px] text-[#767676]">actual / <strong className="text-[#1A1A1A]">target</strong></span>
          </div>
          <div className="px-4 py-1">
            {allocations.map(alloc => {
              const bucket    = p.allocationBuckets.find(b => b.key === alloc.item)
              const color     = ALLOC_COLORS[alloc.item] ?? '#767676'
              const targetPct = alloc.percentage * 100
              const actualPct = p.totalVal > 0 && bucket ? (bucket.val / p.totalVal) * 100 : 0
              const diff      = actualPct - targetPct
              const diffAbs   = Math.abs(diff)
              const over      = diff > 0.5
              const under     = diff < -0.5
              const onTrack   = !over && !under

              return (
                <div key={alloc.id} className="py-1.5 border-b border-[#F5F4F0] last:border-0 flex items-center gap-2">
                  {/* Dot + name */}
                  <div className="flex items-center gap-1.5 w-32 shrink-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-[11px] font-semibold text-[#1A1A1A] truncate">{alloc.item}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="flex-1 relative h-3">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full h-1 rounded-full bg-[#F0EEE9]" />
                    </div>
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full h-1 rounded-full overflow-hidden">
                        <div className="h-full rounded-full opacity-20 transition-all duration-700"
                          style={{ width: `${targetPct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                    <div className="absolute top-1 bottom-1 w-0.5 rounded-full bg-[#C8C4BE]"
                      style={{ left: `calc(${targetPct}% - 1px)` }} />
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full h-1.5 rounded-full overflow-hidden bg-transparent">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(actualPct, 100)}%`, backgroundColor: color, opacity: p.anyLoading ? 0.3 : 1 }} />
                      </div>
                    </div>
                  </div>

                  {/* Pct values */}
                  <div className="text-right w-20 shrink-0">
                    <span className="text-[10px] font-mono text-[#767676]">{p.anyLoading ? '…' : `${actualPct.toFixed(1)}%`}</span>
                    <span className="text-[9px] text-[#C8C4BE] mx-0.5">/</span>
                    <span className="text-[10px] font-mono font-bold text-[#1A1A1A]">{targetPct.toFixed(1)}%</span>
                  </div>

                  {/* Badge */}
                  <div className="w-16 shrink-0 text-right">
                    {!p.anyLoading && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                        onTrack ? 'bg-green-100 text-green-700'
                        : over   ? 'bg-amber-100 text-amber-700'
                        :          'bg-red-100 text-red-600'
                      }`}>
                        {onTrack ? '✓' : over ? `+${diffAbs.toFixed(1)}%` : `-${diffAbs.toFixed(1)}%`}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <EditAllocationModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        allocations={allocations}
        onSave={items => saveMutation.mutateAsync(items)}
      />
    </div>
  )
}
