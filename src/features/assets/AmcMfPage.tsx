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

// ── Fund → BSE symbol map (same as MutualFundsPage) ──────────
const FUND_SYMBOL_MAP: Record<string, string> = {
  'aditya birla sun life large cap fund':          '0P0000XVWL.BO',
  'axis small cap fund':                           '0P00011MAX.BO',
  'groww elss tax saver fund':                     '0P0001BN7D.BO',
  'hdfc elss tax saver fund':                      '0P0000XW8Z.BO',
  'hdfc focused fund':                             '0P0000XW75.BO',
  'hdfc nifty 100 index fund':                     '0P0001OF02.BO',
  'icici prudential dividend yield equity fund':   '0P000134CI.BO',
  'icici prudential nifty midcap 150 index fund':  '0P0001NYM0.BO',
  'kotak elss tax saver fund':                     '0P0000XV6Q.BO',
  'motilal oswal midcap fund':                     '0P00012ALS.BO',
  'nippon india elss tax saver fund':              '0P00015E14.BO',
  'nippon india growth mid cap fund':              '0P0000XVDP.BO',
  'nippon india large cap fund':                   '0P0000XVG6.BO',
  'nippon india nifty midcap 150 index fund':      '0P0001LMCS.BO',
  'nippon india nifty smallcap 250 index fund':    '0P0001KR2R.BO',
  'nippon india power & infra fund':               '0P0000XVD7.BO',
  'nippon india small cap fund':                   '0P0000XVFY.BO',
  'quant elss tax saver fund':                     '0P0000XW51.BO',
  'quant flexi cap fund':                          '0P0001BA3U.BO',
  'sbi contra fund':                               '0P0000XVJR.BO',
  'sundaram elss tax saver fund':                  '0P0001BLNN.BO',
  'sundaram large cap fund':                       '0P0001KN71.BO',
  'tata elss fund':                                '0P00014GLS.BO',
  'tata large & mid cap fund':                     '0P0000XVOJ.BO',
  'tata nifty 50 index fund':                      '0P0000XVOZ.BO',
  'mirae asset large cap fund':                    '0P0000XW1G.BO',
  'mirae asset emerging bluechip fund':            '0P00012ALQ.BO',
  'parag parikh flexi cap fund':                   '0P0000YQ3S.BO',
  'dsp small cap fund':                            '0P0000XV4L.BO',
  'franklin india smaller companies fund':         '0P0000XVK6.BO',
  'uti nifty 50 index fund':                       '0P0000XVTB.BO',
}

function lookupSymbol(name: string): string | null {
  const key = name.trim().toLowerCase()
  if (FUND_SYMBOL_MAP[key]) return FUND_SYMBOL_MAP[key]
  for (const [mapKey, sym] of Object.entries(FUND_SYMBOL_MAP)) {
    if (key.includes(mapKey) || mapKey.includes(key)) return sym
  }
  return null
}

// ── Edit Modal ─────────────────────────────────────────────────
function EditModal({ row, onClose, onSave }: {
  row: Partial<AmcMfHolding>; onClose: () => void; onSave: (d: Partial<AmcMfHolding>) => Promise<void>
}) {
  const [fundName,  setFundName]  = useState(row.platform     ?? '')
  const [qty,       setQty]       = useState(String(row.qty   ?? ''))
  const [avg,       setAvg]       = useState(String(row.avg_cost ?? ''))
  const [navSymbol, setNavSymbol] = useState(row.nav_symbol   ?? '')
  const [folio,     setFolio]     = useState(row.folio_number ?? '')
  const [saving,    setSaving]    = useState(false)

  const handleFundNameBlur = () => {
    if (!navSymbol) {
      const sym = lookupSymbol(fundName)
      if (sym) setNavSymbol(sym)
    }
  }

  const handleSave = async () => {
    if (!fundName || !qty || !avg) return
    setSaving(true)
    await onSave({
      ...row,
      platform:      fundName,
      qty:           parseFloat(qty),
      avg_cost:      parseFloat(avg),
      nav_symbol:    navSymbol.trim() || undefined,
      folio_number:  folio.trim()     || undefined,
    })
    setSaving(false)
  }

  const autoSym = lookupSymbol(fundName)

  return (
    <Modal open onClose={onClose} title={row.id ? 'Edit Fund' : 'Add AMC MF'}
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={handleSave} loading={saving}>💾 Save</Button></>}
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Fund Name *"
          value={fundName}
          onChange={e => setFundName(e.target.value)}
          onBlur={handleFundNameBlur}
          placeholder="e.g. Mirae Asset Large Cap Fund"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Units *" type="number" step="0.001"
            value={qty} onChange={e => setQty(e.target.value)} />
          <Input label="Avg NAV (₹) *" prefix="₹" type="number" step="0.01"
            value={avg} onChange={e => setAvg(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="NAV Symbol (BSE)"
            value={navSymbol}
            onChange={e => setNavSymbol(e.target.value)}
            placeholder={autoSym ?? 'e.g. 0P0000XW1G.BO'}
            helpText={autoSym && !navSymbol ? `Auto: ${autoSym}` : 'For live NAV'}
          />
          <Input label="Folio Number" value={folio}
            onChange={e => setFolio(e.target.value)}
            placeholder="Optional" />
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

  // Live NAV
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
      await upsertMutation.mutateAsync({ ...d, prev_qty, user_id: userId } as Record<string, unknown>)
      toast('Saved ✅', 'success'); setEditRow(null)
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const stats = [
    { label: 'Invested',      value: INR(totalInvested), icon: '₹', accentColor: '#0891b2', loading: isLoading },
    { label: 'Current Value', value: INR(totalValue),    icon: '◈', accentColor: '#0d9488', loading: isLoading, sub: liveLabel },
    { label: 'Gain / Loss',   value: `${isPositive ? '+' : ''}${INR(gain)}`, sub: `${gainPct.toFixed(1)}%`, icon: isPositive ? '▲' : '▼', accentColor: isPositive ? '#059669' : '#dc2626', loading: isLoading },
    { label: 'Actual Invested', value: actual ? INR(actual) : '—', icon: '⊡', accentColor: '#d97706', loading: isLoading },
  ]

  const cols = [
    {
      key: 'platform', header: 'Fund',
      render: (r: AmcMfHolding) => (
        <div>
          <div className="font-semibold text-ink">{r.platform ?? '—'}</div>
          <div className="text-[10px] text-textmut font-mono mt-0.5 flex flex-col gap-0.5">
            {r.nav_symbol    && <span><span className="text-[9px] font-bold uppercase tracking-wide not-italic">NAV  </span>{r.nav_symbol}</span>}
            {r.folio_number  && <span><span className="text-[9px] font-bold uppercase tracking-wide not-italic">Folio </span>{r.folio_number}</span>}
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
