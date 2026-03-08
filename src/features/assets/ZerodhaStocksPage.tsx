import { useState, useMemo } from 'react'
import { useQueryClient }    from '@tanstack/react-query'
import { useAuthStore }      from '../../store/authStore'
import { useAssets }         from '../../hooks/useAssets'
import { useActualInvested } from '../../hooks/useActualInvested'
import { useNsePrices }      from '../../hooks/useLivePrices'
import { replaceAssets }     from '../../services/assetService'
import { useToastStore }     from '../../store/toastStore'
import { PageShell }         from '../../components/common/PageShell'
import { StatGrid, buildInvestedStats } from '../../components/common/StatGrid'
import { AssetTable }        from '../../components/common/AssetTable'
import { ActualInvestedPanel } from '../../components/common/ActualInvestedPanel'
import { CsvImportModal }    from '../../components/common/CsvImportModal'
import { Modal }             from '../../components/ui/Modal'
import { Button }            from '../../components/ui/Button'
import { Input }             from '../../components/ui/Input'
import { INR, calcGain }     from '../../lib/utils'
import { parseCsvRows, cleanNum } from '../../lib/csvParser'
import type { StockHolding } from '../../types/assets'

// Only store what's in the DB schema: instrument, qty, avg_cost
interface CsvRow { instrument: string; qty: number; avg_cost: number }

function parseZerodhaCsv(text: string): CsvRow[] | null {
  const rows = parseCsvRows(text)
  if (!rows.length) return null
  const keys = Object.keys(rows[0])
  const find = (...n: string[]) => keys.find(k => n.some(x => k.includes(x))) ?? null

  const kInst = find('instrument', 'symbol', 'stock')
  const kQty  = find('qty', 'quantity')
  const kAvg  = find('avg', 'cost', 'price')
  if (!kInst || !kQty || !kAvg) return null

  return rows
    .map(r => ({
      instrument: (r[kInst] ?? '').toUpperCase(),
      qty:        cleanNum(r[kQty] ?? ''),
      avg_cost:   cleanNum(r[kAvg] ?? ''),
    }))
    .filter(r => r.instrument && r.qty > 0)
}

