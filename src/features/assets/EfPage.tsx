import { useState, useMemo }   from 'react'
import { useAuthStore }        from '../../store/authStore'
import { useAssets }           from '../../hooks/useAssets'
import { useActualInvested }   from '../../hooks/useActualInvested'
import { useToastStore }       from '../../store/toastStore'
import { AssetPageLayout }     from '../../components/common/AssetPageLayout'
import { PageShell }           from '../../components/common/PageShell'
import { StatGrid }            from '../../components/common/StatGrid'
import { AssetTable }          from '../../components/common/AssetTable'
import { ActualInvestedPanel } from '../../components/common/ActualInvestedPanel'
import { Modal }               from '../../components/ui/Modal'
import { Button }              from '../../components/ui/Button'
import { Input }               from '../../components/ui/Input'
import { INR, formatDate }     from '../../lib/utils'
import type { EfAsset }        from '../../types/assets'

// ── Constants ──────────────────────────────────────────────────
const CATEGORIES = [
  'Savings Account', 'Liquid Fund', 'Overnight Fund', 'Arbitrage Fund',
  'Sweep FD', 'Fixed Deposit', 'Money Market Fund', 'Cash', 'Other',
]

const CAT_COLORS: Record<string, string> = {
  'Savings Account':  'bg-teal/10 text-teal',
  'Liquid Fund':      'bg-blue/10 text-blue',
  'Overnight Fund':   'bg-cyan/10 text-cyan',
  'Arbitrage Fund':   'bg-purple/10 text-purple',
  'Sweep FD':         'bg-amber/10 text-amber',
  'Fixed Deposit':    'bg-orange/10 text-orange',
  'Money Market Fund':'bg-green/10 text-green',
  'Cash':             'bg-ink/10 text-ink',
  'Other':            'bg-textmut/10 text-textmut',
}

// Recommended monthly expenses to estimate coverage
const MONTHS_TARGET = 6

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
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
  return (
    <div className="text-right">
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue/10 text-blue">{formatDate(dateStr)}</span>
    </div>
  )
}

