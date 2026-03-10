import { useState, useMemo } from 'react'
import { useQueryClient }    from '@tanstack/react-query'
import { useAuthStore }      from '../../store/authStore'
import { useAssets }         from '../../hooks/useAssets'
import { useYahooPrices }    from '../../hooks/useLivePrices'
import { useToastStore }     from '../../store/toastStore'
import { AssetPageLayout } from '../../components/common/AssetPageLayout'
import { PageShell }         from '../../components/common/PageShell'
import { StatGrid, buildInvestedStats } from '../../components/common/StatGrid'
import { AssetTable }        from '../../components/common/AssetTable'
import { Modal }             from '../../components/ui/Modal'
import { Button }            from '../../components/ui/Button'
import { Input }             from '../../components/ui/Input'
import { INR, calcGain }     from '../../lib/utils'
import type { GoldHolding }  from '../../types/assets'

// Known gold holdings: name fragment → { type, yahoo_symbol }
const GOLD_LOOKUP: { match: RegExp; type: string; yahoo: string }[] = [
  { match: /goldbees/i,              type: 'ETF', yahoo: 'GOLDBEES.NS' },
  { match: /nippon.*gold/i,          type: 'MF',  yahoo: '0P0000XVDS.BO' },
  { match: /axis.*gold/i,            type: 'ETF', yahoo: 'AXISGOLD.NS' },
  { match: /hdfc.*gold/i,            type: 'ETF', yahoo: 'HDFCGOLD.NS' },
  { match: /icici.*gold/i,           type: 'ETF', yahoo: 'ICICIGOLD.NS' },
  { match: /kotak.*gold/i,           type: 'ETF', yahoo: 'KOTAKGOLD.NS' },
  { match: /sbi.*gold/i,             type: 'ETF', yahoo: 'SBIGOLD.NS' },
  { match: /quantum.*gold/i,         type: 'MF',  yahoo: '0P0000XV6Q.BO' },
  { match: /invesco.*gold/i,         type: 'MF',  yahoo: '' },
  { match: /dsp.*gold/i,             type: 'MF',  yahoo: '' },
]

function lookupGold(name: string): { type: string; yahoo: string } {
  for (const entry of GOLD_LOOKUP) {
    if (entry.match.test(name)) return { type: entry.type, yahoo: entry.yahoo }
  }
  // Default: if name has "fund" it's MF, else ETF
  return { type: /fund/i.test(name) ? 'MF' : 'ETF', yahoo: '' }
}

function EditModal({ row, liveName, onClose, onSave }: { row: Partial<GoldHolding>; liveName?: string | null; onClose: () => void; onSave: (d: Partial<GoldHolding>) => Promise<void> }) {
  const [qty,     setQty]     = useState(String(row.qty ?? ''))
  const [avg,     setAvg]     = useState(String(row.avg_cost ?? ''))
  const [sym,     setSym]     = useState(row.yahoo_symbol ?? '')
  const [saving,  setSaving]  = useState(false)
  const handleSave = async () => {
    if (!qty || !avg) return
    setSaving(true)
    const q = parseFloat(qty), a = parseFloat(avg)
    await onSave({ ...row, qty: q, avg_cost: a, yahoo_symbol: sym })
    setSaving(false)
  }
  return (
    <Modal open onClose={onClose} title={row.id ? 'Edit Holding' : 'Add Holding'}
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={handleSave} loading={saving}>💾 Save</Button></>}
    >
      <div className="flex flex-col gap-4">
<Input label="Qty / Units" type="number" step="0.001" value={qty} onChange={e => setQty(e.target.value)} />
        <Input label="Avg Cost / NAV" prefix="₹" type="number" step="0.01" value={avg} onChange={e => setAvg(e.target.value)} />
        {row.id ? (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-textmut uppercase tracking-wider">Yahoo Symbol</label>
            <div className="h-9 rounded-xl border border-border bg-surface2 text-sm text-textmut px-3 flex items-center font-mono select-none cursor-not-allowed">
              {sym || <span className="italic opacity-40">—</span>}
            </div>
            {liveName && <div className="text-xs text-textmut mt-0.5">{liveName}</div>}
          </div>
        ) : (
          <Input label="Yahoo Symbol (for live price)" value={sym} onChange={e => setSym(e.target.value)} placeholder="e.g. GOLDBEES.NS" />
        )}
      </div>
    </Modal>
  )
}

