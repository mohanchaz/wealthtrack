import { useState, useMemo } from 'react'
import { useAuthStore }      from '../../store/authStore'
import { useAssets }         from '../../hooks/useAssets'
import { useToastStore }     from '../../store/toastStore'
import { PageShell }         from '../../components/common/PageShell'
import { StatGrid, buildInvestedStats } from '../../components/common/StatGrid'
import { AssetTable }        from '../../components/common/AssetTable'
import { Modal }             from '../../components/ui/Modal'
import { Button }            from '../../components/ui/Button'
import { Input }             from '../../components/ui/Input'
import { INR, calcGain }     from '../../lib/utils'
import type { AmcMfHolding } from '../../types/assets'

function EditModal({ row, onClose, onSave }: { row: Partial<AmcMfHolding>; onClose: () => void; onSave: (d: Partial<AmcMfHolding>) => Promise<void> }) {
  const [name,   setName]   = useState(row.fund_name ?? '')
  const [qty,    setQty]    = useState(String(row.qty ?? ''))
  const [avg,    setAvg]    = useState(String(row.avg_cost ?? ''))
  const [saving, setSaving] = useState(false)
  const handleSave = async () => {
    if (!name || !qty || !avg) return
    setSaving(true); const q=parseFloat(qty), a=parseFloat(avg)
    await onSave({ ...row, fund_name: name, qty:q, avg_cost:a, invested:q*a, current_value:q*a }); setSaving(false)
  }
  return (
    <Modal open onClose={onClose} title={row.id ? 'Edit Fund' : 'Add AMC MF'}
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={handleSave} loading={saving}>💾 Save</Button></>}
    >
      <div className="flex flex-col gap-4">
        <Input label="Fund Name" value={name} onChange={e => setName(e.target.value)} />
        <Input label="Units" type="number" step="0.001" value={qty} onChange={e => setQty(e.target.value)} />
        <Input label="Avg NAV" prefix="₹" type="number" step="0.01" value={avg} onChange={e => setAvg(e.target.value)} />
      </div>
    </Modal>
  )
}

export default function AmcMfPage() {
  const userId = useAuthStore(s => s.user?.id)!; const toast = useToastStore(s => s.show)
  const { data: rows = [], isLoading } = useAssets<AmcMfHolding>('amc_mf_holdings')
  const [editRow, setEditRow] = useState<Partial<AmcMfHolding> | null>(null)
  const { upsertMutation, deleteMutation } = useAssets<AmcMfHolding>('amc_mf_holdings')
  const totalInvested = useMemo(() => rows.reduce((s, r) => s + (r.invested ?? r.qty*r.avg_cost), 0), [rows])
  const totalValue    = useMemo(() => rows.reduce((s, r) => s + (r.current_value ?? r.invested ?? r.qty*r.avg_cost), 0), [rows])
  const { gain, gainPct, isPositive } = calcGain(totalValue, totalInvested)
  const handleSave = async (d: Partial<AmcMfHolding>) => {
    try {
      const existing = rows.find(r => r.id === d.id)
      const prev_qty = existing ? existing.qty : d.qty
      await upsertMutation.mutateAsync({ ...d, prev_qty, user_id: userId } as Record<string,unknown>)
      toast('Saved ✅','success'); setEditRow(null)
    } catch (e) { toast((e as Error).message,'error') }
  }
  const stats = [
    { label: 'Invested',     value: INR(totalInvested), icon: '₹', accentColor: '#0891b2', loading: isLoading },
    { label: 'Current Value', value: INR(totalValue),   icon: '◈', accentColor: '#0d9488', loading: isLoading },
    { label: 'Gain / Loss',  value: `${isPositive?'+':''}${INR(gain)}`, sub: `${gainPct.toFixed(1)}%`, icon: isPositive?'▲':'▼', accentColor: isPositive?'#059669':'#dc2626', loading: isLoading },
  ]
  const cols = [
    { key: 'fund_name', header: 'Fund Name', render: (r: AmcMfHolding) => <span className="font-bold">{r.fund_name}</span> },
    { key: 'qty', header: 'Units', align: 'right' as const, render: (r: AmcMfHolding) => {
      const qty = Number(r.qty); const diff = r.prev_qty != null ? qty - Number(r.prev_qty) : null
      return (
        <div className="text-right">
          {qty === 0 ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red/10 text-red">EXITED</span>
            : <div>{qty.toLocaleString('en-IN', { maximumFractionDigits: 4 })}</div>}
          {diff !== null && diff !== 0 && <div className={`text-[10px] font-semibold ${diff > 0 ? 'text-green' : 'text-red'}`}>{diff > 0 ? '+' : ''}{diff.toLocaleString('en-IN', { maximumFractionDigits: 4 })}</div>}
        </div>
      )
    }},
    { key: 'avg_cost',  header: 'Avg NAV',    align: 'right' as const, render: (r: AmcMfHolding) => INR(r.avg_cost) },
    { key: 'invested',  header: 'Invested',   align: 'right' as const, render: (r: AmcMfHolding) => INR(r.invested ?? r.qty*r.avg_cost) },
    { key: 'value',     header: 'Cur. Value', align: 'right' as const, render: (r: AmcMfHolding) => <span className={`font-bold ${(r.current_value??r.qty*r.avg_cost)>=(r.invested??r.qty*r.avg_cost)?"text-green":"text-red"}`}>{INR(r.current_value??r.invested??r.qty*r.avg_cost)}</span> },
    { key: 'gain',      header: 'Gain / Loss', align: 'right' as const, render: (r: AmcMfHolding) => {
      const inv=r.invested??r.qty*r.avg_cost; const val=r.current_value??inv; const {gain,gainPct,isPositive}=calcGain(val,inv)
      return <span className={`font-bold ${isPositive?'text-green':'text-red'}`}>{isPositive?'+':''}{INR(gain)}<br /><span className="text-[10px] font-medium opacity-80">{isPositive?'+':''}{gainPct.toFixed(1)}%</span></span>
    }},
  ]
  return (
    <PageShell title="AMC Mutual Funds" subtitle={`${rows.length} fund${rows.length!==1?'s':''}`}
      actions={[{ label: '+ Add Fund', onClick: () => setEditRow({}), variant: 'primary' }]}
    >
      <StatGrid items={stats} cols={3} />
      <div className="card overflow-hidden"><AssetTable columns={cols} data={rows} rowKey={r => r.id} loading={isLoading} emptyText="No AMC MF holdings — click + Add Fund" 
            onEditRow={r => setEditRow(r)}
            onDeleteRows={async ids => { for (const id of ids) await deleteMutation.mutateAsync(id); toast(`Deleted ${ids.length}`, 'success') }}
          /></div>
      {editRow !== null && <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleSave} />}
    </PageShell>
  )
}
