import { useState, useMemo } from 'react'
import { useAuthStore }      from '../../store/authStore'
import { useAssets }         from '../../hooks/useAssets'
import { useActualInvested } from '../../hooks/useActualInvested'
import { useToastStore }     from '../../store/toastStore'
import { PageShell }         from '../../components/common/PageShell'
import { StatGrid }          from '../../components/common/StatGrid'
import { AssetTable }        from '../../components/common/AssetTable'
import { ActualInvestedPanel } from '../../components/common/ActualInvestedPanel'
import { Modal }             from '../../components/ui/Modal'
import { Button }            from '../../components/ui/Button'
import { Input }             from '../../components/ui/Input'
import { INR, formatDate, calcGain } from '../../lib/utils'
import type { FdAsset }      from '../../types/assets'

function EditModal({ row, onClose, onSave }: { row: Partial<FdAsset>; onClose: () => void; onSave: (d: Partial<FdAsset>) => Promise<void> }) {
  const [category, setCategory] = useState(row.category ?? '')
  const [platform, setPlatform] = useState(row.platform ?? '')
  const [acctNo,   setAcctNo]   = useState(row.account_number ?? '')
  const [invested, setInvested] = useState(String(row.invested ?? ''))
  const [invDate,  setInvDate]  = useState(row.invested_date ?? '')
  const [rate,     setRate]     = useState(String(row.interest_rate ?? ''))
  const [matDate,  setMatDate]  = useState(row.maturity_date ?? '')
  const [matAmt,   setMatAmt]   = useState(String(row.maturity_amount ?? ''))
  const [saving,   setSaving]   = useState(false)
  const handleSave = async () => {
    if (!invested || +invested <= 0) return
    setSaving(true)
    await onSave({ ...row, category: category||undefined, platform: platform||undefined, account_number: acctNo||undefined,
      invested: parseFloat(invested), invested_date: invDate||undefined, interest_rate: rate ? parseFloat(rate) : undefined,
      maturity_date: matDate||undefined, maturity_amount: matAmt ? parseFloat(matAmt) : undefined })
    setSaving(false)
  }
  return (
    <Modal open onClose={onClose} title={row.id ? 'Edit FD' : 'Add FD'}
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={handleSave} loading={saving}>💾 Save</Button></>}
    >
      <div className="grid grid-cols-2 gap-4">
        <Input label="Category" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Bank FD" className="col-span-2" />
        <Input label="Platform / Bank" value={platform} onChange={e => setPlatform(e.target.value)} placeholder="e.g. SBI, HDFC" />
        <Input label="Account No." value={acctNo} onChange={e => setAcctNo(e.target.value)} placeholder="Optional" />
        <Input label="Invested (₹)" prefix="₹" type="number" value={invested} onChange={e => setInvested(e.target.value)} />
        <Input label="Invested Date" type="date" value={invDate} onChange={e => setInvDate(e.target.value)} />
        <Input label="Interest Rate (%)" type="number" step="0.01" value={rate} onChange={e => setRate(e.target.value)} />
        <Input label="Maturity Date" type="date" value={matDate} onChange={e => setMatDate(e.target.value)} />
        <Input label="Maturity Amount (₹)" prefix="₹" type="number" step="0.01" value={matAmt} onChange={e => setMatAmt(e.target.value)} className="col-span-2" />
      </div>
    </Modal>
  )
}

