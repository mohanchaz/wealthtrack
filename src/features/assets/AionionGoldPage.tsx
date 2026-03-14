import { useState, useMemo } from 'react'
import { useAuthStore }      from '../../store/authStore'
import { useAssets }         from '../../hooks/useAssets'
import { useYahooPrices }    from '../../hooks/useLivePrices'
import { useToastStore }     from '../../store/toastStore'
import { AssetPageLayout }   from '../../components/common/AssetPageLayout'
import { PageShell }         from '../../components/common/PageShell'
import { StatGrid, buildInvestedStats } from '../../components/common/StatGrid'
import { AssetTable }        from '../../components/common/AssetTable'
import { Modal }             from '../../components/ui/Modal'
import { Button }            from '../../components/ui/Button'
import { Input }             from '../../components/ui/Input'
import { INR, calcGain }     from '../../lib/utils'
import { GoldInstrumentInput } from '../../components/common/GoldInstrumentInput'
import type { AionionGoldHolding } from '../../types/assets'

// Derive yahoo symbol from instrument name — no DB column needed
const GOLD_LOOKUP: { match: RegExp; yahoo: string }[] = [
  { match: /goldbees/i,     yahoo: 'GOLDBEES.NS'    },
  { match: /nippon.*gold/i, yahoo: '0P0000XVDS.BO'  },
  { match: /axis.*gold/i,   yahoo: 'AXISGOLD.NS'    },
  { match: /hdfc.*gold/i,   yahoo: 'HDFCGOLD.NS'    },
  { match: /icici.*gold/i,  yahoo: 'ICICIGOLD.NS'   },
  { match: /kotak.*gold/i,  yahoo: 'KOTAKGOLD.NS'   },
  { match: /sbi.*gold/i,    yahoo: 'SBIGOLD.NS'     },
  { match: /quantum.*gold/i,yahoo: '0P0000XV6Q.BO'  },
]

function resolveYahoo(instrument: string): string {
  for (const e of GOLD_LOOKUP) if (e.match.test(instrument)) return e.yahoo
  return ''
}

// ── Add / Edit modal ─────────────────────────────────────────
function EditModal({ row, name, onClose, onSave }: {
  row: Partial<AionionGoldHolding>
  name?: string | null
  onClose: () => void
  onSave:  (d: Partial<AionionGoldHolding>) => Promise<void>
}) {
  const [inst,   setInst]   = useState(row.instrument ?? '')
  const [qty,    setQty]    = useState(String(row.qty      ?? ''))
  const [avg,    setAvg]    = useState(String(row.avg_cost ?? ''))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!inst.trim() || !qty || !avg) return
    setSaving(true)
    await onSave({
      ...row,
      instrument: inst.trim(),
      qty:        parseFloat(qty),
      avg_cost:   parseFloat(avg),
    })
    setSaving(false)
  }

  return (
    <Modal open onClose={onClose} title={row.id ? 'Edit Holding' : 'Add Holding'}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} loading={saving} disabled={!inst || !qty || !avg}>Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {row.id ? (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-textmut uppercase tracking-wider">Instrument</label>
            <div className="h-9 rounded-xl border border-border bg-surface2 text-sm text-textmut px-3 flex items-center font-mono select-none cursor-not-allowed">{inst}</div>
            {name && <div className="text-xs text-textmut mt-0.5">{name}</div>}
          </div>
        ) : (
          <GoldInstrumentInput
            value={inst}
            onChange={setInst}
            onLive={r => {
              if (r.status === 'found' && r.price && !avg)
                setAvg(r.price.toFixed(2))
            }}
          />
        )}
        <Input label="Qty / Units" type="number" step="0.0001" value={qty} onChange={e => setQty(e.target.value)} placeholder="e.g. 100" />
        <Input label="Avg Cost / NAV (₹)" prefix="₹" type="number" step="0.01" value={avg} onChange={e => setAvg(e.target.value)} placeholder="e.g. 6500.00" />
      </div>
    </Modal>
  )
}

