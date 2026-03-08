import { useState, useMemo } from 'react'
import { useQueryClient }    from '@tanstack/react-query'
import { useAuthStore }      from '../../store/authStore'
import { useAssets }         from '../../hooks/useAssets'
import { useActualInvested } from '../../hooks/useActualInvested'
import { useYahooPrices }    from '../../hooks/useLivePrices'
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
import type { MfHolding }    from '../../types/assets'

// ── MF-specific CSV parser (mirrors original guessNavSymbol logic) ─
function parseMfCsv(text: string): Omit<MfHolding,'id'|'user_id'>[] | null {
  const rows = parseCsvRows(text)
  if (!rows.length) return null
  const keys = Object.keys(rows[0])
  const find = (...n: string[]) => keys.find(k => n.some(x => k.includes(x))) ?? null

  const kName = find('instrument', 'fund name', 'scheme', 'name')
  const kQty  = find('qty', 'units', 'quantity')
  const kAvg  = find('avg. cost', 'avg cost', 'avg nav', 'average', 'avg')
  if (!kName || !kQty || !kAvg) return null

  return rows
    .map(r => {
      const name = r[kName] ?? ''
      if (!name) return null
      if (/^[A-Z0-9\-\.&]+$/.test(name)) return null
      if (/gold/i.test(name)) return null
      const qty = cleanNum(r[kQty] ?? '')
      const avg = cleanNum(r[kAvg] ?? '')
      if (!qty && !avg) return null
      return { fund_name: name, qty, avg_cost: avg }
    })
    .filter(Boolean) as { fund_name: string; qty: number; avg_cost: number }[]
}

