import { useState, useMemo } from 'react'
import { useQueryClient }    from '@tanstack/react-query'
import { useAuthStore }      from '../../store/authStore'
import { useAssets }         from '../../hooks/useAssets'
import { useActualInvested } from '../../hooks/useActualInvested'
import { useYahooPrices, useFxRates } from '../../hooks/useLivePrices'
import { replaceAssets }     from '../../services/assetService'
import { useToastStore }     from '../../store/toastStore'
import { AssetPageLayout } from '../../components/common/AssetPageLayout'
import { PageShell }         from '../../components/common/PageShell'
import { StatGrid }          from '../../components/common/StatGrid'
import { AssetTable }        from '../../components/common/AssetTable'
import { ActualInvestedPanel } from '../../components/common/ActualInvestedPanel'
import { CsvImportModal }    from '../../components/common/CsvImportModal'
import { Modal }             from '../../components/ui/Modal'
import { Button }            from '../../components/ui/Button'
import { Input }             from '../../components/ui/Input'
import { INR, calcGain }     from '../../lib/utils'
import { parseCsvRows, cleanNum } from '../../lib/csvParser'
import type { ForeignHolding } from '../../types/assets'

// London symbols traded in pence (GBX) — price needs ÷100 for £
const GBX_SET = new Set(['MKS'])
// Yahoo symbol overrides
const YAHOO_MAP: Record<string, string> = {
  BRK: 'BRK-B', CNDX: 'CNDX.L', IGLN: 'IGLN.L', MKS: 'MKS.L', SPXS: 'SPXS.L',
}

function toYahooSymbol(symbol: string, currency: string): string {
  if (YAHOO_MAP[symbol]) return YAHOO_MAP[symbol]
  if (currency === 'GBP' || currency === 'GBX') return `${symbol}.L`
  return symbol
}

function parseForeignCsv(text: string): Omit<ForeignHolding,'id'|'user_id'>[] | null {
  const rows = parseCsvRows(text)
  if (!rows.length) return null
  const keys = Object.keys(rows[0])
  const find = (...n: string[]) => keys.find(k => n.some(x => k.includes(x))) ?? null
  const kSym = find('symbol', 'instrument', 'ticker'); const kQty = find('qty', 'quantity'); const kAvg = find('avg', 'price', 'cost'); const kCur = find('currency', 'cur')
  if (!kSym || !kQty || !kAvg) return null
  return rows.map(r => ({
    symbol: (r[kSym!] ?? '').toUpperCase(), qty: cleanNum(r[kQty!] ?? ''),
    avg_price: cleanNum(r[kAvg!] ?? ''), currency: kCur ? (r[kCur] ?? 'USD').toUpperCase() : 'USD',
  })).filter(r => r.symbol && r.qty > 0) as Omit<ForeignHolding,'id'|'user_id'>[]
}

function EditModal({ row, onClose, onSave }: { row: Partial<ForeignHolding>; onClose: () => void; onSave: (d: Partial<ForeignHolding>) => Promise<void> }) {
  const [symbol,   setSymbol]   = useState(row.symbol ?? '')
  const [qty,      setQty]      = useState(String(row.qty ?? ''))
  const [avgPrice, setAvgPrice] = useState(String(row.avg_price ?? ''))
  const [currency, setCurrency] = useState(row.currency ?? 'USD')
  const [saving,   setSaving]   = useState(false)
  const handleSave = async () => {
    if (!symbol || !qty || !avgPrice) return
    setSaving(true)
    await onSave({ ...row, symbol: symbol.toUpperCase(), qty: parseFloat(qty), avg_price: parseFloat(avgPrice), currency })
    setSaving(false)
  }
  return (
    <Modal open onClose={onClose} title={row.id ? 'Edit Holding' : 'Add Foreign Stock'}
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={handleSave} loading={saving}>💾 Save</Button></>}
    >
      <div className="flex flex-col gap-4">
        <Input label="Symbol" value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="e.g. AAPL, CNDX" />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-textsec uppercase tracking-wider">Currency</label>
          <select value={currency} onChange={e => setCurrency(e.target.value)} className="h-9 rounded-xl border border-border bg-white text-sm text-textprim px-3 focus:border-teal focus:ring-2 focus:ring-teal/15 outline-none">
            <option value="USD">USD</option><option value="GBP">GBP</option><option value="GBX">GBX (pence)</option>
          </select>
        </div>
        <Input label="Quantity" type="number" step="0.001" value={qty} onChange={e => setQty(e.target.value)} />
        <Input label={`Avg Price (${currency})`} type="number" step="0.01" value={avgPrice} onChange={e => setAvgPrice(e.target.value)} />
      </div>
    </Modal>
  )
}

function fmtForeign(v: number, currency: string) {
  if (currency === 'USD') return `$${v.toFixed(2)}`
  if (currency === 'GBX') return `${v.toFixed(2)}p`
  return `£${v.toFixed(2)}`
}

