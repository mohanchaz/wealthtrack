import { useState } from 'react'
import { useActualInvested } from '../../hooks/useActualInvested'
import type { ActualTable } from '../../services/actualInvestedService'
import { INR, formatDate } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

interface Props { table: ActualTable }

export function ActualInvestedPanel({ table }: Props) {
  const { data = [], addMutation, deleteMutation } = useActualInvested(table)
  const [amount, setAmount] = useState('')
  const [note,   setNote]   = useState('')

  const total = data.reduce((s, r) => s + r.amount, 0)

  const handleAdd = async () => {
    const n = parseFloat(amount)
    if (!n) return
    await addMutation.mutateAsync({ amount: n, note })
    setAmount('')
    setNote('')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-textmut uppercase tracking-widest">Actual Invested</span>
        <span className="text-sm font-bold font-mono text-teal">{INR(total)}</span>
      </div>

      {/* Add row */}
      <div className="flex gap-2 items-end">
        <Input
          prefix="₹"
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="w-32"
        />
        <Input
          type="text"
          placeholder="Note (optional)"
          value={note}
          onChange={e => setNote(e.target.value)}
          className="flex-1"
        />
        <Button size="sm" onClick={handleAdd} loading={addMutation.isPending}>
          Add
        </Button>
      </div>

      {/* Entries */}
      {data.length > 0 && (
        <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
          {data.map(entry => (
            <div key={entry.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-surface2">
              <span className="font-mono font-semibold text-textprim">{INR(entry.amount)}</span>
              {entry.note && <span className="text-textmut mx-2 flex-1 truncate">{entry.note}</span>}
              <span className="text-textfade mr-2">{formatDate(entry.created_at)}</span>
              <button
                onClick={() => deleteMutation.mutate(entry.id)}
                className="text-textfade hover:text-red transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
