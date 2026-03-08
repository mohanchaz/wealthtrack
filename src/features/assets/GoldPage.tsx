import { useState, useMemo } from 'react'
import { useQueryClient }    from '@tanstack/react-query'
import { useAuthStore }      from '../../store/authStore'
import { useAssets }         from '../../hooks/useAssets'
import { useYahooPrices }    from '../../hooks/useLivePrices'
import { replaceAssets }     from '../../services/assetService'
import { useToastStore }     from '../../store/toastStore'
import { AssetPageLayout } from '../../components/common/AssetPageLayout'
import { PageShell }         from '../../components/common/PageShell'
import { StatGrid, buildInvestedStats } from '../../components/common/StatGrid'
import { AssetTable }        from '../../components/common/AssetTable'
import { CsvImportModal }    from '../../components/common/CsvImportModal'
import { Modal }             from '../../components/ui/Modal'
import { Button }            from '../../components/ui/Button'
import { Input }             from '../../components/ui/Input'
import { INR, calcGain }     from '../../lib/utils'
import { parseCsvRows, cleanNum } from '../../lib/csvParser'
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

function parseGoldCsv(text: string): Omit<GoldHolding,'id'|'user_id'>[] | null {
  const rows = parseCsvRows(text)
  if (!rows.length) return null
  const keys = Object.keys(rows[0])
  const find = (...n: string[]) => keys.find(k => n.some(x => k.includes(x))) ?? null
  const kName = find('name', 'holding', 'instrument')
  const kType = find('type')
  const kQty  = find('qty', 'units', 'quantity')
  const kAvg  = find('avg', 'cost', 'nav')
  const kSym  = find('symbol', 'yahoo')
  if (!kName || !kQty || !kAvg) return null
  return rows.map(r => {
    const name = r[kName!] ?? ''
    const qty  = cleanNum(r[kQty!] ?? '')
    const avg  = cleanNum(r[kAvg!] ?? '')
    const { type, yahoo } = lookupGold(name)
    return {
      holding_name: name,
      // Use CSV type if explicitly provided, otherwise auto-detect
      holding_type: kType && r[kType] ? r[kType].toUpperCase() : type,
      qty,
      avg_cost:     avg,
      // Use CSV yahoo_symbol if provided, otherwise auto-detect
      yahoo_symbol: (kSym && r[kSym]) ? r[kSym] : yahoo,
    }
  }).filter(r => {
    if (!r.holding_name || r.qty <= 0) return false
    return /gold/i.test(r.holding_name)
  }) as Omit<GoldHolding,'id'|'user_id'>[]
}

