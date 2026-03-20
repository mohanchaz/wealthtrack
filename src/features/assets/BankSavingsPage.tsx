import { useState, useMemo, useEffect } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useAuthStore }   from '../../store/authStore'
import { useAssets }      from '../../hooks/useAssets'
import { useToastStore }  from '../../store/toastStore'
import { AssetPageLayout } from '../../components/common/AssetPageLayout'
import { PageShell }      from '../../components/common/PageShell'
import { StatGrid }       from '../../components/common/StatGrid'
import { AssetTable }     from '../../components/common/AssetTable'
import { Modal }          from '../../components/ui/Modal'
import { ConfirmModal }   from '../../components/ui/ConfirmModal'
import { Button }         from '../../components/ui/Button'
import { Input }          from '../../components/ui/Input'
import { INR, formatDate } from '../../lib/utils'
import { supabase }       from '../../lib/supabase'
import { useFxRates }     from '../../hooks/useLivePrices'
import { RedeemGuide } from '../../components/common/RedeemGuide'


// ── Types ────────────────────────────────────────────────────
interface BankSaving {
  id:             string
  user_id:        string
  account_type:   string
  platform:       string
  account_number?: string
  amount_gbp:     number
  interest_rate?: number
  maturity_date?: string
  created_at?:    string
}

interface ActualEntry {
  id: string; user_id: string; entry_date: string
  gbp_amount: number; inr_rate: number; created_at?: string
}

const ACCOUNT_TYPES = [
  'Current Account', 'Savings Account', 'ISA', 'Cash ISA',
  'Fixed Rate Bond', 'Notice Account', 'Premium Bonds', 'Other',
]

const TYPE_COLORS: Record<string, string> = {
  'Current Account':  'bg-blue/10 text-blue',
  'Savings Account':  'bg-teal/10 text-teal',
  'ISA':              'bg-green/10 text-green',
  'Cash ISA':         'bg-green/10 text-green',
  'Fixed Rate Bond':  'bg-amber/10 text-amber',
  'Notice Account':   'bg-purple/10 text-purple',
  'Premium Bonds':    'bg-pink/10 text-pink',
  'Other':            'bg-textmut/10 text-textmut',
}

function daysUntil(d?: string) {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
}

