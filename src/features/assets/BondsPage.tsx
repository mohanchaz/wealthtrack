import { useState, useMemo }  from 'react'
import { useAuthStore }       from '../../store/authStore'
import { useAssets }          from '../../hooks/useAssets'
import { useToastStore }      from '../../store/toastStore'
import { PageShell }          from '../../components/common/PageShell'
import { StatGrid }           from '../../components/common/StatGrid'
import { AssetTable }         from '../../components/common/AssetTable'
import { Modal }              from '../../components/ui/Modal'
import { Button }             from '../../components/ui/Button'
import { Input }              from '../../components/ui/Input'
import { INR, formatDate }    from '../../lib/utils'
import type { BondAsset }     from '../../types/assets'

// ── Constants ──────────────────────────────────────────────────
const BOND_TYPES = [
  'Government Bond', 'State Dev. Loan', 'Corporate Bond',
  'NCD', 'Tax-Free Bond', 'Sovereign Gold Bond',
  'RBI Floating Rate', 'Infrastructure Bond', 'Other',
]

const TYPE_COLORS: Record<string, string> = {
  'Government Bond':      'bg-blue/10 text-blue',
  'State Dev. Loan':      'bg-cyan/10 text-cyan',
  'Corporate Bond':       'bg-purple/10 text-purple',
  'NCD':                  'bg-orange/10 text-orange',
  'Tax-Free Bond':        'bg-green/10 text-green',
  'Sovereign Gold Bond':  'bg-amber/10 text-amber',
  'RBI Floating Rate':    'bg-teal/10 text-teal',
  'Infrastructure Bond':  'bg-indigo/10 text-indigo',
  'Other':                'bg-textmut/10 text-textmut',
}

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
  row: Partial<BondAsset>; onClose: () => void; onSave: (d: Partial<BondAsset>) => Promise<void>
}) {
  const [name,       setName]       = useState(row.name               ?? '')
  const [platform,   setPlatform]   = useState(row.platform           ?? '')
  const [isin,       setIsin]       = useState(row.isin               ?? '')
  const [bondId,     setBondId]     = useState(row.bond_id            ?? '')
  const [sbAcctNo,   setSbAcctNo]   = useState(row.sb_account_number  ?? '')
  const [invested,   setInvested]   = useState(String(row.invested    ?? ''))
  const [faceVal,    setFaceVal]    = useState(String(row.face_value  ?? ''))
  const [rate,       setRate]       = useState(String(row.interest_rate ?? ''))
  const [purchDate,  setPurchDate]  = useState(row.purchase_date      ?? '')
  const [matDate,    setMatDate]    = useState(row.maturity_date      ?? '')
  const [saving,     setSaving]     = useState(false)

  // Guess bond type from name for the category label
  const detectedType = BOND_TYPES.find(t => name.toLowerCase().includes(t.toLowerCase().split(' ')[0])) ?? ''
  const [bondType,   setBondType]   = useState(row.name ? detectedType : '')

  const handleSave = async () => {
    if (!name || !invested || +invested <= 0) return
    setSaving(true)
    // Store bond type as prefix in name if not already there, or keep as-is
    await onSave({
      ...row,
      name,
      platform:          platform  || undefined,
      isin:              isin      || undefined,
      bond_id:           bondId    || undefined,
      sb_account_number: sbAcctNo  || undefined,
      invested:          parseFloat(invested),
      face_value:        faceVal   ? parseFloat(faceVal) : undefined,
      interest_rate:     rate      ? parseFloat(rate)    : undefined,
      purchase_date:     purchDate || undefined,
      maturity_date:     matDate   || undefined,
    })
    setSaving(false)
  }

  return (
    <Modal open onClose={onClose} title={row.id ? 'Edit Bond' : 'Add Bond'}
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={handleSave} loading={saving}>💾 Save</Button></>}
    >
      <div className="flex flex-col gap-4">

        {/* Type + Name */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-textmut uppercase tracking-wide">Bond Type</label>
          <select value={bondType} onChange={e => setBondType(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
          >
            <option value="">Select type…</option>
            {BOND_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <Input label="Bond Name *" value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. GOI 7.5% 2030, HDFC NCD Series 5" />

        {/* Platform + SB account */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Platform / Broker" value={platform} onChange={e => setPlatform(e.target.value)}
            placeholder="e.g. Zerodha, HDFC Sec" />
          <Input label="SB Account No." value={sbAcctNo} onChange={e => setSbAcctNo(e.target.value)}
            placeholder="Linked savings a/c" />
        </div>

        {/* ISIN + Bond ID */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="ISIN" value={isin} onChange={e => setIsin(e.target.value.toUpperCase())}
            placeholder="e.g. IN0020230047" />
          <Input label="Bond ID / Folio" value={bondId} onChange={e => setBondId(e.target.value)}
            placeholder="Optional" />
        </div>

        {/* Invested + Face value */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Invested (₹) *" prefix="₹" type="number" step="0.01"
            value={invested} onChange={e => setInvested(e.target.value)} />
          <Input label="Face Value (₹)" prefix="₹" type="number" step="0.01"
            value={faceVal} onChange={e => setFaceVal(e.target.value)}
            helpText="Per bond unit" />
        </div>

        {/* Rate + Dates */}
        <div className="grid grid-cols-3 gap-3">
          <Input label="Interest Rate (%)" type="number" step="0.01"
            value={rate} onChange={e => setRate(e.target.value)}
            helpText="Annual coupon %" />
          <Input label="Purchase Date" type="date"
            value={purchDate} onChange={e => setPurchDate(e.target.value)} />
          <Input label="Maturity Date" type="date"
            value={matDate} onChange={e => setMatDate(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}

// ── Page ───────────────────────────────────────────────────────
export default function BondsPage() {
  const userId = useAuthStore(s => s.user?.id)!
  const toast  = useToastStore(s => s.show)
  const { data: rows = [], isLoading } = useAssets<BondAsset>('bonds')
  const [editRow, setEditRow] = useState<Partial<BondAsset> | null>(null)
  const { upsertMutation, deleteMutation } = useAssets<BondAsset>('bonds')

  const totalInvested   = useMemo(() => rows.reduce((s, r) => s + Number(r.invested),             0), [rows])
  const totalFaceValue  = useMemo(() => rows.reduce((s, r) => s + Number(r.face_value ?? r.invested), 0), [rows])
  const totalAnnualInt  = useMemo(() => rows.reduce((s, r) => {
    if (!r.interest_rate) return s
    return s + (Number(r.invested) * Number(r.interest_rate) / 100)
  }, 0), [rows])

  // Upcoming maturities within 90 days
  const upcoming = useMemo(() =>
    rows.filter(r => { const d = daysUntil(r.maturity_date); return d !== null && d >= 0 && d <= 90 }),
  [rows])

  // Detect bond type from name for badge display
  const getBondType = (name: string) =>
    BOND_TYPES.find(t => name.toLowerCase().includes(t.toLowerCase().split(' ')[0])) ?? null

  const handleSave = async (d: Partial<BondAsset>) => {
    try {
      await upsertMutation.mutateAsync({ ...d, user_id: userId } as Record<string, unknown>)
      toast('Saved ✅', 'success'); setEditRow(null)
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const stats = [
    { label: 'Invested',       value: INR(totalInvested),  icon: '₹', accentColor: '#0891b2', loading: isLoading },
    { label: 'Face Value',     value: INR(totalFaceValue), icon: '◈', accentColor: '#0d9488', loading: isLoading },
    { label: 'Annual Interest', value: totalAnnualInt > 0 ? INR(totalAnnualInt) : '—', icon: '⊡', accentColor: '#059669', loading: isLoading },
  ]

  const cols = [
    {
      key: 'name', header: 'Bond',
      render: (r: BondAsset) => {
        const type = getBondType(r.name)
        return (
          <div>
            {type && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TYPE_COLORS[type] ?? 'bg-textmut/10 text-textmut'}`}>
                {type}
              </span>
            )}
            <div className="text-xs font-semibold text-ink mt-0.5">{r.name}</div>
            {r.platform && <div className="text-[10px] text-textmut">{r.platform}</div>}
            {(r.isin || r.bond_id) && (
              <div className="text-[10px] text-textmut font-mono flex flex-col gap-0.5 mt-0.5">
                {r.isin    && <span><span className="text-[9px] font-bold uppercase tracking-wide not-italic">ISIN   </span>{r.isin}</span>}
                {r.bond_id && <span><span className="text-[9px] font-bold uppercase tracking-wide not-italic">ID     </span>{r.bond_id}</span>}
                {r.sb_account_number && <span><span className="text-[9px] font-bold uppercase tracking-wide not-italic">SB     </span>{r.sb_account_number}</span>}
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'invested', header: 'Invested', align: 'right' as const,
      render: (r: BondAsset) => (
        <div className="text-right">
          <div>{INR(r.invested)}</div>
          {r.purchase_date && <div className="text-[10px] text-textmut">{formatDate(r.purchase_date)}</div>}
        </div>
      ),
    },
    {
      key: 'face_value', header: 'Face Value', align: 'right' as const,
      render: (r: BondAsset) => r.face_value
        ? <span className="font-semibold">{INR(r.face_value)}</span>
        : <span className="text-textmut">—</span>,
    },
    {
      key: 'interest_rate', header: 'Coupon', align: 'right' as const,
      render: (r: BondAsset) => r.interest_rate
        ? (
          <div className="text-right">
            <span className="font-semibold text-teal">{Number(r.interest_rate).toFixed(2)}%</span>
            {r.invested && <div className="text-[10px] text-textmut">{INR(Number(r.invested) * Number(r.interest_rate) / 100)}/yr</div>}
          </div>
        )
        : <span className="text-textmut">—</span>,
    },
    {
      key: 'maturity_date', header: 'Matures', align: 'right' as const,
      render: (r: BondAsset) => <MaturityBadge dateStr={r.maturity_date} />,
    },
  ]

  return (
    <PageShell title="Bonds & NCDs" subtitle={`${rows.length} bond${rows.length !== 1 ? 's' : ''}`}
      actions={[{ label: '+ Add Bond', onClick: () => setEditRow({}), variant: 'primary' }]}
    >
      {/* Upcoming maturities alert */}
      {upcoming.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber/30 bg-amber/5 px-4 py-3 flex items-center gap-3">
          <span className="text-amber text-lg">⏰</span>
          <div>
            <div className="text-sm font-semibold text-ink">
              {upcoming.length} bond{upcoming.length > 1 ? 's' : ''} maturing within 90 days
            </div>
            <div className="text-xs text-textmut mt-0.5">
              {upcoming.map(r => `${r.name} (${formatDate(r.maturity_date)})`).join(' · ')}
            </div>
          </div>
        </div>
      )}

      <StatGrid items={stats} cols={3} />
      <div className="card overflow-hidden mt-4">
        <AssetTable columns={cols} data={rows} rowKey={r => r.id} loading={isLoading}
          emptyText="No bonds — click + Add Bond"
          onEditRow={r => setEditRow(r)}
          onDeleteRows={async ids => { for (const id of ids) await deleteMutation.mutateAsync(id); toast(`Deleted ${ids.length}`, 'success') }}
        />
      </div>
      {editRow !== null && <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleSave} />}
    </PageShell>
  )
}
