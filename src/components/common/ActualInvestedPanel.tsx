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

      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-textmut uppercase tracking-widest">Actual Invested</span>
          <span className="text-base font-extrabold font-mono text-teal">{INR(total)}</span>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-2.5">
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
            size="md"
            onClick={handleAdd}
            loading={addMutation.isPending}
            className="w-full"
          >
            + Add Entry
          </Button>
          {error && (
            <p className="text-[11px] text-red bg-red/5 border border-red/20 rounded-lg px-3 py-1.5 leading-snug">
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Entries list */}
      <div className="max-h-[420px] overflow-y-auto">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
            <span className="text-2xl opacity-30">₹</span>
            <p className="text-xs text-textfade">No entries yet</p>
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border">
                <th className="px-5 py-2.5 text-left font-bold text-textmut uppercase tracking-wider">Amount</th>
                <th className="px-5 py-2.5 text-left font-bold text-textmut uppercase tracking-wider">Date</th>
                <th className="px-3 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody>
              {data.map((entry, i) => (
                <tr
                  key={entry.id}
                  className={`border-b border-border/40 last:border-0 transition-colors hover:bg-surface2 ${
                    i % 2 === 0 ? 'bg-white' : 'bg-surface2/40'
                  }`}
                >
                  <td className="px-5 py-3 font-mono font-bold text-textprim">
                    {INR(entry.amount)}
                  </td>
                  <td className="px-5 py-3 text-textmut">
                    {formatDate(entry.entry_date ?? entry.created_at)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() => deleteMutation.mutate(entry.id)}
                      className="w-5 h-5 rounded-md flex items-center justify-center text-textfade hover:bg-red/10 hover:text-red transition-colors mx-auto"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  )
}
