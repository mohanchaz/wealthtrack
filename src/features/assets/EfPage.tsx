import { useState, useMemo } from 'react'
import { useAuthStore }      from '../../store/authStore'
import { useAssets }         from '../../hooks/useAssets'
import { useActualInvested } from '../../hooks/useActualInvested'
import { useToastStore }     from '../../store/toastStore'
import { AssetPageLayout } from '../../components/common/AssetPageLayout'
import { PageShell }         from '../../components/common/PageShell'
import { StatGrid }          from '../../components/common/StatGrid'
import { AssetTable }        from '../../components/common/AssetTable'
import { ActualInvestedPanel } from '../../components/common/ActualInvestedPanel'
import { Modal }             from '../../components/ui/Modal'
import { Button }            from '../../components/ui/Button'
import { Input }             from '../../components/ui/Input'
import { INR, formatDate }   from '../../lib/utils'
import type { EfAsset }      from '../../types/assets'

function EditModal({ row, onClose, onSave }: { row: Partial<EfAsset>; onClose: () => void; onSave: (d: Partial<EfAsset>) => Promise<void> }) {
  const [category, setCategory] = useState(row.category ?? '')
  const [platform, setPlatform] = useState(row.platform ?? '')
  const [invested, setInvested] = useState(String(row.invested ?? ''))
  const [invDate,  setInvDate]  = useState(row.invested_date ?? '')
  const [rate,     setRate]     = useState(String(row.interest_rate ?? ''))
  const [matDate,  setMatDate]  = useState(row.maturity_date ?? '')
  const [matAmt,   setMatAmt]   = useState(String(row.maturity_amount ?? ''))
  const [saving,   setSaving]   = useState(false)
  const handleSave = async () => {
    if (!invested || +invested <= 0) return
    setSaving(true)
    await onSave({ ...row, category: category||undefined, platform: platform||undefined,
      invested: parseFloat(invested), invested_date: invDate||undefined, interest_rate: rate ? parseFloat(rate) : undefined,
      maturity_date: matDate||undefined, maturity_amount: matAmt ? parseFloat(matAmt) : undefined })
    setSaving(false)
  }
  return (
    <Modal open onClose={onClose} title={row.id ? 'Edit Entry' : 'Add Entry'}
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={handleSave} loading={saving}>💾 Save</Button></>}
    >
      <div className="grid grid-cols-2 gap-4">
        <Input label="Category" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Savings Account" className="col-span-2" />
        <Input label="Platform / Bank" value={platform} onChange={e => setPlatform(e.target.value)} />
        <Input label="Amount (₹)" prefix="₹" type="number" value={invested} onChange={e => setInvested(e.target.value)} />
        <Input label="Date" type="date" value={invDate} onChange={e => setInvDate(e.target.value)} />
        <Input label="Interest Rate (%)" type="number" step="0.01" value={rate} onChange={e => setRate(e.target.value)} />
        <Input label="Maturity Date" type="date" value={matDate} onChange={e => setMatDate(e.target.value)} />
        <Input label="Maturity Amount" prefix="₹" type="number" value={matAmt} onChange={e => setMatAmt(e.target.value)} />
      </div>
    </Modal>
  )
}

export default function EfPage() {
  const userId = useAuthStore(s => s.user?.id)!; const toast = useToastStore(s => s.show)
  const { data: rows = [], isLoading } = useAssets<EfAsset>('emergency_funds')
  const aiHook = useActualInvested('ef_actual_invested')
  const [editRow, setEditRow] = useState<Partial<EfAsset> | null>(null)
  const { upsertMutation, deleteMutation } = useAssets<EfAsset>('emergency_funds')
  const totalInvested = useMemo(() => rows.reduce((s, r) => s + r.invested, 0), [rows])
  const totalValue    = useMemo(() => rows.reduce((s, r) => s + (r.maturity_amount ?? r.invested), 0), [rows])
  const actual = aiHook.data?.reduce((s, e) => s + e.amount, 0)
  const handleSave = async (d: Partial<EfAsset>) => { try { await upsertMutation.mutateAsync({ ...d, user_id: userId } as Record<string,unknown>); toast('Saved ✅','success'); setEditRow(null) } catch (e) { toast((e as Error).message,'error') } }
  const handleDelete = async (id: string) => { if (!confirm('Delete this entry?')) return; try { await deleteMutation.mutateAsync(id); toast('Deleted','success') } catch (e) { toast((e as Error).message,'error') } }
  const stats = [
    { label: 'Total Amount',   value: INR(totalInvested), icon: '₹',  accentColor: '#0891b2', loading: isLoading },
    { label: 'With Interest',  value: INR(totalValue),    icon: '◈',  accentColor: '#0d9488', loading: isLoading },
    { label: 'Actual Invested', value: actual ? INR(actual) : '—', icon: '⊡', accentColor: '#d97706', loading: isLoading },
  ]
  const cols = [
    { key: 'category',    header: 'Category', render: (r: EfAsset) => <span className="font-bold">{r.category || '—'}</span> },
    { key: 'platform',    header: 'Platform', render: (r: EfAsset) => r.platform || '—' },
    { key: 'invested',    header: 'Amount',       align: 'right' as const, render: (r: EfAsset) => INR(r.invested) },
    { key: 'invested_date', header: 'Date',       align: 'right' as const, render: (r: EfAsset) => formatDate(r.invested_date) },
    { key: 'interest_rate', header: 'Rate',       align: 'right' as const, render: (r: EfAsset) => r.interest_rate ? `${r.interest_rate.toFixed(2)}%` : '—' },
    { key: 'maturity_date', header: 'Matures On', align: 'right' as const, render: (r: EfAsset) => formatDate(r.maturity_date) },
    { key: 'maturity_amount', header: 'Maturity Amt', align: 'right' as const, render: (r: EfAsset) => <span className="font-bold">{r.maturity_amount ? INR(r.maturity_amount) : '—'}</span> },
    { key: 'actions', header: '', align: 'center' as const, render: (r: EfAsset) => (
      <div className="flex gap-1">
        <button onClick={() => setEditRow(r)} className="w-6 h-6 rounded-lg flex items-center justify-center text-textmut hover:bg-surface2 hover:text-teal transition-colors">✏</button>
        <button onClick={() => handleDelete(r.id)} className="w-6 h-6 rounded-lg flex items-center justify-center text-textmut hover:bg-red/10 hover:text-red transition-colors">✕</button>
      </div>
    )},
  ]
  return (
    <PageShell title="Emergency Fund" subtitle={`${rows.length} entr${rows.length !== 1 ? 'ies' : 'y'}`}
      actions={[{ label: '+ Add Entry', onClick: () => setEditRow({}), variant: 'primary' }]}
    >
      <AssetPageLayout
        stats={<StatGrid items={stats} cols={3} />}
        mainTable={<AssetTable columns={cols} data={rows} rowKey={r => r.id} loading={isLoading} emptyText="No emergency fund entries — click + Add Entry" />}
        actualInvested={<ActualInvestedPanel table="ef_actual_invested" />}
      />
      {editRow !== null && <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleSave} />}
    </PageShell>
  )
}
