import { useState, useMemo, useEffect } from 'react'
import { useQueryClient }    from '@tanstack/react-query'
import { useAuthStore }      from '../../store/authStore'
import { useAssets }         from '../../hooks/useAssets'
import { useActualInvested } from '../../hooks/useActualInvested'
import { useYahooPrices, useFxRates } from '../../hooks/useLivePrices'
import { replaceAssets }     from '../../services/assetService'
import { useToastStore }     from '../../store/toastStore'
import { AssetPageLayout }   from '../../components/common/AssetPageLayout'
import { PageShell }         from '../../components/common/PageShell'
import { StatGrid }          from '../../components/common/StatGrid'
import { AssetTable }        from '../../components/common/AssetTable'
import { CsvImportModal }    from '../../components/common/CsvImportModal'
import { Modal }             from '../../components/ui/Modal'
import { Button }            from '../../components/ui/Button'
import { Input }             from '../../components/ui/Input'
import { ConfirmModal }      from '../../components/ui/ConfirmModal'
import { INR, calcGain, formatDate } from '../../lib/utils'
import { parseCsvRows, cleanNum } from '../../lib/csvParser'
import { supabase }          from '../../lib/supabase'
import type { ForeignHolding } from '../../types/assets'

// ── Symbol intelligence ───────────────────────────────────────
// Known London Stock Exchange symbols (traded in GBX pence)
// Yahoo Finance symbol overrides
const YAHOO_MAP: Record<string, string> = {
  BRK:  'BRK-B',
  CNDX: 'CNDX.L',
  IGLN: 'IGLN.L',
  MKS:  'MKS.L',
  SPXS: 'SPXS.L',
}

function toYahooSymbol(symbol: string, currency: string): string {
  if (YAHOO_MAP[symbol]) return YAHOO_MAP[symbol]
  if (currency === 'GBP' || currency === 'GBX') return `${symbol}.L`
  return symbol
}

// Auto-detect currency from symbol — no currency column in the CSV
// ── CSV parser ────────────────────────────────────────────────
function parseForeignCsv(text: string): Omit<ForeignHolding, 'id' | 'user_id'>[] | null {
  const rows = parseCsvRows(text)
  if (!rows.length) return null
  const keys = Object.keys(rows[0])
  const find = (...n: string[]) => keys.find(k => n.some(x => k.toLowerCase().includes(x))) ?? null

  const kSym = find('symbol', 'instrument', 'ticker')
  const kQty = find('qty', 'quantity')
  const kAvg = find('avg_price', 'avg_cost', 'average', 'price', 'cost')
  const kCur = find('currency', 'ccy', 'cur')

  if (!kSym || !kQty || !kAvg) return null

  return rows
    .map(r => {
      const sym = (r[kSym!] ?? '').toUpperCase().trim()
      // Use explicit currency if present, else auto-detect
      const currency = kCur
        ? (r[kCur] ?? '').toUpperCase() || 'USD'
        : 'USD'
      return {
        symbol:    sym,
        qty:       cleanNum(r[kQty!] ?? ''),
        avg_price: cleanNum(r[kAvg!] ?? ''),
        currency:  currency as 'USD' | 'GBP' | 'GBX',
      }
    })
    .filter(r => r.symbol && r.qty > 0) as Omit<ForeignHolding, 'id' | 'user_id'>[]
}

