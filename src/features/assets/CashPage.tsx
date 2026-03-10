import { useState, useMemo } from 'react'
import { useAuthStore }      from '../../store/authStore'
import { useAssets }         from '../../hooks/useAssets'
import { useToastStore }     from '../../store/toastStore'
import { PageShell }         from '../../components/common/PageShell'
import { StatGrid }          from '../../components/common/StatGrid'
import { AssetTable }        from '../../components/common/AssetTable'
import { Modal }             from '../../components/ui/Modal'
import { Button }            from '../../components/ui/Button'
import { Input }             from '../../components/ui/Input'
import { INR }               from '../../lib/utils'
import type { CashAsset }    from '../../types/assets'

const CATEGORIES = [
  'Savings Account','Current Account','Salary Account','Joint Account',
  'NRE Account','NRO Account','Wallet / UPI','Cash in Hand','Other',
]

const CAT_COLORS: Record<string, string> = {
  'Savings Account': 'bg-teal/10 text-teal',
  'Current Account': 'bg-cyan/10 text-cyan',
  'Salary Account':  'bg-blue/10 text-blue',
  'Joint Account':   'bg-purple/10 text-purple',
  'NRE Account':     'bg-amber/10 text-amber',
  'NRO Account':     'bg-orange/10 text-orange',
  'Wallet / UPI':    'bg-green/10 text-green',
  'Cash in Hand':    'bg-ink/10 text-ink',
  'Other':           'bg-textmut/10 text-textmut',
}

function EditModal({ row, onClose, onSave }: {
  row: Partial<CashAsset>; onClose: () => void; onSave: (d: Partial<CashAsset>) => Promise<void>
}) {
  const [category,        setCategory]        = useState(row.category          ?? '')
  const [platform,        setPlatform]        = useState(row.platform          ?? '')
  const [accountNumber,   setAccountNumber]   = useState(row.account_number    ?? '')
  const [sbAccountNumber, setSbAccountNumber] = useState(row.sb_account_number ?? '')
  const [invested,        setInvested]        = useState(String(row.invested      ?? ''))
  const [curVal,          setCurVal]          = useState(String(row.current_value ?? ''))
  const [notes,           setNotes]           = useState(row.notes              ?? '')
  const [saving,          setSaving]          = useState(false)

  const handleSave = async () => {
    if (!category || !invested || +invested < 0) return
    setSaving(true)
    await onSave({
      ...row,
      category,
      platform:          platform          || undefined,
      account_number:    accountNumber     || undefined,
      sb_account_number: sbAccountNumber   || undefined,
      invested:          parseFloat(invested),
      current_value:     curVal ? parseFloat(curVal) : parseFloat(invested),
      notes:             notes             || undefined,
    })
    setSaving(false)
  }

  return (
    <Modal open onClose={onClose} title={row.id ? 'Edit Cash Entry' : 'Add Cash Entry'}
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={handleSave} loading={saving}>💾 Save</Button></>}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-textmut uppercase tracking-wide">Category *</label>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
          >
            <option value="">Select category…</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <Input label="Bank / Platform" value={platform} onChange={e => setPlatform(e.target.value)}
          placeholder="e.g. HDFC Bank, Paytm, PhonePe" />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Account Number" value={accountNumber} onChange={e => setAccountNumber(e.target.value)}
            placeholder="Last 4 digits ok" />
          <Input label="SB Account Number" value={sbAccountNumber} onChange={e => setSbAccountNumber(e.target.value)}
            placeholder="Optional" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Deposited (₹) *" prefix="₹" type="number" step="0.01"
            value={invested} onChange={e => setInvested(e.target.value)} />
          <Input label="Current Balance (₹)" prefix="₹" type="number" step="0.01"
            value={curVal} onChange={e => setCurVal(e.target.value)}
            helpText="Leave blank = same as deposited" />
        </div>

        <Input label="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Any additional info" />
      </div>
    </Modal>
  )
}

export default function CashPage() {
  const userId = useAuthStore(s => s.user?.id)!
  const toast  = useToastStore(s => s.show)
  const { data: rows = [], isLoading } = useAssets<CashAsset>('cash_assets')
  const [editRow, setEditRow] = useState<Partial<CashAsset> | null>(null)
  const { upsertMutation, deleteMutation } = useAssets<CashAsset>('cash_assets')

  const totalInvested = useMemo(() => rows.reduce((s, r) => s + Number(r.invested),                    0), [rows])
  const totalValue    = useMemo(() => rows.reduce((s, r) => s + Number(r.current_value ?? r.invested), 0), [rows])
  const gain          = totalValue - totalInvested
  const isPositive    = gain >= 0

  const handleSave = async (d: Partial<CashAsset>) => {
    try {
      await upsertMutation.mutateAsync({ ...d, user_id: userId } as Record<string, unknown>)
      toast('Saved ✅', 'success'); setEditRow(null)
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const stats = [
    { label: 'Total Deposited', value: INR(totalInvested), icon: '₹', accentColor: '#0891b2', loading: isLoading },
    { label: 'Current Balance', value: INR(totalValue),    icon: '◈', accentColor: '#0d9488', loading: isLoading },
    { label: 'Gain / Loss',     value: `${isPositive ? '+' : ''}${INR(gain)}`, icon: isPositive ? '▲' : '▼', accentColor: isPositive ? '#059669' : '#dc2626', loading: isLoading },
  ]

  const cols = [
    {
      key: 'category', header: 'Category / Account',
      render: (r: CashAsset) => (
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
    { key: 'invested',      header: 'Deposited', align: 'right' as const,
      render: (r: CashAsset) => INR(r.invested) },
    { key: 'current_value', header: 'Balance',   align: 'right' as const,
      render: (r: CashAsset) => {
        const val = Number(r.current_value ?? r.invested), inv = Number(r.invested)
        return <span className={`font-bold ${val >= inv ? 'text-green' : 'text-red'}`}>{INR(val)}</span>
      }},
    { key: 'gain', header: 'Gain / Loss', align: 'right' as const,
      render: (r: CashAsset) => {
        const g = Number(r.current_value ?? r.invested) - Number(r.invested)
        if (g === 0) return <span className="text-textmut text-xs">—</span>
        return <span className={`text-xs font-semibold ${g > 0 ? 'text-green' : 'text-red'}`}>{g > 0 ? '+' : ''}{INR(g)}</span>
      }},
    { key: 'notes', header: 'Notes',
      render: (r: CashAsset) => <span className="text-textmut text-xs">{r.notes || '—'}</span> },
  ]

  return (
    <PageShell title="Cash & Bank" subtitle={`${rows.length} entr${rows.length !== 1 ? 'ies' : 'y'}`}
      actions={[{ label: 'Add Entry', onClick: () => setEditRow({}), variant: 'primary' }]}
    >
      <StatGrid items={stats} cols={3} />
      <div className="card overflow-hidden">
        <AssetTable columns={cols} data={rows} rowKey={r => r.id} loading={isLoading}
          emptyText="No cash entries — click + Add Entry"
          onEditRow={r => setEditRow(r)}
          onDeleteRows={async ids => { for (const id of ids) await deleteMutation.mutateAsync(id); toast(`Deleted ${ids.length}`, 'success') }}
        />
      </div>
      {editRow !== null && <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleSave} />}
    </PageShell>
  )
}