export default function GoldPage() {
  const userId = useAuthStore(s => s.user?.id)!
  const toast  = useToastStore(s => s.show)
  const qc     = useQueryClient()
  const { data: rows = [], isLoading } = useAssets<GoldHolding>('gold_holdings')
  const symbols = useMemo(() => [...new Set(rows.map(r => r.yahoo_symbol).filter(Boolean) as string[])], [rows])
  const { data: priceMap = {}, isFetching: pf, refetch } = useYahooPrices(symbols)
  const [editRow, setEditRow] = useState<Partial<GoldHolding> | null>(null)
  const { upsertMutation, deleteMutation } = useAssets<GoldHolding>('gold_holdings')
  const getLTP  = (r: GoldHolding) => r.yahoo_symbol ? (priceMap[r.yahoo_symbol.replace(/\.(NS|BO)$/,'')]?.price ?? null) : null
  const getName = (r: GoldHolding) => r.yahoo_symbol ? (priceMap[r.yahoo_symbol.replace(/\.(NS|BO)$/,'')]?.name ?? null) : null
  const totalInvested = useMemo(() => rows.reduce((s, r) => s + r.qty * r.avg_cost, 0), [rows])
  const totalValue    = useMemo(() => rows.reduce((s, r) => { const ltp = getLTP(r); return s + (ltp != null ? r.qty * ltp : r.qty * r.avg_cost) }, 0), [rows, priceMap])
  const liveLabel = pf ? '🔄 Fetching…' : Object.keys(priceMap).length ? `🟢 Live · ${new Date().toLocaleTimeString('en-IN')}` : undefined
  const handleSave = async (d: Partial<GoldHolding>) => {
    try {
      const existing = rows.find(r => r.id === d.id)
      const prev_qty = existing ? existing.qty : d.qty
      await upsertMutation.mutateAsync({ ...d, prev_qty, user_id: userId } as Record<string,unknown>)
      toast('Saved ✅', 'success'); setEditRow(null)
    }
    catch (e) { toast((e as Error).message, 'error') }
  }
  const handleDelete = async (id: string) => {
        try { await deleteMutation.mutateAsync(id); toast('Deleted', 'success') } catch (e) { toast((e as Error).message, 'error') }
  }
  const cols = [
    { key: 'yahoo_symbol', header: 'Name', render: (r: GoldHolding) => (
      <div>
        <div className="font-bold">{getName(r) ?? r.yahoo_symbol ?? '—'}</div>
        {r.yahoo_symbol && <div className="text-[10px] text-textmut font-mono">{r.yahoo_symbol}</div>}
      </div>
    )},
    { key: 'qty', header: 'Qty', align: 'right' as const, render: (r: GoldHolding) => {
      const qty  = Number(r.qty)
      const diff = r.prev_qty != null ? qty - Number(r.prev_qty) : null
      return (
        <div>
          {Number(qty) === 0
            ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red/10 text-red">EXITED</span>
            : <div>{qty.toLocaleString('en-IN', { maximumFractionDigits: 4 })}</div>}
          {diff !== null && diff !== 0 && (
            <div className={`text-[10px] font-semibold ${diff > 0 ? 'text-green' : 'text-red'}`}>
              {diff > 0 ? '+' : ''}{diff.toLocaleString('en-IN', { maximumFractionDigits: 4 })}
            </div>
          )}
        </div>
      )
    }},
    { key: 'avg_cost', header: 'Avg Cost',  align: 'right' as const, render: (r: GoldHolding) => INR(r.avg_cost) },
    { key: 'ltp',      header: 'Live Price', align: 'right' as const, render: (r: GoldHolding) => { const ltp = getLTP(r); return <span className="font-bold">{ltp != null ? INR(ltp) : '—'}</span> }},
    { key: 'invested', header: 'Invested',  align: 'right' as const, render: (r: GoldHolding) => INR(r.qty * r.avg_cost) },
    { key: 'value',    header: 'Cur. Value', align: 'right' as const, render: (r: GoldHolding) => { const ltp = getLTP(r); const val = ltp != null ? r.qty * ltp : r.qty * r.avg_cost; return <span className={`font-bold ${val >= r.qty * r.avg_cost ? "text-green" : "text-red"}`}>{INR(val)}</span> }},
    { key: 'gain',     header: 'Gain / Loss', align: 'right' as const, render: (r: GoldHolding) => {
      const ltp = getLTP(r); const inv = r.qty * r.avg_cost; const val = ltp != null ? r.qty * ltp : inv
      const { gain, gainPct, isPositive } = calcGain(val, inv)
      return <span className={`font-bold ${isPositive ? 'text-green' : 'text-red'}`}>{isPositive ? '+' : ''}{INR(gain)}<br /><span className="text-[10px] font-medium opacity-80">{isPositive?'+':''}{gainPct.toFixed(1)}%</span></span>
    }},
  ]
  return (
    <PageShell title="Gold" subtitle={`${rows.length} holding${rows.length !== 1 ? 's' : ''}`}
      actions={[
        { label: 'Add Holding', onClick: () => setEditRow({}), variant: 'primary' },
        { label: '🔄', onClick: () => refetch(), variant: 'outline' },
      ]}
    >
      <AssetPageLayout
        stats={<StatGrid items={buildInvestedStats({ invested: totalInvested, value: totalValue, loading: isLoading, liveLabel }).slice(0, 3)} cols={3} />}
        mainTable={<AssetTable columns={cols} data={rows} rowKey={r => r.id} loading={isLoading} emptyText="No gold holdings — import from Zerodha Overview or click + Add Holding" 
            onEditRow={r => setEditRow({ ...r, _liveName: getName(r) } as typeof r)}
            onDeleteRows={async ids => { for (const id of ids) await deleteMutation.mutateAsync(id); toast(`Deleted ${ids.length}`, 'success') }}
          />}
      />
      {editRow !== null && <EditModal row={editRow} liveName={editRow.id ? (editRow as GoldHolding & { _liveName?: string })._liveName ?? getName(editRow as GoldHolding) : null} onClose={() => setEditRow(null)} onSave={handleSave} />}

    </PageShell>
  )
}
