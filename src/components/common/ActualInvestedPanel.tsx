import { useState } from 'react'
import { useActualInvested } from '../../hooks/useActualInvested'
import type { ActualTable } from '../../services/actualInvestedService'
import { INR, formatDate } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Input }  from '../ui/Input'

interface Props { table: ActualTable }

export function ActualInvestedPanel({ table }: Props) {
  const { data = [], addMutation, deleteMutation } = useActualInvested(table)
  const [amount,    setAmount]    = useState('')
  const [entryDate, setEntryDate] = useState('')
  const [error,     setError]     = useState('')

  const total = data.reduce((s, r) => s + r.amount, 0)

  const handleAdd = async () => {
    const n = parseFloat(amount)
    if (!n || n <= 0) return
    setError('')
    try {
      await addMutation.mutateAsync({ amount: n, entryDate: entryDate || undefined })
      setAmount('')
      setEntryDate('')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="flex flex-col">

      {/* Header + form */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold text-textmut uppercase tracking-widest">Actual Invested</span>
          <span className="text-sm font-extrabold font-mono text-teal">{INR(total)}</span>
        </div>
        <div className="flex flex-col gap-2">
          <Input
            prefix="₹"
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <Input
            type="date"
            value={entryDate}
            onChange={e => setEntryDate(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <Button size="sm" onClick={handleAdd} loading={addMutation.isPending} className="w-full">
            + Add Entry
          </Button>
          {error && (
            <p className="text-[10px] text-red bg-red/5 border border-red/20 rounded-lg px-2 py-1 leading-snug">{error}</p>
          )}
        </div>
      </div>

      {/* Entries */}
      <div className="max-h-96 overflow-y-auto">
        {data.length === 0 ? (
          <div className="py-6 text-center text-xs text-textfade">No entries yet</div>
        ) : (
          <>
            <div className="px-4 py-2 border-b border-border bg-surface2/40">
              <div className="flex text-[10px] font-bold text-textmut uppercase tracking-widest">
                <span className="flex-1">Amount</span>
                <span className="w-24 text-right">Date</span>
                <span className="w-6" />
              </div>
            </div>
            {data.map((entry, i) => (
              <div
                key={entry.id}
                className={`flex items-center px-4 py-2.5 border-b border-border/40 last:border-0 hover:bg-surface2 transition-colors ${
                  i % 2 === 1 ? 'bg-surface2/20' : ''
                }`}
              >
                <span className="flex-1 font-mono font-bold text-xs text-textprim">{INR(entry.amount)}</span>
                <span className="w-24 text-right text-[11px] text-textmut">
                  {formatDate(entry.entry_date ?? entry.created_at)}
                </span>
                <button
                  onClick={() => deleteMutation.mutate(entry.id)}
                  className="w-6 flex items-center justify-center text-textfade hover:text-red transition-colors ml-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </>
        )}
      </div>

    </div>
  )
}
