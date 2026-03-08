import { useState, useMemo } from 'react'
import { useQueryClient }    from '@tanstack/react-query'
import { useAuthStore }      from '../../store/authStore'
import { useAssets }         from '../../hooks/useAssets'
import { useActualInvested } from '../../hooks/useActualInvested'
import { useYahooPrices }    from '../../hooks/useLivePrices'
import { replaceAssets }     from '../../services/assetService'
import { useToastStore }     from '../../store/toastStore'
import { AssetPageLayout }   from '../../components/common/AssetPageLayout'
import { PageShell }         from '../../components/common/PageShell'
import { StatGrid, buildInvestedStats } from '../../components/common/StatGrid'
import { AssetTable }        from '../../components/common/AssetTable'
import { ActualInvestedPanel } from '../../components/common/ActualInvestedPanel'
import { CsvImportModal }    from '../../components/common/CsvImportModal'
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

// ── CSV parser: handles Zerodha combined holdings CSV ─────────
// Mutual fund rows have a full-word name (contains spaces + mixed case)
// Stock rows are ALL-CAPS short symbols
function parseMfCsv(text: string): Omit<MfHolding, 'id' | 'user_id'>[] | null {
  const rows = parseCsvRows(text)
  if (!rows.length) return null

  const keys = Object.keys(rows[0])
  const find = (...n: string[]) => keys.find(k => n.some(x => k.toLowerCase().includes(x.toLowerCase()))) ?? null

  const kName = find('instrument', 'fund name', 'scheme', 'name')
  const kQty  = find('qty', 'units', 'quantity')
  const kAvg  = find('avg. cost', 'avg cost', 'avg nav', 'average nav', 'avg')
  if (!kName || !kQty || !kAvg) return null

  const seen = new Map<string, { qty: number; avg_cost: number }>()

  for (const r of rows) {
    const rawName = (r[kName] ?? '').trim()
    if (!rawName) continue

    // Skip stock rows: all-uppercase short symbols (no spaces, no lowercase)
    // MF names always have spaces and mixed case
    const isStock = /^[A-Z0-9&\-\.]+$/.test(rawName)
    if (isStock) continue

    // Skip gold fund (handled separately)
    if (/gold/i.test(rawName) && !/elss/i.test(rawName)) continue

    const qty = cleanNum(r[kQty] ?? '')
    const avg = cleanNum(r[kAvg] ?? '')
    if (qty <= 0 && avg <= 0) continue

    // Merge duplicate fund entries (same fund appearing twice — sum qty, weighted avg)
    const existing = seen.get(rawName)
    if (existing) {
      const totalQty = existing.qty + qty
      const weightedAvg = totalQty > 0
        ? (existing.qty * existing.avg_cost + qty * avg) / totalQty
        : avg
      seen.set(rawName, { qty: totalQty, avg_cost: weightedAvg })
    } else {
      seen.set(rawName, { qty, avg_cost: avg })
    }
  }

  return Array.from(seen.entries()).map(([fund_name, { qty, avg_cost }]) => ({
    fund_name,
    qty,
    avg_cost,
    nav_symbol: lookupSymbol(fund_name) ?? undefined,
  })) as Omit<MfHolding, 'id' | 'user_id'>[]
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
  const [showImport, setShowImport] = useState(false)
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
    ? '🔄 Fetching NAVs…'
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

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this fund?')) return
    try { await deleteMutation.mutateAsync(id); toast('Deleted', 'success') }
    catch (e) { toast((e as Error).message, 'error') }
  }

  const handleImport = async (parsed: Record<string, unknown>[]) => {
    // parsed rows already have fund_name, qty, avg_cost, nav_symbol from parseMfCsv
    const inserts = parsed.map(r => ({
      user_id:    userId,
      fund_name:  r.fund_name,
      qty:        r.qty,
      avg_cost:   r.avg_cost,
      nav_symbol: r.nav_symbol ?? null,
    }))
    await replaceAssets('mf_holdings', userId, inserts)
    qc.invalidateQueries({ queryKey: ['mf_holdings', userId] })
    const withSymbol = inserts.filter(r => r.nav_symbol).length
    toast(`${parsed.length} funds imported · ${withSymbol} with live NAV ✅`, 'success')
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
      key: 'qty', header: 'UNITS', align: 'right' as const,
      render: (r: MfHolding) => {
        const diff = r.prev_qty != null ? r.qty - r.prev_qty : null
        return (
          <div className="text-right">
            <div>{r.qty.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</div>
            {diff !== null && diff !== 0 && (
              <div className={`text-[10px] font-semibold ${diff > 0 ? 'text-green' : 'text-red'}`}>
                {diff > 0 ? '+' : ''}{diff.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
              </div>
            )}
          </div>
        )
      },
    },
    { key: 'avg_cost', header: 'Avg NAV',   align: 'right' as const, render: (r: MfHolding) => INR(r.avg_cost) },
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
        return <span className="font-bold">{INR(nav != null ? r.qty * nav : r.qty * r.avg_cost)}</span>
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
    {
      key: 'actions', header: '', align: 'center' as const,
      render: (r: MfHolding) => (
        <div className="flex gap-1">
          <button onClick={() => setEditRow(r)} className="w-6 h-6 rounded-lg flex items-center justify-center text-textmut hover:bg-surface2 hover:text-textprim transition-colors text-xs">✏</button>
          <button onClick={() => handleDelete(r.id)} className="w-6 h-6 rounded-lg flex items-center justify-center text-textmut hover:bg-red/10 hover:text-red transition-colors text-xs">✕</button>
        </div>
      ),
    },
  ]

  return (
    <PageShell
      title="Mutual Funds"
      subtitle={`${rows.length} fund${rows.length !== 1 ? 's' : ''}`}
      actions={[
        { label: '📥 Import CSV', onClick: () => setShowImport(true), variant: 'secondary' },
        { label: '+ Add Fund',   onClick: () => setEditRow({}),       variant: 'primary'   },
        { label: '🔄',           onClick: () => refetch(),            variant: 'outline'   },
      ]}
    >
      <AssetPageLayout
        stats={<StatGrid items={buildInvestedStats({ invested: totalInvested, value: totalValue, actual, loading: isLoading, liveLabel })} cols={5} />}
        mainTable={<AssetTable columns={cols} data={rows} rowKey={r => r.id} loading={isLoading} emptyText="No funds — click 📥 Import CSV or + Add Fund" />}
        actualInvested={<ActualInvestedPanel table="mf_actual_invested" />}
      />

      {editRow !== null && (
        <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleSave} />
      )}

      <CsvImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Import Mutual Funds CSV"
        hint="Zerodha holdings CSV (stocks + MFs together is fine). Funds are auto-detected by name. Known funds get live NAV symbols automatically."
        parse={parseMfCsv}
        columns={[
          { key: 'fund_name',  header: 'Fund Name' },
          { key: 'qty',        header: 'Units',      align: 'right' },
          { key: 'avg_cost',   header: 'Avg NAV',    align: 'right' },
          { key: 'nav_symbol', header: 'NAV Symbol' },
        ]}
        renderCell={(row, key) => {
          if (key === 'nav_symbol') return (row[key] as string) ?? <span className="text-textfade text-[10px]">not found</span>
          if (typeof row[key] === 'number') return INR(row[key] as number)
          return String(row[key] ?? '—')
        }}
        onImport={handleImport}
      />
    </PageShell>
  )
}