// ── Edit modal ────────────────────────────────────────────────
function EditModal({ row, onClose, onSave }: {
  row:     Partial<StockHolding>
  onClose: () => void
  onSave:  (data: Partial<StockHolding>) => Promise<void>
}) {
  const [instrument, setInstrument] = useState(row.instrument ?? '')
  const [qty,        setQty]        = useState(String(row.qty ?? ''))
  const [avgCost,    setAvgCost]    = useState(String(row.avg_cost ?? ''))
  const [saving,     setSaving]     = useState(false)

  const handleSave = async () => {
    if (!instrument || !qty || !avgCost) return
    setSaving(true)
    const q = parseFloat(qty), a = parseFloat(avgCost)
    await onSave({ ...row, instrument: instrument.toUpperCase(), qty: q, avg_cost: a })
    setSaving(false)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={row.id ? 'Edit Holding' : 'Add Holding'}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} loading={saving}>💾 Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="NSE Symbol" value={instrument} onChange={e => setInstrument(e.target.value)} placeholder="e.g. RELIANCE" />
        <Input label="Quantity"   type="number" value={qty}     onChange={e => setQty(e.target.value)} />
        <Input label="Avg Cost (₹)" prefix="₹" type="number" step="0.01" value={avgCost} onChange={e => setAvgCost(e.target.value)} />
      </div>
    </Modal>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function ZerodhaStocksPage() {
  const userId  = useAuthStore(s => s.user?.id)!
  const toast   = useToastStore(s => s.show)
  const qc      = useQueryClient()

  const { data: rows = [], isLoading } = useAssets<StockHolding>('zerodha_stocks')
  const aiHook  = useActualInvested('zerodha_actual_invested')

  const instruments = useMemo(() => rows.map(r => r.instrument), [rows])
  const { data: priceMap = {}, isFetching: pricesFetching, refetch: refreshPrices } = useNsePrices(instruments)

  const [editRow,    setEditRow]    = useState<Partial<StockHolding> | null>(null)
  const [showImport, setShowImport] = useState(false)

  const { upsertMutation, deleteMutation } = useAssets<StockHolding>('zerodha_stocks')

  const getLTP  = (r: StockHolding) => priceMap[r.instrument]?.price ?? null
  const getName = (r: StockHolding) => priceMap[r.instrument]?.name ?? null

  const totalInvested = useMemo(() =>
    rows.reduce((s, r) => s + r.qty * r.avg_cost, 0), [rows])
  const totalValue = useMemo(() =>
    rows.reduce((s, r) => {
      const ltp = getLTP(r)
      return s + (ltp != null ? r.qty * ltp : r.qty * r.avg_cost)
    }, 0), [rows, priceMap])

  const actual = aiHook.data?.reduce((s, e) => s + e.amount, 0)

  const hasLive   = Object.keys(priceMap).length > 0
  const liveLabel = pricesFetching
    ? '🔄 Fetching live prices…'
    : hasLive ? `🟢 Live · ${new Date().toLocaleTimeString('en-IN')}` : undefined

  const handleSave = async (data: Partial<StockHolding>) => {
    try {
      await upsertMutation.mutateAsync({ ...data, user_id: userId } as Record<string, unknown>)
      toast('Saved ✅', 'success')
      setEditRow(null)
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this holding?')) return
    try {
      await deleteMutation.mutateAsync(id)
      toast('Deleted', 'success')
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const handleImport = async (parsed: Record<string, unknown>[]) => {
    // Only pass columns that exist in the DB schema
    await replaceAssets('zerodha_stocks', userId,
      parsed.map(r => ({ user_id: userId, instrument: r.instrument, qty: r.qty, avg_cost: r.avg_cost }))
    )
    qc.invalidateQueries({ queryKey: ['zerodha_stocks', userId] })
    toast(`${parsed.length} stocks imported ✅`, 'success')
  }

  const stats = buildInvestedStats({
    invested:  totalInvested,
    value:     totalValue,
    actual,
    loading:   isLoading,
    liveLabel,
  })

  const cols = [
    {
      key: 'instrument', header: 'Instrument',
      render: (r: StockHolding) => (
        <div>
          <div className="font-bold text-textprim">{r.instrument}</div>
          {getName(r) && <div className="text-[10px] text-textmut">{getName(r)}</div>}
        </div>
      ),
    },
    { key: 'qty',      header: 'Qty',        align: 'right' as const, render: (r: StockHolding) => r.qty.toLocaleString('en-IN') },
    { key: 'avg_cost', header: 'Avg Cost',   align: 'right' as const, render: (r: StockHolding) => INR(r.avg_cost) },
    {
      key: 'ltp', header: 'LTP', align: 'right' as const,
      render: (r: StockHolding) => {
        const ltp = getLTP(r)
        return <span className="font-bold">{ltp != null ? INR(ltp) : '—'}</span>
      },
    },
    { key: 'invested', header: 'Invested',   align: 'right' as const, render: (r: StockHolding) => INR(r.qty * r.avg_cost) },
    {
      key: 'value', header: 'Cur. Value', align: 'right' as const,
      render: (r: StockHolding) => {
        const ltp = getLTP(r)
        return <span className="font-bold">{INR(ltp != null ? r.qty * ltp : r.qty * r.avg_cost)}</span>
      },
    },
    {
      key: 'gain', header: 'Gain / Loss', align: 'right' as const,
      render: (r: StockHolding) => {
        const ltp  = getLTP(r)
        const inv  = r.qty * r.avg_cost
        const val  = ltp != null ? r.qty * ltp : inv
        const { gain, gainPct, isPositive } = calcGain(val, inv)
        return (
          <span className={`font-bold ${isPositive ? 'text-green' : 'text-red'}`}>
            {isPositive ? '+' : ''}{INR(gain)}<br />
            <span className="text-[10px] font-medium opacity-80">
              {isPositive ? '+' : ''}{gainPct.toFixed(1)}%
            </span>
          </span>
        )
      },
    },
    {
      key: 'actions', header: '', align: 'center' as const,
      render: (r: StockHolding) => (
        <div className="flex items-center gap-1">
          <button onClick={() => setEditRow(r)}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-textmut hover:bg-surface2 hover:text-teal transition-colors">✏</button>
          <button onClick={() => handleDelete(r.id)}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-textmut hover:bg-red/10 hover:text-red transition-colors">✕</button>
        </div>
      ),
    },
  ]

  return (
    <PageShell
      title="Zerodha Stocks"
      subtitle={`${rows.length} holding${rows.length !== 1 ? 's' : ''}`}
      actions={[
        { label: '📥 Import CSV', onClick: () => setShowImport(true), variant: 'secondary' },
        { label: '+ Add Holding', onClick: () => setEditRow({}),      variant: 'primary'   },
        { label: '🔄',            onClick: () => refreshPrices(),     variant: 'outline'   },
      ]}
    >
      <StatGrid items={stats} cols={5} />

      <div className="card overflow-hidden">
        <AssetTable
          columns={cols}
          data={rows}
          rowKey={r => r.id}
          loading={isLoading}
          emptyText="No holdings — click 📥 Import CSV or + Add Holding"
        />
      </div>

      <div className="card p-5">
        <ActualInvestedPanel table="zerodha_actual_invested" />
      </div>

      {editRow !== null && (
        <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleSave} />
      )}

      <CsvImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Import Zerodha Holdings"
        hint="CSV must have: Instrument (or Symbol), Qty, Avg Cost. Current value is fetched live from NSE — no need to import it."
        parse={parseZerodhaCsv}
        columns={[
          { key: 'instrument', header: 'Instrument' },
          { key: 'qty',        header: 'Qty',      align: 'right' },
          { key: 'avg_cost',   header: 'Avg Cost', align: 'right' },
        ]}
        renderCell={(row, key) =>
          typeof row[key] === 'number' ? INR(row[key] as number) : String(row[key] ?? '—')
        }
        onImport={handleImport}
      />
    </PageShell>
  )
}