function EditModal({ row, onClose, onSave }: { row: Partial<GoldHolding>; onClose: () => void; onSave: (d: Partial<GoldHolding>) => Promise<void> }) {
  const [name,    setName]    = useState(row.holding_name ?? '')
  const [type,    setType]    = useState(row.holding_type ?? 'ETF')
  const [qty,     setQty]     = useState(String(row.qty ?? ''))
  const [avg,     setAvg]     = useState(String(row.avg_cost ?? ''))
  const [sym,     setSym]     = useState(row.yahoo_symbol ?? '')
  const [saving,  setSaving]  = useState(false)
  const handleSave = async () => {
    if (!name || !qty || !avg) return
    setSaving(true)
    const q = parseFloat(qty), a = parseFloat(avg)
    await onSave({ ...row, holding_name: name, holding_type: type, qty: q, avg_cost: a, yahoo_symbol: sym })
    setSaving(false)
  }
  return (
    <Modal open onClose={onClose} title={row.id ? 'Edit Holding' : 'Add Holding'}
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={handleSave} loading={saving}>💾 Save</Button></>}
    >
      <div className="flex flex-col gap-4">
        <Input label="Name" value={name} onChange={e => setName(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-textsec uppercase tracking-wider">Type</label>
          <select value={type} onChange={e => setType(e.target.value)} className="h-9 rounded-xl border border-border bg-white text-sm text-textprim px-3 focus:border-teal focus:ring-2 focus:ring-teal/15 outline-none">
            <option value="ETF">ETF</option><option value="MF">MF</option>
          </select>
        </div>
        <Input label="Qty / Units" type="number" step="0.001" value={qty} onChange={e => setQty(e.target.value)} />
        <Input label="Avg Cost / NAV" prefix="₹" type="number" step="0.01" value={avg} onChange={e => setAvg(e.target.value)} />
        <Input label="Yahoo Symbol (for live price)" value={sym} onChange={e => setSym(e.target.value)} placeholder="e.g. GOLDBEES.NS" />
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
  const [showImport, setShowImport] = useState(false)
  const { upsertMutation, deleteMutation } = useAssets<GoldHolding>('gold_holdings')
  const getLTP = (r: GoldHolding) => r.yahoo_symbol ? (priceMap[r.yahoo_symbol.replace(/\.(NS|BO)$/,'')]?.price ?? null) : null
  const totalInvested = useMemo(() => rows.reduce((s, r) => s + r.qty * r.avg_cost, 0), [rows])
  const totalValue    = useMemo(() => rows.reduce((s, r) => { const ltp = getLTP(r); return s + (ltp != null ? r.qty * ltp : r.qty * r.avg_cost) }, 0), [rows, priceMap])
  const liveLabel = pf ? '🔄 Fetching…' : Object.keys(priceMap).length ? `🟢 Live · ${new Date().toLocaleTimeString('en-IN')}` : undefined
  const handleSave = async (d: Partial<GoldHolding>) => {
    try { await upsertMutation.mutateAsync({ ...d, user_id: userId } as Record<string,unknown>); toast('Saved ✅', 'success'); setEditRow(null) }
    catch (e) { toast((e as Error).message, 'error') }
  }
  const handleDelete = async (id: string) => {
    if (!confirm('Delete?')) return
    try { await deleteMutation.mutateAsync(id); toast('Deleted', 'success') } catch (e) { toast((e as Error).message, 'error') }
  }
  const handleImport = async (parsed: Record<string, unknown>[]) => {
    await replaceAssets('gold_holdings', userId, parsed.map(r => ({ ...r, user_id: userId })))
    qc.invalidateQueries({ queryKey: ['gold_holdings', userId] })
    toast(`${parsed.length} holdings imported ✅`, 'success')
  }
  const cols = [
    { key: 'holding_name', header: 'Name', render: (r: GoldHolding) => <span className="font-bold">{r.holding_name}</span> },
    { key: 'holding_type', header: 'Type', render: (r: GoldHolding) => (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.holding_type === 'ETF' ? 'bg-amber/10 text-amber' : 'bg-teal/10 text-teal'}`}>{r.holding_type}</span>
    )},
    { key: 'qty',      header: 'Qty',       align: 'right' as const, render: (r: GoldHolding) => r.qty.toLocaleString('en-IN', { maximumFractionDigits: 4 }) },
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
        { label: '📥 Import CSV', onClick: () => setShowImport(true), variant: 'secondary' },
        { label: '+ Add Holding', onClick: () => setEditRow({}), variant: 'primary' },
        { label: '🔄', onClick: () => refetch(), variant: 'outline' },
      ]}
    >
      <AssetPageLayout
        stats={<StatGrid items={buildInvestedStats({ invested: totalInvested, value: totalValue, loading: isLoading, liveLabel }).slice(0, 3)} cols={3} />}
        mainTable={<AssetTable columns={cols} data={rows} rowKey={r => r.id} loading={isLoading} emptyText="No gold holdings — click 📥 Import CSV or + Add Holding" 
            onEditRow={r => setEditRow(r)}
            onDeleteRows={async ids => { for (const id of ids) await deleteMutation.mutateAsync(id); toast(`Deleted ${ids.length}`, 'success') }}
          />}
      />
      {editRow !== null && <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleSave} />}
      <CsvImportModal open={showImport} onClose={() => setShowImport(false)} title="Import Gold Holdings CSV"
        hint="CSV: Name (or Holding), Qty (or Units), Avg Cost (or NAV). Optional: Type (ETF/MF), Yahoo Symbol."
        parse={parseGoldCsv}
        columns={[
          { key: 'holding_name', header: 'Name' },
          { key: 'holding_type', header: 'Type' },
          { key: 'qty',          header: 'Qty',     align: 'right' },
          { key: 'avg_cost',     header: 'Avg Cost', align: 'right' },
        ]}
        renderCell={(row, key) => typeof row[key] === 'number' ? INR(row[key] as number) : String(row[key] ?? '—')}
        onImport={handleImport}
      />
    </PageShell>
  )
}
