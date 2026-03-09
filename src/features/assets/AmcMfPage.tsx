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

// ── Ticker → Fund name map  (symbol stored in DB, name derived at runtime) ──
const SYMBOL_TO_FUND: Record<string, string> = {
  '0P0000XVWL.BO': 'Aditya Birla Sun Life Large Cap Fund',
  '0P00011MAX.BO': 'Axis Small Cap Fund',
  '0P0001BN7D.BO': 'Groww ELSS Tax Saver Fund',
  '0P0000XW8Z.BO': 'HDFC ELSS Tax Saver Fund',
  '0P0000XW75.BO': 'HDFC Focused Fund',
  '0P0001OF02.BO': 'HDFC Nifty 100 Index Fund',
  '0P000134CI.BO': 'ICICI Prudential Dividend Yield Equity Fund',
  '0P0001NYM0.BO': 'ICICI Prudential Nifty Midcap 150 Index Fund',
  '0P0000XV6Q.BO': 'Kotak ELSS Tax Saver Fund',
  '0P00012ALS.BO': 'Motilal Oswal Midcap Fund',
  '0P00015E14.BO': 'Nippon India ELSS Tax Saver Fund',
  '0P0000XVDS.BO': 'Nippon India Gold Savings Fund',
  '0P0000XVDP.BO': 'Nippon India Growth Mid Cap Fund',
  '0P0000XVG6.BO': 'Nippon India Large Cap Fund',
  '0P0001LMCS.BO': 'Nippon India Nifty Midcap 150 Index Fund',
  '0P0001KR2R.BO': 'Nippon India Nifty Smallcap 250 Index Fund',
  '0P0000XVD7.BO': 'Nippon India Power & Infra Fund',
  '0P0000XVFY.BO': 'Nippon India Small Cap Fund',
  '0P0000XW51.BO': 'Quant ELSS Tax Saver Fund',
  '0P0001BA3U.BO': 'Quant Flexi Cap Fund',
  '0P0000XVJR.BO': 'SBI Contra Fund',
  '0P0001BLNN.BO': 'Sundaram ELSS Tax Saver Fund',
  '0P0001KN71.BO': 'Sundaram Large Cap Fund',
  '0P00014GLS.BO': 'Tata ELSS Fund',
  '0P0000XVOJ.BO': 'Tata Large & Mid Cap Fund',
  '0P0000XVOZ.BO': 'Tata Nifty 50 Index Fund',
  '0P0000XW1G.BO': 'Mirae Asset Large Cap Fund',
  '0P00012ALQ.BO': 'Mirae Asset Emerging Bluechip Fund',
  '0P0000YQ3S.BO': 'Parag Parikh Flexi Cap Fund',
  '0P0000XV4L.BO': 'DSP Small Cap Fund',
  '0P0000XVK6.BO': 'Franklin India Smaller Companies Fund',
  '0P0000XVTB.BO': 'UTI Nifty 50 Index Fund',
  '0P0001BFYH.BO': 'Canara Robeco Bluechip Equity Fund',
  '0P0001GBZ6.BO': 'Navi Nifty 50 Index Fund',
  '0P0001H0PK.BO': 'Zerodha Nifty Large Midcap 250 Index Fund',
}

// Fund name → ticker (for search in form)
const FUND_TO_SYMBOL = Object.fromEntries(
  Object.entries(SYMBOL_TO_FUND).map(([sym, name]) => [name.toLowerCase(), sym])
)

function getFundName(symbol?: string | null): string {
  if (!symbol) return '—'
  return SYMBOL_TO_FUND[symbol] ?? symbol  // fallback to raw symbol if not in map
}

// AMC list derived from fund names
const AMC_LIST = [
  'Aditya Birla Sun Life', 'Axis', 'Canara Robeco', 'DSP', 'Franklin Templeton',
  'Groww', 'HDFC', 'ICICI Prudential', 'Invesco', 'Kotak', 'LIC', 'Mirae Asset',
  'Motilal Oswal', 'Navi', 'Nippon India', 'Parag Parikh', 'Quant', 'SBI',
  'Sundaram', 'Tata', 'UTI', 'Zerodha', 'Other',
]

