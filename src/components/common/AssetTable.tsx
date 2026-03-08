import { useState, type ReactNode } from 'react'

export interface Column<T> {
  key:        string
  header:     string
  render:     (row: T) => ReactNode
  align?:     'left' | 'right' | 'center'
  className?: string
  width?:     string
}

interface Props<T> {
  columns:      Column<T>[]
  data:         T[]
  rowKey:       (row: T) => string
  emptyText?:   string
  loading?:     boolean
  onEditRow?:   (row: T) => void
  onDeleteRows?: (ids: string[]) => Promise<void>
}

export function AssetTable<T>({ columns, data, rowKey, emptyText = 'No data', loading, onEditRow, onDeleteRows }: Props<T>) {
  const [selected,  setSelected]  = useState<Set<string>>(new Set())
  const [deleting,  setDeleting]  = useState(false)

  const allIds     = data.map(rowKey)
  const allChecked = allIds.length > 0 && allIds.every(id => selected.has(id))
  const anyChecked = selected.size > 0

  const toggleAll = () => {
    if (allChecked) setSelected(new Set())
    else setSelected(new Set(allIds))
  }

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleDeleteSelected = async () => {
    if (!onDeleteRows || selected.size === 0) return
    if (!confirm(`Delete ${selected.size} selected item${selected.size > 1 ? 's' : ''}?`)) return
    setDeleting(true)
    try {
      await onDeleteRows([...selected])
      setSelected(new Set())
    } finally {
      setDeleting(false)
    }
  }

  // Strip 'actions' column — we manage edit/delete ourselves
  const displayCols = columns.filter(c => c.key !== 'actions')
  const hasEdit     = !!onEditRow

  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 skeleton w-full" style={{ animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="py-10 text-center text-sm text-textmut">{emptyText}</div>
    )
  }

  return (
    <div className="w-full overflow-hidden">
      {/* Delete bar — appears when rows selected */}
      {anyChecked && onDeleteRows && (
        <div className="flex items-center gap-3 px-4 py-2 bg-red/5 border-b border-red/20">
          <span className="text-xs font-semibold text-red">{selected.size} selected</span>
          <button
            onClick={handleDeleteSelected}
            disabled={deleting}
            className="ml-auto text-xs font-bold px-3 py-1.5 rounded-lg bg-red text-white hover:bg-red/80 disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Deleting…' : `🗑 Delete ${selected.size}`}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-textmut hover:text-textprim transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border bg-surface2/60">
            {/* Checkbox header */}
            {onDeleteRows && (
              <th className="px-3 py-3 w-8">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  className="w-3.5 h-3.5 rounded accent-ink cursor-pointer"
                  title="Select all"
                />
              </th>
            )}
            {displayCols.map(col => (
              <th
                key={col.key}
                className={`
                  px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-textfade whitespace-nowrap
                  ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                  ${col.width ?? ''}
                `}
              >
                {col.header}
              </th>
            ))}
            {/* Edit column header */}
            {hasEdit && <th className="px-3 py-3 w-8" />}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const id         = rowKey(row)
            const isSelected = selected.has(id)
            return (
              <tr
                key={id}
                className={`border-b border-border/50 hover:bg-surface2 transition-colors duration-100 ${
                  isSelected ? 'bg-red/5' : i % 2 === 1 ? 'bg-surface2/30' : ''
                }`}
              >
                {onDeleteRows && (
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(id)}
                      className="w-3.5 h-3.5 rounded accent-ink cursor-pointer"
                    />
                  </td>
                )}
                {displayCols.map(col => (
                  <td
                    key={col.key}
                    className={`
                      px-4 py-3 text-textprim
                      ${col.align === 'right' ? 'text-right font-mono tabular-nums' : col.align === 'center' ? 'text-center' : ''}
                      ${col.className ?? ''}
                    `}
                  >
                    {col.render(row)}
                  </td>
                ))}
                {hasEdit && (
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() => onEditRow(row)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-textmut hover:bg-surface2 hover:text-teal transition-colors mx-auto"
                    >
                      ✏
                    </button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
