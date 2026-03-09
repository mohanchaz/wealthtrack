import { useState, useMemo } from 'react'
import { useAuthStore }      from '../../store/authStore'
import { useAssets }         from '../../hooks/useAssets'
import { useToastStore }     from '../../store/toastStore'
import { PageShell }         from '../../components/common/PageShell'
import { StatGrid }          from '../../components/common/StatGrid'
import { AssetTable }        from '../../components/common/AssetTable'
import { Modal }             from '../../components/ui/Modal'
import { Button }            from '../../components/ui/Button'
import { Input }             from '../../components/ui/Input'
import { INR }               from '../../lib/utils'
import type { CashAsset }    from '../../types/assets'

function EditModal({ row, onClose, onSave }: { row: Partial<CashAsset>; onClose: () => void; onSave: (d: Partial<CashAsset>) => Promise<void> }) {
  const [name,    setName]    = useState(row.name ?? '')
  const [invested, setInvested] = useState(String(row.invested ?? ''))
  const [curVal,  setCurVal]  = useState(String(row.current_value ?? ''))
  const [notes,   setNotes]   = useState(row.notes ?? '')
  const [saving,  setSaving]  = useState(false)
  const handleSave = async () => {
    if (!name || !invested || +invested <= 0) return
    setSaving(true)
    await onSave({ ...row, name, invested: parseFloat(invested), current_value: curVal ? parseFloat(curVal) : parseFloat(invested), notes: notes || undefined })
    setSaving(false)
  }
  return (
    <Modal open onClose={onClose} title={row.id ? 'Edit Entry' : 'Add Cash Entry'}
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={handleSave} loading={saving}>💾 Save</Button></>}
    >
      <div className="flex flex-col gap-4">
        <Input label="Name / Account" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. HDFC Savings, Petty Cash" />
        <Input label="Invested / Deposited (₹)" prefix="₹" type="number" step="0.01" value={invested} onChange={e => setInvested(e.target.value)} />
        <Input label="Current Value (₹)" prefix="₹" type="number" step="0.01" value={curVal} onChange={e => setCurVal(e.target.value)} helpText="Leave blank to use same as invested" />
        <Input label="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
    </Modal>
  )
}

export default function CashPage() {
  const userId = useAuthStore(s => s.user?.id)!; const toast = useToastStore(s => s.show)
  const { data: rows = [], isLoading } = useAssets<CashAsset>('cash_assets')
  const [editRow, setEditRow] = useState<Partial<CashAsset> | null>(null)
  const { upsertMutation, deleteMutation } = useAssets<CashAsset>('cash_assets')
  const totalInvested = useMemo(() => rows.reduce((s, r) => s + r.invested, 0), [rows])
  const totalValue    = useMemo(() => rows.reduce((s, r) => s + (r.current_value ?? r.invested), 0), [rows])
  const handleSave = async (d: Partial<CashAsset>) => { try { await upsertMutation.mutateAsync({ ...d, user_id: userId } as Record<string,unknown>); toast('Saved ✅','success'); setEditRow(null) } catch (e) { toast((e as Error).message,'error') } }
  const stats = [
    { label: 'Total Deposited', value: INR(totalInvested), icon: '₹', accentColor: '#0891b2', loading: isLoading },
    { label: 'Current Balance', value: INR(totalValue),    icon: '◈', accentColor: '#0d9488', loading: isLoading },
    { label: 'Entries',         value: String(rows.length), icon: '⬡', accentColor: '#d97706', loading: isLoading },
  ]
  const cols = [
    { key: 'name',    header: 'Name / Account', render: (r: CashAsset) => <span className="font-bold">{r.name}</span> },
    { key: 'invested',      header: 'Deposited',     align: 'right' as const, render: (r: CashAsset) => INR(r.invested) },
    { key: 'current_value', header: 'Current',       align: 'right' as const, render: (r: CashAsset) => <span className="font-bold">{INR(r.current_value ?? r.invested)}</span> },
    { key: 'notes',   header: 'Notes', render: (r: CashAsset) => <span className="text-textmut text-xs">{r.notes || '—'}</span> },
  ]
  return (
    <PageShell title="Cash" subtitle={`${rows.length} entr${rows.length !== 1 ? 'ies' : 'y'}`}
      actions={[{ label: '+ Add Entry', onClick: () => setEditRow({}), variant: 'primary' }]}
    >
      <StatGrid items={stats} cols={3} />
      <div className="card overflow-hidden"><AssetTable columns={cols} data={rows} rowKey={r => r.id} loading={isLoading} emptyText="No cash entries — click + Add Entry" 
            onEditRow={r => setEditRow(r)}
            onDeleteRows={async ids => { for (const id of ids) await deleteMutation.mutateAsync(id); toast(`Deleted ${ids.length}`, 'success') }}
          /></div>
      {editRow !== null && <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleSave} />}
    </PageShell>
  )
}