// ── Edit modal ────────────────────────────────────────────────
function EditModal({ row, onClose, onSave }: {
  row:    Partial<MfHolding>
  onClose: () => void
  onSave:  (data: Partial<MfHolding>) => Promise<void>
}) {
  const [fundName, setFundName] = useState(row.fund_name ?? '')
  const [qty,      setQty]      = useState(String(row.qty ?? ''))
  const [avgCost,  setAvgCost]  = useState(String(row.avg_cost ?? ''))
  const [saving,   setSaving]   = useState(false)

  const handleSave = async () => {
    if (!fundName || !qty || !avgCost) return
    setSaving(true)
    const q = parseFloat(qty), a = parseFloat(avgCost)
    await onSave({ ...row, fund_name: fundName, qty: q, avg_cost: a })
    setSaving(false)
  }

  return (
    <Modal open onClose={onClose} title={row.id ? 'Edit Fund' : 'Add Fund'}
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={handleSave} loading={saving}>💾 Save</Button></>}
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Fund Name"
          value={fundName}
          onChange={e => setFundName(e.target.value)}
          placeholder="Fund Name (optionally append ||SYMBOL.BO)"
          helpText="Add ||SYMBOL.BO after the name for live NAV (e.g. Mirae Large Cap||MIRAEASSET.BO)"
        />
        <Input label="Units"    type="number" step="0.001" value={qty}     onChange={e => setQty(e.target.value)} />
        <Input label="Avg NAV" prefix="₹" type="number" step="0.01" value={avgCost} onChange={e => setAvgCost(e.target.value)} />
      </div>
    </Modal>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function MutualFundsPage() {
  const userId = useAuthStore(s => s.user?.id)!
  const toast  = useToastStore(s => s.show)
  const qc     = useQueryClient()

  const { data: rows = [], isLoading } = useAssets<MfHolding>('mf_holdings')
  const aiHook = useActualInvested('mf_actual_invested')

  const symbols = useMemo(() =>
    [...new Set(rows.map(r => r.fund_name.split('||')[1]?.trim()).filter(Boolean) as string[])], [rows])
  const { data: priceMap = {}, isFetching: pricesFetching, refetch } = useYahooPrices(symbols)

  const [editRow,    setEditRow]    = useState<Partial<MfHolding> | null>(null)
  const [showImport, setShowImport] = useState(false)
  const { upsertMutation, deleteMutation } = useAssets<MfHolding>('mf_holdings')

  const getLTP = (r: MfHolding) => {
    const sym = r.fund_name.split('||')[1]?.trim().replace(/\.(NS|BO)$/, '')
    return sym ? (priceMap[sym]?.price ?? null) : null
  }

  const totalInvested = useMemo(() => rows.reduce((s, r) => s + r.qty * r.avg_cost, 0), [rows])
  const totalValue    = useMemo(() => rows.reduce((s, r) => { const ltp = getLTP(r); return s + (ltp != null ? r.qty * ltp : r.qty * r.avg_cost) }, 0), [rows, priceMap])
  const actual = aiHook.data?.reduce((s, e) => s + e.amount, 0)
  const liveLabel = pricesFetching ? '🔄 Fetching…' : Object.keys(priceMap).length ? `🟢 Live NAVs · ${new Date().toLocaleTimeString('en-IN')}` : undefined

  const handleSave = async (data: Partial<MfHolding>) => {
    try { await upsertMutation.mutateAsync({ ...data, user_id: userId } as Record<string,unknown>); toast('Saved ✅', 'success'); setEditRow(null) }
    catch (e) { toast((e as Error).message, 'error') }
  }
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this fund?')) return
    try { await deleteMutation.mutateAsync(id); toast('Deleted', 'success') }
    catch (e) { toast((e as Error).message, 'error') }
  }
  const handleImport = async (parsed: Record<string, unknown>[]) => {
    type R = { fund_name: string; qty: number; avg_cost: number; invested?: number; current_value?: number }
    const rows = parsed as unknown as R[]
    await replaceAssets('mf_holdings', userId, rows.map(r => ({ user_id: userId, fund_name: r.fund_name, qty: r.qty, avg_cost: r.avg_cost, invested: r.invested, current_value: r.current_value })))
    qc.invalidateQueries({ queryKey: ['mf_holdings', userId] })
    toast(`${parsed.length} funds imported ✅`, 'success')
  }

  const cols = [
    { key: 'fund_name', header: 'Fund', render: (r: MfHolding) => {
      const [name, sym] = r.fund_name.split('||')
      return (<div><div className="font-bold text-textprim">{name.trim()}</div>{sym && <div className="text-[10px] text-textmut font-mono">{sym.trim()}</div>}</div>)
    }},
    { key: 'qty',      header: 'Units',    align: 'right' as const, render: (r: MfHolding) => r.qty.toLocaleString('en-IN', { maximumFractionDigits: 4 }) },
    { key: 'avg_cost', header: 'Avg NAV',  align: 'right' as const, render: (r: MfHolding) => INR(r.avg_cost) },
    { key: 'ltp',      header: 'Live NAV', align: 'right' as const, render: (r: MfHolding) => { const ltp = getLTP(r); return <span className="font-bold">{ltp != null ? INR(ltp) : '—'}</span> }},
    { key: 'invested', header: 'Invested', align: 'right' as const, render: (r: MfHolding) => INR(r.qty * r.avg_cost) },
    { key: 'value',    header: 'Cur. Value', align: 'right' as const, render: (r: MfHolding) => { const ltp = getLTP(r); return <span className="font-bold">{INR(ltp != null ? r.qty * ltp : r.qty * r.avg_cost)}</span> }},
    { key: 'gain',     header: 'Gain / Loss', align: 'right' as const, render: (r: MfHolding) => {
      const ltp = getLTP(r); const inv = r.qty * r.avg_cost; const val = ltp != null ? r.qty * ltp : inv
      const { gain, gainPct, isPositive } = calcGain(val, inv)
      return <span className={`font-bold ${isPositive ? 'text-green' : 'text-red'}`}>{isPositive ? '+' : ''}{INR(gain)}<br /><span className="text-[10px] font-medium opacity-80">{isPositive ? '+' : ''}{gainPct.toFixed(1)}%</span></span>
    }},
    { key: 'actions', header: '', align: 'center' as const, render: (r: MfHolding) => (
      <div className="flex gap-1">
        <button onClick={() => setEditRow(r)} className="w-6 h-6 rounded-lg flex items-center justify-center text-textmut hover:bg-surface2 hover:text-teal transition-colors">✏</button>
        <button onClick={() => handleDelete(r.id)} className="w-6 h-6 rounded-lg flex items-center justify-center text-textmut hover:bg-red/10 hover:text-red transition-colors">✕</button>
      </div>
    )},
  ]

  return (
    <PageShell title="Mutual Funds" subtitle={`${rows.length} fund${rows.length !== 1 ? 's' : ''}`}
      actions={[
        { label: '📥 Import CSV', onClick: () => setShowImport(true), variant: 'secondary' },
        { label: '+ Add Fund', onClick: () => setEditRow({}), variant: 'primary' },
        { label: '🔄', onClick: () => refetch(), variant: 'outline' },
      ]}
    >
      <StatGrid items={buildInvestedStats({ invested: totalInvested, value: totalValue, actual, loading: isLoading, liveLabel })} cols={5} />
      <div className="card overflow-hidden">
        <AssetTable columns={cols} data={rows} rowKey={r => r.id} loading={isLoading} emptyText="No funds — click 📥 Import CSV or + Add Fund" />
      </div>
      <div className="card p-5"><ActualInvestedPanel table="mf_actual_invested" /></div>
      {editRow !== null && <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleSave} />}
      <CsvImportModal open={showImport} onClose={() => setShowImport(false)} title="Import Mutual Funds CSV"
        hint="Zerodha-style CSV: Fund Name (or Instrument), Units (or Qty), Avg Cost. Gold and ETF rows are auto-skipped. Append ||SYMBOL.BO to enable live NAVs."
        parse={parseMfCsv}
        columns={[
          { key: 'fund_name', header: 'Fund Name' },
          { key: 'qty',       header: 'Units',    align: 'right' },
          { key: 'avg_cost',  header: 'Avg NAV',  align: 'right' },
          { key: 'invested',  header: 'Invested', align: 'right' },
        ]}
        renderCell={(row, key) => typeof row[key] === 'number' ? INR(row[key] as number) : String(row[key] ?? '—')}
        onImport={handleImport}
      />
    </PageShell>
  )
}