export default function ForeignStocksPage() {
  const userId = useAuthStore(s => s.user?.id)!; const toast = useToastStore(s => s.show); const qc = useQueryClient()
  const { data: rows = [], isLoading } = useAssets<ForeignHolding>('foreign_stock_holdings')
  const aiHook = useActualInvested('foreign_actual_invested')
  const { data: fx } = useFxRates()
  const gbpUsd = fx?.gbpUsd ?? 1.27; const usdInr = fx?.usdInr ?? 83.5; const gbpInr = fx?.gbpInr ?? gbpUsd * usdInr

  // Resolve yahoo symbols
  const yahooSymbols = useMemo(() =>
    [...new Set(rows.map(r => toYahooSymbol(r.symbol, r.currency)))], [rows])
  const { data: priceMap = {}, isFetching: pf, refetch } = useYahooPrices(yahooSymbols)

  const [editRow, setEditRow] = useState<Partial<ForeignHolding> | null>(null)
  const [showImport, setShowImport] = useState(false)
  const { upsertMutation, deleteMutation } = useAssets<ForeignHolding>('foreign_stock_holdings')

  const getLTP = (r: ForeignHolding): number | null => {
    const ySym = toYahooSymbol(r.symbol, r.currency)
    const key = ySym.replace(/\.(L|US)$/, '')
    const entry = priceMap[key] ?? priceMap[ySym]
    if (!entry) return null
    // GBX (pence) -> divide by 100 to get GBP
    return GBX_SET.has(r.symbol) ? entry.price / 100 : entry.price
  }

  // Convert any holding value to INR
  const toInr = (valueInLocalCurrency: number, currency: string): number => {
    if (currency === 'USD') return valueInLocalCurrency * usdInr
    if (currency === 'GBP' || currency === 'GBX') return valueInLocalCurrency * gbpInr
    return valueInLocalCurrency
  }
  const toGbp = (valueInLocalCurrency: number, currency: string): number => {
    if (currency === 'USD') return valueInLocalCurrency / gbpUsd
    return valueInLocalCurrency  // already GBP or GBX
  }

  const totalInvestedInr = useMemo(() =>
    rows.reduce((s, r) => s + toInr(r.qty * r.avg_price, r.currency), 0), [rows, fx])
  const totalValueInr = useMemo(() =>
    rows.reduce((s, r) => { const ltp = getLTP(r); const val = ltp != null ? r.qty * ltp : r.qty * r.avg_price; return s + toInr(val, r.currency) }, 0), [rows, priceMap, fx])
  const totalInvestedGbp = useMemo(() =>
    rows.reduce((s, r) => s + toGbp(r.qty * r.avg_price, r.currency), 0), [rows, fx])
  const totalValueGbp = useMemo(() =>
    rows.reduce((s, r) => { const ltp = getLTP(r); const val = ltp != null ? r.qty * ltp : r.qty * r.avg_price; return s + toGbp(val, r.currency) }, 0), [rows, priceMap, fx])

  const actual = aiHook.data?.reduce((s, e) => s + e.amount, 0)
  const liveLabel = pf ? '🔄 Fetching…' : Object.keys(priceMap).length ? `🟢 Live · ${new Date().toLocaleTimeString('en-IN')}` : undefined
  const { gain: gainInr, gainPct, isPositive } = calcGain(totalValueInr, totalInvestedInr)
  const actGain = actual ? calcGain(totalValueInr, actual) : null

  const stats = [
    { label: 'Invested (₹)',      value: INR(totalInvestedInr), icon: '₹', accentColor: '#0891b2', loading: isLoading },
    { label: 'Invested (£)',      value: `£${totalInvestedGbp.toFixed(2)}`, icon: '£', accentColor: '#0891b2', loading: isLoading },
    { label: 'Current Value (₹)', value: INR(totalValueInr), sub: liveLabel, icon: '◈', accentColor: '#0d9488', loading: isLoading },
    { label: 'Current Value (£)', value: `£${totalValueGbp.toFixed(2)}`, icon: '◈', accentColor: '#0d9488', loading: isLoading },
    { label: 'Gain / Loss',       value: `${isPositive?'+':''}${INR(gainInr)}`, sub: `${isPositive?'+':''}${gainPct.toFixed(1)}%`, icon: isPositive?'▲':'▼', accentColor: isPositive?'#059669':'#dc2626', loading: isLoading },
    { label: 'Actual Invested',   value: actual ? INR(actual) : '—', icon: '⊡', accentColor: '#d97706', loading: isLoading },
    { label: 'Actual Gain',       value: actGain ? `${actGain.isPositive?'+':''}${INR(actGain.gain)}` : '—', icon: actGain?.isPositive?'▲':'▼', accentColor: actGain?.isPositive!==false?'#059669':'#dc2626', loading: isLoading },
  ]

  const handleSave = async (d: Partial<ForeignHolding>) => { try { await upsertMutation.mutateAsync({ ...d, user_id: userId } as Record<string,unknown>); toast('Saved ✅','success'); setEditRow(null) } catch (e) { toast((e as Error).message,'error') } }
  const handleDelete = async (id: string) => { if (!confirm('Delete?')) return; try { await deleteMutation.mutateAsync(id); toast('Deleted','success') } catch (e) { toast((e as Error).message,'error') } }
  const handleImport = async (parsed: Record<string, unknown>[]) => {
    await replaceAssets('foreign_stock_holdings', userId, parsed.map(r => ({ ...r, user_id: userId })))
    qc.invalidateQueries({ queryKey: ['foreign_stock_holdings', userId] }); toast(`${parsed.length} holdings imported ✅`,'success')
  }

  const cols = [
    { key: 'symbol', header: 'Symbol', render: (r: ForeignHolding) => (
      <div>
        <span className="font-bold">{r.symbol}</span>
        <span className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${r.currency==='USD'?'bg-cyan/10 text-cyan':'bg-amber/10 text-amber'}`}>{r.currency}</span>
      </div>
    )},
    { key: 'qty',       header: 'Qty',       align: 'right' as const, render: (r: ForeignHolding) => r.qty.toLocaleString('en-IN', { maximumFractionDigits: 4 }) },
    { key: 'avg_price', header: 'Avg Price', align: 'right' as const, render: (r: ForeignHolding) => fmtForeign(r.avg_price, r.currency) },
    { key: 'ltp',       header: 'Live Price', align: 'right' as const, render: (r: ForeignHolding) => { const ltp=getLTP(r); return <span className="font-bold">{ltp!=null ? fmtForeign(ltp, r.currency) : '—'}</span> }},
    { key: 'invested_inr', header: 'Invested (₹)', align: 'right' as const, render: (r: ForeignHolding) => INR(toInr(r.qty*r.avg_price, r.currency)) },
    { key: 'value_inr',    header: 'Value (₹)',    align: 'right' as const, render: (r: ForeignHolding) => { const ltp=getLTP(r); const val=ltp!=null?r.qty*ltp:r.qty*r.avg_price; return <span className="font-bold">{INR(toInr(val,r.currency))}</span> }},
    { key: 'gain',         header: 'Gain / Loss',  align: 'right' as const, render: (r: ForeignHolding) => {
      const ltp=getLTP(r); const inv=toInr(r.qty*r.avg_price,r.currency); const val=ltp!=null?toInr(r.qty*ltp,r.currency):inv
      const {gain,gainPct,isPositive}=calcGain(val,inv)
      return <span className={`font-bold ${isPositive?'text-green':'text-red'}`}>{isPositive?'+':''}{INR(gain)}<br /><span className="text-[10px] font-medium opacity-80">{isPositive?'+':''}{gainPct.toFixed(1)}%</span></span>
    }},
    { key: 'actions', header: '', align: 'center' as const, render: (r: ForeignHolding) => (
      <div className="flex gap-1">
        <button onClick={() => setEditRow(r)} className="w-6 h-6 rounded-lg flex items-center justify-center text-textmut hover:bg-surface2 hover:text-teal transition-colors">✏</button>
        <button onClick={() => handleDelete(r.id)} className="w-6 h-6 rounded-lg flex items-center justify-center text-textmut hover:bg-red/10 hover:text-red transition-colors">✕</button>
      </div>
    )},
  ]

  return (
    <PageShell title="Foreign Stocks" subtitle={`${rows.length} holding${rows.length!==1?'s':''}`}
      actions={[
        { label: '📥 Import CSV', onClick: () => setShowImport(true), variant: 'secondary' },
        { label: '+ Add Holding', onClick: () => setEditRow({}), variant: 'primary' },
        { label: '🔄', onClick: () => refetch(), variant: 'outline' },
      ]}
    >
      <AssetPageLayout
        stats={<StatGrid items={stats} cols={4} />}
        mainTable={<AssetTable columns={cols} data={rows} rowKey={r => r.id} loading={isLoading} emptyText="No foreign holdings — click 📥 Import CSV or + Add Holding" />}
        actualInvested={<ActualInvestedPanel table="foreign_actual_invested" />}
      />
      {editRow !== null && <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleSave} />}
      <CsvImportModal open={showImport} onClose={() => setShowImport(false)} title="Import Foreign Holdings CSV"
        hint="CSV: Symbol, Qty, Avg Price, Currency (USD/GBP/GBX). London stocks use .L suffix on Yahoo. GBX = pence (auto ÷100)."
        parse={parseForeignCsv}
        columns={[
          { key: 'symbol', header: 'Symbol' }, { key: 'currency', header: 'CCY' },
          { key: 'qty', header: 'Qty', align: 'right' }, { key: 'avg_price', header: 'Avg Price', align: 'right' },
        ]}
        renderCell={(row, key) => typeof row[key] === 'number' ? (row[key] as number).toFixed(4) : String(row[key] ?? '—')}
        onImport={handleImport}
      />
    </PageShell>
  )
}
