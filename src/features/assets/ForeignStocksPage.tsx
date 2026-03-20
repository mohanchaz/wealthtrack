import { useState, useMemo } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
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
import {
import { RedeemGuide } from '../../components/common/RedeemGuide'

  toForeignYahooSymbol, getForeignPriceEntry,
  isForeignGbxLive, getForeignLtpGbp, getForeignAvgGbp,
} from '../../lib/foreignPriceHelpers'

// ── Symbol intelligence ───────────────────────────────────────
// Known London Stock Exchange symbols (traded in GBX pence)
// Yahoo Finance symbol overrides

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
  const qcPanel = useQueryClient()
  const invalidateActual = () => {
    qcPanel.invalidateQueries({ queryKey: ['foreign_actual_invested', userId] })
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
  const [editEntry,   setEditEntry]   = useState<ForeignActualEntry | null>(null)
  const [editGbp,     setEditGbp]     = useState('')
  const [editRate,    setEditRate]    = useState('')
  const [editDate,    setEditDate]    = useState('')
  const [editSaving,  setEditSaving]  = useState(false)
  const toast = useToastStore(s => s.show)

  // Use the same query key as the main page — invalidateActual() refreshes both together
  const { data: entries = [], isFetching: loading } = useQuery({
    queryKey: ['foreign_actual_invested', userId],
    queryFn: async () => {
      const { data } = await supabase.from('foreign_actual_invested')
        .select('*').eq('user_id', userId).order('entry_date', { ascending: false })
      return (data ?? []) as ForeignActualEntry[]
    },
    enabled: !!userId,
  })

  const openEdit = (e: ForeignActualEntry) => {
    setEditEntry(e); setEditGbp(String(e.gbp_amount)); setEditRate(String(e.inr_rate)); setEditDate(e.entry_date)
  }
  const handleEditSave = async () => {
    if (!editEntry) return
    setEditSaving(true)
    try {
      const { error: err } = await supabase.from('foreign_actual_invested').update({
        gbp_amount: parseFloat(editGbp), inr_rate: parseFloat(editRate), entry_date: editDate
      }).eq('id', editEntry.id)
      if (err) throw new Error(err.message)
      setEditEntry(null); await invalidateActual(); toast('Updated ✅', 'success')
    } catch (e2) { toast((e2 as Error).message, 'error') }
    finally { setEditSaving(false) }
  }

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
      await invalidateActual()
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
      setSelected(new Set()); await invalidateActual()
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

        <Button size="sm" onClick={() => setShowForm(f => !f)} variant={showForm ? 'secondary' : 'primary'}>
          {showForm ? '✕ Cancel' : 'Add Entry'}
        </Button>

        {showForm && (
          <div className="flex flex-col gap-2 mt-2">
            <Input label="GBP Amount" prefix="£" type="number" step="0.01" placeholder="e.g. 1000.00"
              value={gbpAmount} onChange={e => setGbpAmount(e.target.value)} />
            <Input label="GBP → INR Rate" type="number" step="0.01" placeholder="e.g. 106.5"
              value={inrRate} onChange={e => setInrRate(e.target.value)}
              helpText={`Live rate: ₹${gbpInr.toFixed(2)} / £1`} />
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
                className={`grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-x-2 items-center px-4 py-2 border-b border-border/40 last:border-0 transition-colors ${selected.has(e.id) ? 'bg-red/5' : i % 2 === 1 ? 'bg-surface2/20' : 'hover:bg-surface2'}`}
              >
                <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleOne(e.id)}
                  className="w-3 h-3 rounded accent-ink cursor-pointer shrink-0" />
                <span className="text-[11px] text-textmut font-mono">
                  {formatDate(e.entry_date || e.created_at)}
                </span>
                <div className="text-right">
                  <div className="font-mono font-bold text-[12px] text-textprim">£{Number(e.gbp_amount).toFixed(2)}</div>
                  <div className="text-[9px] text-textfade font-mono mt-0.5">@ ₹{Number(e.inr_rate).toFixed(1)}/£</div>
                </div>
                <span className="text-[11px] font-semibold text-teal text-right">
                  {INR(Number(e.gbp_amount) * Number(e.inr_rate))}
                </span>
                <button onClick={() => openEdit(e)} className="text-[10px] text-textmut hover:text-ink px-1 py-0.5 rounded hover:bg-surface2 transition-colors" title="Edit">✏</button>
              </div>
            ))}
          </>
        )}
      </div>

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
function EditModal({ row, name, onClose, onSave }: {
  row: Partial<ForeignHolding>; name?: string | null; onClose: () => void; onSave: (d: Partial<ForeignHolding>) => Promise<void>
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
          {row.id ? (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-textmut uppercase tracking-wider">Symbol</label>
              <div className="h-9 rounded-xl border border-border bg-surface2 text-sm text-textmut px-3 flex items-center font-mono select-none cursor-not-allowed">{symbol}</div>
              {name && <div className="text-xs text-textmut mt-0.5">{name}</div>}
            </div>
          ) : (
            <Input label="Symbol *" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. AAPL, MKS" helpText="e.g. AAPL, TSLA, CNDX.L" />
          )}
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


// ── Trading212 Import Modal ───────────────────────────────────
const T212_KEY_STORAGE = 'wealthtrack_t212_key'

function Trading212ImportModal({ onClose, onImport, existingCurrencyMap }: {
  onClose: () => void
  onImport: (rows: Omit<ForeignHolding, 'id' | 'user_id'>[]) => Promise<void>
  existingCurrencyMap: Map<string, string>
}) {
  const [apiKey,    setApiKey]    = useState(() => localStorage.getItem(T212_KEY_STORAGE) ?? '')
  const [remember,  setRemember]  = useState(!!localStorage.getItem(T212_KEY_STORAGE))
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [preview,   setPreview]   = useState<{ symbol: string; quantity: number; avg_price: number; currency: string }[] | null>(null)
  const [importing, setImporting] = useState(false)

  async function handleFetch() {
    if (!apiKey.trim()) { setError('Enter your Trading212 API key.'); return }
    setLoading(true); setError(''); setPreview(null)
    try {
      const res = await fetch('/api/trading212', {
        method: 'POST',
        headers: { 'X-Trading212-Key': apiKey.trim() },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      if (remember) {
        localStorage.setItem(T212_KEY_STORAGE, apiKey.trim())
      } else {
        localStorage.removeItem(T212_KEY_STORAGE)
      }
      setPreview(data.holdings ?? [])
    } catch (e: any) {
      setError(e.message ?? 'Failed to fetch from Trading212')
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    if (!preview) return
    setImporting(true)
    const rows = preview.map(h => ({
      symbol:    h.symbol,
      qty:       h.quantity,
      avg_price: h.avg_price,
      // Preserve manually-set currency for existing symbols
      currency:  (existingCurrencyMap.get(h.symbol) ?? h.currency) as 'USD' | 'GBP' | 'GBX',
    }))
    await onImport(rows)
    setImporting(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] w-full max-w-lg flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EEE9]">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-[#E8F4FD] flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#0369a1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#0369a1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="text-[15px] font-black text-[#1A1A1A]">Import from Trading212</h3>
            </div>
            <p className="text-[11px] text-[#767676] mt-0.5">Fetch your live portfolio directly — no CSV needed</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#ABABAB] hover:text-[#1A1A1A] hover:bg-[#F5F4F0] transition-colors text-lg leading-none">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!preview ? (
            <>
              <div className="mb-4">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#767676] mb-1.5 block">
                  Trading212 API Key
                </label>
                <input
                  type="password"
                  placeholder="Paste your API key here"
                  value={apiKey}
                  onChange={e => { setApiKey(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleFetch()}
                  className="w-full h-10 rounded-xl bg-[#F5F4F0] border border-[#E0DDD6] text-[13px] text-[#1A1A1A] placeholder:text-[#ABABAB] outline-none px-3.5 focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 focus:bg-white transition-all font-mono"
                />
                <div className="flex items-center justify-between mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-[#0F766E] cursor-pointer" />
                    <span className="text-[11px] text-[#767676]">Remember key in this browser</span>
                  </label>
                  <a href="https://app.trading212.com/settings/api" target="_blank" rel="noopener noreferrer"
                    className="text-[11px] text-[#0F766E] hover:underline">
                    Get API key →
                  </a>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 mb-4">
                  <span className="text-red-500 text-xs mt-0.5">⚠</span>
                  <p className="text-[12px] text-[#C0392B]">{error}</p>
                </div>
              )}

              <div className="bg-[#F0FBF9] border border-[#D1FAE5] rounded-xl px-3.5 py-3 text-[11px] text-[#065F46]">
                <p className="font-semibold mb-1">What gets imported</p>
                <p className="text-[#047857] leading-relaxed">
                  All your live positions — symbol, quantity, and average price. Symbols are auto-cleaned (same as your PowerShell script). Existing currency settings are preserved.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-semibold text-[#1A1A1A]">
                  {preview.length} holdings found
                </p>
                <button onClick={() => setPreview(null)}
                  className="text-[11px] text-[#767676] hover:text-[#1A1A1A] underline underline-offset-2">
                  ← Change key
                </button>
              </div>
              <div className="rounded-xl border border-[#E0DDD6] overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2 bg-[#F5F4F0] border-b border-[#E0DDD6]">
                  {['Symbol', 'Currency', 'Qty', 'Avg Price'].map(h => (
                    <span key={h} className="text-[9px] font-bold uppercase tracking-widest text-[#767676]">{h}</span>
                  ))}
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-[#F0EEE9]">
                  {preview.map((h, i) => (
                    <div key={h.symbol} className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2 text-[12px] ${i % 2 === 1 ? 'bg-[#FAFAF8]' : ''}`}>
                      <span className="font-bold text-[#1A1A1A] font-mono">{h.symbol}</span>
                      <span className="text-[#767676] font-mono text-center">
                        {existingCurrencyMap.has(h.symbol)
                          ? <span className="text-amber-600">{existingCurrencyMap.get(h.symbol)}</span>
                          : h.currency}
                      </span>
                      <span className="text-right text-[#1A1A1A] font-mono">{h.quantity.toFixed(4)}</span>
                      <span className="text-right text-[#1A1A1A] font-mono">{h.avg_price.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {Array.from(existingCurrencyMap.entries()).some(([sym]) => preview.some(h => h.symbol === sym)) && (
                <p className="text-[10px] text-amber-600 mt-2">
                  ⚠ Amber currency = preserved from your existing settings and won't be overwritten.
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#F0EEE9] flex gap-2">
          <button onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-[#E0DDD6] bg-[#F5F4F0] text-[#767676] text-[13px] font-semibold hover:bg-[#EFEDE8] transition-all">
            Cancel
          </button>
          {!preview ? (
            <button onClick={handleFetch} disabled={loading}
              className="flex-1 h-10 rounded-xl bg-[#0F766E] text-white text-[13px] font-bold hover:bg-[#0D4F4A] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />}
              {loading ? 'Fetching…' : 'Fetch portfolio'}
            </button>
          ) : (
            <button onClick={handleImport} disabled={importing}
              className="flex-1 h-10 rounded-xl bg-[#0F766E] text-white text-[13px] font-bold hover:bg-[#0D4F4A] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {importing && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />}
              {importing ? 'Importing…' : `Import ${preview.length} holdings`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function ForeignStocksPage() {
  const userId    = (useAuthStore(s => s.activeProfileId ?? s.user?.id))!
  const toast     = useToastStore(s => s.show)
  const qc        = useQueryClient()

  const { data: rows = [], isLoading } = useAssets<ForeignHolding>('foreign_stock_holdings')
  const { data: fx } = useFxRates()

  const gbpUsd = fx?.gbpUsd ?? 1.27
  const usdInr = fx?.usdInr ?? 83.5
  const gbpInr = fx?.gbpInr ?? gbpUsd * usdInr

  // Actual invested entries — same cache key as ForeignActualPanel so invalidation auto-refetches
  const { data: actualEntries = [] } = useQuery({
    queryKey: ['foreign_actual_invested_totals', userId],
    queryFn: async () => {
      const { data } = await supabase.from('foreign_actual_invested').select('gbp_amount,inr_rate').eq('user_id', userId)
      return (data ?? []) as { gbp_amount: number; inr_rate: number }[]
    },
    enabled: !!userId,
  })
  const actualGbp = actualEntries.reduce((s, e) => s + Number(e.gbp_amount), 0)
  const actualInr = actualEntries.reduce((s, e) => s + Number(e.gbp_amount) * Number(e.inr_rate), 0)

  // Build yahoo symbols list
  const yahooSymbols = useMemo(() =>
    [...new Set(rows.map(r => toForeignYahooSymbol(r.symbol, r.currency)))],
  [rows])

  const { data: priceMap = {}, isFetching: priceFetching, refetch } = useYahooPrices(yahooSymbols)
  const [editRow,    setEditRow]    = useState<Partial<ForeignHolding> | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showT212,   setShowT212]   = useState(false)
  const { upsertMutation, deleteMutation } = useAssets<ForeignHolding>('foreign_stock_holdings')

  // ── Price helpers (from shared foreignPriceHelpers) ─────────
  const getLtpInGbp  = (r: ForeignHolding) => getForeignLtpGbp(r, priceMap, gbpUsd)
  const getAvgInGbp  = (r: ForeignHolding) => getForeignAvgGbp(r, gbpUsd)
  const isGbxLive    = (r: ForeignHolding) => isForeignGbxLive(r, priceMap)
  const getRawEntry  = (r: ForeignHolding) => getForeignPriceEntry(r, priceMap)

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
    ? '⟳ Fetching…'
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
    { label: 'Gain / Loss (₹)',    value: `${isUpInr?'+':''}${INR(gainInr)}`,        sub: `${isUpInr?'+':''}${(totalInvestedInr > 0 ? (gainInr/totalInvestedInr)*100 : 0).toFixed(1)}%`, icon: isUpInr?'▲':'▼', accentColor: isUpInr?'#059669':'#dc2626', loading: isLoading },
    { label: 'Actual Invested (₹)',value: actualInr > 0 ? INR(actualInr) : '—',                          icon: '⊡', accentColor: '#d97706', loading: isLoading },
    { label: 'Actual Gain (₹)',    value: actGainInr != null ? `${actIsUp?'+':''}${INR(actGainInr)}` : '—', sub: actGainPctGbp != null ? `${actIsUp?'+':''}${actGainPctGbp.toFixed(1)}%` : undefined, icon: actIsUp?'▲':'▼', accentColor: actIsUp?'#059669':'#dc2626', loading: isLoading },
  ]
  const actGainPctActual = actualGbp > 0 ? ((totalValueGbp - actualGbp) / actualGbp) * 100 : null

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
    qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    toast(`${parsed.length} holdings imported ✅`, 'success')
  }

  // Sort rows by instrument name from priceMap, fallback to symbol
  const getInstrumentName = (r: ForeignHolding): string => {
    const ySym  = toForeignYahooSymbol(r.symbol, r.currency)
    const key   = ySym.replace(/\.(L|US)$/, '')
    return priceMap[key]?.name ?? priceMap[ySym]?.name ?? r.symbol
  }

  const sortedRows = useMemo(() =>
    [...rows].sort((a, b) => getInstrumentName(a).localeCompare(getInstrumentName(b))),
  [rows, priceMap])

  const handleBulkSave = async (changes: { id: string; [key: string]: unknown }[]) => {
    try {
      await Promise.all(changes.map(change => {
        const existing = rows.find(r => r.id === change.id)
        if (!existing) return Promise.resolve()
        const qty       = typeof change.qty       === 'number' ? change.qty       : existing.qty
        const avg_price = typeof change.avg_price === 'number' ? change.avg_price : existing.avg_price
        return upsertMutation.mutateAsync({ ...existing, qty, avg_price, prev_qty: existing.qty, user_id: userId } as Record<string, unknown>)
      }))
      toast(`Updated ${changes.length} holding${changes.length !== 1 ? 's' : ''} ✅`, 'success')
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const cols = [
    {
      key: 'symbol',
      mobilePrimary: true, header: 'Symbol',
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
      key: 'qty',
      hideOnMobile: true, header: 'Qty',
      editable:   true,
      editValue:  (r: ForeignHolding) => Number(r.qty),
      editStep:   '0.001',
      align: 'right' as const,
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
      key: 'avg_price',
      hideOnMobile: true, header: 'Avg Price',
      editable:   true,
      editValue:  (r: ForeignHolding) => Number(r.avg_price).toFixed(4),
      editStep:   '0.0001',
      align: 'right' as const,
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
      key: 'ltp',
      hideOnMobile: true, header: 'Live Price', align: 'right' as const,
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
      key: 'invested',
      hideOnMobile: true, header: 'Invested', align: 'right' as const,
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
      key: 'value',
      mobileValue: true, header: 'Cur. Value', align: 'right' as const,
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
      key: 'gain',
      mobileSubValue: true, header: 'Gain / Loss', align: 'right' as const,
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
      badge={
        <span style={{display:'inline-flex',alignItems:'stretch',borderRadius:'20px',overflow:'hidden',fontSize:'11px',fontWeight:700,border:'1px solid #059669'}}>
          <span style={{background:'#059669',color:'#fff',padding:'2px 8px',fontFamily:'DM Sans,sans-serif',letterSpacing:'0.05em',display:'flex',alignItems:'center'}}>GBP→INR</span>
          <span style={{background:'#ECFDF5',color:'#065F46',padding:'2px 9px',fontFamily:'DM Mono,monospace',display:'flex',alignItems:'center'}}>₹{gbpInr.toFixed(2)}</span>
        </span>
      }
      redeemGuide={<RedeemGuide assetType="foreign-stocks" />}
      actions={[
        { label: 'Import CSV', onClick: () => setShowImport(true), variant: 'import' },
        { label: <span style={{display:'inline-flex',alignItems:'center',gap:5}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>Trading212</span>, onClick: () => setShowT212(true), variant: 'secondary' },
        { label: 'Add Holding', onClick: () => setEditRow({}), variant: 'primary' },
        { label: <span style={{display:'inline-flex',alignItems:'center',gap:5,color:'#fff'}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Refresh</span>, onClick: () => refetch(), variant: 'teal' },
      ]}
    >
      <AssetPageLayout
        stats={
          <div className="space-y-2">
            <StatGrid items={statsRow1} cols={5} />
            <div className="flex flex-wrap gap-y-1 py-2 bg-ink/[0.03] border border-border rounded-xl px-3">
              <span className="text-[10px] text-textmut uppercase tracking-widest self-center font-semibold pr-3">£ GBP</span>
              {[
                { label: 'Invested',        val: fmtGbp(totalInvestedGbp) },
                { label: 'Current Value',   val: fmtGbp(totalValueGbp) },
                { label: 'Gain',            val: `${isUpGbp?'+':''}${fmtGbp(gainGbp)} (${isUpGbp?'+':''}${gainPctGbp.toFixed(1)}%)`, color: isUpGbp ? 'text-green' : 'text-red' },
                ...(actualGbp > 0 ? [
                  { label: 'Actual Inv',    val: fmtGbp(actualGbp) },
                  ...(actGainGbp != null ? [{ label: 'Actual Gain', val: `${actIsUp?'+':''}${fmtGbp(actGainGbp)} (${actIsUp?'+':''}${(actGainPctActual??0).toFixed(1)}%)`, color: actIsUp ? 'text-green' : 'text-red' }] : []),
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
            emptyText="No foreign holdings — click 📥 Import CSV or + Add"
            onEditRow={r => setEditRow(r)}
            onDeleteRows={async ids => {
              for (const id of ids) await deleteMutation.mutateAsync(id)
              toast(`Deleted ${ids.length}`, 'success')
            }}
            onBulkSave={handleBulkSave}
          />
        }
        actualInvested={<ForeignActualPanel userId={userId} gbpInr={gbpInr} />}
      />

      {editRow !== null && (
        <EditModal row={editRow} name={editRow.id ? (getForeignPriceEntry(editRow as ForeignHolding, priceMap)?.name ?? null) : null} onClose={() => setEditRow(null)} onSave={handleSave} />
      )}

      {showT212 && (
        <Trading212ImportModal
          onClose={() => setShowT212(false)}
          existingCurrencyMap={new Map(rows.map(r => [r.symbol.toUpperCase(), r.currency]))}
          onImport={async (parsed) => {
            await replaceAssets('foreign_stock_holdings', userId, parsed.map(r => ({ ...r, user_id: userId })))
            qc.invalidateQueries({ queryKey: ['foreign_stock_holdings', userId] })
            qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
            toast(`${parsed.length} holdings imported from Trading212 ✅`, 'success')
          }}
        />
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
