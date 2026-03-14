import { useState, useMemo } from 'react'
import { useAuthStore }      from '../../store/authStore'
import { useAssets }         from '../../hooks/useAssets'
import { useActualInvested } from '../../hooks/useActualInvested'
import { useNsePrices }      from '../../hooks/useLivePrices'
import { useToastStore }     from '../../store/toastStore'
import { AssetPageLayout }   from '../../components/common/AssetPageLayout'
import { PageShell }         from '../../components/common/PageShell'
import { StatGrid, buildInvestedStats } from '../../components/common/StatGrid'
import { AssetTable }        from '../../components/common/AssetTable'
import { ActualInvestedPanel } from '../../components/common/ActualInvestedPanel'
import { Modal }             from '../../components/ui/Modal'
import { Button }            from '../../components/ui/Button'
import { Input }             from '../../components/ui/Input'
import { NseSymbolInput }    from '../../components/common/NseSymbolInput'
import { INR, calcGain }     from '../../lib/utils'
import type { StockHolding } from '../../types/assets'

function EditModal({ row, name, onClose, onSave }: {
  row: Partial<StockHolding>; name?: string | null; onClose: () => void; onSave: (d: Partial<StockHolding>) => Promise<void>
}) {
  const [inst,   setInst]   = useState(row.instrument ?? '')
  const [qty,    setQty]    = useState(String(row.qty      ?? ''))
  const [avg,    setAvg]    = useState(String(row.avg_cost ?? ''))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!inst.trim() || !qty || !avg) return
    setSaving(true)
    await onSave({ ...row, instrument: inst.trim().toUpperCase(), qty: parseFloat(qty), avg_cost: parseFloat(avg) })
    setSaving(false)
  }

  return (
    <Modal open onClose={onClose} title={row.id ? 'Edit Holding' : 'Add Holding'}
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={handleSave} loading={saving} disabled={!inst || !qty || !avg}>Save</Button></>}
    >
      <div className="flex flex-col gap-4">
        {row.id ? (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-textmut uppercase tracking-wider">Symbol</label>
            <div className="h-9 rounded-xl border border-border bg-surface2 text-sm text-textmut px-3 flex items-center font-mono select-none cursor-not-allowed">{inst}</div>
            {name && <div className="text-xs text-textmut mt-0.5">{name}</div>}
          </div>
        ) : (
          <NseSymbolInput
            value={inst}
            onChange={setInst}
            onLive={r => {
            // Auto-fill LTP as avg cost only when adding new (not editing)
            if (!row.id && r.status === 'found' && r.price && !avg)
              setAvg(r.price.toFixed(2))
            }}
          />
        )}
        <Input label="Quantity" type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="e.g. 10" />
        <Input label="Avg Cost (₹)" prefix="₹" type="number" step="0.01" value={avg} onChange={e => setAvg(e.target.value)} placeholder="e.g. 1500.00" />
      </div>
    </Modal>
  )
}

