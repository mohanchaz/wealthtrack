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
import { INR, formatDate }   from '../../lib/utils'
import type { BondAsset }    from '../../types/assets'

function EditModal({ row, onClose, onSave }: { row: Partial<BondAsset>; onClose: () => void; onSave: (d: Partial<BondAsset>) => Promise<void> }) {
  const [name,    setName]    = useState(row.name ?? '')
  const [invested,setInvested]= useState(String(row.invested ?? ''))
  const [face,    setFace]    = useState(String(row.face_value ?? ''))
  const [coupon,  setCoupon]  = useState(String(row.coupon_rate ?? ''))
  const [maturity,setMaturity]= useState(row.maturity ?? '')
  const [saving,  setSaving]  = useState(false)
  const handleSave = async () => {
    if (!name || !invested || +invested <= 0) return
    setSaving(true)
    await onSave({ ...row, name, invested: parseFloat(invested), face_value: face ? parseFloat(face) : undefined, coupon_rate: coupon ? parseFloat(coupon) : undefined, maturity: maturity || undefined })
    setSaving(false)
  }
  return (
    <Modal open onClose={onClose} title={row.id ? 'Edit Bond' : 'Add Bond'}
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={handleSave} loading={saving}>💾 Save</Button></>}
    >
      <div className="flex flex-col gap-4">
        <Input label="Bond Name / ISIN" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. GOI 7.5% 2030" />
        <Input label="Invested (₹)" prefix="₹" type="number" value={invested} onChange={e => setInvested(e.target.value)} />
        <Input label="Face Value (₹)" prefix="₹" type="number" value={face} onChange={e => setFace(e.target.value)} />
        <Input label="Coupon Rate (%)" type="number" step="0.01" value={coupon} onChange={e => setCoupon(e.target.value)} />
        <Input label="Maturity Date" type="date" value={maturity} onChange={e => setMaturity(e.target.value)} />
      </div>
    </Modal>
  )
}

export default function BondsPage() {
  const userId = useAuthStore(s => s.user?.id)!; const toast = useToastStore(s => s.show)
  const { data: rows = [], isLoading } = useAssets<BondAsset>('bonds')
  const [editRow, setEditRow] = useState<Partial<BondAsset> | null>(null)
  const { upsertMutation, deleteMutation } = useAssets<BondAsset>('bonds')
  const totalInvested = useMemo(() => rows.reduce((s, r) => s + r.invested, 0), [rows])
  const totalFace     = useMemo(() => rows.reduce((s, r) => s + (r.face_value ?? r.invested), 0), [rows])
  const handleSave = async (d: Partial<BondAsset>) => { try { await upsertMutation.mutateAsync({ ...d, user_id: userId } as Record<string,unknown>); toast('Saved ✅','success'); setEditRow(null) } catch (e) { toast((e as Error).message,'error') } }
  const stats = [
    { label: 'Invested',    value: INR(totalInvested), icon: '₹', accentColor: '#0891b2', loading: isLoading },
    { label: 'Face Value',  value: INR(totalFace),     icon: '◈', accentColor: '#0d9488', loading: isLoading },
    { label: 'Bonds',       value: String(rows.length), icon: '⬡', accentColor: '#d97706', loading: isLoading },
  ]
  const cols = [
    { key: 'name',        header: 'Bond Name', render: (r: BondAsset) => <span className="font-bold">{r.name}</span> },
    { key: 'invested',    header: 'Invested',   align: 'right' as const, render: (r: BondAsset) => INR(r.invested) },
    { key: 'face_value',  header: 'Face Value', align: 'right' as const, render: (r: BondAsset) => r.face_value ? INR(r.face_value) : '—' },
    { key: 'coupon_rate', header: 'Coupon',     align: 'right' as const, render: (r: BondAsset) => r.coupon_rate ? `${r.coupon_rate.toFixed(2)}%` : '—' },
    { key: 'maturity',    header: 'Maturity',   align: 'right' as const, render: (r: BondAsset) => formatDate(r.maturity) },
  ]
  return (
    <PageShell title="Bonds" subtitle={`${rows.length} bond${rows.length !== 1 ? 's' : ''}`}
      actions={[{ label: '+ Add Bond', onClick: () => setEditRow({}), variant: 'primary' }]}
    >
      <StatGrid items={stats} cols={3} />
      <div className="card overflow-hidden"><AssetTable columns={cols} data={rows} rowKey={r => r.id} loading={isLoading} emptyText="No bonds — click + Add Bond" 
            onEditRow={r => setEditRow(r)}
            onDeleteRows={async ids => { for (const id of ids) await deleteMutation.mutateAsync(id); toast(`Deleted ${ids.length}`, 'success') }}
          /></div>
      {editRow !== null && <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleSave} />}
    </PageShell>
  )
}
