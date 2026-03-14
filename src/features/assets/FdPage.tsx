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
import { INR, formatDate, calcGain } from '../../lib/utils'
import type { FdAsset }        from '../../types/assets'

const CATEGORIES = [
  'Bank FD', 'Corporate FD', 'NBFC FD', 'Post Office TD',
  'Senior Citizen FD', 'Tax Saver FD', 'Flexi FD', 'Recurring Deposit', 'Other',
]

const CAT_COLORS: Record<string, string> = {
  'Bank FD':            'bg-blue/10 text-blue',
  'Corporate FD':       'bg-purple/10 text-purple',
  'NBFC FD':            'bg-cyan/10 text-cyan',
  'Post Office TD':     'bg-amber/10 text-amber',
  'Senior Citizen FD':  'bg-teal/10 text-teal',
  'Tax Saver FD':       'bg-green/10 text-green',
  'Flexi FD':           'bg-orange/10 text-orange',
  'Recurring Deposit':  'bg-pink/10 text-pink',
  'Other':              'bg-textmut/10 text-textmut',
}

// Days until maturity — returns null if no date, negative if past
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

function EditModal({ row, onClose, onSave }: {
  row: Partial<FdAsset>; onClose: () => void; onSave: (d: Partial<FdAsset>) => Promise<void>
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

  // Auto-calc maturity amount when rate + date filled
  const autoCalcMaturity = () => {
    const p = parseFloat(invested), r = parseFloat(rate)
    if (!p || !r || !invDate || !matDate) return
    const years = (new Date(matDate).getTime() - new Date(invDate).getTime()) / (365.25 * 86_400_000)
    if (years <= 0) return
    const amt = p * Math.pow(1 + r / 100, years)
    setMatAmt(amt.toFixed(2))
  }

  const handleSave = async () => {
    if (!category || !invested || +invested <= 0) return
    setSaving(true)
    await onSave({
      ...row,
      category,
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
    <Modal open onClose={onClose} title={row.id ? 'Edit FD' : 'Add Fixed Deposit'}
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={handleSave} loading={saving}>💾 Save</Button></>}
    >
      <div className="flex flex-col gap-4">
        {/* Category */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-textmut uppercase tracking-wide">Category *</label>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
          >
            <option value="">Select category…</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Platform + Account numbers */}
        <Input label="Bank / Institution" value={platform} onChange={e => setPlatform(e.target.value)}
          placeholder="e.g. SBI, HDFC, Bajaj Finance" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="FD Account No." value={acctNo} onChange={e => setAcctNo(e.target.value)}
            placeholder="Optional" />
          <Input label="SB Account No." value={sbAcctNo} onChange={e => setSbAcctNo(e.target.value)}
            placeholder="Linked savings a/c" />
        </div>

        {/* Investment */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Principal (₹) *" prefix="₹" type="number" step="0.01"
            value={invested} onChange={e => setInvested(e.target.value)} />
          <Input label="Invested Date" type="date"
            value={invDate} onChange={e => setInvDate(e.target.value)} />
        </div>

        {/* Rate + Maturity */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Interest Rate (%)" type="number" step="0.01"
            value={rate} onChange={e => setRate(e.target.value)}
            helpText="Annual rate" />
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
          placeholder="Nomination, auto-renewal, etc." />
      </div>
    </Modal>
  )
}

export default function FdPage() {
  const userId = useAuthStore(s => s.user?.id)!
  const toast  = useToastStore(s => s.show)
  const { data: rows = [], isLoading } = useAssets<FdAsset>('bank_fd_assets')
  const aiHook = useActualInvested('fd_actual_invested')
  const [editRow, setEditRow] = useState<Partial<FdAsset> | null>(null)
  const { upsertMutation, deleteMutation } = useAssets<FdAsset>('bank_fd_assets')

  const totalInvested  = useMemo(() => rows.reduce((s, r) => s + Number(r.invested), 0), [rows])
  const totalMaturity  = useMemo(() => rows.reduce((s, r) => s + Number(r.maturity_amount ?? r.invested), 0), [rows])
  const actual         = aiHook.data?.reduce((s, e) => s + e.amount, 0)
  const { gain, gainPct, isPositive } = calcGain(totalMaturity, totalInvested)

  // Upcoming maturities within 90 days
  const upcoming = useMemo(() => rows.filter(r => { const d = daysUntil(r.maturity_date); return d !== null && d >= 0 && d <= 90 }), [rows])

  const handleSave = async (d: Partial<FdAsset>) => {
    try {
      await upsertMutation.mutateAsync({ ...d, user_id: userId } as Record<string, unknown>)
      toast('Saved ✅', 'success'); setEditRow(null)
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const actualGainFd   = actual && actual > 0 ? calcGain(totalMaturity, actual) : null

  const handleBulkSave = async (changes: { id: string; [key: string]: unknown }[]) => {
    try {
      await Promise.all(changes.map(change => {
        const existing = rows.find(r => r.id === change.id)
        if (!existing) return Promise.resolve()
        const invested      = typeof change.invested      === 'number' ? change.invested      : existing.invested
        const interest_rate = typeof change.interest_rate === 'number' ? change.interest_rate : existing.interest_rate
        return upsertMutation.mutateAsync({ ...existing, invested, interest_rate, user_id: userId } as Record<string, unknown>)
      }))
      toast(`Updated ${changes.length} FD${changes.length !== 1 ? 's' : ''} ✅`, 'success')
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const stats = [
    { label: 'Principal',      value: INR(totalInvested), icon: '₹', accentColor: '#0891b2', loading: isLoading },
    { label: 'Maturity Value', value: INR(totalMaturity), icon: '◈', accentColor: '#0d9488', loading: isLoading },
    { label: 'Total Interest', value: `${isPositive?'+':''}${INR(gain)}`, sub: `${gainPct.toFixed(1)}%`, icon: isPositive?'▲':'▼', accentColor: isPositive?'#059669':'#dc2626', loading: isLoading },
    { label: 'Actual Invested', value: actual ? INR(actual) : '—', icon: '⊡', accentColor: '#d97706', loading: isLoading },
    { label: 'Actual Gain', value: actualGainFd ? `${actualGainFd.isPositive?'+':''}${INR(actualGainFd.gain)}` : '—', sub: actualGainFd ? `${actualGainFd.isPositive?'+':''}${actualGainFd.gainPct.toFixed(1)}%` : undefined, icon: actualGainFd?.isPositive ? '▲' : '▼', accentColor: actualGainFd?.isPositive ? '#059669' : '#dc2626', loading: isLoading },
  ]

  const cols = [
    {
      key: 'category', header: 'FD Details',
      render: (r: FdAsset) => (
        <div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CAT_COLORS[r.category] ?? 'bg-textmut/10 text-textmut'}`}>
            {r.category}
          </span>
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
      key: 'invested', header: 'Principal',
      editable:   true,
      editValue:  (r: FdAsset) => Number(r.invested).toFixed(2),
      editStep:   '0.01',
      editPrefix:  '₹',
      align: 'right' as const,
      render: (r: FdAsset) => (
        <div className="text-right">
          <div>{INR(r.invested)}</div>
          {r.invested_date && <div className="text-[10px] text-textmut">{formatDate(r.invested_date)}</div>}
        </div>
      ),
    },
    {
      key: 'interest_rate', header: 'Rate',
      editable:   true,
      editValue:  (r: FdAsset) => r.interest_rate ? Number(r.interest_rate).toFixed(2) : '',
      editStep:   '0.01',
      align: 'right' as const,
      render: (r: FdAsset) => r.interest_rate
        ? <span className="font-semibold text-teal">{r.interest_rate.toFixed(2)}%</span>
        : <span className="text-textmut">—</span>,
    },
    {
      key: 'maturity_date', header: 'Matures', align: 'right' as const,
      render: (r: FdAsset) => <MaturityBadge dateStr={r.maturity_date} />,
    },
    {
      key: 'maturity_amount', header: 'Maturity Amt', align: 'right' as const,
      render: (r: FdAsset) => (
        <div className="text-right">
          <div className="font-bold">{r.maturity_amount ? INR(r.maturity_amount) : '—'}</div>
          {r.maturity_amount && r.invested && (
            <div className="text-[10px] text-green">+{INR(Number(r.maturity_amount) - Number(r.invested))}</div>
          )}
        </div>
      ),
    },
    {
      key: 'notes', header: 'Notes',
      render: (r: FdAsset) => <span className="text-textmut text-xs">{r.notes || '—'}</span>,
    },
  ]

  return (
    <PageShell title="Fixed Deposits" subtitle={`${rows.length} FD${rows.length !== 1 ? 's' : ''} tracked`}
      actions={[{ label: 'Add FD', onClick: () => setEditRow({}), variant: 'primary' }]}
    >
      {/* Upcoming maturities alert */}
      {upcoming.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber/30 bg-amber/5 px-4 py-3 flex items-center gap-3">
          <span className="text-amber text-lg">⏰</span>
          <div>
            <div className="text-sm font-semibold text-ink">
              {upcoming.length} FD{upcoming.length > 1 ? 's' : ''} maturing within 90 days
            </div>
            <div className="text-xs text-textmut mt-0.5">
              {upcoming.map(r => `${r.platform ?? r.category} (${formatDate(r.maturity_date)})`).join(' · ')}
            </div>
          </div>
        </div>
      )}

      <AssetPageLayout
        stats={<StatGrid items={stats} cols={5} />}
        mainTable={
          <AssetTable columns={cols} data={rows} rowKey={r => r.id} loading={isLoading}
            emptyText="No FDs yet — click + Add FD"
            onEditRow={r => setEditRow(r)}
            onDeleteRows={async ids => { for (const id of ids) await deleteMutation.mutateAsync(id); toast(`Deleted ${ids.length}`, 'success') }}
            onBulkSave={handleBulkSave}
          />
        }
        actualInvested={<ActualInvestedPanel table="fd_actual_invested" />}
      />
      {editRow !== null && <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleSave} />}
    </PageShell>
  )
}
