import { useState, type ReactNode } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

interface Props<T> {
  open:      boolean
  onClose:   () => void
  title:     string
  hint?:     string
  parse:     (text: string) => T[] | null
  columns:   { key: keyof T & string; header: string; align?: 'right' | 'left' }[]
  renderCell?: (row: T, key: keyof T & string) => ReactNode
  onImport:  (rows: T[]) => Promise<void>
}

export function CsvImportModal<T extends Record<string, unknown>>({
  open, onClose, title, hint, parse, columns, renderCell, onImport,
}: Props<T>) {
  const [preview, setPreview]   = useState<T[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [filename, setFilename] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFilename(file.name); setError('')
    const reader = new FileReader()
    reader.onload = ev => {
      const rows = parse(ev.target?.result as string)
      if (!rows || !rows.length) { setError('Could not parse CSV — check format'); setPreview([]); return }
      setPreview(rows)
      setSelected(new Set(rows.map((_, i) => i)))
    }
    reader.readAsText(file)
  }

  const toggle = (i: number) => setSelected(prev => {
    const s = new Set(prev)
    s.has(i) ? s.delete(i) : s.add(i)
    return s
  })
  const allChecked = preview.length > 0 && selected.size === preview.length
  const toggleAll  = () => setSelected(allChecked ? new Set() : new Set(preview.map((_, i) => i)))

  const handleImport = async () => {
    const rows = preview.filter((_, i) => selected.has(i))
    if (!rows.length) return
    setLoading(true)
    try {
      await onImport(rows)
      setPreview([]); setSelected(new Set()); setFilename('')
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setPreview([]); setSelected(new Set()); setFilename(''); setError('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      maxWidth="max-w-2xl"
      footer={
        <div className="flex items-center gap-2 w-full justify-end">
          <Button variant="secondary" size="sm" onClick={handleClose}>Cancel</Button>
          {preview.length > 0 && selected.size > 0 && (
            <Button size="sm" onClick={handleImport} loading={loading}>
              📥 Import {selected.size} row{selected.size !== 1 ? 's' : ''}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {hint && (
          <p className="text-xs text-textmut leading-relaxed bg-surface2 rounded-xl px-3 py-2.5 border border-border">
            {hint}
          </p>
        )}

        {/* File picker */}
        <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-border hover:border-teal/40 hover:bg-teal/3 transition-colors cursor-pointer">
          <span className="text-2xl">📂</span>
          <span className="text-sm font-semibold text-textsec">
            {filename || 'Click to select CSV file'}
          </span>
          {filename && <span className="text-xs text-textmut">{filename}</span>}
          <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
        </label>

        {error && (
          <p className="text-xs text-red bg-red/5 border border-red/20 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Preview table */}
        {preview.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-textmut uppercase tracking-widest">
                Preview — {selected.size} of {preview.length} selected
              </span>
              <button
                onClick={toggleAll}
                className="text-xs text-teal hover:text-teal2 font-semibold transition-colors"
              >
                {allChecked ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-surface2">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 w-8">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          onChange={toggleAll}
                          className="w-3.5 h-3.5 accent-teal cursor-pointer"
                        />
                      </th>
                      {columns.map(col => (
                        <th
                          key={col.key}
                          className={`px-3 py-2 font-bold text-textmut uppercase tracking-wider ${
                            col.align === 'right' ? 'text-right' : 'text-left'
                          }`}
                        >
                          {col.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr
                        key={i}
                        onClick={() => toggle(i)}
                        className={`border-b border-border/50 cursor-pointer transition-colors ${
                          selected.has(i)
                            ? 'bg-white hover:bg-surface2'
                            : 'opacity-40 bg-surface2 hover:opacity-60'
                        }`}
                      >
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={selected.has(i)}
                            onChange={() => toggle(i)}
                            onClick={e => e.stopPropagation()}
                            className="w-3.5 h-3.5 accent-teal cursor-pointer"
                          />
                        </td>
                        {columns.map(col => (
                          <td
                            key={col.key}
                            className={`px-3 py-2 text-textprim font-mono ${
                              col.align === 'right' ? 'text-right' : ''
                            }`}
                          >
                            {renderCell ? renderCell(row, col.key) : String(row[col.key] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