export default function AionionStocksPage() {
  const userId = useAuthStore(s => s.user?.id)!
  const toast  = useToastStore(s => s.show)
  const { data: rows = [], isLoading } = useAssets<StockHolding>('aionion_stocks')
  const aiHook      = useActualInvested('aionion_actual_invested')
  const instruments = useMemo(() => rows.map(r => r.instrument), [rows])
  const { data: priceMap = {}, isFetching: pf, refetch } = useNsePrices(instruments)
  const [editRow, setEditRow] = useState<Partial<StockHolding> | null>(null)
  const { upsertMutation, deleteMutation } = useAssets<StockHolding>('aionion_stocks')
  const getLTP  = (r: StockHolding) => priceMap[r.instrument]?.price ?? null
  const getName = (r: StockHolding) => priceMap[r.instrument]?.name  ?? null
  const totalInvested = useMemo(() => rows.reduce((s, r) => s + r.qty * r.avg_cost, 0), [rows])
  const totalValue    = useMemo(() => rows.reduce((s, r) => {
    const ltp = getLTP(r); return s + (ltp != null ? r.qty * ltp : r.qty * r.avg_cost)
  }, 0), [rows, priceMap])
  const actual    = aiHook.data?.reduce((s, e) => s + e.amount, 0)
  const liveLabel = pf ? '⟳ Fetching…' : Object.keys(priceMap).length ? `🟢 Live NSE · ${new Date().toLocaleTimeString('en-IN')}` : undefined
  const handleSave = async (d: Partial<StockHolding>) => {
    try {
      const { _liveName, ...clean } = d as Partial<StockHolding> & { _liveName?: string }
      // When editing, preserve old qty as prev_qty so diff badge shows correctly.
      const existing = rows.find(r => r.id === clean.id)
      const prev_qty = existing ? existing.qty : clean.qty
      await upsertMutation.mutateAsync({ ...clean, prev_qty, user_id: userId } as Record<string,unknown>)
      toast('Saved ✅','success'); setEditRow(null)
    }
    catch (e) { toast((e as Error).message, 'error') }
  }
  const handleBulkSave = async (changes: { id: string; [key: string]: unknown }[]) => {
    try {
      await Promise.all(changes.map(change => {
        const existing = rows.find(r => r.id === change.id)
        if (!existing) return Promise.resolve()
        const qty      = typeof change.qty      === 'number' ? change.qty      : existing.qty
        const avg_cost = typeof change.avg_cost === 'number' ? change.avg_cost : existing.avg_cost
        return upsertMutation.mutateAsync({ ...existing, qty, avg_cost, prev_qty: existing.qty, user_id: userId } as Record<string, unknown>)
      }))
      toast(`Updated ${changes.length} holding${changes.length !== 1 ? 's' : ''} ✅`, 'success')
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const cols = [
    { key: 'instrument',
      mobilePrimary: true, header: 'Instrument', render: (r: StockHolding) => (
      <div><div className="font-bold">{r.instrument}</div>{getName(r) && <div className="text-[10px] text-textmut">{getName(r)}</div>}</div>
    )},
    { key: 'qty',
      hideOnMobile: true, header: 'Qty',
      editable:   true,
      editValue:  (r: StockHolding) => Number(r.qty),
      editStep:   '0.001',
      align: 'right' as const, render: (r: StockHolding) => {
      const qty = Number(r.qty); const diff = r.prev_qty != null ? qty - Number(r.prev_qty) : null
      return (
        <div className="text-right">
          {Number(qty) === 0
            ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red/10 text-red">EXITED</span>
            : <div>{qty.toLocaleString('en-IN')}</div>}
          {diff !== null && diff !== 0 && <div className={`text-[10px] font-semibold ${diff > 0 ? 'text-green' : 'text-red'}`}>{diff > 0 ? '+' : ''}{diff.toLocaleString('en-IN')}</div>}
        </div>
      )
    }},
    { key: 'avg_cost',
      hideOnMobile: true, header: 'Avg Cost',
      editable:   true,
      editValue:  (r: StockHolding) => Number(r.avg_cost).toFixed(2),
      editStep:   '0.01',
      editPrefix:  '₹',   align: 'right' as const, render: (r: StockHolding) => INR(r.avg_cost) },
    { key: 'ltp',
      hideOnMobile: true,      header: 'LTP',        align: 'right' as const, render: (r: StockHolding) => {
      const ltp = getLTP(r); return <span className="font-bold">{ltp != null ? INR(ltp) : '—'}</span>
    }},
    { key: 'invested',
      hideOnMobile: true, header: 'Invested',   align: 'right' as const, render: (r: StockHolding) => INR(r.qty * r.avg_cost) },
    { key: 'value',
      mobileValue: true,    header: 'Cur. Value', align: 'right' as const, render: (r: StockHolding) => {
      const ltp = getLTP(r); const val = ltp != null ? r.qty * ltp : r.qty * r.avg_cost
      return <span className={`font-bold ${val >= r.qty * r.avg_cost ? 'text-green' : 'text-red'}`}>{INR(val)}</span>
    }},
    { key: 'gain',
      mobileSubValue: true, header: 'Gain / Loss', align: 'right' as const, render: (r: StockHolding) => {
      const ltp = getLTP(r); const inv = r.qty * r.avg_cost; const val = ltp != null ? r.qty * ltp : inv
      const { gain, gainPct, isPositive } = calcGain(val, inv)
      return (
        <span className={`font-bold ${isPositive ? 'text-green' : 'text-red'}`}>
          {isPositive ? '+' : ''}{INR(gain)}
          <br /><span className="text-[10px] font-medium opacity-80">{isPositive ? '+' : ''}{gainPct.toFixed(1)}%</span>
        </span>
      )
    }},
  ]
  return (
    <PageShell title="Aionion Stocks" subtitle={`${rows.length} stock${rows.length !== 1 ? 's' : ''}`}
      actions={[
        { label: 'Add Holding', onClick: () => setEditRow({}), variant: 'primary' },
        { label: <span style={{display:'inline-flex',alignItems:'center',gap:5,color:'#fff'}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Refresh</span>, onClick: () => refetch(), variant: 'teal' },
      ]}
    >
      <AssetPageLayout
        stats={<StatGrid items={buildInvestedStats({ invested: totalInvested, value: totalValue, actual, loading: isLoading, liveLabel })} cols={5} />}
        mainTable={
          <AssetTable columns={cols} data={rows} rowKey={r => r.id} loading={isLoading}
            emptyText="No holdings yet — click + Add Holding to get started"
            onEditRow={r => setEditRow(r)}
            onDeleteRows={async ids => { for (const id of ids) await deleteMutation.mutateAsync(id); toast(`Deleted ${ids.length}`, 'success') }}
            onBulkSave={handleBulkSave}
          />
        }
        actualInvested={<ActualInvestedPanel table="aionion_actual_invested" />}
      />
      {editRow !== null && <EditModal row={editRow} name={editRow.id ? getName(editRow as StockHolding) : null} onClose={() => setEditRow(null)} onSave={handleSave} />}
    </PageShell>
  )
}