// ── Edit Modal ─────────────────────────────────────────────────
function EditModal({ row, onClose, onSave }: {
  row: Partial<EfAsset>; onClose: () => void; onSave: (d: Partial<EfAsset>) => Promise<void>
}) {
  const [category,        setCategory]        = useState(row.category          ?? '')
  const [platform,        setPlatform]        = useState(row.platform          ?? '')
  const [acctNo,          setAcctNo]          = useState(row.account_number    ?? '')
  const [sbAcctNo,        setSbAcctNo]        = useState(row.sb_account_number ?? '')
  const [invested,        setInvested]        = useState(String(row.invested       ?? ''))
  const [invDate,         setInvDate]         = useState(row.invested_date     ?? '')
  const [rate,            setRate]            = useState(String(row.interest_rate   ?? ''))
  const [matDate,         setMatDate]         = useState(row.maturity_date     ?? '')
  const [matAmt,          setMatAmt]          = useState(String(row.maturity_amount ?? ''))
  const [notes,           setNotes]           = useState(row.notes             ?? '')
  const [saving,          setSaving]          = useState(false)

  const autoCalcMaturity = () => {
    const p = parseFloat(invested), r = parseFloat(rate)
    if (!p || !r || !invDate || !matDate) return
    const years = (new Date(matDate).getTime() - new Date(invDate).getTime()) / (365.25 * 86_400_000)
    if (years <= 0) return
    setMatAmt((p * Math.pow(1 + r / 100, years)).toFixed(2))
  }

  const handleSave = async () => {
    if (!invested || +invested < 0) return
    setSaving(true)
    await onSave({
      ...row,
      category:          category   || undefined,
      platform:          platform   || undefined,
      account_number:    acctNo     || undefined,
      sb_account_number: sbAcctNo   || undefined,
      invested:          parseFloat(invested),
      invested_date:     invDate    || undefined,
      interest_rate:     rate       ? parseFloat(rate)   : undefined,
      maturity_date:     matDate    || undefined,
      maturity_amount:   matAmt     ? parseFloat(matAmt) : undefined,
      notes:             notes      || undefined,
    })
    setSaving(false)
  }

  return (
    <Modal open onClose={onClose} title={row.id ? 'Edit Entry' : 'Add Emergency Fund Entry'}
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={handleSave} loading={saving}>💾 Save</Button></>}
    >
      <div className="flex flex-col gap-4">
        {/* Category */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-textmut uppercase tracking-wide">Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
          >
            <option value="">Select category…</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Platform + account numbers */}
        <Input label="Bank / Platform" value={platform} onChange={e => setPlatform(e.target.value)}
          placeholder="e.g. HDFC Bank, Zerodha, Paytm" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Account Number" value={acctNo} onChange={e => setAcctNo(e.target.value)}
            placeholder="Optional" />
          <Input label="SB Account Number" value={sbAcctNo} onChange={e => setSbAcctNo(e.target.value)}
            placeholder="Linked savings a/c" />
        </div>

        {/* Amount + date */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Amount (₹) *" prefix="₹" type="number" step="0.01"
            value={invested} onChange={e => setInvested(e.target.value)} />
          <Input label="Invested Date" type="date"
            value={invDate} onChange={e => setInvDate(e.target.value)} />
        </div>

        {/* Rate + maturity */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Interest Rate (%)" type="number" step="0.01"
            value={rate} onChange={e => setRate(e.target.value)}
            helpText="If applicable (FD, sweep)" />
          <Input label="Maturity Date" type="date"
            value={matDate} onChange={e => setMatDate(e.target.value)} />
        </div>

        {/* Maturity amount with auto-calc */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input label="Maturity Amount (₹)" prefix="₹" type="number" step="0.01"
              value={matAmt} onChange={e => setMatAmt(e.target.value)} />
          </div>
          <Button variant="secondary" size="sm" onClick={autoCalcMaturity}
            className="mb-0.5 whitespace-nowrap">⚡ Auto-calc</Button>
        </div>

        {/* Notes */}
        <Input label="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="e.g. Sweep to FD above ₹1L, auto-renewal" />
      </div>
    </Modal>
  )
}

// ── Page ───────────────────────────────────────────────────────
export default function EfPage() {
  const userId = useAuthStore(s => s.user?.id)!
  const toast  = useToastStore(s => s.show)
  const { data: rows = [], isLoading } = useAssets<EfAsset>('emergency_funds')
  const aiHook = useActualInvested('ef_actual_invested')
  const [editRow, setEditRow] = useState<Partial<EfAsset> | null>(null)
  const { upsertMutation, deleteMutation } = useAssets<EfAsset>('emergency_funds')

  const totalInvested = useMemo(() => rows.reduce((s, r) => s + Number(r.invested),                     0), [rows])
  const totalMaturity = useMemo(() => rows.reduce((s, r) => s + Number(r.maturity_amount ?? r.invested), 0), [rows])
  const actual        = aiHook.data?.reduce((s, e) => s + e.amount, 0)
  const totalInterest = totalMaturity - totalInvested

  // Coverage: total ef / (actual / 6 months) — shows how many months are covered
  const monthlyExpense = actual ? actual / MONTHS_TARGET : null
  const coverageMonths = monthlyExpense && monthlyExpense > 0
    ? (totalInvested / monthlyExpense).toFixed(1)
    : null

  // Upcoming maturities within 90 days
  const upcoming = useMemo(() =>
    rows.filter(r => { const d = daysUntil(r.maturity_date); return d !== null && d >= 0 && d <= 90 }),
  [rows])

  const handleSave = async (d: Partial<EfAsset>) => {
    try {
      await upsertMutation.mutateAsync({ ...d, user_id: userId } as Record<string, unknown>)
      toast('Saved ✅', 'success'); setEditRow(null)
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const stats = [
    { label: 'Total Amount',    value: INR(totalInvested), icon: '₹',  accentColor: '#0891b2', loading: isLoading },
    { label: 'With Interest',   value: INR(totalMaturity), icon: '◈',  accentColor: '#0d9488', loading: isLoading },
    { label: 'Total Interest',  value: totalInterest > 0 ? `+${INR(totalInterest)}` : INR(totalInterest), icon: '▲', accentColor: '#059669', loading: isLoading },
    { label: 'Actual Invested', value: actual ? INR(actual) : '—',     icon: '⊡', accentColor: '#d97706', loading: isLoading },
  ]

  const cols = [
    {
      key: 'category', header: 'Account / Platform',
      render: (r: EfAsset) => (
        <div>
          {r.category
            ? <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CAT_COLORS[r.category] ?? 'bg-textmut/10 text-textmut'}`}>{r.category}</span>
            : null}
          {r.platform && <div className="text-xs font-semibold text-ink mt-0.5">{r.platform}</div>}
          {(r.account_number || r.sb_account_number) && (
            <div className="text-[10px] text-textmut mt-0.5 font-mono flex flex-col gap-0.5">
              {r.account_number    && <span><span className="text-[9px] font-bold uppercase tracking-wide not-italic">A/C </span>{r.account_number}</span>}
              {r.sb_account_number && <span><span className="text-[9px] font-bold uppercase tracking-wide not-italic">SB&nbsp; </span>{r.sb_account_number}</span>}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'invested', header: 'Amount', align: 'right' as const,
      render: (r: EfAsset) => (
        <div className="text-right">
          <div>{INR(r.invested)}</div>
          {r.invested_date && <div className="text-[10px] text-textmut">{formatDate(r.invested_date)}</div>}
        </div>
      ),
    },
    {
      key: 'interest_rate', header: 'Rate', align: 'right' as const,
      render: (r: EfAsset) => r.interest_rate
        ? <span className="font-semibold text-teal">{r.interest_rate.toFixed(2)}%</span>
        : <span className="text-textmut">—</span>,
    },
    {
      key: 'maturity_date', header: 'Matures', align: 'right' as const,
      render: (r: EfAsset) => <MaturityBadge dateStr={r.maturity_date} />,
    },
    {
      key: 'maturity_amount', header: 'Maturity Amt', align: 'right' as const,
      render: (r: EfAsset) => (
        <div className="text-right">
          <div className="font-bold">{r.maturity_amount ? INR(r.maturity_amount) : '—'}</div>
          {r.maturity_amount && Number(r.maturity_amount) > Number(r.invested) && (
            <div className="text-[10px] text-green">+{INR(Number(r.maturity_amount) - Number(r.invested))}</div>
          )}
        </div>
      ),
    },
    {
      key: 'notes', header: 'Notes',
      render: (r: EfAsset) => <span className="text-textmut text-xs">{r.notes || '—'}</span>,
    },
  ]

  return (
    <PageShell title="Emergency Fund" subtitle={`${rows.length} entr${rows.length !== 1 ? 'ies' : 'y'}`}
      actions={[{ label: 'Add Entry', onClick: () => setEditRow({}), variant: 'primary' }]}
    >
      {/* Coverage banner */}
      {coverageMonths !== null && (
        <div className={`mb-4 rounded-xl border px-4 py-3 flex items-center gap-3 ${
          Number(coverageMonths) >= MONTHS_TARGET
            ? 'border-green/30 bg-green/5'
            : 'border-amber/30 bg-amber/5'
        }`}>
          <span className="text-lg">{Number(coverageMonths) >= MONTHS_TARGET ? '🛡️' : '⚠️'}</span>
          <div>
            <div className="text-sm font-semibold text-ink">
              {coverageMonths} months of expenses covered
              {Number(coverageMonths) >= MONTHS_TARGET
                ? ' — target met ✓'
                : ` — target is ${MONTHS_TARGET} months`}
            </div>
            <div className="text-xs text-textmut mt-0.5">
              Based on ₹{(Number(actual) / MONTHS_TARGET).toLocaleString('en-IN', { maximumFractionDigits: 0 })} / month (from actual invested ÷ {MONTHS_TARGET})
            </div>
          </div>
        </div>
      )}

      {/* Upcoming maturities alert */}
      {upcoming.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber/30 bg-amber/5 px-4 py-3 flex items-center gap-3">
          <span className="text-amber text-lg">⏰</span>
          <div>
            <div className="text-sm font-semibold text-ink">
              {upcoming.length} entr{upcoming.length > 1 ? 'ies' : 'y'} maturing within 90 days
            </div>
            <div className="text-xs text-textmut mt-0.5">
              {upcoming.map(r => `${r.platform ?? r.category ?? 'Entry'} (${formatDate(r.maturity_date)})`).join(' · ')}
            </div>
          </div>
        </div>
      )}

      <AssetPageLayout
        stats={<StatGrid items={stats} cols={4} />}
        mainTable={
          <AssetTable columns={cols} data={rows} rowKey={r => r.id} loading={isLoading}
            emptyText="No emergency fund entries — click + Add Entry"
            onEditRow={r => setEditRow(r)}
            onDeleteRows={async ids => { for (const id of ids) await deleteMutation.mutateAsync(id); toast(`Deleted ${ids.length}`, 'success') }}
          />
        }
        actualInvested={<ActualInvestedPanel table="ef_actual_invested" />}
      />
      {editRow !== null && <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleSave} />}
    </PageShell>
  )
}
