import { useState, useMemo }   from 'react'
import { useAuthStore }        from '../../store/authStore'
import { useAssets }           from '../../hooks/useAssets'
import { useActualInvested }   from '../../hooks/useActualInvested'
import { useToastStore }       from '../../store/toastStore'
import { useYahooPrices }      from '../../hooks/useLivePrices'
import { AssetPageLayout }     from '../../components/common/AssetPageLayout'
import { PageShell }           from '../../components/common/PageShell'
import { StatGrid }            from '../../components/common/StatGrid'
import { AssetTable }          from '../../components/common/AssetTable'
import { ActualInvestedPanel } from '../../components/common/ActualInvestedPanel'
import { Modal }               from '../../components/ui/Modal'
import { Button }              from '../../components/ui/Button'
import { Input }               from '../../components/ui/Input'
import { INR, calcGain }       from '../../lib/utils'
import type { AmcMfHolding }   from '../../types/assets'

const AMC_LIST = [
  'Aditya Birla Sun Life', 'Axis', 'Canara Robeco', 'DSP', 'Franklin Templeton',
  'Groww', 'HDFC', 'ICICI Prudential', 'Invesco', 'Kotak', 'LIC', 'Mirae Asset',
  'Motilal Oswal', 'Navi', 'Nippon India', 'Parag Parikh', 'Quant', 'SBI',
  'Sundaram', 'Tata', 'UTI', 'Zerodha', 'Other',
]