// ── Ticker Search Input ────────────────────────────────────────
function TickerSearch({ value, onChange }: { value: string; onChange: (sym: string) => void }) {
  const [query, setQuery] = useState(
    value ? (SYMBOL_TO_FUND[value] ?? value) : ''
  )
  const [open, setOpen] = useState(false)

  const results = useMemo(() => {
    if (query.length < 2) return []
    const q = query.toLowerCase()
    return Object.entries(SYMBOL_TO_FUND)
      .filter(([sym, name]) => name.toLowerCase().includes(q) || sym.toLowerCase().includes(q))
      .slice(0, 8)
  }, [query])

  const select = (sym: string, name: string) => {
    setQuery(name)
    onChange(sym)
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-1 relative">
      <label className="text-xs font-semibold text-textmut uppercase tracking-wide">Fund (search by name or ticker) *</label>
      <input
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange('') }}
        onFocus={() => setOpen(true)}
        placeholder="e.g. Tata Nifty 50, 0P0000XVOZ.BO"
      />
      {/* Selected ticker badge */}
      {value && SYMBOL_TO_FUND[value] && (
        <div className="text-[10px] text-textmut font-mono">{value}</div>
      )}
      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-surface shadow-lg max-h-56 overflow-y-auto">
          {results.map(([sym, name]) => (
            <button key={sym} type="button"
              className="w-full text-left px-3 py-2 hover:bg-bg text-sm flex flex-col gap-0.5 border-b border-border/50 last:border-0"
              onClick={() => select(sym, name)}
            >
              <span className="font-semibold text-ink">{name}</span>
              <span className="text-[10px] text-textmut font-mono">{sym}</span>
            </button>
          ))}
        </div>
      )}
      {/* Manual entry hint */}
      {open && results.length === 0 && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-surface shadow-lg px-3 py-2 text-xs text-textmut">
          Not in list — enter BSE ticker manually below
        </div>
      )}
    </div>
  )
}

// ── Edit Modal ─────────────────────────────────────────────────
function EditModal({ row, onClose, onSave }: {
  row: Partial<AmcMfHolding>; onClose: () => void; onSave: (d: Partial<AmcMfHolding>) => Promise<void>
}) {
  const [navSymbol, setNavSymbol] = useState(row.nav_symbol   ?? '')
  const [platform,  setPlatform]  = useState(row.platform     ?? '')
  const [qty,       setQty]       = useState(String(row.qty   ?? ''))
  const [avg,       setAvg]       = useState(String(row.avg_cost ?? ''))
  const [folio,     setFolio]     = useState(row.folio_number ?? '')
  const [saving,    setSaving]    = useState(false)

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

        {/* Ticker search */}
        <TickerSearch value={navSymbol} onChange={setNavSymbol} />

        {/* Manual ticker override */}
        <Input label="BSE Ticker (manual override)" value={navSymbol}
          onChange={e => setNavSymbol(e.target.value)}
          placeholder="e.g. 0P0000XVOZ.BO"
          helpText="Auto-filled from search above, or enter manually" />

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

  // Live NAV via nav_symbol
  const symbols = useMemo(() =>
    [...new Set(rows.map(r => r.nav_symbol).filter(Boolean) as string[])],
  [rows])
  const { data: priceMap = {}, isFetching: pricesFetching, refetch } = useYahooPrices(symbols)

  const getLTP = (r: AmcMfHolding) => {
    if (!r.nav_symbol) return null
    const key = r.nav_symbol.replace(/\.(BO|NS)$/, '')
    return priceMap[key]?.price ?? priceMap[r.nav_symbol]?.price ?? null
  }

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
      render: (r: AmcMfHolding) => (
        <div>
          <div className="font-semibold text-ink text-sm">{getFundName(r.nav_symbol)}</div>
          <div className="text-[10px] text-textmut mt-0.5 flex flex-col gap-0.5 font-mono">
            {r.nav_symbol   && <span><span className="not-italic font-bold text-[9px] uppercase tracking-wide">Ticker </span>{r.nav_symbol}</span>}
            {r.platform     && <span><span className="not-italic font-bold text-[9px] uppercase tracking-wide">AMC    </span>{r.platform}</span>}
            {r.folio_number && <span><span className="not-italic font-bold text-[9px] uppercase tracking-wide">Folio  </span>{r.folio_number}</span>}
          </div>
        </div>
      ),
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
        { label: '+ Add Fund', onClick: () => setEditRow({}), variant: 'primary' },
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
      {editRow !== null && <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleSave} />}
    </PageShell>
  )
}
