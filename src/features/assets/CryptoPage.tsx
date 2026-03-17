import { useState, useMemo, useEffect } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useAuthStore }      from '../../store/authStore'
import { useAssets }         from '../../hooks/useAssets'
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
import { INR, formatDate }   from '../../lib/utils'
import { parseCsvRows, cleanNum } from '../../lib/csvParser'
import { supabase }          from '../../lib/supabase'
import type { CryptoHolding } from '../../types/assets'

// ── Helpers ───────────────────────────────────────────────────
const cryptoTicker  = (s: string) => s.replace(/-GBP$/i, '').replace(/-USD$/i, '')
const fmtGbp        = (v: number) => `£${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const PLATFORMS = ['Kraken', 'Revolut', 'Coinbase', 'Binance', 'Bybit', 'Ledger', 'Trezor', 'Other']

// ── CSV parser ────────────────────────────────────────────────
// Expected: yahoo_symbol (or symbol/coin), qty, avg_price_gbp (or avg_price/price), platform (optional)
function parseCryptoCsv(text: string): Omit<CryptoHolding, 'id' | 'user_id'>[] | null {
  const rows = parseCsvRows(text)
  if (!rows.length) return null
  const keys = Object.keys(rows[0])
  const find = (...n: string[]) => keys.find(k => n.some(x => k.toLowerCase().includes(x))) ?? null

  const kSym  = find('yahoo_symbol', 'symbol', 'coin', 'ticker')
  const kQty  = find('qty', 'quantity', 'amount')
  const kAvg  = find('avg_price_gbp', 'avg_price', 'avg_cost', 'price', 'cost')
  const kPlat = find('platform', 'exchange', 'wallet')

  if (!kSym || !kQty || !kAvg) return null

  return rows.map(r => {
    const sym = (r[kSym!] ?? '').toUpperCase().trim()
    // Auto-append -GBP if not already suffixed
    const yahoo_symbol = /-(GBP|USD|EUR|USDT)$/i.test(sym) ? sym : `${sym}-GBP`
    return {
      yahoo_symbol,
      platform:      kPlat ? (r[kPlat] ?? 'Kraken') : 'Kraken',
      qty:           cleanNum(r[kQty!] ?? ''),
      avg_price_gbp: cleanNum(r[kAvg!] ?? ''),
    }
  }).filter(r => r.yahoo_symbol && r.qty > 0) as Omit<CryptoHolding, 'id' | 'user_id'>[]
}

// ── Actual Invested Panel ─────────────────────────────────────
interface CryptoActualEntry { id: string; user_id: string; entry_date: string; gbp_amount: number; inr_rate: number | null; created_at?: string }

function CryptoActualPanel({ userId, gbpInr }: { userId: string; gbpInr: number }) {
  const qcPanel = useQueryClient()
  const invalidateActual = () => {
    qcPanel.invalidateQueries({ queryKey: ['crypto_actual_invested', userId] })
    qcPanel.invalidateQueries({ queryKey: ['dashboard-stats'] })
  }
  const [showForm,    setShowForm]    = useState(false)
  const [gbpAmount,   setGbpAmount]   = useState('')
  const [inrRate,     setInrRate]     = useState(String(gbpInr.toFixed(2)))
  const [entryDate,   setEntryDate]   = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [deleting,    setDeleting]    = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editEntry,   setEditEntry]   = useState<CryptoActualEntry | null>(null)
  const [editGbp,     setEditGbp]     = useState('')
  const [editRate,    setEditRate]    = useState('')
  const [editDate,    setEditDate]    = useState('')
  const [editSaving,  setEditSaving]  = useState(false)
  const toast = useToastStore(s => s.show)

  const openEdit = (e: CryptoActualEntry) => {
    setEditEntry(e); setEditGbp(String(e.gbp_amount)); setEditRate(String(e.inr_rate ?? gbpInr)); setEditDate(e.entry_date)
  }
  const handleEditSave = async () => {
    if (!editEntry) return
    setEditSaving(true)
    try {
      const { error: err } = await supabase.from('crypto_actual_invested').update({
        gbp_amount: parseFloat(editGbp), inr_rate: parseFloat(editRate), entry_date: editDate
      }).eq('id', editEntry.id)
      if (err) throw new Error(err.message)
      setEditEntry(null); await invalidateActual(); toast('Updated ✅', 'success')
    } catch (e2) { toast((e2 as Error).message, 'error') }
    finally { setEditSaving(false) }
  }

  const { data: entries = [], isFetching: loading } = useQuery<CryptoActualEntry[]>({
    queryKey: ['crypto_actual_invested', userId],
    queryFn: async () => {
      const { data } = await supabase.from('crypto_actual_invested')
        .select('*').eq('user_id', userId).order('entry_date', { ascending: false })
      return (data ?? []) as CryptoActualEntry[]
    },
    enabled: !!userId,
  })

  const totalGbp = entries.reduce((s, e) => s + Number(e.gbp_amount), 0)
  const totalInr = entries.reduce((s, e) => s + Number(e.gbp_amount) * Number(e.inr_rate ?? gbpInr), 0)

  const handleAdd = async () => {
    const gbp = parseFloat(gbpAmount); const rate = parseFloat(inrRate)
    if (!gbp || !rate) return
    setSaving(true); setError('')
    try {
      const { error: err } = await supabase.from('crypto_actual_invested').insert({
        user_id: userId, gbp_amount: gbp, inr_rate: rate,
        entry_date: entryDate || new Date().toISOString().slice(0, 10),
      })
      if (err) throw new Error(err.message)
      setGbpAmount(''); setEntryDate(''); setShowForm(false)
      await invalidateActual(); toast('Entry added ✅', 'success')
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(false) }
  }

  const doDelete = async () => {
    setConfirmOpen(false); setDeleting(true)
    try {
      for (const id of selected) await supabase.from('crypto_actual_invested').delete().eq('id', id)
      setSelected(new Set()); await invalidateActual(); toast(`Deleted ${selected.size}`, 'success')
    } finally { setDeleting(false) }
  }

  const allIds   = entries.map(e => e.id)
  const allCheck = allIds.length > 0 && allIds.every(id => selected.has(id))
  const toggleAll = () => allCheck ? setSelected(new Set()) : setSelected(new Set(allIds))
  const toggleOne = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex flex-col gap-0.5 mb-3">
          <span className="text-[10px] font-bold text-textmut uppercase tracking-widest">Actual Invested</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-textmut">Total £</span>
            <span className="text-sm font-extrabold font-mono text-textprim">{fmtGbp(totalGbp)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-textmut">Total ₹</span>
            <span className="text-sm font-extrabold font-mono text-teal">{INR(totalInr)}</span>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowForm(f => !f)} variant={showForm ? 'secondary' : 'primary'}>
          {showForm ? '✕ Cancel' : 'Add Entry'}
        </Button>
        {showForm && (
          <div className="flex flex-col gap-2 mt-2">
            <Input label="GBP Amount" prefix="£" type="number" step="0.01" placeholder="e.g. 500.00"
              value={gbpAmount} onChange={e => setGbpAmount(e.target.value)} />
            <Input label="GBP → INR Rate" type="number" step="0.01"
              value={inrRate} onChange={e => setInrRate(e.target.value)}
              helpText={`Live: ₹${gbpInr.toFixed(2)} / £1`} />
            <Input label="Date" type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
            <Button size="sm" onClick={handleAdd} loading={saving} >Save Entry</Button>
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
            {/* Table header */}
            <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-x-2 items-center px-4 py-1.5 bg-surface2/50 border-b border-border/40">
              <span className="w-3" />
              <span className="text-[9px] font-bold text-textfade uppercase tracking-widest">Date</span>
              <span className="text-[9px] font-bold text-textfade uppercase tracking-widest text-right">£ Amount</span>
              <span className="text-[9px] font-bold text-textfade uppercase tracking-widest text-right">₹ Value</span>
              <span className="w-5" />
            </div>
            {entries.map((e, i) => (
              <div key={e.id}
                className={`grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-x-2 items-center px-4 py-2 border-b border-border/40 last:border-0 transition-colors ${selected.has(e.id) ? 'bg-red/5' : i % 2 === 1 ? 'bg-surface2/20' : 'hover:bg-surface2'}`}>
                <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleOne(e.id)} className="w-3 h-3 rounded accent-ink cursor-pointer shrink-0" />
                <span className="text-[11px] text-textmut font-mono">
                  {formatDate(e.entry_date || e.created_at)}
                </span>
                <div className="text-right">
                  <div className="font-mono font-bold text-[12px] text-textprim">{fmtGbp(Number(e.gbp_amount))}</div>
                  <div className="text-[9px] text-textfade font-mono mt-0.5">@ ₹{Number(e.inr_rate ?? gbpInr).toFixed(1)}/£</div>
                </div>
                <span className="text-[11px] font-semibold text-right">{INR(Number(e.gbp_amount) * Number(e.inr_rate ?? gbpInr))}</span>
                <button onClick={() => openEdit(e)} className="text-[10px] text-textmut hover:text-ink px-1 py-0.5 rounded hover:bg-surface2 transition-colors" title="Edit">✏</button>
              </div>
            ))}
          </>
        )}
      </div>
      {confirmOpen && <ConfirmModal message={`Delete ${selected.size} entr${selected.size > 1 ? 'ies' : 'y'}?`} onConfirm={doDelete} onCancel={() => setConfirmOpen(false)} />}
      {editEntry && (
        <Modal open onClose={() => setEditEntry(null)} title="Edit Entry"
          footer={<><Button variant="secondary" size="sm" onClick={() => setEditEntry(null)}>Cancel</Button><Button size="sm" onClick={handleEditSave} loading={editSaving}>💾 Save</Button></>}
        >
          <div className="flex flex-col gap-3">
            <Input label="GBP Amount" prefix="£" type="number" step="0.01" value={editGbp} onChange={e2 => setEditGbp(e2.target.value)} />
            <Input label="GBP → INR Rate" type="number" step="0.01" value={editRate} onChange={e2 => setEditRate(e2.target.value)} />
            <Input label="Date" type="date" value={editDate} onChange={e2 => setEditDate(e2.target.value)} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Edit Modal ────────────────────────────────────────────────
function EditModal({ row, name, onClose, onSave }: {
  row: Partial<CryptoHolding>; name?: string | null; onClose: () => void; onSave: (d: Partial<CryptoHolding>) => Promise<void>
}) {
  const [sym,       setSym]      = useState(row.yahoo_symbol ?? '')
  const [platform,  setPlatform] = useState(row.platform ?? 'Kraken')
  const [qty,       setQty]      = useState(String(row.qty ?? ''))
  const [avgGbp,    setAvgGbp]   = useState(String(row.avg_price_gbp ?? ''))
  const [saving,    setSaving]   = useState(false)
  const [coinName,  setCoinName] = useState<string | null>(null)
  const [looking,   setLooking]  = useState(false)

  // Lookup coin name from Yahoo when symbol changes (debounced)
  useEffect(() => {
    if (!sym || sym.length < 2) { setCoinName(null); return }
    const yahoo_symbol = /-(GBP|USD|EUR|USDT)$/i.test(sym) ? sym : `${sym}-GBP`
    const timer = setTimeout(async () => {
      setLooking(true)
      try {
        const res  = await fetch(`/api/prices?symbols=${encodeURIComponent(yahoo_symbol)}`)
        const data = await res.json() as Record<string, { price: number; name: string | null }>
        const key  = yahoo_symbol.replace(/-(GBP|USD|EUR|USDT)$/i, '')
        setCoinName(data[key]?.name ?? null)
      } catch { setCoinName(null) }
      finally { setLooking(false) }
    }, 600)
    return () => clearTimeout(timer)
  }, [sym])

  const handleSave = async () => {
    if (!sym || !qty || !avgGbp) return
    setSaving(true)
    const yahoo_symbol = /-(GBP|USD|EUR|USDT)$/i.test(sym.toUpperCase()) ? sym.toUpperCase() : `${sym.toUpperCase()}-GBP`
    await onSave({ ...row, yahoo_symbol, platform, qty: parseFloat(qty), avg_price_gbp: parseFloat(avgGbp) })
    setSaving(false)
  }

  return (
    <Modal open onClose={onClose} title={row.id ? 'Edit Holding' : 'Add Crypto'}
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={handleSave} loading={saving}>💾 Save</Button></>}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          {row.id ? (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-textmut uppercase tracking-wider">Yahoo Symbol</label>
              <div className="h-9 rounded-xl border border-border bg-surface2 text-sm text-textmut px-3 flex items-center font-mono select-none cursor-not-allowed">{sym}</div>
              {name && <div className="text-xs text-textmut mt-0.5">{name}</div>}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Input label="Yahoo Symbol *" value={sym} onChange={e => setSym(e.target.value.toUpperCase())}
                placeholder="BTC, ETH, SOL…" helpText="Auto-appends -GBP if needed" />
              {looking && <p className="text-[10px] text-textmut">Looking up…</p>}
              {coinName && !looking && (
                <p className="text-[11px] font-semibold text-green flex items-center gap-1">✓ {coinName}</p>
              )}
              {!coinName && !looking && sym.length > 1 && (
                <p className="text-[10px] text-textmut italic">Name will show once found</p>
              )}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-textmut uppercase tracking-wide">Platform *</label>
            <select value={platform} onChange={e => setPlatform(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20">
              {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Quantity *" type="number" step="0.00000001" value={qty} onChange={e => setQty(e.target.value)} />
          <Input label="Avg Price (£) *" type="number" step="0.01" value={avgGbp} onChange={e => setAvgGbp(e.target.value)} helpText="Price paid in GBP" />
        </div>
      </div>
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function CryptoPage() {
  const userId = (useAuthStore(s => s.activeProfileId ?? s.user?.id))!
  const toast  = useToastStore(s => s.show)
  const qc     = useQueryClient()

  const { data: rows = [], isLoading } = useAssets<CryptoHolding>('crypto_holdings')
  const { data: fx } = useFxRates()
  const gbpInr = fx?.gbpInr ?? (fx?.gbpUsd ?? 1.27) * (fx?.usdInr ?? 83.5)

  const yahooSymbols = useMemo(() => [...new Set(rows.map(r => r.yahoo_symbol))], [rows])
  const { data: priceMap = {}, isFetching: priceFetching, refetch } = useYahooPrices(yahooSymbols)

  const [editRow,    setEditRow]    = useState<Partial<CryptoHolding> | null>(null)
  const [showImport, setShowImport] = useState(false)
  const { data: _cryptoActRows = [] } = useQuery<{ gbp_amount: number; inr_rate: number | null }[]>({
    queryKey: ['crypto_actual_invested_totals', userId],
    queryFn: async () => {
      const { data } = await supabase.from('crypto_actual_invested').select('gbp_amount,inr_rate').eq('user_id', userId)
      return (data ?? []) as { gbp_amount: number; inr_rate: number | null }[]
    },
    enabled: !!userId,
  })
  const actualGbp = useMemo(() => _cryptoActRows.reduce((s, e) => s + Number(e.gbp_amount), 0), [_cryptoActRows])
  const actualInr = useMemo(() => _cryptoActRows.reduce((s, e) => s + Number(e.gbp_amount) * Number(e.inr_rate ?? gbpInr), 0), [_cryptoActRows, gbpInr])
  const { upsertMutation, deleteMutation } = useAssets<CryptoHolding>('crypto_holdings')

  // API strips -GBP/-USD suffix from keys: BTC-GBP → stored as BTC in priceMap
  const priceKey   = (sym: string) => sym.replace(/-(GBP|USD|EUR|USDT)$/i, '')
  const getLtpGbp  = (r: CryptoHolding) => priceMap[priceKey(r.yahoo_symbol)]?.price ?? null
  const gbpToInr   = (v: number) => v * gbpInr
  const getCoinName = (r: CryptoHolding) => priceMap[priceKey(r.yahoo_symbol)]?.name ?? cryptoTicker(r.yahoo_symbol)

  // Totals
  const totalInvestedGbp = useMemo(() => rows.reduce((s, r) => s + r.qty * r.avg_price_gbp, 0), [rows])
  const totalValueGbp    = useMemo(() => rows.reduce((s, r) => { const ltp = getLtpGbp(r); return s + r.qty * (ltp ?? r.avg_price_gbp) }, 0), [rows, priceMap])
  const totalInvestedInr = gbpToInr(totalInvestedGbp)
  const totalValueInr    = gbpToInr(totalValueGbp)

  const gainGbp     = totalValueGbp - totalInvestedGbp
  const gainPctGbp  = totalInvestedGbp > 0 ? (gainGbp / totalInvestedGbp) * 100 : 0
  const isUpGbp     = gainGbp >= 0
  const gainInr     = totalValueInr - totalInvestedInr
  const isUpInr     = gainInr >= 0

  const actGainGbp    = actualGbp > 0 ? totalValueGbp - actualGbp : null
  const actGainInr    = actualInr > 0 ? totalValueInr - actualInr : null
  const actGainPct    = actualGbp > 0 ? ((totalValueGbp - actualGbp) / actualGbp) * 100 : null
  const actIsUp       = actGainGbp != null ? actGainGbp >= 0 : true

  const liveLabel = priceFetching
    ? '⟳ Fetching…'
    : Object.keys(priceMap).length ? `🟢 Live · ${new Date().toLocaleTimeString('en-IN')}` : undefined

  // Row 1: ₹  |  Row 2: £
  const statsRow1 = [
    { label: 'Invested (₹)',        value: INR(totalInvestedInr),                                                                                      icon: '₹', accentColor: '#0891b2', loading: isLoading },
    { label: 'Current Value (₹)',   value: INR(totalValueInr),                                                                                         icon: '◈', accentColor: '#0d9488', loading: isLoading, sub: liveLabel },
    { label: 'Gain / Loss (₹)',     value: `${isUpInr?'+':''}${INR(gainInr)}`,        sub: `${isUpInr?'+':''}${(totalInvestedInr > 0 ? (gainInr/totalInvestedInr)*100 : 0).toFixed(1)}%`, icon: isUpInr?'▲':'▼', accentColor: isUpInr?'#059669':'#dc2626', loading: isLoading },
    { label: 'Actual Invested (₹)', value: actualInr > 0 ? INR(actualInr) : '—',                                                                      icon: '⊡', accentColor: '#d97706', loading: isLoading },
    { label: 'Actual Gain (₹)',     value: actGainInr != null ? `${actIsUp?'+':''}${INR(actGainInr)}` : '—', sub: actGainPct != null ? `${actIsUp?'+':''}${actGainPct.toFixed(1)}%` : undefined, icon: actIsUp?'▲':'▼', accentColor: actIsUp?'#059669':'#dc2626', loading: isLoading },
  ]
  const handleSave = async (d: Partial<CryptoHolding>) => {
    try {
      const existing = rows.find(r => r.id === d.id)
      const prev_qty = existing ? existing.qty : d.qty
      await upsertMutation.mutateAsync({ ...d, prev_qty, user_id: userId } as Record<string, unknown>)
      toast('Saved ✅', 'success'); setEditRow(null)
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const handleImport = async (parsed: Record<string, unknown>[]) => {
    // Preserve manually-edited platform for existing symbols
    const existingPlatformMap = new Map(rows.map(r => [r.yahoo_symbol.toUpperCase(), r.platform]))
    const merged = parsed.map(r => {
      const sym = String(r.yahoo_symbol ?? '').toUpperCase()
      return { ...r, user_id: userId, platform: existingPlatformMap.get(sym) ?? r.platform ?? 'Kraken' }
    })
    await replaceAssets('crypto_holdings', userId, merged)
    qc.invalidateQueries({ queryKey: ['crypto_holdings', userId] })
    qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    toast(`${parsed.length} holdings imported ✅`, 'success')
  }

  // Sort by coin name
  const sortedRows = useMemo(() =>
    [...rows].sort((a, b) => getCoinName(a).localeCompare(getCoinName(b))),
  [rows, priceMap])

  const handleBulkSave = async (changes: { id: string; [key: string]: unknown }[]) => {
    try {
      await Promise.all(changes.map(change => {
        const existing = rows.find(r => r.id === change.id)
        if (!existing) return Promise.resolve()
        const qty           = typeof change.qty           === 'number' ? change.qty           : existing.qty
        const avg_price_gbp = typeof change.avg_price_gbp === 'number' ? change.avg_price_gbp : existing.avg_price_gbp
        return upsertMutation.mutateAsync({ ...existing, qty, avg_price_gbp, prev_qty: existing.qty, user_id: userId } as Record<string, unknown>)
      }))
      toast(`Updated ${changes.length} holding${changes.length !== 1 ? 's' : ''} ✅`, 'success')
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const cols = [
    {
      key: 'coin',
      mobilePrimary: true, header: 'Coin',
      render: (r: CryptoHolding) => {
        const ticker  = cryptoTicker(r.yahoo_symbol)
        const rawName = priceMap[priceKey(r.yahoo_symbol)]?.name ?? null
        return (
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-ink">{ticker}</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-orange-50 text-orange-700 border-orange-200">{r.platform}</span>
            </div>
            {rawName
              ? <div className="text-[10px] text-textmut truncate max-w-[200px]" title={rawName}>{rawName}</div>
              : <div className="text-[10px] text-textfade font-mono">{r.yahoo_symbol}</div>
            }
          </div>
        )
      },
    },
    {
      key: 'qty',
      hideOnMobile: true, header: 'Qty',
      editable:   true,
      editValue:  (r: CryptoHolding) => Number(r.qty),
      editStep:   '0.000001',
      align: 'right' as const,
      render: (r: CryptoHolding) => {
        const qty  = Number(r.qty)
        const diff = r.prev_qty != null ? qty - Number(r.prev_qty) : null
        return (
          <div className="text-right">
            {qty === 0
              ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red/10 text-red">EXITED</span>
              : <div className="font-mono">{qty.toLocaleString('en-GB', { maximumFractionDigits: 8 })}</div>}
            {diff !== null && diff !== 0 && (
              <div className={`text-[10px] font-semibold ${diff > 0 ? 'text-green' : 'text-red'}`}>
                {diff > 0 ? '+' : ''}{diff.toLocaleString('en-GB', { maximumFractionDigits: 8 })}
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'avg_price_gbp',
      hideOnMobile: true, header: 'Avg Price',
      editable:   true,
      editValue:  (r: CryptoHolding) => Number(r.avg_price_gbp).toFixed(4),
      editStep:   '0.0001',
      editPrefix:  '£',
      align: 'right' as const,
      render: (r: CryptoHolding) => (
        <div className="text-right">
          <div>{fmtGbp(r.avg_price_gbp)}</div>
        </div>
      ),
    },
    {
      key: 'ltp',
      hideOnMobile: true, header: 'Live Price', align: 'right' as const,
      render: (r: CryptoHolding) => {
        const ltp = getLtpGbp(r)
        if (ltp == null) return <span className="text-textmut">—</span>
        const changePct = r.avg_price_gbp > 0 ? ((ltp - r.avg_price_gbp) / r.avg_price_gbp) * 100 : 0
        return (
          <div className="text-right">
            <div className="font-bold">{fmtGbp(ltp)}</div>
            <div className={`text-[10px] font-semibold ${changePct >= 0 ? 'text-green' : 'text-red'}`}>
              {changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%
            </div>
          </div>
        )
      },
    },
    {
      key: 'invested',
      hideOnMobile: true, header: 'Invested', align: 'right' as const,
      render: (r: CryptoHolding) => (
        <div className="text-right">{fmtGbp(r.qty * r.avg_price_gbp)}</div>
      ),
    },
    {
      key: 'value',
      mobileValue: true, header: 'Cur. Value', align: 'right' as const,
      render: (r: CryptoHolding) => {
        const ltp    = getLtpGbp(r)
        const valGbp = r.qty * (ltp ?? r.avg_price_gbp)
        const isUp   = valGbp >= r.qty * r.avg_price_gbp
        return (
          <div className="text-right">
            <div className={`font-bold ${isUp ? 'text-green' : 'text-red'}`}>{fmtGbp(valGbp)}</div>
          </div>
        )
      },
    },
    {
      key: 'gain',
      mobileSubValue: true, header: 'Gain / Loss', align: 'right' as const,
      render: (r: CryptoHolding) => {
        const ltp     = getLtpGbp(r)
        const valGbp  = r.qty * (ltp ?? r.avg_price_gbp)
        const costGbp = r.qty * r.avg_price_gbp
        const gain    = valGbp - costGbp
        const pct     = costGbp > 0 ? (gain / costGbp) * 100 : 0
        const isUp    = gain >= 0
        return (
          <span className={`font-bold ${isUp ? 'text-green' : 'text-red'}`}>
            {isUp ? '+' : ''}{fmtGbp(gain)}
            <br />
            <span className="text-[10px] font-medium opacity-80">{isUp ? '+' : ''}{pct.toFixed(1)}%</span>
          </span>
        )
      },
    },
  ]

  return (
    <PageShell title="Crypto"
      subtitle={`${rows.filter(r => Number(r.qty) > 0).length} holdings`}
      badge={
        <span style={{display:'inline-flex',alignItems:'stretch',borderRadius:'20px',overflow:'hidden',fontSize:'11px',fontWeight:700,border:'1px solid #059669'}}>
          <span style={{background:'#059669',color:'#fff',padding:'2px 8px',fontFamily:'DM Sans,sans-serif',letterSpacing:'0.05em',display:'flex',alignItems:'center'}}>GBP→INR</span>
          <span style={{background:'#ECFDF5',color:'#065F46',padding:'2px 9px',fontFamily:'DM Mono,monospace',display:'flex',alignItems:'center'}}>₹{gbpInr.toFixed(2)}</span>
        </span>
      }
      actions={[
        { label: 'Add Crypto',  onClick: () => setEditRow({}),      variant: 'primary' },
        { label: <span style={{display:'inline-flex',alignItems:'center',gap:5,color:'#fff'}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Refresh</span>,            onClick: () => refetch(), variant: 'teal' },
      ]}
    >
      <AssetPageLayout
        stats={
          <div className="space-y-2">
            <StatGrid items={statsRow1} cols={5} />
            <div className="flex flex-wrap gap-y-1 py-2 bg-ink/[0.03] border border-border rounded-xl px-3">
              <span className="text-[10px] text-textmut uppercase tracking-widest self-center font-semibold pr-3">£ GBP</span>
              {[
                { label: 'Invested',      val: fmtGbp(totalInvestedGbp) },
                { label: 'Current Value', val: fmtGbp(totalValueGbp) },
                { label: 'Gain',          val: `${isUpGbp?'+':''}${fmtGbp(gainGbp)} (${isUpGbp?'+':''}${gainPctGbp.toFixed(1)}%)`, color: isUpGbp ? 'text-green' : 'text-red' },
                ...(actualGbp > 0 ? [
                  { label: 'Actual Inv',  val: fmtGbp(actualGbp) },
                  ...(actGainGbp != null ? [{ label: 'Actual Gain', val: `${actIsUp?'+':''}${fmtGbp(actGainGbp)} (${actIsUp?'+':''}${(actGainPct??0).toFixed(1)}%)`, color: actIsUp ? 'text-green' : 'text-red' }] : []),
                ] : []),
              ].map(({ label, val, color }, i) => (
                <div key={label} className={`flex items-center gap-1.5 px-3 ${i > 0 ? 'border-l border-border' : ''}`}>
                  <span className="text-[10px] text-textmut">{label}</span>
                  <span className={`text-[11px] font-bold font-mono ${color ?? 'text-textprim'}`}>{val}</span>
                </div>
              ))}
              <span className="text-[9px] text-textfade self-center ml-auto pl-3">@ ₹{gbpInr.toFixed(1)}/£</span>
            </div>
          </div>
        }
        mainTable={
          <AssetTable columns={cols} data={sortedRows} rowKey={r => r.id} loading={isLoading}
            emptyText="No crypto holdings — click 📥 Import CSV or + Add Crypto"
            onEditRow={r => setEditRow(r)}
            onDeleteRows={async ids => {
              for (const id of ids) await deleteMutation.mutateAsync(id)
              toast(`Deleted ${ids.length}`, 'success')
            }}
            onBulkSave={handleBulkSave}
          />
        }
        actualInvested={
          <CryptoActualPanel userId={userId} gbpInr={gbpInr} />
        }
      />

      {editRow !== null && <EditModal row={editRow} name={editRow.id ? getCoinName(editRow as CryptoHolding) : null} onClose={() => setEditRow(null)} onSave={handleSave} />}

      <CsvImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Import Crypto Holdings"
        hint="CSV needs: yahoo_symbol (or symbol/coin), qty, avg_price_gbp. Platform optional. Symbols auto-append -GBP if no suffix."
        parse={parseCryptoCsv}
        columns={[
          { key: 'yahoo_symbol', header: 'Symbol' },
          { key: 'platform',     header: 'Platform' },
          { key: 'qty',          header: 'Qty',       align: 'right' },
          { key: 'avg_price_gbp',header: 'Avg (£)',   align: 'right' },
        ]}
        renderCell={(row, key) =>
          typeof row[key] === 'number' ? (row[key] as number).toFixed(6) : String(row[key] ?? '—')
        }
        onImport={handleImport}
      />
    </PageShell>
  )
}
