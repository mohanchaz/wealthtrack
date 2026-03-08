import type { ReactNode } from 'react'

export interface Column<T> {
  key:        string
  header:     string
  render:     (row: T) => ReactNode
  align?:     'left' | 'right' | 'center'
  className?: string
  width?:     string
}

interface Props<T> {
  columns:    Column<T>[]
  data:       T[]
  rowKey:     (row: T) => string
  emptyText?: string
  loading?:   boolean
}

export function AssetTable<T>({ columns, data, rowKey, emptyText = 'No data', loading }: Props<T>) {
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
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border bg-surface2/60">
            {columns.map(col => (
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
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={rowKey(row)}
              className={`border-b border-border/50 hover:bg-surface2 transition-colors duration-100 ${
                i % 2 === 1 ? 'bg-surface2/30' : ''
              }`}
            >
              {columns.map(col => (
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
