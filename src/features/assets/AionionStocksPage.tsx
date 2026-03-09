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

function EditModal({ row, onClose, onSave }: {
  row: Partial<StockHolding>; onClose: () => void; onSave: (d: Partial<StockHolding>) => Promise<void>
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
        <NseSymbolInput
          value={inst}
          onChange={setInst}
          onLive={r => {
            // Auto-fill LTP as avg cost only when adding new (not editing)
            if (!row.id && r.status === 'found' && r.price && !avg)
              setAvg(r.price.toFixed(2))
          }}
        />
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
  const liveLabel = pf ? '🔄 Fetching…' : Object.keys(priceMap).length ? `🟢 Live NSE · ${new Date().toLocaleTimeString('en-IN')}` : undefined
  const handleSave = async (d: Partial<StockHolding>) => {
    try {
      // When editing, preserve old qty as prev_qty so diff badge shows correctly.
      // When adding new, prev_qty = qty (no diff to show on first save).
      const existing = rows.find(r => r.id === d.id)
      const prev_qty = existing ? existing.qty : d.qty
      await upsertMutation.mutateAsync({ ...d, prev_qty, user_id: userId } as Record<string,unknown>)
      toast('Saved ✅','success'); setEditRow(null)
    }
    catch (e) { toast((e as Error).message, 'error') }
  }
  const cols = [
    { key: 'instrument', header: 'Instrument', render: (r: StockHolding) => (
      <div><div className="font-bold">{r.instrument}</div>{getName(r) && <div className="text-[10px] text-textmut">{getName(r)}</div>}</div>
    )},
    { key: 'qty', header: 'Qty', align: 'right' as const, render: (r: StockHolding) => {
      const qty = Number(r.qty); const diff = r.prev_qty != null ? qty - Number(r.prev_qty) : null
      return (
        <div className="text-right">
          {qty === 0 ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red/10 text-red">EXITED</span>
            : <div>{qty.toLocaleString('en-IN')}</div>}
          {diff !== null && diff !== 0 && <div className={`text-[10px] font-semibold ${diff > 0 ? 'text-green' : 'text-red'}`}>{diff > 0 ? '+' : ''}{diff.toLocaleString('en-IN')}</div>}
        </div>
      )
    }},
    { key: 'avg_cost', header: 'Avg Cost',   align: 'right' as const, render: (r: StockHolding) => INR(r.avg_cost) },
    { key: 'ltp',      header: 'LTP',        align: 'right' as const, render: (r: StockHolding) => {
      const ltp = getLTP(r); return <span className="font-bold">{ltp != null ? INR(ltp) : '—'}</span>
    }},
    { key: 'invested', header: 'Invested',   align: 'right' as const, render: (r: StockHolding) => INR(r.qty * r.avg_cost) },
    { key: 'value',    header: 'Cur. Value', align: 'right' as const, render: (r: StockHolding) => {
      const ltp = getLTP(r); const val = ltp != null ? r.qty * ltp : r.qty * r.avg_cost
      return <span className={`font-bold ${val >= r.qty * r.avg_cost ? 'text-green' : 'text-red'}`}>{INR(val)}</span>
    }},
    { key: 'gain', header: 'Gain / Loss', align: 'right' as const, render: (r: StockHolding) => {
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
        { label: '+ Add Holding', onClick: () => setEditRow({}), variant: 'primary' },
        { label: '🔄', onClick: () => refetch(), variant: 'outline' },
      ]}
    >
      <AssetPageLayout
        stats={<StatGrid items={buildInvestedStats({ invested: totalInvested, value: totalValue, actual, loading: isLoading, liveLabel })} cols={5} />}
        mainTable={
          <AssetTable columns={cols} data={rows} rowKey={r => r.id} loading={isLoading}
            emptyText="No holdings yet — click + Add Holding to get started"
            onEditRow={r => setEditRow(r)}
            onDeleteRows={async ids => { for (const id of ids) await deleteMutation.mutateAsync(id); toast(`Deleted ${ids.length}`, 'success') }}
          />
        }
        actualInvested={<ActualInvestedPanel table="aionion_actual_invested" />}
      />
      {editRow !== null && <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleSave} />}
    </PageShell>
  )
}
