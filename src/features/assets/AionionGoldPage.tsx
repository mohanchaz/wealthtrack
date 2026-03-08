import { useState, useMemo } from 'react'
import { useAuthStore }      from '../../store/authStore'
import { useAssets }         from '../../hooks/useAssets'
import { useActualInvested } from '../../hooks/useActualInvested'
import { useYahooPrices }    from '../../hooks/useLivePrices'
import { useToastStore }     from '../../store/toastStore'
import { AssetPageLayout } from '../../components/common/AssetPageLayout'
import { PageShell }         from '../../components/common/PageShell'
import { StatGrid, buildInvestedStats } from '../../components/common/StatGrid'
import { AssetTable }        from '../../components/common/AssetTable'
import { ActualInvestedPanel } from '../../components/common/ActualInvestedPanel'
import { Modal }             from '../../components/ui/Modal'
import { Button }            from '../../components/ui/Button'
import { Input }             from '../../components/ui/Input'
import { INR, calcGain }     from '../../lib/utils'
import type { AionionGoldHolding } from '../../types/assets'

function EditModal({ row, onClose, onSave }: { row: Partial<AionionGoldHolding>; onClose: () => void; onSave: (d: Partial<AionionGoldHolding>) => Promise<void> }) {
  const [inst, setInst] = useState(row.instrument ?? ''); const [qty, setQty] = useState(String(row.qty ?? '')); const [avg, setAvg] = useState(String(row.avg_cost ?? '')); const [sym, setSym] = useState(row.yahoo_symbol ?? ''); const [saving, setSaving] = useState(false)
  const handleSave = async () => { if (!inst || !qty || !avg) return; setSaving(true); const q=parseFloat(qty), a=parseFloat(avg); await onSave({ ...row, instrument: inst.toUpperCase(), qty:q, avg_cost:a, yahoo_symbol:sym, invested:q*a, current_value:q*a }); setSaving(false) }
  return (
    <Modal open onClose={onClose} title={row.id ? 'Edit Holding' : 'Add Holding'} footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={handleSave} loading={saving}>💾 Save</Button></>}>
      <div className="flex flex-col gap-4">
        <Input label="Instrument" value={inst} onChange={e => setInst(e.target.value)} />
        <Input label="Qty / Units" type="number" step="0.001" value={qty} onChange={e => setQty(e.target.value)} />
        <Input label="Avg Cost / NAV" prefix="₹" type="number" step="0.01" value={avg} onChange={e => setAvg(e.target.value)} />
        <Input label="Yahoo Symbol (for live price)" value={sym} onChange={e => setSym(e.target.value)} placeholder="e.g. GOLDBEES.NS" />
      </div>
    </Modal>
  )
}

