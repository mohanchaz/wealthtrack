import { useState } from 'react'
import { useAllocations } from '../../hooks/useAllocations'
import { usePortfolioTotals, ALLOC_COLORS } from '../../hooks/usePortfolioTotals'
import { EditAllocationModal } from './EditAllocationModal'
import { Button } from '../../components/ui/Button'
import { PageSpinner } from '../../components/ui/Spinner'
import { INR } from '../../lib/utils'

function fmt(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`
  return INR(n)
}

export default function AllocationPage() {
  const { data: allocations = [], isLoading, error, seedMutation, saveMutation } = useAllocations()
  const p = usePortfolioTotals()
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
          <h1 className="text-2xl font-extrabold text-textprim tracking-tight">Allocation</h1>
          <p className="text-sm text-textmut mt-0.5">Target vs actual portfolio weights</p>
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)} size="sm">
          ✏️ Edit targets
        </Button>
      </div>

      {/* Target vs Actual — full panel */}
      <div className="rounded-2xl border border-border bg-white shadow-card animate-fade-up delay-1 overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold text-textprim">Target vs Actual</h2>
          <div className="flex items-center gap-4 text-[11px] text-textmut">
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-2 rounded-full bg-[#1A1A1A] opacity-80" />
              <span>Actual</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-px h-4 bg-border2" />
              <span>Target</span>
            </div>
            <span className="text-textfade font-mono">actual% / <strong className="text-textprim">target%</strong></span>
          </div>
        </div>

        <div className="px-6 py-4 space-y-1">
          {allocations.map((alloc) => {
            const bucket   = p.allocationBuckets.find(b => b.key === alloc.item)
            const color    = ALLOC_COLORS[alloc.item] ?? '#767676'
            const targetPct = alloc.percentage * 100
            const actualPct = p.totalVal > 0 && bucket ? (bucket.val / p.totalVal) * 100 : 0
            const diff      = actualPct - targetPct
            const diffAbs   = Math.abs(diff)
            const over      = diff > 0.5
            const under     = diff < -0.5
            const onTrack   = !over && !under

            return (
              <div key={alloc.id} className="py-3 border-b border-border/50 last:border-0">
                {/* Label row */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-sm font-semibold text-textprim">{alloc.item}</span>
                    {!p.anyLoading && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        onTrack ? 'bg-green/8 text-green'
                        : over   ? 'bg-amber-50 text-amber-700'
                        :          'bg-red/8 text-red'
                      }`}>
                        {onTrack ? '✓ on track'
                          : over ? `+${diffAbs.toFixed(1)}% over`
                          :        `${diffAbs.toFixed(1)}% under`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-5">
                    {bucket && !p.anyLoading && (
                      <span className="text-sm font-mono font-semibold text-textsec">
                        {fmt(bucket.val)}
                      </span>
                    )}
                    <div className="text-right w-24">
                      <span className="text-[12px] font-mono text-textmut">
                        {p.anyLoading ? '…' : `${actualPct.toFixed(1)}%`}
                      </span>
                      <span className="text-[11px] text-border2 mx-1">/</span>
                      <span className="text-[12px] font-mono text-textprim font-bold">{targetPct.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                {/* Dual progress bar */}
                <div className="relative h-5">
                  {/* Background track */}
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full h-1.5 rounded-full bg-surface2" />
                  </div>
                  {/* Target ghost fill */}
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full h-1.5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full opacity-20 transition-all duration-700"
                        style={{ width: `${targetPct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                  {/* Target tick */}
                  <div className="absolute top-1 bottom-1 w-0.5 rounded-full bg-border2"
                    style={{ left: `calc(${targetPct}% - 1px)` }} />
                  {/* Actual bar */}
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full h-2.5 rounded-full overflow-hidden bg-transparent">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(actualPct, 100)}%`, backgroundColor: color, opacity: p.anyLoading ? 0.3 : 1 }} />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
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
