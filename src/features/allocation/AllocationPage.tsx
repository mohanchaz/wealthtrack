import { useState } from 'react'
import { useAllocations } from '../../hooks/useAllocations'
import { AllocationDonut } from '../../components/charts/AllocationDonut'
import { EditAllocationModal } from './EditAllocationModal'
import { Button } from '../../components/ui/Button'
import { PageSpinner } from '../../components/ui/Spinner'
import { CHART_COLORS } from '../../constants/chartColors'

const TIPS = [
  { icon: '🎯', title: 'Target Mix',       body: 'Set the percentage you want in each asset class. This is your long-term goal, not your current holdings.' },
  { icon: '✏️', title: 'Customise Freely', body: 'Click Edit to rename, add, or remove asset classes. The total must always equal 100%.' },
  { icon: '📊', title: 'Stay on Track',    body: 'Once you add real assets, WealthTrack compares your actual portfolio to this target automatically.' },
]

export default function AllocationPage() {
  const { data: allocations = [], isLoading, error, seedMutation, saveMutation } = useAllocations()
  const [editOpen, setEditOpen] = useState(false)

  if (isLoading) return <PageSpinner />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
        <p className="text-sm text-red">{String(error)}</p>
      </div>
    )
  }

  if (!allocations.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] gap-5 text-center">
        <div className="w-14 h-14 rounded-2xl bg-teal/10 border border-teal/20 flex items-center justify-center text-3xl">
          ◎
        </div>
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
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-2xl font-extrabold text-textprim tracking-tight">Ideal Allocation</h1>
          <p className="text-sm text-textmut mt-0.5">Your target portfolio mix across asset classes</p>
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)} size="sm">
          ✏️ Edit
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Bar list */}
        <div className="lg:col-span-3 rounded-2xl border border-border bg-white p-6 shadow-card animate-fade-up delay-1">
          <h2 className="text-sm font-bold text-textprim mb-5">Target Allocation</h2>
          <div className="flex flex-col gap-4">
            {allocations.map((a, i) => {
              const pct   = (a.percentage * 100).toFixed(1)
              const color = CHART_COLORS[i % CHART_COLORS.length]
              return (
                <div key={a.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                      <span className="text-sm font-medium text-textprim">{a.item}</span>
                    </div>
                    <span className="text-sm font-bold font-mono" style={{ color }}>{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}80)` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Donut */}
          <div className="rounded-2xl border border-border bg-white p-5 shadow-card animate-fade-up delay-2">
            <h2 className="text-sm font-bold text-textprim mb-4">Distribution</h2>
            <AllocationDonut allocations={allocations} />
          </div>

          {/* Tips */}
          <div className="rounded-2xl border border-border bg-white p-5 shadow-card animate-fade-up delay-3">
            <h2 className="text-sm font-bold text-textprim mb-4">About Ideal Allocation</h2>
            <div className="flex flex-col gap-4">
              {TIPS.map(t => (
                <div key={t.title} className="flex gap-3">
                  <span className="text-lg shrink-0 mt-0.5">{t.icon}</span>
                  <div>
                    <div className="text-xs font-bold text-textprim mb-1">{t.title}</div>
                    <div className="text-xs text-textsec leading-relaxed">{t.body}</div>
                  </div>
                </div>
              ))}
            </div>
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
