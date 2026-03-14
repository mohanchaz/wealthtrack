import { useState, useRef, type ReactNode } from 'react'
import { ConfirmModal } from '../ui/ConfirmModal'

export interface Column<T> {
  key:        string
  header:     string
  render:     (row: T) => ReactNode
  align?:     'left' | 'right' | 'center'
  className?: string
  width?:     string

  // ── Bulk-edit support ─────────────────────────────────────
  editable?:   boolean
  editValue?:  (row: T) => string | number
  editType?:   'number' | 'text'
  editStep?:   string
  editPrefix?: string
}

export type BulkChange = { id: string } & Record<string, unknown>

interface Props<T> {
  columns:       Column<T>[]
  data:          T[]
  rowKey:        (row: T) => string
  emptyText?:    string
  loading?:      boolean
  onEditRow?:    (row: T) => void
  onDeleteRows?: (ids: string[]) => Promise<void>
  onBulkSave?:   (changes: BulkChange[]) => Promise<void>
}

function EditCell({ col, value, onChange }: {
  col:      Column<unknown>
  value:    string | number
  onChange: (v: string) => void
}) {
  const [val,     setVal]     = useState(String(value))
  const [changed, setChanged] = useState(false)

  const handleChange = (v: string) => {
    setVal(v)
    setChanged(v !== String(value))
    onChange(v)
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      {col.editPrefix && (
        <span className="text-[11px] text-textmut">{col.editPrefix}</span>
      )}
      <input
        type={col.editType ?? 'number'}
        step={col.editStep ?? '0.01'}
        defaultValue={String(value)}
        onChange={e => handleChange(e.target.value)}
        className={[
          'w-24 h-7 rounded-lg border text-[12px] font-mono px-2 text-right',
          'outline-none transition-all duration-150',
          changed
            ? 'border-[#0F766E] bg-[#E1F5EE] text-[#0F4A44] ring-1 ring-[#0F766E]/20'
            : 'border-border bg-surface2 text-textprim focus:border-[#0F766E] focus:bg-white',
        ].join(' ')}
      />
    </div>
  )
}

