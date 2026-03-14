import { useState, useMemo } from 'react'
import { useQueryClient }    from '@tanstack/react-query'
import { useAuthStore }      from '../../store/authStore'
import { useAssets }         from '../../hooks/useAssets'
import { useActualInvested } from '../../hooks/useActualInvested'
import { useYahooPrices }    from '../../hooks/useLivePrices'
import { useToastStore }     from '../../store/toastStore'
import { AssetPageLayout }   from '../../components/common/AssetPageLayout'
import { PageShell }         from '../../components/common/PageShell'
import { StatGrid, buildInvestedStats } from '../../components/common/StatGrid'
import { AssetTable }        from '../../components/common/AssetTable'
import { ActualInvestedPanel } from '../../components/common/ActualInvestedPanel'
import { Modal }             from '../../components/ui/Modal'
import { Button }            from '../../components/ui/Button'
import { Input }             from '../../components/ui/Input'
import { INR, calcGain }     from '../../lib/utils'
import { parseCsvRows, cleanNum } from '../../lib/csvParser'
import type { MfHolding }    from '../../types/assets'

// ── Known fund name → BSE symbol map ─────────────────────────
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
  'nippon india gold savings fund':                '0P0000XVDS.BO',
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
}

function lookupSymbol(fundName: string): string | null {
  const key = fundName.trim().toLowerCase()
  // exact match
  if (FUND_SYMBOL_MAP[key]) return FUND_SYMBOL_MAP[key]
  // fuzzy: find any map key that is contained in the fund name or vice versa
  for (const [mapKey, sym] of Object.entries(FUND_SYMBOL_MAP)) {
    if (key.includes(mapKey) || mapKey.includes(key)) return sym
  }
  return null
}