// ── Edit Modal ─────────────────────────────────────────────────
function EditModal({ row, name, onClose, onSave }: {
  row: Partial<AmcMfHolding>; name?: string | null; onClose: () => void; onSave: (d: Partial<AmcMfHolding>) => Promise<void>
}) {
  const [navSymbol, setNavSymbol] = useState(row.nav_symbol   ?? '')
  const [platform,  setPlatform]  = useState(row.platform     ?? '')
  const [qty,       setQty]       = useState(String(row.qty   ?? ''))
  const [avg,       setAvg]       = useState(String(row.avg_cost ?? ''))
  const [folio,     setFolio]     = useState(row.folio_number ?? '')
  const [saving,    setSaving]    = useState(false)

  // Live preview of fund name while typing ticker
  const [previewName, setPreviewName] = useState<string | null>(null)
  const [previewing,  setPreviewing]  = useState(false)

  const fetchPreview = async (sym: string) => {
    if (!sym || sym.length < 5) { setPreviewName(null); return }
    setPreviewing(true)
    try {
      const res = await fetch(`/api/prices?symbols=${encodeURIComponent(sym)}`)
      if (res.ok) {
        const map = await res.json() as Record<string, { price: number; name: string | null }>
        const key = sym.replace(/\.(BO|NS)$/, '')
        const entry = map[key] ?? map[sym]
        setPreviewName(entry?.name ?? null)
      }
    } catch { setPreviewName(null) }
    finally { setPreviewing(false) }
  }

  const handleSave = async () => {
    if (!navSymbol || !qty || !avg) return
    setSaving(true)
    await onSave({
      ...row,
      nav_symbol:   navSymbol.trim(),
      platform:     platform.trim() || undefined,
      qty:          parseFloat(qty),
      avg_cost:     parseFloat(avg),
      folio_number: folio.trim() || undefined,
    })
    setSaving(false)
  }

  return (
    <Modal open onClose={onClose} title={row.id ? 'Edit Fund' : 'Add AMC MF'}
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={handleSave} loading={saving}>💾 Save</Button></>}
    >
      <div className="flex flex-col gap-4">

        {/* Ticker input with live name preview */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-textmut uppercase tracking-wide">BSE Ticker *</label>
          {row.id ? (
            <>
              <div className="h-9 rounded-xl border border-border bg-surface2 text-sm text-textmut px-3 flex items-center font-mono select-none cursor-not-allowed">{navSymbol}</div>
              {name && <div className="text-xs text-textmut mt-0.5">{name}</div>}
            </>
          ) : (
            <div className="flex gap-2 items-center">
              <input
                className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20 font-mono"
                value={navSymbol}
                onChange={e => { setNavSymbol(e.target.value); setPreviewName(null) }}
                placeholder="e.g. 0P0000XVOZ.BO"
              />
              <Button variant="secondary" size="sm" onClick={() => fetchPreview(navSymbol)} loading={previewing}>
                🔍 Lookup
              </Button>
            </div>
          )}
          {/* Live name preview */}
          {previewName && (
            <div className="flex items-center gap-2 mt-1 px-3 py-2 rounded-lg bg-green/5 border border-green/20">
              <span className="text-green text-xs">✓</span>
              <span className="text-sm font-semibold text-ink">{previewName}</span>
            </div>
          )}
          {!row.id && previewName === null && navSymbol && !previewing && (
            <p className="text-[10px] text-textmut">Enter ticker then click 🔍 Lookup to verify fund name</p>
          )}
        </div>

        {/* AMC + folio */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-textmut uppercase tracking-wide">AMC Name</label>
            <select value={platform} onChange={e => setPlatform(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
            >
              <option value="">Select AMC…</option>
              {AMC_LIST.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <Input label="Folio Number" value={folio}
            onChange={e => setFolio(e.target.value)} placeholder="Optional" />
        </div>

        {/* Units + Avg NAV */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Units *" type="number" step="0.001"
            value={qty} onChange={e => setQty(e.target.value)} />
          <Input label="Avg NAV (₹) *" prefix="₹" type="number" step="0.01"
            value={avg} onChange={e => setAvg(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}

// ── Page ───────────────────────────────────────────────────────
export default function AmcMfPage() {
  const userId = useAuthStore(s => s.user?.id)!
  const toast  = useToastStore(s => s.show)
  const { data: rows = [], isLoading } = useAssets<AmcMfHolding>('amc_mf_holdings')
  const aiHook = useActualInvested('amc_mf_actual_invested')
  const [editRow, setEditRow] = useState<Partial<AmcMfHolding> | null>(null)
  const { upsertMutation, deleteMutation } = useAssets<AmcMfHolding>('amc_mf_holdings')

  // Live NAV + names via nav_symbol
  const symbols = useMemo(() =>
    [...new Set(rows.map(r => r.nav_symbol).filter(Boolean) as string[])],
  [rows])
  const { data: priceMap = {}, isFetching: pricesFetching, refetch } = useYahooPrices(symbols)

  const getPriceEntry = (r: AmcMfHolding) => {
    if (!r.nav_symbol) return null
    const key = r.nav_symbol.replace(/\.(BO|NS)$/, '')
    return priceMap[key] ?? priceMap[r.nav_symbol] ?? null
  }
  const getLTP  = (r: AmcMfHolding) => getPriceEntry(r)?.price ?? null
  const getName = (r: AmcMfHolding) => getPriceEntry(r)?.name  ?? null

  const totalInvested = useMemo(() => rows.reduce((s, r) => s + Number(r.qty) * Number(r.avg_cost), 0), [rows])
  const totalValue    = useMemo(() => rows.reduce((s, r) => {
    const ltp = getLTP(r)
    return s + (ltp != null ? Number(r.qty) * ltp : Number(r.qty) * Number(r.avg_cost))
  }, 0), [rows, priceMap])

  const actual = aiHook.data?.reduce((s, e) => s + e.amount, 0)
  const { gain, gainPct, isPositive } = calcGain(totalValue, totalInvested)
  const liveLabel = pricesFetching
    ? '🔄 Fetching…'
    : Object.keys(priceMap).length ? `🟢 Live · ${new Date().toLocaleTimeString('en-IN')}` : undefined

  const handleSave = async (d: Partial<AmcMfHolding>) => {
    try {
      const existing = rows.find(r => r.id === d.id)
      const prev_qty = existing ? existing.qty : d.qty
      try {
        await upsertMutation.mutateAsync({ ...d, prev_qty, user_id: userId } as Record<string, unknown>)
      } catch (e1) {
        if ((e1 as Error).message?.includes('prev_qty')) {
          await upsertMutation.mutateAsync({ ...d, user_id: userId } as Record<string, unknown>)
        } else { throw e1 }
      }
      toast('Saved ✅', 'success'); setEditRow(null)
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const stats = [
    { label: 'Invested',       value: INR(totalInvested), icon: '₹', accentColor: '#0891b2', loading: isLoading },
    { label: 'Current Value',  value: INR(totalValue),    icon: '◈', accentColor: '#0d9488', loading: isLoading, sub: liveLabel },
    { label: 'Gain / Loss',    value: `${isPositive ? '+' : ''}${INR(gain)}`, sub: `${gainPct.toFixed(1)}%`, icon: isPositive ? '▲' : '▼', accentColor: isPositive ? '#059669' : '#dc2626', loading: isLoading },
    { label: 'Actual Invested', value: actual ? INR(actual) : '—', icon: '⊡', accentColor: '#d97706', loading: isLoading },
  ]

  const cols = [
    {
      key: 'nav_symbol', header: 'Fund',
      render: (r: AmcMfHolding) => {
        const name = getName(r)
        return (
          <div>
            {/* Fund name from live API, loading state while fetching */}
            {pricesFetching && !name
              ? <div className="h-3 w-48 bg-border/50 rounded animate-pulse mb-1" />
              : name
                ? <div className="font-semibold text-ink text-sm">{name}</div>
                : <div className="font-semibold text-ink text-sm font-mono">{r.nav_symbol ?? '—'}</div>
            }
            <div className="text-[10px] text-textmut mt-0.5 flex flex-col gap-0.5 font-mono">
              {r.nav_symbol    && <span><span className="not-italic font-bold text-[9px] uppercase tracking-wide">Ticker </span>{r.nav_symbol}</span>}
              {r.platform      && <span><span className="not-italic font-bold text-[9px] uppercase tracking-wide">AMC    </span>{r.platform}</span>}
              {r.folio_number  && <span><span className="not-italic font-bold text-[9px] uppercase tracking-wide">Folio  </span>{r.folio_number}</span>}
            </div>
          </div>
        )
      },
    },
    {
      key: 'qty', header: 'Units', align: 'right' as const,
      render: (r: AmcMfHolding) => {
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
      key: 'avg_cost', header: 'Avg NAV', align: 'right' as const,
      render: (r: AmcMfHolding) => INR(r.avg_cost),
    },
    {
      key: 'ltp', header: 'Live NAV', align: 'right' as const,
      render: (r: AmcMfHolding) => {
        const ltp = getLTP(r)
        if (ltp == null) return <span className="text-textmut">—</span>
        const change = ltp - Number(r.avg_cost)
        return (
          <div className="text-right">
            <div className="font-bold">{INR(ltp)}</div>
            {change !== 0 && (
              <div className={`text-[10px] font-semibold ${change > 0 ? 'text-green' : 'text-red'}`}>
                {change > 0 ? '+' : ''}{INR(change)}
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'invested', header: 'Invested', align: 'right' as const,
      render: (r: AmcMfHolding) => INR(Number(r.qty) * Number(r.avg_cost)),
    },
    {
      key: 'value', header: 'Cur. Value', align: 'right' as const,
      render: (r: AmcMfHolding) => {
        const ltp = getLTP(r)
        const val = ltp != null ? Number(r.qty) * ltp : Number(r.qty) * Number(r.avg_cost)
        const inv = Number(r.qty) * Number(r.avg_cost)
        return <span className={`font-bold ${val >= inv ? 'text-green' : 'text-red'}`}>{INR(val)}</span>
      },
    },
    {
      key: 'gain', header: 'Gain / Loss', align: 'right' as const,
      render: (r: AmcMfHolding) => {
        const ltp = getLTP(r)
        const inv = Number(r.qty) * Number(r.avg_cost)
        const val = ltp != null ? Number(r.qty) * ltp : inv
        const { gain, gainPct, isPositive } = calcGain(val, inv)
        return (
          <span className={`font-bold ${isPositive ? 'text-green' : 'text-red'}`}>
            {isPositive ? '+' : ''}{INR(gain)}
            <br />
            <span className="text-[10px] font-medium opacity-80">{isPositive ? '+' : ''}{gainPct.toFixed(1)}%</span>
          </span>
        )
      },
    },
  ]

  return (
    <PageShell title="AMC Mutual Funds" subtitle={`${rows.length} fund${rows.length !== 1 ? 's' : ''}`}
      actions={[
        { label: '🔄', onClick: () => refetch(), variant: 'secondary' },
        { label: 'Add Fund', onClick: () => setEditRow({}), variant: 'primary' },
      ]}
    >
      <AssetPageLayout
        stats={<StatGrid items={stats} cols={4} />}
        mainTable={
          <AssetTable columns={cols} data={rows} rowKey={r => r.id} loading={isLoading}
            emptyText="No AMC MF holdings — click + Add Fund"
            onEditRow={r => setEditRow(r)}
            onDeleteRows={async ids => { for (const id of ids) await deleteMutation.mutateAsync(id); toast(`Deleted ${ids.length}`, 'success') }}
          />
        }
        actualInvested={<ActualInvestedPanel table="amc_mf_actual_invested" />}
      />
      {editRow !== null && <EditModal row={editRow} name={editRow.id ? getName(editRow as AmcMfHolding) : null} onClose={() => setEditRow(null)} onSave={handleSave} />}
    </PageShell>
  )
}
