import { INR, GBP, formatDate, formatPct } from '../../lib/utils'
import { SpinnerWrap } from '../ui/Spinner'

export interface ColDef {
  key: string
  label: string
  align?: 'right' | 'left'
  fmt?: 'inr' | 'pct' | 'date' | 'name' | 'mono' | 'gold_type' | 'qty_diff' | 'alloc_pct' | 'gbp'
  bold?: boolean
  fw?: string
}

function formatCell(val: unknown, col: ColDef): string {
  if (val === null || val === undefined || val === '') return '—'
  const v = val as string | number
  switch (col.fmt) {
    case 'inr':      return INR(+v)
    case 'gbp':      return GBP(+v)
    case 'pct':      return formatPct(+v)
    case 'date':     return formatDate(String(v))
    case 'name':
      return `<span style="color:var(--muted);font-size:12px">${v || '—'}</span>`
    case 'mono':
      return `<span style="font-family:monospace;font-size:12px">${v}</span>`
    case 'gold_type':
      return v === 'ETF'
        ? `<span style="background:#fff3cd;color:#856404;padding:1px 7px;border-radius:20px;font-size:11px;font-weight:600">ETF</span>`
        : `<span style="background:var(--accentbg);color:var(--accent);padding:1px 7px;border-radius:20px;font-size:11px;font-weight:600">MF</span>`
    case 'qty_diff': {
      const n = +v
      if (!n || isNaN(n)) return '<span style="color:var(--muted2)">—</span>'
      const arrow = n > 0 ? '▲' : '▼'
      const color = n > 0 ? 'var(--green)' : 'var(--danger)'
      return `<span style="color:${color};font-weight:600">${arrow} ${Math.abs(n)}</span>`
    }
    case 'alloc_pct': {
      const n = +v
      if (!n || isNaN(n)) return '<span style="color:var(--muted2)">—</span>'
      const bw = Math.min(n, 100).toFixed(1)
      return `<span style="display:inline-flex;align-items:center;gap:6px;justify-content:flex-end">
        <span style="width:48px;height:5px;background:var(--border2);border-radius:99px;overflow:hidden;display:inline-block">
          <span style="display:block;height:100%;width:${bw}%;background:var(--accent);border-radius:99px"></span>
        </span>
        <b style="font-size:12px;color:var(--accent)">${n.toFixed(1)}%</b>
      </span>`
    }
    default:
      return col.bold
        ? `<b>${v}</b>`
        : col.fw
        ? `<span style="font-weight:${col.fw}">${v}</span>`
        : String(v)
  }
}

interface AssetTableProps {
  columns: ColDef[]
  rows: Record<string, unknown>[]
  isLoading?: boolean
  onRowEdit?: (row: Record<string, unknown>) => void
  emptyMessage?: string
}

export function AssetTable({ columns, rows, isLoading, onRowEdit, emptyMessage }: AssetTableProps) {
  if (isLoading) return <SpinnerWrap />

  return (
    <div className="assets-table-wrap">
      <table className="assets-table">
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} className={c.align === 'right' ? 'right' : ''}>{c.label}</th>
            ))}
            {onRowEdit && <th></th>}
          </tr>
        </thead>
        <tbody>
          {!rows.length ? (
            <tr>
              <td colSpan={columns.length + (onRowEdit ? 1 : 0)}>
                <div className="assets-empty">
                  <div className="empty-icon">📭</div>
                  <p>{emptyMessage ?? 'No data yet'}</p>
                </div>
              </td>
            </tr>
          ) : rows.map((row, i) => (
            <tr key={(row.id as string) ?? i}>
              {columns.map(col => (
                <td
                  key={col.key}
                  className={col.align === 'right' ? 'right' : ''}
                  dangerouslySetInnerHTML={{ __html: formatCell(row[col.key], col) }}
                />
              ))}
              {onRowEdit && (
                <td style={{ textAlign: 'right' }}>
                  <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, opacity: 0.65 }}
                    onClick={() => onRowEdit(row)}
                    title="Edit"
                  >🖊️</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