// ── Edit modal ────────────────────────────────────────────────
function EditModal({ row, onClose, onSave }: {
  row:     Partial<MfHolding>
  onClose: () => void
  onSave:  (data: Partial<MfHolding>) => Promise<void>
}) {
  const [fundName,  setFundName]  = useState(row.fund_name  ?? '')
  const [qty,       setQty]       = useState(String(row.qty       ?? ''))
  const [avgCost,   setAvgCost]   = useState(String(row.avg_cost  ?? ''))
  const [navSymbol, setNavSymbol] = useState(row.nav_symbol ?? '')
  const [saving,    setSaving]    = useState(false)

  // Auto-fill nav_symbol when fund name is typed
  const handleFundNameBlur = () => {
    if (!navSymbol) {
      const sym = lookupSymbol(fundName)
      if (sym) setNavSymbol(sym)
    }
  }

  const handleSave = async () => {
    if (!fundName || !qty || !avgCost) return
    setSaving(true)
    const q = parseFloat(qty), a = parseFloat(avgCost)
    await onSave({
      ...row,
      fund_name:  fundName,
      qty:        q,
      avg_cost:   a,
      nav_symbol: navSymbol.trim() || undefined,
    })
    setSaving(false)
  }

  const autoSym = lookupSymbol(fundName)

  return (
    <Modal open onClose={onClose} title={row.id ? 'Edit Fund' : 'Add Fund'}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} loading={saving}>Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Fund Name"
          value={fundName}
          onChange={e => setFundName(e.target.value)}
          onBlur={handleFundNameBlur}
          placeholder="e.g. HDFC Focused Fund"
        />
        <Input label="Units" type="number" step="0.001" value={qty} onChange={e => setQty(e.target.value)} />
        <Input label="Avg NAV" prefix="₹" type="number" step="0.01" value={avgCost} onChange={e => setAvgCost(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <Input
            label="NAV Symbol (BSE)"
            value={navSymbol}
            onChange={e => setNavSymbol(e.target.value)}
            placeholder="e.g. 0P0000XW75.BO"
            helpText={autoSym && !navSymbol ? `Auto-detected: ${autoSym}` : 'BSE symbol for live NAV lookup'}
          />
          {autoSym && !navSymbol && (
            <button
              type="button"
              onClick={() => setNavSymbol(autoSym)}
              className="text-xs text-ink font-semibold underline underline-offset-2 text-left"
            >
              Use {autoSym}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function MutualFundsPage() {
  const userId = useAuthStore(s => s.user?.id)!
  const toast  = useToastStore(s => s.show)
  const qc     = useQueryClient()

  const { data: rows = [], isLoading } = useAssets<MfHolding>('mf_holdings')
  const aiHook = useActualInvested('mf_actual_invested')

  // Use nav_symbol column for live prices
  const symbols = useMemo(() =>
    [...new Set(rows.map(r => r.nav_symbol).filter(Boolean) as string[])],
    [rows]
  )
  const { data: priceMap = {}, isFetching: pricesFetching, refetch } = useYahooPrices(symbols)

  const [editRow,    setEditRow]    = useState<Partial<MfHolding> | null>(null)
  const { upsertMutation, deleteMutation } = useAssets<MfHolding>('mf_holdings')

  // Get live NAV for a row via nav_symbol
  const getLiveNAV = (r: MfHolding): number | null => {
    if (!r.nav_symbol) return null
    // Strip .BO/.NS suffix when looking up in priceMap (Yahoo strips it)
    const key = r.nav_symbol.replace(/\.(BO|NS)$/, '')
    return priceMap[key]?.price ?? priceMap[r.nav_symbol]?.price ?? null
  }

  const totalInvested = useMemo(() => rows.reduce((s, r) => s + r.qty * r.avg_cost, 0), [rows])
  const totalValue    = useMemo(() => rows.reduce((s, r) => {
    const nav = getLiveNAV(r)
    return s + (nav != null ? r.qty * nav : r.qty * r.avg_cost)
  }, 0), [rows, priceMap])

  const actual = aiHook.data?.reduce((s, e) => s + e.amount, 0)
  const liveCount = Object.keys(priceMap).length
  const liveLabel = pricesFetching
    ? '⟳ Fetching NAVs…'
    : liveCount > 0
      ? `🟢 Live · ${liveCount}/${symbols.length} NAVs · ${new Date().toLocaleTimeString('en-IN')}`
      : symbols.length > 0 ? '⚠ No live NAVs' : undefined

  const handleSave = async (data: Partial<MfHolding>) => {
    try {
      await upsertMutation.mutateAsync({ ...data, user_id: userId } as Record<string, unknown>)
      toast('Saved ✅', 'success')
      setEditRow(null)
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const handleBulkSave = async (changes: { id: string; [key: string]: unknown }[]) => {
    try {
      await Promise.all(changes.map(change => {
        const existing = rows.find(r => r.id === change.id)
        if (!existing) return Promise.resolve()
        const qty      = typeof change.qty      === 'number' ? change.qty      : existing.qty
        const avg_cost = typeof change.avg_cost === 'number' ? change.avg_cost : existing.avg_cost
        return upsertMutation.mutateAsync({ ...existing, qty, avg_cost, prev_qty: existing.qty, user_id: userId } as Record<string, unknown>)
      }))
      toast(`Updated ${changes.length} fund${changes.length !== 1 ? 's' : ''} ✅`, 'success')
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const handleDelete = async (id: string) => {
        try { await deleteMutation.mutateAsync(id); toast('Deleted', 'success') }
    catch (e) { toast((e as Error).message, 'error') }
  }

  const cols = [
    {
      key: 'fund_name', header: 'Fund',
      render: (r: MfHolding) => (
        <div>
          <div className="font-semibold text-textprim text-xs">{r.fund_name}</div>
          {r.nav_symbol
            ? <div className="text-[10px] text-textmut font-mono mt-0.5">{r.nav_symbol}</div>
            : <div className="text-[10px] text-textfade mt-0.5">No live NAV symbol</div>
          }
        </div>
      ),
    },
    {
      key: 'qty', header: 'UNITS',
      editable:   true,
      editValue:  (r: MfHolding) => Number(r.qty),
      editStep:   '0.001', align: 'right' as const,
      render: (r: MfHolding) => {
        const qty  = Number(r.qty)
        const diff = r.prev_qty != null ? qty - Number(r.prev_qty) : null
        return (
          <div className="text-right">
            {Number(qty) === 0
            ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red/10 text-red">EXITED</span>
            : <div>{qty.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</div>}
            {diff !== null && diff !== 0 && (
              <div className={`text-[10px] font-semibold ${diff > 0 ? 'text-green' : 'text-red'}`}>
                {diff > 0 ? '+' : ''}{diff.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
              </div>
            )}
          </div>
        )
      },
    },
    { key: 'avg_cost', header: 'Avg NAV',
      editable:   true,
      editValue:  (r: MfHolding) => Number(r.avg_cost).toFixed(2),
      editStep:   '0.01',
      editPrefix:  '₹',   align: 'right' as const, render: (r: MfHolding) => INR(r.avg_cost) },
    {
      key: 'ltp', header: 'Live NAV', align: 'right' as const,
      render: (r: MfHolding) => {
        const nav = getLiveNAV(r)
        return nav != null
          ? <span className="font-bold text-textprim">{INR(nav)}</span>
          : <span className="text-textfade">—</span>
      },
    },
    { key: 'invested', header: 'Invested',  align: 'right' as const, render: (r: MfHolding) => INR(r.qty * r.avg_cost) },
    {
      key: 'value', header: 'Cur. Value', align: 'right' as const,
      render: (r: MfHolding) => {
        const nav = getLiveNAV(r)
        const val = nav != null ? r.qty * nav : r.qty * r.avg_cost
        const inv = r.qty * r.avg_cost
        return <span className={`font-bold ${val >= inv ? 'text-green' : 'text-red'}`}>{INR(val)}</span>
      },
    },
    {
      key: 'gain', header: 'Gain / Loss', align: 'right' as const,
      render: (r: MfHolding) => {
        const nav = getLiveNAV(r)
        const inv = r.qty * r.avg_cost
        const val = nav != null ? r.qty * nav : inv
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
    <PageShell
      title="Mutual Funds"
      subtitle={`${rows.length} fund${rows.length !== 1 ? 's' : ''}`}
      actions={[
        { label: 'Add Fund',   onClick: () => setEditRow({}),       variant: 'primary'   },
        { label: <span style={{display:'inline-flex',alignItems:'center',gap:5,color:'#fff'}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Refresh</span>,           onClick: () => refetch(), variant: 'teal' },
      ]}
    >
      <AssetPageLayout
        stats={<StatGrid items={buildInvestedStats({ invested: totalInvested, value: totalValue, actual, loading: isLoading, liveLabel })} cols={5} />}
        mainTable={<AssetTable columns={cols} data={rows} rowKey={r => r.id} loading={isLoading} emptyText="No funds — import from Zerodha Overview or click + Add Fund" 
            onEditRow={r => setEditRow(r)}
            onDeleteRows={async ids => { for (const id of ids) await deleteMutation.mutateAsync(id); toast(`Deleted ${ids.length}`, 'success') }}
            onBulkSave={handleBulkSave}
          />}
        actualInvested={<ActualInvestedPanel table="mf_actual_invested" />}
      />

      {editRow !== null && (
        <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleSave} />
      )}


    </PageShell>
  )
}