export function AssetTable<T>({
  columns, data, rowKey, emptyText = 'No data',
  loading, onEditRow, onDeleteRows, onBulkSave,
}: Props<T>) {

  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [deleting,    setDeleting]    = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editingIds,  setEditingIds]  = useState<Set<string>>(new Set())
  const [bulkSaving,  setBulkSaving]  = useState(false)
  const draftRef = useRef<Record<string, Record<string, string>>>({})

  const allIds     = data.map(rowKey)
  const allChecked = allIds.length > 0 && allIds.every(id => selected.has(id))
  const anyChecked = selected.size > 0
  const isEditing  = editingIds.size > 0
  const editCols   = columns.filter(c => c.editable && c.editValue)
  const hasBulkEdit = !!onBulkSave && editCols.length > 0

  const toggleAll = () => {
    if (isEditing) return
    if (allChecked) setSelected(new Set())
    else setSelected(new Set(allIds))
  }

  const toggleOne = (id: string) => {
    if (isEditing) return
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const doDelete = async () => {
    if (!onDeleteRows) return
    setConfirmOpen(false)
    setDeleting(true)
    try {
      await onDeleteRows([...selected])
      setSelected(new Set())
    } finally {
      setDeleting(false)
    }
  }

  const enterBulkEdit = () => {
    if (!onBulkSave || selected.size === 0) return
    const draft: Record<string, Record<string, string>> = {}
    data.forEach(row => {
      const id = rowKey(row)
      if (!selected.has(id)) return
      draft[id] = {}
      editCols.forEach(col => { draft[id][col.key] = String(col.editValue!(row)) })
    })
    draftRef.current = draft
    setEditingIds(new Set(selected))
    setSelected(new Set())
  }

  const saveBulkEdit = async () => {
    if (!onBulkSave) return
    setBulkSaving(true)
    try {
      const changes: BulkChange[] = [...editingIds].map(id => {
        const draft  = draftRef.current[id] ?? {}
        const change: BulkChange = { id }
        editCols.forEach(col => {
          const raw = draft[col.key]
          if (raw !== undefined)
            change[col.key] = col.editType === 'text' ? raw : parseFloat(raw)
        })
        return change
      })
      await onBulkSave(changes)
      setEditingIds(new Set())
      draftRef.current = {}
    } finally {
      setBulkSaving(false)
    }
  }

  const cancelBulkEdit = () => {
    setEditingIds(new Set())
    draftRef.current = {}
  }

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
    return <div className="py-10 text-center text-sm text-textmut">{emptyText}</div>
  }

  return (
    <div className="w-full overflow-x-auto -webkit-overflow-scrolling-touch">

      {/* ── Selection bar ─────────────────────────────────────── */}
      {anyChecked && !isEditing && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#0F766E]/8 border-b border-[#0F766E]/20 animate-fade-up">
          <span className="text-xs font-bold text-[#0F766E]">
            {selected.size} row{selected.size !== 1 ? 's' : ''} selected
          </span>

          {hasBulkEdit && (
            <button
              onClick={enterBulkEdit}
              className="ml-2 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-[#0F766E] text-white hover:bg-[#0D5F58] transition-colors"
            >
              ✏ Edit {selected.size} selected
            </button>
          )}

          {onDeleteRows && (
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={deleting}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-red text-white hover:bg-red2 disabled:opacity-50 transition-colors"
            >
              {deleting ? 'Deleting…' : `🗑 Delete ${selected.size}`}
            </button>
          )}

          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-textmut hover:text-textprim transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Bulk-edit save bar ─────────────────────────────────── */}
      {isEditing && (
        <div className="flex items-center gap-3 px-4 py-2 bg-[#E1F5EE] border-b border-[#0F766E]/25 animate-fade-up">
          <span className="text-xs font-bold text-[#0F766E]">
            Editing {editingIds.size} row{editingIds.size !== 1 ? 's' : ''}
          </span>
          <span className="text-xs text-[#0F766E]/60 hidden sm:inline">
            — modify the highlighted fields below, then save all at once
          </span>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={saveBulkEdit}
              disabled={bulkSaving}
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-lg bg-[#0F766E] text-white hover:bg-[#0D5F58] disabled:opacity-60 transition-colors"
            >
              {bulkSaving
                ? <><span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" /><span>Saving…</span></>
                : <>💾 Save all</>
              }
            </button>
            <button
              onClick={cancelBulkEdit}
              disabled={bulkSaving}
              className="text-xs text-[#0F766E]/70 hover:text-[#0F766E] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <table className="w-full min-w-[540px] text-xs border-collapse">
        <thead>
          <tr className="border-b border-border bg-surface2/60">
            {(onDeleteRows || hasBulkEdit) && (
              <th className="px-3 py-3 w-8">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  disabled={isEditing}
                  className="w-3.5 h-3.5 rounded accent-ink cursor-pointer disabled:opacity-30"
                  title="Select all"
                />
              </th>
            )}

            {displayCols.map(col => (
              <th
                key={col.key}
                className={[
                  'px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-textfade whitespace-nowrap',
                  col.align === 'right'  ? 'text-right'  : '',
                  col.align === 'center' ? 'text-center' : 'text-left',
                  col.width ?? '',
                ].join(' ')}
              >
                {col.header}
                {col.editable && isEditing && (
                  <span className="ml-1 text-[8px] font-bold text-[#0F766E] opacity-60">✏</span>
                )}
              </th>
            ))}

            {hasEdit && <th className="px-3 py-3 w-8" />}
          </tr>
        </thead>

        <tbody>
          {data.map((row, i) => {
            const id           = rowKey(row)
            const isSelected   = selected.has(id)
            const isRowEditing = editingIds.has(id)

            return (
              <tr
                key={id}
                className={[
                  'border-b border-border/50 transition-colors duration-100',
                  isRowEditing  ? 'bg-[#F0FAF7]'
                  : isSelected  ? 'bg-[#0F766E]/5'
                  : i % 2 === 1 ? 'bg-surface2/30 hover:bg-surface2'
                                : 'hover:bg-surface2',
                  bulkSaving && isRowEditing ? 'opacity-60 pointer-events-none' : '',
                ].join(' ')}
              >
                {(onDeleteRows || hasBulkEdit) && (
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected || isRowEditing}
                      onChange={() => toggleOne(id)}
                      disabled={isEditing}
                      className="w-3.5 h-3.5 rounded accent-ink cursor-pointer disabled:opacity-30"
                    />
                  </td>
                )}

                {displayCols.map(col => (
                  <td
                    key={col.key}
                    className={[
                      'px-4 py-2.5 text-textprim',
                      col.align === 'right'  ? 'text-right font-mono tabular-nums' : '',
                      col.align === 'center' ? 'text-center' : '',
                      col.className ?? '',
                    ].join(' ')}
                  >
                    {isRowEditing && col.editable && col.editValue ? (
                      <EditCell
                        col={col as Column<unknown>}
                        value={col.editValue(row)}
                        onChange={v => {
                          if (!draftRef.current[id]) draftRef.current[id] = {}
                          draftRef.current[id][col.key] = v
                        }}
                      />
                    ) : (
                      col.render(row)
                    )}
                  </td>
                ))}

                {hasEdit && (
                  <td className="px-3 py-2.5 text-center">
                    {!isEditing && (
                      <button
                        onClick={() => onEditRow(row)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-textmut hover:bg-surface2 hover:text-teal transition-colors mx-auto"
                        title="Edit row"
                      >
                        ✏
                      </button>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>

      {confirmOpen && (
        <ConfirmModal
          message={`Delete ${selected.size} selected item${selected.size > 1 ? 's' : ''}? This cannot be undone.`}
          onConfirm={doDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  )
}
