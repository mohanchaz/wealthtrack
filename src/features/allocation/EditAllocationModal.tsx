import { useState, useCallback } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import type { IdealAllocation } from '../../types'

interface Row { name: string; pct: string }

interface Props {
  open:        boolean
  onClose:     () => void
  allocations: IdealAllocation[]
  onSave:      (items: { name: string; pct: number }[]) => Promise<void>
}

function TotalBadge({ total }: { total: number }) {
  const r    = Math.round(total * 10) / 10
  const diff = Math.abs(r - 100)
  const ok   = diff < 0.05
  const over = r > 100

  return (
    <span className={`text-xs font-mono font-bold px-3 py-1.5 rounded-lg border ${
      ok   ? 'bg-green/8 border-green/25 text-green2' :
      over ? 'bg-red/8 border-red/25 text-red2' :
             'bg-amber/8 border-amber/25 text-amber2'
    }`}>
      {ok   ? `✓ ${r}%` :
       over ? `${r}% (+${(r-100).toFixed(1)}%)` :
              `${r}% (${(100-r).toFixed(1)}% to go)`}
    </span>
  )
}

export function EditAllocationModal({ open, onClose, allocations, onSave }: Props) {
  const [rows,   setRows]   = useState<Row[]>(() =>
    allocations.map(a => ({ name: a.item, pct: (a.percentage * 100).toFixed(1) }))
  )
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const resetRows = useCallback(() => {
    setRows(allocations.map(a => ({ name: a.item, pct: (a.percentage * 100).toFixed(1) })))
    setError(null)
  }, [allocations])

  const total = rows.reduce((s, r) => s + (parseFloat(r.pct) || 0), 0)

  const update = (i: number, k: keyof Row, v: string) =>
    setRows(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r))

  const handleSave = async () => {
    const items = rows
      .map(r => ({ name: r.name.trim(), pct: parseFloat(r.pct) || 0 }))
      .filter(r => r.name && r.pct > 0)
    if (!items.length) { setError('Add at least one valid row.'); return }
    if (Math.abs(items.reduce((s, r) => s + r.pct, 0) - 100) > 0.5) {
      setError('Total must equal 100%.'); return
    }
    setSaving(true); setError(null)
    try { await onSave(items); onClose() }
    catch (e) { setError(String(e)) }
    finally { setSaving(false) }
  }

  return (
    <Modal
      open={open}
      onClose={() => { resetRows(); onClose() }}
      title="Edit Allocation"
      maxWidth="max-w-xl"
      footer={
        <>
          <TotalBadge total={total} />
          <div className="flex-1" />
          <Button variant="secondary" onClick={() => { resetRows(); onClose() }}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save Allocation</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_120px_32px] gap-2 px-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-textmut">Asset / Item</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-textmut text-right">% Allocation</span>
          <span />
        </div>

        {/* Rows */}
        <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto pr-1">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_120px_32px] gap-2 items-center">
              <input
                type="text"
                placeholder="e.g. India Equity MF"
                value={row.name}
                onChange={e => update(i, 'name', e.target.value)}
                className="h-8 px-3 rounded-xl border border-border bg-white text-sm text-textprim placeholder:text-textfade outline-none focus:border-teal focus:ring-2 focus:ring-teal/15 transition-all"
              />
              <div className="relative">
                <input
                  type="number"
                  placeholder="0.0"
                  min="0" max="100" step="0.1"
                  value={row.pct}
                  onChange={e => update(i, 'pct', e.target.value)}
                  className="h-8 w-full px-3 pr-6 rounded-xl border border-border bg-white text-sm text-textprim font-mono placeholder:text-textfade outline-none focus:border-teal focus:ring-2 focus:ring-teal/15 transition-all text-right"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-textmut text-xs pointer-events-none">%</span>
              </div>
              <button
                onClick={() => setRows(p => p.filter((_, idx) => idx !== i))}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-textfade hover:bg-red/8 hover:text-red transition-colors text-xs"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => setRows(p => [...p, { name: '', pct: '' }])}
          className="flex items-center gap-2 text-xs text-teal hover:text-teal2 transition-colors py-1"
        >
          <span className="w-5 h-5 rounded-lg bg-teal/10 border border-teal/20 flex items-center justify-center font-bold">+</span>
          Add Row
        </button>

        {error && <p className="text-xs text-red font-medium">{error}</p>}
      </div>
    </Modal>
  )
}
