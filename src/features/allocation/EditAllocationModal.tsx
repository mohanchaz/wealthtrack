import { useState, useCallback } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import type { IdealAllocation } from '../../types'

interface Row { name: string; pct: string }

interface Props {
  open:        boolean
  onClose:     () => void
  allocations: IdealAllocation[]
  onSave:      (items: { name: string; pct: number }[]) => Promise<void>
}

function TotalBadge({ total }: { total: number }) {
  const rounded  = Math.round(total * 10) / 10
  const diff     = Math.abs(rounded - 100)
  const isOk     = diff < 0.05
  const isOver   = rounded > 100

  return (
    <div className={`
      text-xs font-mono font-medium px-3 py-1.5 rounded-lg border
      ${isOk   ? 'bg-green/10 border-green/30 text-green' :
        isOver  ? 'bg-danger/10 border-danger/30 text-danger' :
                  'bg-amber/10 border-amber/30 text-amber'}
    `}>
      {isOk
        ? `✓ Total: ${rounded}%`
        : isOver
          ? `Total: ${rounded}% (over by ${(rounded - 100).toFixed(1)}%)`
          : `Total: ${rounded}% (need ${(100 - rounded).toFixed(1)}% more)`
      }
    </div>
  )
}

export function EditAllocationModal({ open, onClose, allocations, onSave }: Props) {
  const [rows, setRows]     = useState<Row[]>(() =>
    allocations.map(a => ({ name: a.item, pct: (a.percentage * 100).toFixed(1) }))
  )
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  // Reset rows when allocations prop changes
  const resetRows = useCallback(() => {
    setRows(allocations.map(a => ({ name: a.item, pct: (a.percentage * 100).toFixed(1) })))
    setError(null)
  }, [allocations])

  const total = rows.reduce((s, r) => s + (parseFloat(r.pct) || 0), 0)

  const updateRow = (i: number, field: keyof Row, val: string) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  }

  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i))

  const addRow = () => setRows(prev => [...prev, { name: '', pct: '' }])

  const handleSave = async () => {
    const items = rows
      .map(r => ({ name: r.name.trim(), pct: parseFloat(r.pct) || 0 }))
      .filter(r => r.name && r.pct > 0)

    if (!items.length) { setError('Add at least one valid row.'); return }
    if (Math.abs(items.reduce((s, r) => s + r.pct, 0) - 100) > 0.5) {
      setError('Total must equal 100%.'); return
    }

    setSaving(true)
    setError(null)
    try {
      await onSave(items)
      onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { resetRows(); onClose() }}
      title="Edit Ideal Allocation"
      maxWidth="max-w-xl"
      footer={
        <>
          <TotalBadge total={total} />
          <div className="flex-1" />
          <Button variant="secondary" onClick={() => { resetRows(); onClose() }}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Save Allocation
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_120px_32px] gap-2 px-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-textmut">Asset / Item</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-textmut text-right">% Allocation</span>
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
                onChange={e => updateRow(i, 'name', e.target.value)}
                className="h-8 px-3 rounded-lg bg-surface2 border border-border2 text-sm text-textprim placeholder:text-textmut outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
              />
              <div className="relative">
                <input
                  type="number"
                  placeholder="0.0"
                  min="0"
                  max="100"
                  step="0.1"
                  value={row.pct}
                  onChange={e => updateRow(i, 'pct', e.target.value)}
                  className="h-8 w-full px-3 pr-6 rounded-lg bg-surface2 border border-border2 text-sm text-textprim font-mono placeholder:text-textmut outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors text-right"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-textmut text-xs pointer-events-none">%</span>
              </div>
              <button
                onClick={() => removeRow(i)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-textmut hover:bg-danger/10 hover:text-danger transition-colors text-xs"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Add row */}
        <button
          onClick={addRow}
          className="flex items-center gap-2 text-xs text-textsec hover:text-textprim transition-colors py-1 px-1"
        >
          <span className="w-5 h-5 rounded-md bg-surface2 border border-border2 flex items-center justify-center text-accent">+</span>
          Add Row
        </button>

        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