export default function AionionGoldPage() {
  const userId = useAuthStore(s => s.user?.id)!; const toast = useToastStore(s => s.show)
  const { data: rows = [], isLoading } = useAssets<AionionGoldHolding>('aionion_gold')
  const aiHook = useActualInvested('aionion_gold_actual_invested')
  const symbols = useMemo(() => [...new Set(rows.map(r => r.yahoo_symbol ?? (r.instrument + '.NS')).filter(Boolean))], [rows])
  const { data: priceMap = {}, isFetching: pf, refetch } = useYahooPrices(symbols as string[])
  const [editRow, setEditRow] = useState<Partial<AionionGoldHolding> | null>(null)
  const { upsertMutation, deleteMutation } = useAssets<AionionGoldHolding>('aionion_gold')
  const getLTP = (r: AionionGoldHolding) => { const sym = (r.yahoo_symbol ?? r.instrument+'.NS').replace(/\.(NS|BO)$/,''); return priceMap[sym]?.price ?? null }
  const totalInvested = useMemo(() => rows.reduce((s, r) => s + r.qty*r.avg_cost, 0), [rows])
  const totalValue    = useMemo(() => rows.reduce((s, r) => { const ltp=getLTP(r); return s + (ltp != null ? r.qty*ltp : r.qty*r.avg_cost) }, 0), [rows, priceMap])
  const actual = aiHook.data?.reduce((s, e) => s + e.amount, 0)
  const liveLabel = pf ? '🔄 Fetching…' : Object.keys(priceMap).length ? `🟢 Live · ${new Date().toLocaleTimeString('en-IN')}` : undefined
  const handleSave = async (d: Partial<AionionGoldHolding>) => { try { await upsertMutation.mutateAsync({ ...d, user_id: userId } as Record<string,unknown>); toast('Saved ✅','success'); setEditRow(null) } catch (e) { toast((e as Error).message,'error') } }
  const handleDelete = async (id: string) => { if (!confirm('Delete?')) return; try { await deleteMutation.mutateAsync(id); toast('Deleted','success') } catch (e) { toast((e as Error).message,'error') } }
  const cols = [
    { key: 'instrument', header: 'Instrument', render: (r: AionionGoldHolding) => <span className="font-bold">{r.instrument}</span> },
    { key: 'qty',      header: 'Qty',       align: 'right' as const, render: (r: AionionGoldHolding) => r.qty.toLocaleString('en-IN', { maximumFractionDigits: 4 }) },
    { key: 'avg_cost', header: 'Avg Cost',  align: 'right' as const, render: (r: AionionGoldHolding) => INR(r.avg_cost) },
    { key: 'ltp',      header: 'Live Price', align: 'right' as const, render: (r: AionionGoldHolding) => { const ltp=getLTP(r); return <span className="font-bold">{ltp!=null?INR(ltp):'—'}</span> }},
    { key: 'invested', header: 'Invested',  align: 'right' as const, render: (r: AionionGoldHolding) => INR(r.qty*r.avg_cost) },
    { key: 'value',    header: 'Cur. Value', align: 'right' as const, render: (r: AionionGoldHolding) => { const ltp=getLTP(r); return <span className="font-bold">{INR(ltp!=null?r.qty*ltp:r.qty*r.avg_cost)}</span> }},
    { key: 'gain',     header: 'Gain / Loss', align: 'right' as const, render: (r: AionionGoldHolding) => {
      const ltp=getLTP(r); const inv=r.qty*r.avg_cost; const val=ltp!=null?r.qty*ltp:inv; const {gain,gainPct,isPositive}=calcGain(val,inv)
      return <span className={`font-bold ${isPositive?'text-green':'text-red'}`}>{isPositive?'+':''}{INR(gain)}<br /><span className="text-[10px] font-medium opacity-80">{isPositive?'+':''}{gainPct.toFixed(1)}%</span></span>
    }},
    { key: 'actions', header: '', align: 'center' as const, render: (r: AionionGoldHolding) => (
      <div className="flex gap-1">
        <button onClick={() => setEditRow(r)} className="w-6 h-6 rounded-lg flex items-center justify-center text-textmut hover:bg-surface2 hover:text-teal transition-colors">✏</button>
        <button onClick={() => handleDelete(r.id)} className="w-6 h-6 rounded-lg flex items-center justify-center text-textmut hover:bg-red/10 hover:text-red transition-colors">✕</button>
      </div>
    )},
  ]
  return (
    <PageShell title="Aionion Gold" subtitle={`${rows.length} holding${rows.length !== 1 ? 's' : ''}`}
      actions={[{ label: '+ Add Holding', onClick: () => setEditRow({}), variant: 'primary' }, { label: '🔄', onClick: () => refetch(), variant: 'outline' }]}
    >
      <AssetPageLayout
        stats={<StatGrid items={buildInvestedStats({ invested: totalInvested, value: totalValue, actual, loading: isLoading, liveLabel })} cols={5} />}
        mainTable={<AssetTable columns={cols} data={rows} rowKey={r => r.id} loading={isLoading} emptyText="No holdings — click + Add Holding" />}
        actualInvested={<ActualInvestedPanel table="aionion_gold_actual_invested" />}
      />
      {editRow !== null && <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleSave} />}
    </PageShell>
  )
}
