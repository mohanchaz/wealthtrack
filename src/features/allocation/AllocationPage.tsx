import { useState } from 'react'
import { useAllocations } from '../../hooks/useAllocations'
import { AllocationDonut } from '../../components/charts/AllocationDonut'
import { EditAllocationModal } from './EditAllocationModal'
import { Button } from '../../components/ui/Button'
import { PageSpinner } from '../../components/ui/Spinner'
import { CHART_COLORS } from '../../constants/chartColors'

const TIPS = [
  { icon: '🎯', title: 'Target Mix',        body: 'Set the % you want in each asset class. This is your long-term financial goal, not current holdings.' },
  { icon: '✏️', title: 'Customise Freely',  body: 'Click Edit to rename, add, or remove asset classes. Total must equal 100%.' },
  { icon: '📊', title: 'Stay on Track',     body: 'Once you add assets, WealthTrack will show how your actual portfolio compares to this target.' },
]

export default function AllocationPage() {
  const { data: allocations = [], isLoading, error, seedMutation, saveMutation } = useAllocations()
  const [editOpen, setEditOpen] = useState(false)

  if (isLoading) return <PageSpinner />

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
      <p className="text-sm text-danger">{String(error)}</p>
    </div>
  )

  if (allocations.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
      <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-2xl">
        ◎
      </div>
      <div>
        <h3 className="text-base font-semibold text-textprim mb-1">No allocation data yet</h3>
        <p className="text-sm text-textsec max-w-xs">Set up your ideal portfolio allocation to track how close your holdings are to your target.</p>
      </div>
      <Button
        onClick={() => seedMutation.mutate()}
        loading={seedMutation.isPending}
      >
        Set up defaults →
      </Button>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold text-textprim tracking-tight">Ideal Allocation</h1>
          <p className="text-sm text-textsec mt-0.5">Your target portfolio mix across asset classes</p>
        </div>
        <Button variant="secondary" onClick={() => setEditOpen(true)} size="sm">
          ✏️ Edit
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Allocation bar list */}
        <div className="lg:col-span-3 rounded-xl border border-border bg-surface p-5 animate-fade-up delay-1">
          <h2 className="text-sm font-semibold text-textprim mb-4">Target Allocation</h2>
          <div className="flex flex-col gap-3.5">
            {allocations.map((a, i) => {
              const pct   = (a.percentage * 100).toFixed(1)
              const color = CHART_COLORS[i % CHART_COLORS.length]
              return (
                <div key={a.id} className="group">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-sm text-textprim">{a.item}</span>
                    </div>
                    <span className="text-sm font-semibold font-mono" style={{ color }}>
                      {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}99)` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Donut chart */}
          <div className="rounded-xl border border-border bg-surface p-5 flex flex-col items-center animate-fade-up delay-2">
            <h2 className="text-sm font-semibold text-textprim mb-4 self-start">Distribution</h2>
            <AllocationDonut allocations={allocations} />
          </div>

          {/* Tips */}
          <div className="rounded-xl border border-border bg-surface p-5 animate-fade-up delay-3">
            <h2 className="text-sm font-semibold text-textprim mb-4">About Ideal Allocation</h2>
            <div className="flex flex-col gap-4">
              {TIPS.map(t => (
                <div key={t.title} className="flex gap-3">
                  <span className="text-lg shrink-0 mt-0.5">{t.icon}</span>
                  <div>
                    <div className="text-xs font-semibold text-textprim mb-1">{t.title}</div>
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
        onSave={(items) => saveMutation.mutateAsync(items)}
      />
    </div>
  )
}
