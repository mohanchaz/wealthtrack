import { useState } from 'react'
import { useActualInvested } from '../../hooks/useActualInvested'
import { useToast } from '../../store/uiStore'
import { INR } from '../../lib/utils'
import { Modal } from '../ui/Modal'
import { SpinnerWrap } from '../ui/Spinner'
import type { ActualInvestedRow } from '../../types/assets'

interface Props {
  table: string
  title?: string
  onTotalChange?: (total: number) => void
}

export function ActualInvestedPanel({ table, title = 'Actual Invested Entries', onTotalChange }: Props) {
  const toast = useToast()
  const { data = [], isLoading, saveMutation, deleteMutation } = useActualInvested(table)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ActualInvestedRow | null>(null)
  const [date, setDate] = useState('')
  const [amount, setAmount] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)

  const grand = data.reduce((s, r) => s + (+r.amount || 0), 0)
  if (onTotalChange) onTotalChange(grand)

  const openAdd = () => { setEditing(null); setDate(''); setAmount(''); setModalOpen(true) }
  const openEdit = (row: ActualInvestedRow) => {
    setEditing(row)
    setDate(row.entry_date)
    setAmount(String(row.amount))
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!date) { toast('Date is required', 'error'); return }
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast('Amount must be > 0', 'error'); return }
    try {
      await saveMutation.mutateAsync({ id: editing?.id, entry_date: date, amount: amt })
      toast(editing ? 'Entry updated ✅' : 'Entry added 🎉', 'success')
      setModalOpen(false)
    } catch (e: unknown) {
      toast((e as Error).message, 'error')
    }
  }

  const handleBulkDelete = async () => {
    try {
      await deleteMutation.mutateAsync([...selected])
      toast(`${selected.size} entr${selected.size > 1 ? 'ies' : 'y'} deleted`, 'success')
      setSelected(new Set())
      setConfirmDelete(false)
    } catch (e: unknown) {
      toast((e as Error).message, 'error')
    }
  }

  if (isLoading) return <SpinnerWrap />

  return (
    <div className="monthly-summary">
      <div className="monthly-header">
        <span className="monthly-title">{title}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {selected.size > 0 && (
            <button
              className="btn-secondary"
              style={{ fontSize: 12, padding: '5px 12px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
              onClick={() => setConfirmDelete(true)}
            >
              Delete {selected.size}
            </button>
          )}
          <span style={{ fontSize: 12, color: 'var(--muted2)', fontWeight: 600 }}>
            Total: {INR(grand)}
          </span>
          <button className="btn-primary" style={{ fontSize: 12, padding: '6px 14px' }} onClick={openAdd}>
            + Add Entry
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div className="bulk-bar">
          <span className="bulk-bar-count">Delete {selected.size} entr{selected.size > 1 ? 'ies' : 'y'}?</span>
          <button className="btn-secondary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => setConfirmDelete(false)}>Cancel</button>
          <button className="btn-primary" style={{ fontSize: 12, padding: '4px 12px', background: 'var(--danger)' }} onClick={handleBulkDelete}>Yes, delete</button>
        </div>
      )}

      <table className="monthly-table">
        <thead>
          <tr>
            <th style={{ width: 32 }}>
              <input
                type="checkbox"
                checked={selected.size === data.length && data.length > 0}
                onChange={e => setSelected(e.target.checked ? new Set(data.map(r => r.id)) : new Set())}
                style={{ cursor: 'pointer' }}
              />
            </th>
            <th>Date</th>
            <th className="right">Amount</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {!data.length ? (
            <tr>
              <td colSpan={4} style={{ padding: '18px 14px', textAlign: 'center', color: 'var(--muted2)' }}>
                No entries yet — click <b>+ Add Entry</b>
              </td>
            </tr>
          ) : data.map(r => (
            <tr key={r.id}>
              <td style={{ width: 32 }}>
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={e => {
                    const next = new Set(selected)
                    e.target.checked ? next.add(r.id) : next.delete(r.id)
                    setSelected(next)
                  }}
                  style={{ cursor: 'pointer' }}
                />
              </td>
              <td style={{ color: 'var(--accent)', fontWeight: 500 }}>
                {new Date(r.entry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </td>
              <td className="right">{INR(r.amount)}</td>
              <td style={{ textAlign: 'right' }}>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, opacity: 0.65 }}
                  onClick={() => openEdit(r)}
                  title="Edit"
                >🖊️</button>
              </td>
            </tr>
          ))}
          {data.length > 0 && (
            <tr style={{ background: 'var(--surface2)' }}>
              <td colSpan={2} style={{ padding: '9px 14px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted2)' }}>Total</td>
              <td className="right" style={{ color: 'var(--accent)', fontWeight: 700 }}>{INR(grand)}</td>
              <td />
            </tr>
          )}
        </tbody>
      </table>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Entry' : 'Add Entry'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : '💾 Save Entry'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Date</label>
          <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Amount (₹)</label>
          <input className="form-input" type="number" min="0" step="0.01" placeholder="e.g. 50000" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
      </Modal>
    </div>
  )
}
