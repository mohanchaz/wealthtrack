import { useState } from 'react'
import { useActualInvested } from '../../hooks/useActualInvested'
import type { ActualTable } from '../../services/actualInvestedService'
import { INR, formatDate } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Input }  from '../ui/Input'

interface Props { table: ActualTable }

export function ActualInvestedPanel({ table }: Props) {
  const { data = [], addMutation, deleteMutation } = useActualInvested(table)
  const [showForm,  setShowForm]  = useState(false)
  const [amount,    setAmount]    = useState('')
  const [entryDate, setEntryDate] = useState('')
  const [error,     setError]     = useState('')
  const [selected,  setSelected]  = useState<Set<string>>(new Set())
  const [deleting,  setDeleting]  = useState(false)
  const [showForm,  setShowForm]  = useState(false)

  const total    = data.reduce((s, r) => s + r.amount, 0)
  const allIds   = data.map(e => e.id)
  const allCheck = allIds.length > 0 && allIds.every(id => selected.has(id))
  const anyCheck = selected.size > 0

  const toggleAll = () => allCheck ? setSelected(new Set()) : setSelected(new Set(allIds))
  const toggleOne = (id: string) => setSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const handleAdd = async () => {
    const n = parseFloat(amount)
    if (!n || n <= 0) return
    setError('')
    try {
      await addMutation.mutateAsync({ amount: n, entryDate: entryDate || undefined })
      setAmount(''); setEntryDate(''); setShowForm(false)
    } catch (e) { setError((e as Error).message) }
  }

  const handleDeleteSelected = async () => {
    if (!confirm(`Delete ${selected.size} entr${selected.size > 1 ? 'ies' : 'y'}?`)) return
    setDeleting(true)
    try {
      for (const id of selected) await deleteMutation.mutateAsync(id)
      setSelected(new Set())
    } finally { setDeleting(false) }
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold text-textmut uppercase tracking-widest">Actual Invested</span>
          <span className="text-sm font-extrabold font-mono text-teal">{INR(total)}</span>
        </div>
        <Button size="sm" onClick={() => setShowForm(f => !f)} className="w-full" variant={showForm ? 'secondary' : 'primary'}>
          {showForm ? '✕ Cancel' : '+ Add Entry'}
        </Button>
        {showForm && (
          <div className="flex flex-col gap-2 mt-2">
            <Input prefix="₹" type="number" placeholder="Amount" value={amount}
              onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            <Input type="date" value={entryDate}
              onChange={e => setEntryDate(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            <Button size="sm" onClick={handleAdd} loading={addMutation.isPending} className="w-full">
              Save Entry
            </Button>
            {error && <p className="text-[10px] text-red bg-red/5 border border-red/20 rounded-lg px-2 py-1 leading-snug">{error}</p>}
          </div>
        )}
      </div>

      {/* Entries */}
      <div className="max-h-96 overflow-y-auto">
        {data.length === 0 ? (
          <div className="py-6 text-center text-xs text-textfade">No entries yet</div>
        ) : (
          <>
            {/* Select-all header */}
            <div className="px-4 py-2 border-b border-border bg-surface2/40">
              <div className="flex items-center text-[10px] font-bold text-textmut uppercase tracking-widest gap-2">
                <input type="checkbox" checked={allCheck} onChange={toggleAll}
                  className="w-3 h-3 rounded accent-ink cursor-pointer" title="Select all" />
                <span className="flex-1">Amount</span>
                <span className="w-24 text-right">Date</span>
              </div>
            </div>

            {/* Delete bar */}
            {anyCheck && (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-red/5 border-b border-red/20">
                <span className="text-[10px] font-semibold text-red flex-1">{selected.size} selected</span>
                <button onClick={handleDeleteSelected} disabled={deleting}
                  className="text-[10px] font-bold px-2 py-1 rounded bg-red text-white hover:bg-red/80 disabled:opacity-50 transition-colors">
                  {deleting ? '…' : `🗑 Delete`}
                </button>
                <button onClick={() => setSelected(new Set())}
                  className="text-[10px] text-textmut hover:text-textprim transition-colors">
                  Cancel
                </button>
              </div>
            )}

            {data.map((entry, i) => (
              <div key={entry.id}
                className={`flex items-center px-4 py-2.5 border-b border-border/40 last:border-0 hover:bg-surface2 transition-colors gap-2 ${
                  selected.has(entry.id) ? 'bg-red/5' : i % 2 === 1 ? 'bg-surface2/20' : ''
                }`}
              >
                <input type="checkbox" checked={selected.has(entry.id)} onChange={() => toggleOne(entry.id)}
                  className="w-3 h-3 rounded accent-ink cursor-pointer shrink-0" />
                <span className="flex-1 font-mono font-bold text-xs text-textprim">{INR(entry.amount)}</span>
                <span className="w-24 text-right text-[11px] text-textmut">
                  {formatDate(entry.entry_date ?? entry.created_at)}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