// ── Page ─────────────────────────────────────────────────────
export default function AionionGoldPage() {
  const userId = useAuthStore(s => s.user?.id)!
  const toast  = useToastStore(s => s.show)

  const { data: rows = [], isLoading } = useAssets<AionionGoldHolding>('aionion_gold')

  // Derive yahoo symbols from instrument names at runtime
  const symbols = useMemo(() =>
    [...new Set(rows.map(r => resolveYahoo(r.instrument)).filter(Boolean))], [rows])
  const { data: priceMap = {}, isFetching: pf, refetch } = useYahooPrices(symbols)

  const [editRow, setEditRow] = useState<Partial<AionionGoldHolding> | null>(null)
  const { upsertMutation, deleteMutation } = useAssets<AionionGoldHolding>('aionion_gold')

  const getLTP = (r: AionionGoldHolding) => {
    const yahoo = resolveYahoo(r.instrument)
    if (!yahoo) return null
    const key = yahoo.replace(/\.(NS|BO)$/, '')
    return priceMap[key]?.price ?? null
  }
  const getName = (r: AionionGoldHolding) => {
    const yahoo = resolveYahoo(r.instrument)
    if (!yahoo) return null
    const key = yahoo.replace(/\.(NS|BO)$/, '')
    return priceMap[key]?.name ?? null
  }

  const totalInvested = useMemo(() => rows.reduce((s, r) => s + r.qty * r.avg_cost, 0), [rows])
  const totalValue    = useMemo(() => rows.reduce((s, r) => {
    const ltp = getLTP(r); return s + (ltp != null ? r.qty * ltp : r.qty * r.avg_cost)
  }, 0), [rows, priceMap])

  const liveLabel = pf ? '⟳ Fetching…'
    : Object.keys(priceMap).length ? `🟢 Live · ${new Date().toLocaleTimeString('en-IN')}` : undefined

  const handleSave = async (d: Partial<AionionGoldHolding>) => {
    try {
      // Only save DB columns — no yahoo_symbol / invested / current_value / _liveName
      const { yahoo_symbol, invested, current_value, _liveName, ...clean } = d as AionionGoldHolding & { yahoo_symbol?: string; invested?: number; current_value?: number; _liveName?: string }
      // Preserve old qty as prev_qty so diff badge works; new adds get prev_qty = qty
      const existing = rows.find(r => r.id === clean.id)
      const prev_qty = existing ? existing.qty : clean.qty
      try {
        await upsertMutation.mutateAsync({ ...clean, prev_qty, user_id: userId } as Record<string, unknown>)
      } catch (e1) {
        // If prev_qty column doesn't exist in DB yet, retry without it
        if ((e1 as Error).message?.includes('prev_qty')) {
          await upsertMutation.mutateAsync({ ...clean, user_id: userId } as Record<string, unknown>)
        } else throw e1
      }
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
      toast(`Updated ${changes.length} holding${changes.length !== 1 ? 's' : ''} ✅`, 'success')
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const cols = [
    {
      key: 'instrument', header: 'Instrument',
      render: (r: AionionGoldHolding) => {
        const yahoo = resolveYahoo(r.instrument)
        return (
          <div>
            <div className="font-bold">{r.instrument}</div>
            {getName(r)
              ? <div className="text-[10px] text-textmut">{getName(r)}</div>
              : yahoo && <div className="text-[10px] text-textmut font-mono">{yahoo}</div>}
          </div>
        )
      },
    },
    {
      key: 'qty',
      hideOnMobile: true, header: 'Qty',
      editable:   true,
      editValue:  (r: AionionGoldHolding) => Number(r.qty),
      editStep:   '0.001',
      align: 'right' as const,
      render: (r: AionionGoldHolding) => (
        <div className="text-right">
          {Number(r.qty) === 0
            ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red/10 text-red">EXITED</span>
            : <div>{Number(r.qty).toLocaleString('en-IN', { maximumFractionDigits: 4 })}</div>}
          {r.prev_qty != null && Number(r.prev_qty) !== Number(r.qty) && (
            <div className={`text-[10px] font-semibold ${Number(r.qty) > Number(r.prev_qty) ? 'text-green' : 'text-red'}`}>
              {Number(r.qty) > Number(r.prev_qty) ? '+' : ''}{(Number(r.qty) - Number(r.prev_qty)).toLocaleString('en-IN', { maximumFractionDigits: 4 })}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'avg_cost',
      hideOnMobile: true, header: 'Avg Cost',
      editable:   true,
      editValue:  (r: AionionGoldHolding) => Number(r.avg_cost).toFixed(2),
      editStep:   '0.01',
      editPrefix:  '₹',
      align: 'right' as const,
      render: (r: AionionGoldHolding) => INR(r.avg_cost),
    },
    {
      key: 'ltp',
      hideOnMobile: true, header: 'Live Price', align: 'right' as const,
      render: (r: AionionGoldHolding) => {
        const ltp = getLTP(r)
        return <span className="font-bold">{ltp != null ? INR(ltp) : '—'}</span>
      },
    },
    {
      key: 'invested',
      hideOnMobile: true, header: 'Invested', align: 'right' as const,
      render: (r: AionionGoldHolding) => INR(r.qty * r.avg_cost),
    },
    {
      key: 'value', header: 'Cur. Value', align: 'right' as const,
      render: (r: AionionGoldHolding) => {
        const ltp = getLTP(r); const val = ltp != null ? r.qty * ltp : r.qty * r.avg_cost
        return <span className={`font-bold ${val >= r.qty * r.avg_cost ? 'text-green' : 'text-red'}`}>{INR(val)}</span>
      },
    },
    {
      key: 'gain', header: 'Gain / Loss', align: 'right' as const,
      render: (r: AionionGoldHolding) => {
        const ltp = getLTP(r); const inv = r.qty * r.avg_cost; const val = ltp != null ? r.qty * ltp : inv
        const { gain, gainPct, isPositive } = calcGain(val, inv)
        return (
          <span className={`font-bold ${isPositive ? 'text-green' : 'text-red'}`}>
            {isPositive ? '+' : ''}{INR(gain)}
            <br /><span className="text-[10px] font-medium opacity-80">{isPositive ? '+' : ''}{gainPct.toFixed(1)}%</span>
          </span>
        )
      },
    },
  ]

  return (
    <PageShell
      title="Aionion Gold"
      subtitle={`${rows.length} holding${rows.length !== 1 ? 's' : ''}`}
      actions={[
        { label: 'Add Holding', onClick: () => setEditRow({}), variant: 'primary' },
        { label: <span style={{display:'inline-flex',alignItems:'center',gap:5,color:'#fff'}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Refresh</span>, onClick: () => refetch(), variant: 'teal' },
      ]}
    >
      <AssetPageLayout
        stats={
          <StatGrid
            items={buildInvestedStats({ invested: totalInvested, value: totalValue, loading: isLoading, liveLabel }).slice(0, 3)}
            cols={3}
          />
        }
        mainTable={
          <AssetTable
            columns={cols}
            data={rows}
            rowKey={r => r.id}
            loading={isLoading}
            emptyText="No gold holdings yet — click + Add Holding to get started"
            onEditRow={r => setEditRow({ ...r, _liveName: getName(r) } as typeof r)}
            onDeleteRows={async ids => {
              for (const id of ids) await deleteMutation.mutateAsync(id)
              toast(`Deleted ${ids.length}`, 'success')
            }}
            onBulkSave={handleBulkSave}
          />
        }
        actualInvested={undefined}
      />
      {editRow !== null && (
        <EditModal row={editRow} name={editRow.id ? (editRow as AionionGoldHolding & { _liveName?: string })._liveName ?? getName(editRow as AionionGoldHolding) : null} onClose={() => setEditRow(null)} onSave={handleSave} />
      )}
    </PageShell>
  )
}