// ── Actual Invested Panel ────────────────────────────────────
function BankActualPanel({ userId, gbpInr }: { userId: string; gbpInr: number }) {
  const qc = useQueryClient()
  const invalidateActual = () => {
    qc.invalidateQueries({ queryKey: ['bank_savings_actual_invested', userId] })
    qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
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
  const [editEntry,   setEditEntry]   = useState<ActualEntry | null>(null)
  const [editGbp,     setEditGbp]     = useState('')
  const [editRate,    setEditRate]    = useState('')
  const [editDate,    setEditDate]    = useState('')
  const [editSaving,  setEditSaving]  = useState(false)
  const toast = useToastStore(s => s.show)

  useEffect(() => { setInrRate(String(gbpInr.toFixed(2))) }, [gbpInr])

  // Shared cache key — invalidateActual() refreshes both panel and stats banner
  const { data: entries = [], isFetching: loading } = useQuery<ActualEntry[]>({
    queryKey: ['bank_savings_actual_invested', userId],
    queryFn: async () => {
      const { data } = await supabase.from('bank_savings_actual_invested')
        .select('*').eq('user_id', userId).order('entry_date', { ascending: false })
      return (data ?? []) as ActualEntry[]
    },
    enabled: !!userId,
  })

  const totalGbp = entries.reduce((s, e) => s + Number(e.gbp_amount), 0)
  const totalInr = entries.reduce((s, e) => s + Number(e.gbp_amount) * Number(e.inr_rate), 0)

  const handleAdd = async () => {
    const gbp = parseFloat(gbpAmount); const rate = parseFloat(inrRate)
    if (!gbp || !rate) return
    setSaving(true); setError('')
    try {
      const { error: err } = await supabase.from('bank_savings_actual_invested').insert({
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

  const openEdit = (e: ActualEntry) => {
    setEditEntry(e); setEditGbp(String(e.gbp_amount)); setEditRate(String(e.inr_rate)); setEditDate(e.entry_date)
  }
  const handleEditSave = async () => {
    if (!editEntry) return
    setEditSaving(true)
    try {
      const { error: err } = await supabase.from('bank_savings_actual_invested').update({
        gbp_amount: parseFloat(editGbp), inr_rate: parseFloat(editRate), entry_date: editDate
      }).eq('id', editEntry.id)
      if (err) throw new Error(err.message)
      setEditEntry(null); await invalidateActual(); toast('Updated ✅', 'success')
    } catch (e2) { toast((e2 as Error).message, 'error') }
    finally { setEditSaving(false) }
  }

  const doDelete = async () => {
    setConfirmOpen(false); setDeleting(true)
    try {
      for (const id of selected) await supabase.from('bank_savings_actual_invested').delete().eq('id', id)
      setSelected(new Set()); await invalidateActual(); toast(`Deleted ${selected.size}`, 'success')
    } finally { setDeleting(false) }
  }

  const allIds = entries.map(e => e.id)
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
        <Button size="sm" variant={showForm ? 'secondary' : 'primary'} onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Cancel' : '+ Add Entry'}
        </Button>
        {showForm && (
          <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-border">
            <Input label="GBP Amount" prefix="£" type="number" step="0.01" placeholder="e.g. 500.00"
              value={gbpAmount} onChange={e => setGbpAmount(e.target.value)} />
            <Input label="GBP → INR Rate" type="number" step="0.01" placeholder="e.g. 106.5"
              value={inrRate} onChange={e => setInrRate(e.target.value)} />
            <Input label="Date" type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
            {error && <p className="text-[10px] text-red bg-red/5 border border-red/20 rounded-lg px-2 py-1">{error}</p>}
            <Button size="sm" onClick={handleAdd} loading={saving}>Save Entry</Button>
          </div>
        )}
      </div>

      {/* Entries list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-3 text-xs text-textmut">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="px-4 py-3 text-xs text-textmut italic">No entries yet</div>
        ) : (
          <>
            <div className="flex items-center px-4 py-2 border-b border-border gap-2">
              <input type="checkbox" checked={allCheck} onChange={toggleAll} className="rounded" />
              <span className="text-[10px] text-textmut flex-1">{entries.length} entries</span>
              {selected.size > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red/10 text-red">
                  {selected.size}
                </span>
              )}
            </div>
            {selected.size > 0 && (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-red/5 border-b border-red/20">
                <span className="text-[10px] font-semibold text-red flex-1">{selected.size} selected</span>
                <button onClick={() => setConfirmOpen(true)} disabled={deleting}
                  className="text-[10px] font-bold px-2 py-1 rounded bg-red text-white hover:bg-red/80 disabled:opacity-50">
                  {deleting ? '…' : '🗑 Delete'}
                </button>
              </div>
            )}
            {/* Column headers */}
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
                  <div className="font-mono font-bold text-[12px] text-textprim">£{Number(e.gbp_amount).toFixed(2)}</div>
                  <div className="text-[9px] text-textfade font-mono mt-0.5">@ ₹{Number(e.inr_rate).toFixed(2)}/£</div>
                </div>
                <span className="text-[11px] font-semibold text-right text-teal">{INR(Number(e.gbp_amount) * Number(e.inr_rate))}</span>
                <button onClick={() => openEdit(e)} className="text-[10px] text-textmut hover:text-ink px-1 py-0.5 rounded hover:bg-surface2 transition-colors" title="Edit">✏</button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Edit modal */}
      {confirmOpen && (
        <ConfirmModal
          message={`Delete ${selected.size} entr${selected.size > 1 ? 'ies' : 'y'}?`}
          onConfirm={doDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
      {editEntry && (
        <Modal open onClose={() => setEditEntry(null)} title="Edit Entry"
          footer={<><Button variant="secondary" size="sm" onClick={() => setEditEntry(null)}>Cancel</Button>
            <Button size="sm" onClick={handleEditSave} loading={editSaving}>💾 Save</Button></>}>
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

function MaturityBadge({ dateStr }: { dateStr?: string }) {
  const d = daysUntil(dateStr)
  if (d === null) return <span className="text-textmut text-xs">—</span>
  if (d < 0) return (
    <div className="text-right">
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green/10 text-green">✓ Matured</span>
      <div className="text-[10px] text-textmut mt-0.5">{formatDate(dateStr)}</div>
    </div>
  )
  if (d <= 30) return (
    <div className="text-right">
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red/10 text-red">In {d}d</span>
      <div className="text-[10px] text-textmut mt-0.5">{formatDate(dateStr)}</div>
    </div>
  )
  if (d <= 90) return (
    <div className="text-right">
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber/10 text-amber">In {d}d</span>
      <div className="text-[10px] text-textmut mt-0.5">{formatDate(dateStr)}</div>
    </div>
  )
  return <div className="text-right text-xs text-textmut">{formatDate(dateStr)}</div>
}

// ── Edit / Add Modal ─────────────────────────────────────────
function EditModal({ row, onClose, onSave }: {
  row: Partial<BankSaving>; onClose: () => void; onSave: (d: Partial<BankSaving>) => Promise<void>
}) {
  const [accountType,   setAccountType]   = useState(row.account_type ?? 'Savings Account')
  const [platform,      setPlatform]      = useState(row.platform ?? '')
  const [accountNumber, setAccountNumber] = useState(row.account_number ?? '')
  const [amount,        setAmount]        = useState(String(row.amount_gbp ?? ''))
  const [interest,      setInterest]      = useState(String(row.interest_rate ?? ''))
  const [maturity,      setMaturity]      = useState(row.maturity_date ?? '')
  const [saving,        setSaving]        = useState(false)

  const handleSave = async () => {
    if (!platform || !amount) return
    setSaving(true)
    await onSave({
      ...row,
      account_type:   accountType,
      platform,
      account_number: accountNumber || undefined,
      amount_gbp:     parseFloat(amount),
      interest_rate:  interest ? parseFloat(interest) : undefined,
      maturity_date:  maturity || undefined,
    })
    setSaving(false)
  }

  return (
    <Modal open onClose={onClose} title={row.id ? 'Edit Account' : 'Add Account'}
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={handleSave} loading={saving} disabled={!platform || !amount}>Save</Button></>}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-textsec uppercase tracking-wider">Account Type</label>
          <select value={accountType} onChange={e => setAccountType(e.target.value)}
            className="h-9 rounded-xl border border-border bg-white text-sm text-textprim px-3 focus:border-teal focus:ring-2 focus:ring-teal/15 outline-none">
            {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <Input label="Platform / Bank *" value={platform} onChange={e => setPlatform(e.target.value)} placeholder="e.g. Monzo, Barclays, NS&I" />
        <Input label="Account Number (last 4)" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="e.g. 4521" />
        <Input label="Amount (£) *" prefix="£" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 5000.00" />
        <Input label="Interest Rate (%)" type="number" step="0.01" value={interest} onChange={e => setInterest(e.target.value)} placeholder="e.g. 4.5" />
        <Input label="Maturity Date" type="date" value={maturity} onChange={e => setMaturity(e.target.value)} />
      </div>
    </Modal>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function BankSavingsPage() {
  const userId = (useAuthStore(s => s.activeProfileId ?? s.user?.id))!
  const toast  = useToastStore(s => s.show)
  const { data: rows = [], isLoading } = useAssets<BankSaving>('bank_savings')
  const { upsertMutation, deleteMutation } = useAssets<BankSaving>('bank_savings')
  const [editRow, setEditRow] = useState<Partial<BankSaving> | null>(null)

  const { data: fx } = useFxRates()
  const usdInr = fx?.usdInr ?? 84
  const gbpInr = fx?.gbpInr ?? (fx?.gbpUsd ?? 1.27) * usdInr

  // Actual invested total — same cache key as panel so invalidation updates both
  const { data: _actRows = [] } = useQuery<{ gbp_amount: number; inr_rate: number }[]>({
    queryKey: ['bank_savings_actual_invested_totals', userId],
    queryFn: async () => {
      const { data } = await supabase.from('bank_savings_actual_invested').select('gbp_amount,inr_rate').eq('user_id', userId)
      return (data ?? []) as { gbp_amount: number; inr_rate: number }[]
    },
    enabled: !!userId,
  })
  const actGbp = useMemo(() => _actRows.reduce((s, e) => s + Number(e.gbp_amount), 0), [_actRows])
  const actInr = useMemo(() => _actRows.reduce((s, e) => s + Number(e.gbp_amount) * Number(e.inr_rate), 0), [_actRows])

  const totalGbp = useMemo(() => rows.reduce((s, r) => s + Number(r.amount_gbp), 0), [rows])
  const totalInr = useMemo(() => rows.reduce((s, r) => s + Number(r.amount_gbp) * gbpInr, 0), [rows, gbpInr])

  const handleSave = async (d: Partial<BankSaving>) => {
    try {
      await upsertMutation.mutateAsync({ ...d, user_id: userId } as Record<string, unknown>)
      toast('Saved ✅', 'success'); setEditRow(null)
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const upcoming = useMemo(() =>
    rows.filter(r => { const d = daysUntil(r.maturity_date); return d !== null && d >= 0 && d <= 90 })
  , [rows])

  const handleBulkSave = async (changes: { id: string; [key: string]: unknown }[]) => {
    try {
      await Promise.all(changes.map(change => {
        const existing = rows.find(r => r.id === change.id)
        if (!existing) return Promise.resolve()
        const amount_gbp    = typeof change.amount_gbp    === 'number' ? change.amount_gbp    : existing.amount_gbp
        const interest_rate = typeof change.interest_rate === 'number' ? change.interest_rate : existing.interest_rate
        return upsertMutation.mutateAsync({ ...existing, amount_gbp, interest_rate, user_id: userId } as Record<string, unknown>)
      }))
      toast(`Updated ${changes.length} account${changes.length !== 1 ? 's' : ''} ✅`, 'success')
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const cols = [
    {
      key: 'platform',
      mobilePrimary: true, header: 'Account',
      render: (r: BankSaving) => (
        <div>
          <div className="font-bold text-textprim">{r.platform}</div>
          {r.account_number && <div className="text-[10px] text-textmut font-mono">••••{r.account_number}</div>}
        </div>
      ),
    },
    {
      key: 'account_type',
      hideOnMobile: true, header: 'Type',
      render: (r: BankSaving) => (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TYPE_COLORS[r.account_type] ?? 'bg-textmut/10 text-textmut'}`}>
          {r.account_type}
        </span>
      ),
    },
    {
      key: 'amount_gbp',
      mobileValue: true, header: 'Amount (£)',
      editable:   true,
      editValue:  (r: BankSaving) => Number(r.amount_gbp).toFixed(2),
      editStep:   '0.01',
      editPrefix:  '£',
      align: 'right' as const,
      render: (r: BankSaving) => (
        <span className="font-bold">£{Number(r.amount_gbp).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      ),
    },
    {
      key: 'amount_inr',
      hideOnMobile: true, header: 'Amount (₹)', align: 'right' as const,
      render: (r: BankSaving) => <span className="font-bold text-teal">{INR(Number(r.amount_gbp) * gbpInr)}</span>,
    },
    {
      key: 'interest_rate', header: 'Interest',
      editable:   true,
      editValue:  (r: BankSaving) => r.interest_rate ? Number(r.interest_rate).toFixed(2) : '',
      editStep:   '0.01',
      align: 'right' as const,
      render: (r: BankSaving) => r.interest_rate
        ? <span className="font-semibold text-green">{Number(r.interest_rate).toFixed(2)}%</span>
        : <span className="text-textmut">—</span>,
    },
    {
      key: 'maturity_date',
      hideOnMobile: true, header: 'Maturity', align: 'right' as const,
      render: (r: BankSaving) => <MaturityBadge dateStr={r.maturity_date} />,
    },
  ]

  return (
    <PageShell title="Bank Savings" subtitle={`${rows.length} account${rows.length !== 1 ? 's' : ''}`}
      actions={[
        { label: <RedeemGuide assetType="bank-savings" />, onClick: () => {}, variant: 'secondary' as const },
        { label: 'Add Account', onClick: () => setEditRow({}), variant: 'primary' }]}
    >
      {/* Upcoming maturities alert */}
      {upcoming.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber/30 bg-amber/5 px-4 py-3 flex items-center gap-3">
          <span className="text-amber text-lg">⏰</span>
          <div>
            <div className="text-sm font-semibold text-ink">
              {upcoming.length} account{upcoming.length > 1 ? 's' : ''} maturing within 90 days
            </div>
            <div className="text-xs text-textmut mt-0.5">
              {upcoming.map(r => `${r.platform} (${formatDate(r.maturity_date)})`).join(' · ')}
            </div>
          </div>
        </div>
      )}
      <AssetPageLayout
        stats={
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface rounded-2xl border border-border p-4">
              <div className="text-[10px] font-bold text-textmut uppercase tracking-widest mb-2">Holdings</div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-textmut">₹</span>
                <span className="text-sm font-extrabold font-mono text-teal">{INR(totalInr)}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-textmut">£</span>
                <span className="text-sm font-extrabold font-mono text-textprim">£{totalGbp.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="text-[10px] text-textmut mt-1.5">{rows.length} account{rows.length !== 1 ? 's' : ''} · @ ₹{gbpInr.toFixed(2)}/£</div>
            </div>
            <div className="bg-surface rounded-2xl border border-border p-4">
              <div className="text-[10px] font-bold text-textmut uppercase tracking-widest mb-2">Actual Invested</div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-textmut">₹</span>
                <span className="text-sm font-extrabold font-mono text-teal">{actInr > 0 ? INR(actInr) : '—'}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-textmut">£</span>
                <span className="text-sm font-extrabold font-mono text-textprim">{actGbp > 0 ? `£${actGbp.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</span>
              </div>
            </div>
          </div>
        }
        mainTable={
          <AssetTable columns={cols} data={rows} rowKey={r => r.id} loading={isLoading}
            emptyText="No bank accounts — click Add Account"
            onEditRow={r => setEditRow(r)}
            onDeleteRows={async ids => { for (const id of ids) await deleteMutation.mutateAsync(id); toast(`Deleted ${ids.length}`, 'success') }}
            onBulkSave={handleBulkSave}
          />
        }
        actualInvested={<BankActualPanel userId={userId} gbpInr={gbpInr} />}
      />
      {editRow !== null && <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleSave} />}
    </PageShell>
  )
}
