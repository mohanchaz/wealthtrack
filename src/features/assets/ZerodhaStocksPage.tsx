import { useState, useMemo } from 'react'
import { useQueryClient }    from '@tanstack/react-query'
import { useAuthStore }      from '../../store/authStore'
import { useAssets }         from '../../hooks/useAssets'
import { useActualInvested } from '../../hooks/useActualInvested'
import { useNsePrices }      from '../../hooks/useLivePrices'
import { useToastStore }     from '../../store/toastStore'
import { AssetPageLayout } from '../../components/common/AssetPageLayout'
import { PageShell }         from '../../components/common/PageShell'
import { StatGrid, buildInvestedStats } from '../../components/common/StatGrid'
import { AssetTable }        from '../../components/common/AssetTable'
import { ActualInvestedPanel } from '../../components/common/ActualInvestedPanel'
import { Modal }             from '../../components/ui/Modal'
import { Button }            from '../../components/ui/Button'
import { Input }             from '../../components/ui/Input'
import { NseSymbolInput }    from '../../components/common/NseSymbolInput'
import { INR, calcGain }     from '../../lib/utils'
import { parseCsvRows, cleanNum } from '../../lib/csvParser'
import type { StockHolding } from '../../types/assets'

// Only store what's in the DB schema: instrument, qty, avg_cost
interface CsvRow { instrument: string; qty: number; avg_cost: number }

// Gold/Silver ETFs listed on NSE that appear in Zerodha holdings but belong in Gold page
const GOLD_ETF_SYMBOLS = new Set([
  'GOLDBEES','GOLDIETF','AXISGOLD','HDFCGOLD','ICICIGOLD','KOTAKGOLD',
  'NIPGOLD','SBIGOLD','QGOLDHALF','BSLGOLDETF','LICMFGOLD','MAFANG',
  'SILVERBEES','SILVERETF','SILVER','SILVERIETF',
])

// Known ETF/MF symbols that look like stocks but are funds
const ETF_PATTERN = /BEES$|ETF$|FUND$|INDEX$/i
// NCD/Bond symbols start with digits (e.g. 1075MML027, 12ACAPL27B, 985ACAPL26)
// Also Sovereign Gold Bonds (SGBSEP28, SGBMAR29)
const NCD_BOND_PATTERN = /^\d+[A-Z]|^SGB[A-Z]/i

function isStockRow(rawName: string): boolean {
  const name = rawName.trim()
  if (!name) return false
  // Mutual fund rows always have spaces (e.g. "Aditya Birla Sun Life Large Cap Fund")
  if (name.includes(' ')) return false
  const upper = name.toUpperCase()
  // Known Gold/Silver ETF symbols
  if (GOLD_ETF_SYMBOLS.has(upper)) return false
  // Symbols ending in BEES, ETF, FUND, INDEX
  if (ETF_PATTERN.test(upper)) return false
  // NCD/Bond instruments start with digits or SGB prefix
  if (NCD_BOND_PATTERN.test(upper)) return false
  return true
}

// ── Edit modal ────────────────────────────────────────────────
function EditModal({ row, name, onClose, onSave }: {
  row:     Partial<StockHolding>
  name?:   string | null
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
          <Button size="sm" onClick={handleSave} loading={saving} disabled={!instrument || !qty || !avgCost}>💾 Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {row.id ? (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-textmut uppercase tracking-wider">Symbol</label>
            <div className="h-9 rounded-xl border border-border bg-surface2 text-sm text-textmut px-3 flex items-center font-mono select-none cursor-not-allowed">
              {instrument}
            </div>
            {name && <div className="text-xs text-textmut mt-0.5">{name}</div>}
          </div>
        ) : (
          <NseSymbolInput
            value={instrument}
            onChange={setInstrument}
            onLive={r => {
              if (r.status === 'found' && r.price && !avgCost)
                setAvgCost(r.price.toFixed(2))
            }}
          />
        )}
        <Input label="Quantity"     type="number" value={qty}     onChange={e => setQty(e.target.value)} placeholder="e.g. 10" />
        <Input label="Avg Cost (₹)" prefix="₹" type="number" step="0.01" value={avgCost} onChange={e => setAvgCost(e.target.value)} placeholder="e.g. 1500.00" />
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
      const { _liveName, ...clean } = data as Partial<StockHolding> & { _liveName?: string }
      // Keep prev_qty as the pre-edit qty so the diff badge stays accurate
      const existing = rows.find(r => r.id === clean.id)
      const prev_qty = existing ? existing.qty : clean.qty
      await upsertMutation.mutateAsync({ ...clean, prev_qty, user_id: userId } as Record<string, unknown>)
      toast('Saved ✅', 'success')
      setEditRow(null)
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const handleDelete = async (id: string) => {
        try {
      await deleteMutation.mutateAsync(id)
      toast('Deleted', 'success')
    } catch (e) { toast((e as Error).message, 'error') }
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
    {
      key: 'qty', header: 'QTY', align: 'right' as const,
      render: (r: StockHolding) => {
        const qty  = Number(r.qty)
        const diff = r.prev_qty != null ? qty - Number(r.prev_qty) : null
        return (
          <div className="text-right">
            {Number(qty) === 0
            ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red/10 text-red">EXITED</span>
            : <div>{qty.toLocaleString('en-IN')}</div>}
            {diff !== null && diff !== 0 && (
              <div className={`text-[10px] font-semibold ${diff > 0 ? 'text-green' : 'text-red'}`}>
                {diff > 0 ? '+' : ''}{diff.toLocaleString('en-IN')}
              </div>
            )}
          </div>
        )
      },
    },
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
        return <span className={`font-bold ${(ltp ?? r.avg_cost) >= r.avg_cost ? "text-green" : "text-red"}`}>{INR(ltp != null ? r.qty * ltp : r.qty * r.avg_cost)}</span>
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
  ]

  return (
    <PageShell
      title="Zerodha Stocks"
      subtitle={`${rows.length} stock${rows.length !== 1 ? 's' : ''}`}
      actions={[
        { label: 'Add Holding', onClick: () => setEditRow({}),      variant: 'primary'   },
        { label: '🔄',            onClick: () => refreshPrices(),     variant: 'outline'   },
      ]}
    >
      <AssetPageLayout
        stats={<StatGrid items={stats} cols={5} />}
        mainTable={
          <AssetTable
            columns={cols}
            data={rows}
            rowKey={r => r.id}
            loading={isLoading}
            emptyText="No holdings — click + Add Holding or import from Zerodha Overview"
          
            onEditRow={r => setEditRow({ ...r, _liveName: getName(r) } as typeof r)}
            onDeleteRows={async ids => { for (const id of ids) await deleteMutation.mutateAsync(id); toast(`Deleted ${ids.length}`, 'success') }}
          />
        }
        actualInvested={<ActualInvestedPanel table="zerodha_actual_invested" />}
      />

      {editRow !== null && (
        <EditModal row={editRow} name={editRow.id ? (editRow as StockHolding & { _liveName?: string })._liveName ?? getName(editRow as StockHolding) : null} onClose={() => setEditRow(null)} onSave={handleSave} />
      )}


    </PageShell>
  )
}
