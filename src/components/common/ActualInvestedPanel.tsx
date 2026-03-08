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
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-textmut uppercase tracking-widest">Actual Invested</span>
        <span className="text-sm font-bold font-mono text-teal">{INR(total)}</span>
      </div>

      {/* Two-column layout: form left, table right */}
      <div className="flex gap-4 items-start">

        {/* Left — Add form */}
        <div className="flex flex-col gap-2 w-56 shrink-0">
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
          <Button
            size="sm"
            onClick={handleAdd}
            loading={addMutation.isPending}
            className="w-full"
          >
            + Add
          </Button>
          {error && (
            <p className="text-[10px] text-red leading-tight">{error}</p>
          )}
        </div>

        {/* Right — Entries table */}
        <div className="flex-1 min-w-0">
          {data.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-xs text-textfade">
              No entries yet
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface2">
                    <th className="px-3 py-2 text-left font-bold text-textmut uppercase tracking-wider">Amount</th>
                    <th className="px-3 py-2 text-left font-bold text-textmut uppercase tracking-wider">Date</th>
                    <th className="px-3 py-2 w-6" />
                  </tr>
                </thead>
                <tbody>
                  {data.map((entry, i) => (
                    <tr
                      key={entry.id}
                      className={`border-b border-border/50 last:border-0 ${i % 2 === 0 ? '' : 'bg-surface2/50'}`}
                    >
                      <td className="px-3 py-2 font-mono font-semibold text-textprim">
                        {INR(entry.amount)}
                      </td>
                      <td className="px-3 py-2 text-textmut">
                        {formatDate(entry.entry_date ?? entry.created_at)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => deleteMutation.mutate(entry.id)}
                          className="text-textfade hover:text-red transition-colors"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