export default function FdPage() {
  const userId = useAuthStore(s => s.user?.id)!; const toast = useToastStore(s => s.show)
  const { data: rows = [], isLoading } = useAssets<FdAsset>('bank_fd_assets')
  const aiHook = useActualInvested('fd_actual_invested')
  const [editRow, setEditRow] = useState<Partial<FdAsset> | null>(null)
  const { upsertMutation, deleteMutation } = useAssets<FdAsset>('bank_fd_assets')
  const totalInvested = useMemo(() => rows.reduce((s, r) => s + r.invested, 0), [rows])
  const totalValue    = useMemo(() => rows.reduce((s, r) => s + (r.maturity_amount ?? r.invested), 0), [rows])
  const actual = aiHook.data?.reduce((s, e) => s + e.amount, 0)
  const { gain, gainPct, isPositive } = calcGain(totalValue, totalInvested)
  const handleSave = async (d: Partial<FdAsset>) => { try { await upsertMutation.mutateAsync({ ...d, user_id: userId } as Record<string,unknown>); toast('Saved ✅','success'); setEditRow(null) } catch (e) { toast((e as Error).message,'error') } }
  const handleDelete = async (id: string) => { if (!confirm('Delete this FD?')) return; try { await deleteMutation.mutateAsync(id); toast('Deleted','success') } catch (e) { toast((e as Error).message,'error') } }
  const stats = [
    { label: 'Invested',       value: INR(totalInvested), icon: '₹',  accentColor: '#0891b2', loading: isLoading },
    { label: 'Maturity Value', value: INR(totalValue),    icon: '◈',  accentColor: '#0d9488', loading: isLoading },
    { label: 'Total Interest', value: `${isPositive?'+':''}${INR(gain)}`, sub: `${gainPct.toFixed(1)}%`, icon: isPositive?'▲':'▼', accentColor: isPositive?'#059669':'#dc2626', loading: isLoading },
    { label: 'Actual Invested', value: actual ? INR(actual) : '—', icon: '⊡', accentColor: '#d97706', loading: isLoading },
  ]
  const cols = [
    { key: 'category',    header: 'Category', render: (r: FdAsset) => <span className="font-bold">{r.category || '—'}</span> },
    { key: 'platform',    header: 'Platform', render: (r: FdAsset) => r.platform || '—' },
    { key: 'account_number', header: 'Account No.', render: (r: FdAsset) => <span className="font-mono text-xs">{r.account_number || '—'}</span> },
    { key: 'invested',    header: 'Invested',     align: 'right' as const, render: (r: FdAsset) => INR(r.invested) },
    { key: 'invested_date', header: 'Invested On', align: 'right' as const, render: (r: FdAsset) => formatDate(r.invested_date) },
    { key: 'interest_rate', header: 'Rate',        align: 'right' as const, render: (r: FdAsset) => r.interest_rate ? `${r.interest_rate.toFixed(2)}%` : '—' },
    { key: 'maturity_date', header: 'Matures On',  align: 'right' as const, render: (r: FdAsset) => formatDate(r.maturity_date) },
    { key: 'maturity_amount', header: 'Maturity Amt', align: 'right' as const, render: (r: FdAsset) => <span className="font-bold">{r.maturity_amount ? INR(r.maturity_amount) : '—'}</span> },
    { key: 'actions', header: '', align: 'center' as const, render: (r: FdAsset) => (
      <div className="flex gap-1">
        <button onClick={() => setEditRow(r)} className="w-6 h-6 rounded-lg flex items-center justify-center text-textmut hover:bg-surface2 hover:text-teal transition-colors">✏</button>
        <button onClick={() => handleDelete(r.id)} className="w-6 h-6 rounded-lg flex items-center justify-center text-textmut hover:bg-red/10 hover:text-red transition-colors">✕</button>
      </div>
    )},
  ]
  return (
    <PageShell title="Fixed Deposits" subtitle={`${rows.length} FD${rows.length !== 1 ? 's' : ''} tracked`}
      actions={[{ label: '+ Add FD', onClick: () => setEditRow({}), variant: 'primary' }]}
    >
      <StatGrid items={stats} cols={4} />
      <div className="card overflow-hidden"><AssetTable columns={cols} data={rows} rowKey={r => r.id} loading={isLoading} emptyText="No FDs yet — click + Add FD" /></div>
      <div className="card p-5"><ActualInvestedPanel table="fd_actual_invested" /></div>
      {editRow !== null && <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleSave} />}
    </PageShell>
  )
}