// ── Helpers ───────────────────────────────────────────────────
function fmtLocal(v: number, currency: string) {
  if (currency === 'USD') return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (currency === 'GBX') return `${v.toFixed(2)}p`
  // GBP
  return `£${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Format in GBP (£) — used for invested/value/gain columns
function fmtGbp(v: number) {
  return `£${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function CurrencyBadge({ currency }: { currency: string }) {
  const styles: Record<string, string> = {
    USD: 'bg-blue-50 text-blue-700 border-blue-200',
    GBP: 'bg-amber/10 text-amber border-amber/20',
    GBX: 'bg-amber/10 text-amber border-amber/20',
  }
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${styles[currency] ?? 'bg-bg text-textmut border-border'}`}>
      {currency}
    </span>
  )
}

// ── Foreign Actual Invested Panel ─────────────────────────────
// Schema: gbp_amount + inr_rate (NOT generic amount)
interface ForeignActualEntry {
  id: string; user_id: string; entry_date: string
  gbp_amount: number; inr_rate: number; created_at?: string
}

function ForeignActualPanel({ userId, gbpInr }: { userId: string; gbpInr: number }) {
  const [showForm,    setShowForm]    = useState(false)
  const [gbpAmount,   setGbpAmount]   = useState('')
  const [inrRate,     setInrRate]     = useState(String(gbpInr.toFixed(2)))
  const [entryDate,   setEntryDate]   = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [deleting,    setDeleting]    = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const toast = useToastStore(s => s.show)

  const [entries, setEntries] = useState<ForeignActualEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('foreign_actual_invested')
      .select('*').eq('user_id', userId).order('entry_date', { ascending: false })
    setEntries((data ?? []) as ForeignActualEntry[])
    setLoading(false)
  }

  useMemo(() => { load() }, [userId])

  const totalInr = entries.reduce((s, e) => s + Number(e.gbp_amount) * Number(e.inr_rate), 0)
  const totalGbp = entries.reduce((s, e) => s + Number(e.gbp_amount), 0)

  const handleAdd = async () => {
    const gbp = parseFloat(gbpAmount); const rate = parseFloat(inrRate)
    if (!gbp || !rate) return
    setSaving(true); setError('')
    try {
      const { error: err } = await supabase.from('foreign_actual_invested').insert({
        user_id: userId, gbp_amount: gbp, inr_rate: rate,
        entry_date: entryDate || new Date().toISOString().slice(0, 10),
      })
      if (err) throw new Error(err.message)
      setGbpAmount(''); setEntryDate(''); setShowForm(false)
      await load()
      toast('Entry added ✅', 'success')
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(false) }
  }

  const doDelete = async () => {
    setConfirmOpen(false); setDeleting(true)
    try {
      for (const id of selected) {
        await supabase.from('foreign_actual_invested').delete().eq('id', id)
      }
      setSelected(new Set()); await load()
      toast(`Deleted ${selected.size}`, 'success')
    } finally { setDeleting(false) }
  }

  const allIds   = entries.map(e => e.id)
  const allCheck = allIds.length > 0 && allIds.every(id => selected.has(id))
  const toggleAll = () => allCheck ? setSelected(new Set()) : setSelected(new Set(allIds))
  const toggleOne = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-textmut uppercase tracking-widest">Actual Invested</span>
        </div>
        <div className="flex flex-col gap-0.5 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-textmut">Total £</span>
            <span className="text-sm font-extrabold font-mono text-textprim">£{totalGbp.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-textmut">Total ₹</span>
            <span className="text-sm font-extrabold font-mono text-teal">{INR(totalInr)}</span>
          </div>
        </div>

        <Button size="sm" onClick={() => setShowForm(f => !f)} className="w-full" variant={showForm ? 'secondary' : 'primary'}>
          {showForm ? '✕ Cancel' : '+ Add Entry'}
        </Button>

        {showForm && (
          <div className="flex flex-col gap-2 mt-2">
            <Input label="GBP Amount" prefix="£" type="number" step="0.01" placeholder="e.g. 1000.00"
              value={gbpAmount} onChange={e => setGbpAmount(e.target.value)} />
            <Input label="GBP → INR Rate" type="number" step="0.01" placeholder="e.g. 106.5"
              value={inrRate} onChange={e => setInrRate(e.target.value)}
              helpText={`Live rate: ₹${gbpInr.toFixed(2)} / £1`} />
            <Input label="Date" type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
            <Button size="sm" onClick={handleAdd} loading={saving} className="w-full">Save Entry</Button>
            {error && <p className="text-[10px] text-red bg-red/5 border border-red/20 rounded-lg px-2 py-1">{error}</p>}
          </div>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="py-6 text-center text-xs text-textfade">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="py-6 text-center text-xs text-textfade">No entries yet</div>
        ) : (
          <>
            <div className="px-4 py-2 border-b border-border bg-surface2/40">
              <div className="flex items-center text-[10px] font-bold text-textmut uppercase tracking-widest gap-2">
                <input type="checkbox" checked={allCheck} onChange={toggleAll}
                  className="w-3 h-3 rounded accent-ink cursor-pointer" />
                <span className="flex-1">£ Amount</span>
                <span className="w-20 text-right">Rate</span>
                <span className="w-20 text-right">₹ Value</span>
              </div>
            </div>

            {selected.size > 0 && (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-red/5 border-b border-red/20">
                <span className="text-[10px] font-semibold text-red flex-1">{selected.size} selected</span>
                <button onClick={() => setConfirmOpen(true)} disabled={deleting}
                  className="text-[10px] font-bold px-2 py-1 rounded bg-red text-white hover:bg-red/80 disabled:opacity-50">
                  {deleting ? '…' : '🗑 Delete'}
                </button>
                <button onClick={() => setSelected(new Set())} className="text-[10px] text-textmut">Cancel</button>
              </div>
            )}

            {entries.map((e, i) => (
              <div key={e.id}
                className={`flex items-center px-4 py-2.5 border-b border-border/40 last:border-0 hover:bg-surface2 transition-colors gap-2 ${selected.has(e.id) ? 'bg-red/5' : i % 2 === 1 ? 'bg-surface2/20' : ''}`}
              >
                <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleOne(e.id)}
                  className="w-3 h-3 rounded accent-ink cursor-pointer shrink-0" />
                <span className="flex-1 font-mono font-bold text-xs text-textprim">
                  £{Number(e.gbp_amount).toFixed(2)}
                </span>
                <span className="w-20 text-right text-[10px] text-textmut font-mono">
                  ₹{Number(e.inr_rate).toFixed(1)}
                </span>
                <span className="w-20 text-right text-[11px] font-semibold text-textprim">
                  {INR(Number(e.gbp_amount) * Number(e.inr_rate))}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {confirmOpen && (
        <ConfirmModal
          message={`Delete ${selected.size} entr${selected.size > 1 ? 'ies' : 'y'}?`}
          onConfirm={doDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  )
}

// ── Edit Modal ────────────────────────────────────────────────
function EditModal({ row, onClose, onSave }: {
  row: Partial<ForeignHolding>; onClose: () => void; onSave: (d: Partial<ForeignHolding>) => Promise<void>
}) {
  const [symbol,   setSymbol]   = useState(row.symbol   ?? '')
  const [qty,      setQty]      = useState(String(row.qty       ?? ''))
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
        <div className="grid grid-cols-2 gap-3">
          <Input label="Symbol *" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())}
            placeholder="e.g. AAPL, MKS" />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-textmut uppercase tracking-wide">Currency *</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20">
              <option value="USD">USD — US Dollar</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="GBX">GBX — Pence (÷100 = £)</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Quantity *" type="number" step="0.0001"
            value={qty} onChange={e => setQty(e.target.value)} />
          <Input label={`Avg Price (${currency}) *`} type="number" step="0.01"
            value={avgPrice} onChange={e => setAvgPrice(e.target.value)} />
        </div>
        {currency === 'GBX' && (
          <div className="text-[10px] text-amber bg-amber/5 border border-amber/20 rounded-lg px-3 py-2">
            GBX prices are in pence. £1 = 100p. Values will be auto-converted to GBP for INR calculation.
          </div>
        )}
      </div>
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function ForeignStocksPage() {
  const userId    = useAuthStore(s => s.user?.id)!
  const toast     = useToastStore(s => s.show)
  const qc        = useQueryClient()

  const { data: rows = [], isLoading } = useAssets<ForeignHolding>('foreign_stock_holdings')
  const { data: fx } = useFxRates()

  const gbpUsd = fx?.gbpUsd ?? 1.27
  const usdInr = fx?.usdInr ?? 83.5
  const gbpInr = fx?.gbpInr ?? gbpUsd * usdInr

  // Actual invested entries — fetched at page level for stats
  const [actualEntries, setActualEntries] = useState<{gbp_amount: number; inr_rate: number}[]>([])
  useEffect(() => {
    supabase.from('foreign_actual_invested').select('gbp_amount,inr_rate').eq('user_id', userId)
      .then(({ data }) => setActualEntries((data ?? []) as {gbp_amount: number; inr_rate: number}[]))
  }, [userId])
  const actualGbp = actualEntries.reduce((s, e) => s + Number(e.gbp_amount), 0)
  const actualInr = actualEntries.reduce((s, e) => s + Number(e.gbp_amount) * Number(e.inr_rate), 0)

  // Build yahoo symbols list
  const yahooSymbols = useMemo(() =>
    [...new Set(rows.map(r => toYahooSymbol(r.symbol, r.currency)))],
  [rows])

  const { data: priceMap = {}, isFetching: priceFetching, refetch } = useYahooPrices(yahooSymbols)
  const [editRow,    setEditRow]    = useState<Partial<ForeignHolding> | null>(null)
  const [showImport, setShowImport] = useState(false)
  const { upsertMutation, deleteMutation } = useAssets<ForeignHolding>('foreign_stock_holdings')

  // ── Price helpers ────────────────────────────────────────────
  // getRawEntry: raw Yahoo price map entry for a holding
  const getRawEntry = (r: ForeignHolding) => {
    const ySym = toYahooSymbol(r.symbol, r.currency)
    const key  = ySym.replace(/\.(L|US)$/, '')
    return priceMap[key] ?? priceMap[ySym] ?? null
  }

  // isGbxLive: true if Yahoo is reporting this price in pence (GBp)
  // Yahoo uses "GBp" (lowercase p) for pence-denominated LSE stocks
  // This replaces the unreliable price-magnitude heuristic
  const isGbxLive = (r: ForeignHolding): boolean => {
    if (r.currency === 'GBX') return true          // user explicitly set GBX
    const entry = getRawEntry(r)
    if (!entry?.currency) return false
    return entry.currency === 'GBp'                // Yahoo's pence marker
  }

  // getLtpInGbp: live price always in GBP (never pence, never USD)
  // This is the single source of truth for current value calculations
  const getLtpInGbp = (r: ForeignHolding): number | null => {
    const entry = getRawEntry(r)
    if (!entry) return null
    if (isGbxLive(r))        return entry.price / 100          // pence → GBP
    if (r.currency === 'USD') return entry.price / gbpUsd       // USD   → GBP
    return entry.price                                          // already GBP
  }

  // getAvgInGbp: avg cost always in GBP
  const getAvgInGbp = (r: ForeignHolding): number => {
    if (r.currency === 'GBX') return r.avg_price / 100
    if (r.currency === 'USD') return r.avg_price / gbpUsd
    return r.avg_price
  }

  // gbpToInr: final conversion
  const gbpToInr = (gbp: number): number => gbp * gbpInr

  // Totals — everything in GBP first, then × gbpInr
  const totalInvestedGbp = useMemo(() =>
    rows.reduce((s, r) => s + r.qty * getAvgInGbp(r), 0),
  [rows, fx])

  const totalValueGbp = useMemo(() =>
    rows.reduce((s, r) => {
      const ltpGbp = getLtpInGbp(r)
      return s + r.qty * (ltpGbp ?? getAvgInGbp(r))
    }, 0),
  [rows, priceMap, fx])

  const totalInvestedInr = useMemo(() => gbpToInr(totalInvestedGbp), [totalInvestedGbp, fx])
  const totalValueInr    = useMemo(() => gbpToInr(totalValueGbp),    [totalValueGbp, fx])

  const liveLabel = priceFetching
    ? '🔄 Fetching…'
    : Object.keys(priceMap).length ? `🟢 Live · ${new Date().toLocaleTimeString('en-IN')}` : undefined

  const gainGbp     = totalValueGbp - totalInvestedGbp
  const gainPctGbp  = totalInvestedGbp > 0 ? (gainGbp / totalInvestedGbp) * 100 : 0
  const isUpGbp     = gainGbp >= 0
  const gainInr     = totalValueInr - totalInvestedInr
  const isUpInr     = gainInr >= 0

  // Actual gain
  const actGainGbp    = actualGbp > 0 ? totalValueGbp - actualGbp : null
  const actGainInr    = actualInr > 0 ? totalValueInr - actualInr : null
  const actGainPctGbp = actualGbp > 0 ? ((totalValueGbp - actualGbp) / actualGbp) * 100 : null
  const actIsUp       = actGainGbp != null ? actGainGbp >= 0 : true

  // Row 1: ₹  |  Row 2: £  — 4 cols each
  const statsRow1 = [
    { label: 'Invested (₹)',       value: INR(totalInvestedInr),                                         icon: '₹', accentColor: '#0891b2', loading: isLoading },
    { label: 'Current Value (₹)',  value: INR(totalValueInr),                                            icon: '◈', accentColor: '#0d9488', loading: isLoading, sub: liveLabel },
    { label: 'Gain / Loss (₹)',    value: `${isUpInr?'+':''}${INR(gainInr)}`,                            icon: isUpInr?'▲':'▼', accentColor: isUpInr?'#059669':'#dc2626', loading: isLoading },
    { label: 'Actual Invested (₹)',value: actualInr > 0 ? INR(actualInr) : '—',                          icon: '⊡', accentColor: '#d97706', loading: isLoading },
    { label: 'Actual Gain (₹)',    value: actGainInr != null ? `${actIsUp?'+':''}${INR(actGainInr)}` : '—', sub: actGainPctGbp != null ? `${actIsUp?'+':''}${actGainPctGbp.toFixed(1)}%` : undefined, icon: actIsUp?'▲':'▼', accentColor: actIsUp?'#059669':'#dc2626', loading: isLoading },
  ]
  const actGainPctActual = actualGbp > 0 ? ((totalValueGbp - actualGbp) / actualGbp) * 100 : null

  const statsRow2 = [
    { label: 'Invested (£)',       value: fmtGbp(totalInvestedGbp),                                                                                      icon: '£', accentColor: '#B45309', loading: isLoading },
    { label: 'Current Value (£)',  value: fmtGbp(totalValueGbp),                                                                                         icon: '◈', accentColor: '#0d9488', loading: isLoading },
    { label: 'Gain / Loss (£)',    value: `${isUpGbp?'+':''}${fmtGbp(gainGbp)}`,    sub: `${isUpGbp?'+':''}${gainPctGbp.toFixed(1)}%`,                    icon: isUpGbp?'▲':'▼', accentColor: isUpGbp?'#059669':'#dc2626', loading: isLoading },
    { label: 'Actual Invested (£)',value: actualGbp > 0 ? fmtGbp(actualGbp) : '—',                                                                       icon: '⊡', accentColor: '#d97706', loading: isLoading },
    { label: 'Actual Gain (£)',    value: actGainGbp != null ? `${actIsUp?'+':''}${fmtGbp(actGainGbp)}` : '—', sub: actGainPctActual != null ? `${actIsUp?'+':''}${actGainPctActual.toFixed(1)}%` : undefined, icon: actIsUp?'▲':'▼', accentColor: actIsUp?'#059669':'#dc2626', loading: isLoading },
  ]

  const handleSave = async (d: Partial<ForeignHolding>) => {
    try {
      const existing = rows.find(r => r.id === d.id)
      const prev_qty = existing ? existing.qty : d.qty
      await upsertMutation.mutateAsync({ ...d, prev_qty, user_id: userId } as Record<string, unknown>)
      toast('Saved ✅', 'success'); setEditRow(null)
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const handleImport = async (parsed: Record<string, unknown>[]) => {
    // Preserve manually-edited currency for existing symbols — never overwrite on re-import
    const existingCurrencyMap = new Map(rows.map(r => [r.symbol.toUpperCase(), r.currency]))
    const merged = parsed.map(r => {
      const sym = String(r.symbol ?? '').toUpperCase()
      const preservedCurrency = existingCurrencyMap.get(sym)
      return {
        ...r,
        user_id:  userId,
        // Keep existing currency if symbol already in DB, else use parsed/auto-detected value
        currency: preservedCurrency ?? r.currency,
      }
    })
    await replaceAssets('foreign_stock_holdings', userId, merged)
    qc.invalidateQueries({ queryKey: ['foreign_stock_holdings', userId] })
    toast(`${parsed.length} holdings imported ✅`, 'success')
  }

  // Sort rows by instrument name from priceMap, fallback to symbol
  const getInstrumentName = (r: ForeignHolding): string => {
    const ySym  = toYahooSymbol(r.symbol, r.currency)
    const key   = ySym.replace(/\.(L|US)$/, '')
    return priceMap[key]?.name ?? priceMap[ySym]?.name ?? r.symbol
  }

  const sortedRows = useMemo(() =>
    [...rows].sort((a, b) => getInstrumentName(a).localeCompare(getInstrumentName(b))),
  [rows, priceMap])

  const cols = [
    {
      key: 'symbol', header: 'Symbol',
      render: (r: ForeignHolding) => {
        const name = getInstrumentName(r)
        return (
          <div className="flex items-start gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-ink">{r.symbol}</span>
                <CurrencyBadge currency={r.currency} />
              </div>
              {name !== r.symbol && (
                <div className="text-[10px] text-textmut truncate max-w-[180px]" title={name}>{name}</div>
              )}
              {r.currency === 'GBX' && (
                <div className="text-[9px] text-textfade">priced in pence</div>
              )}
            </div>
          </div>
        )
      },
    },
    {
      key: 'qty', header: 'Qty', align: 'right' as const,
      render: (r: ForeignHolding) => {
        const qty  = Number(r.qty)
        const diff = r.prev_qty != null ? qty - Number(r.prev_qty) : null
        return (
          <div className="text-right">
            {qty === 0
              ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red/10 text-red">EXITED</span>
              : <div>{qty.toLocaleString('en-IN', { maximumFractionDigits: 4 })}</div>}
            {diff !== null && diff !== 0 && (
              <div className={`text-[10px] font-semibold ${diff > 0 ? 'text-green' : 'text-red'}`}>
                {diff > 0 ? '+' : ''}{diff.toLocaleString('en-IN', { maximumFractionDigits: 4 })}
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'avg_price', header: 'Avg Price', align: 'right' as const,
      render: (r: ForeignHolding) => {
        const avgGbp = getAvgInGbp(r)
        return (
          <div className="text-right">
            <div>{fmtLocal(r.avg_price, r.currency)}</div>
            {r.currency !== 'GBP' && (
              <div className="text-[10px] text-textmut">{fmtGbp(avgGbp)} / unit</div>
            )}
          </div>
        )
      },
    },
    {
      key: 'ltp', header: 'Live Price', align: 'right' as const,
      render: (r: ForeignHolding) => {
        const ltpGbp  = getLtpInGbp(r)
        if (ltpGbp == null) return <span className="text-textmut">—</span>
        const avgGbp  = getAvgInGbp(r)
        const changePct = avgGbp > 0 ? ((ltpGbp - avgGbp) / avgGbp) * 100 : 0
        // Convert GBP price back to display currency for consistency with avg_price column
        const displayPrice = r.currency === 'USD'
          ? ltpGbp * gbpUsd         // GBP → USD for display
          : r.currency === 'GBX'
            ? ltpGbp * 100          // GBP → pence for display
            : ltpGbp                // already GBP
        return (
          <div className="text-right">
            <div className="font-bold">{fmtLocal(displayPrice, r.currency)}</div>
            <div className={`text-[10px] font-semibold ${changePct >= 0 ? 'text-green' : 'text-red'}`}>
              {changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%
            </div>
          </div>
        )
      },
    },
    {
      key: 'invested', header: 'Invested', align: 'right' as const,
      render: (r: ForeignHolding) => {
        const localVal = r.qty * r.avg_price
        const gbpVal   = r.qty * getAvgInGbp(r)
        return (
          <div className="text-right">
            <div>{fmtLocal(localVal, r.currency)}</div>
            {r.currency !== 'GBP' && (
              <div className="text-[10px] text-textmut">{fmtGbp(gbpVal)}</div>
            )}
          </div>
        )
      },
    },
    {
      key: 'value', header: 'Cur. Value', align: 'right' as const,
      render: (r: ForeignHolding) => {
        const ltpGbp  = getLtpInGbp(r)
        const avgGbp  = getAvgInGbp(r)
        const valGbp  = r.qty * (ltpGbp ?? avgGbp)
        const costGbp = r.qty * avgGbp
        const isUp    = valGbp >= costGbp
        // Convert GBP value back to display currency
        const localVal = r.currency === 'USD'
          ? valGbp * gbpUsd
          : r.currency === 'GBX'
            ? valGbp * 100
            : valGbp
        return (
          <div className="text-right">
            <div className={`font-bold ${isUp ? 'text-green' : 'text-red'}`}>
              {fmtLocal(localVal, r.currency)}
            </div>
            {r.currency !== 'GBP' && (
              <div className="text-[10px] text-textmut">{fmtGbp(valGbp)}</div>
            )}
          </div>
        )
      },
    },
    {
      key: 'gain', header: 'Gain / Loss', align: 'right' as const,
      render: (r: ForeignHolding) => {
        const ltpGbp  = getLtpInGbp(r)
        const avgGbp  = getAvgInGbp(r)
        const valGbp  = r.qty * (ltpGbp ?? avgGbp)
        const costGbp = r.qty * avgGbp
        const gainGbp = valGbp - costGbp
        const gainPct = costGbp > 0 ? (gainGbp / costGbp) * 100 : 0
        const isUp    = gainGbp >= 0
        return (
          <span className={`font-bold ${isUp ? 'text-green' : 'text-red'}`}>
            {isUp ? '+' : ''}{fmtGbp(gainGbp)}
            <br />
            <span className="text-[10px] font-medium opacity-80">{isUp ? '+' : ''}{gainPct.toFixed(1)}%</span>
          </span>
        )
      },
    },
  ]

  return (
    <PageShell title="Foreign Stocks"
      subtitle={`${rows.filter(r => Number(r.qty) > 0).length} holdings`}
      badge={<span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200 tabular-nums">£1 = ₹{gbpInr.toFixed(2)}</span>}
      actions={[
        { label: '📥 Import CSV', onClick: () => setShowImport(true), variant: 'secondary' },
        { label: '+ Add Holding', onClick: () => setEditRow({}), variant: 'primary' },
        { label: '🔄', onClick: () => refetch(), variant: 'secondary' },
      ]}
    >
      <AssetPageLayout
        stats={
          <div className="flex flex-col gap-3">
            <StatGrid items={statsRow1} cols={5} />
            <StatGrid items={statsRow2} cols={5} />
          </div>
        }
        mainTable={
          <AssetTable columns={cols} data={sortedRows} rowKey={r => r.id} loading={isLoading}
            emptyText="No foreign holdings — click 📥 Import CSV or + Add"
            onEditRow={r => setEditRow(r)}
            onDeleteRows={async ids => {
              for (const id of ids) await deleteMutation.mutateAsync(id)
              toast(`Deleted ${ids.length}`, 'success')
            }}
          />
        }
        actualInvested={<ForeignActualPanel userId={userId} gbpInr={gbpInr} />}
      />

      {editRow !== null && (
        <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleSave} />
      )}

      <CsvImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Import Foreign Holdings"
        hint="CSV needs: symbol, quantity, avg_price. Currency is auto-detected (London stocks → GBX, rest → USD). Add a 'currency' column to override."
        parse={parseForeignCsv}
        columns={[
          { key: 'symbol',    header: 'Symbol' },
          { key: 'currency',  header: 'CCY' },
          { key: 'qty',       header: 'Qty',       align: 'right' },
          { key: 'avg_price', header: 'Avg Price',  align: 'right' },
        ]}
        renderCell={(row, key) =>
          typeof row[key] === 'number'
            ? (row[key] as number).toFixed(4)
            : String(row[key] ?? '—')
        }
        onImport={handleImport}
      />
    </PageShell>
  )
}
