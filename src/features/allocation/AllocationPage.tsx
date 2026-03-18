import { useState, useMemo } from 'react'
import { useAllocations } from '../../hooks/useAllocations'
import { usePortfolioTotals, ALLOC_COLORS } from '../../hooks/usePortfolioTotals'
import { EditAllocationModal } from './EditAllocationModal'
import { Button } from '../../components/ui/Button'
import { PageSpinner } from '../../components/ui/Spinner'
import { INR } from '../../lib/utils'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts'
import type { StockHolding } from '../../types/assets'

function fmt(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`
  return INR(n)
}

// ── Rebalancing types ──────────────────────────────────────────
interface RebalanceRow {
  item:       string
  color:      string
  actualPct:  number
  targetPct:  number
  diffPct:    number
  actualVal:  number
  targetVal:  number
  actionAmt:  number
  action:     'buy' | 'sell' | 'hold'
}

// ── Single action row ──────────────────────────────────────────
function ActionRow({ row, totalVal }: { row: RebalanceRow; totalVal: number }) {
  const isBuy      = row.action === 'buy'
  const amtAbs     = Math.abs(row.actionAmt)
  const pctMove    = totalVal > 0 ? (amtAbs / totalVal) * 100 : 0
  const [hovered, setHovered] = useState(false)

  const diffSign  = isBuy ? '+' : '-'
  const diffColor = isBuy ? '#0F766E' : '#D97706'

  return (
    <div className="flex items-center gap-2 py-0.5">
      {/* Name — flexible on mobile */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1 sm:w-36 sm:flex-none sm:shrink-0">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
        <span className="text-[12px] font-semibold text-[#1A1A1A] truncate">{row.item}</span>
      </div>

      {/* Bar — hidden on mobile, shown on sm+ */}
      <div
        className="hidden sm:block flex-1 relative h-4 cursor-pointer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="absolute inset-0 flex items-center">
          <div className="w-full h-1.5 rounded-full bg-[#F0EEE9]" />
        </div>
        <div className="absolute inset-0 flex items-center">
          <div className="w-full h-1.5 rounded-full overflow-hidden">
            <div className="h-full transition-all duration-700 rounded-full"
              style={{ width: `${Math.min(row.actualPct, 100)}%`, backgroundColor: row.color, opacity: 0.35 }} />
          </div>
        </div>
        <div className="absolute top-0.5 bottom-0.5 w-0.5 rounded bg-[#1A1A1A] opacity-40"
          style={{ left: `calc(${row.targetPct}% - 1px)` }} />

        {hovered && (
          <div
            className="absolute z-20 bottom-full mb-2 left-1/2 -translate-x-1/2
                       bg-[#1A1A1A] text-white rounded-xl shadow-lg px-3 py-2.5
                       whitespace-nowrap pointer-events-none"
            style={{ fontSize: '11px' }}
          >
            <div className="flex items-center justify-between gap-5 mb-1.5">
              <span className="text-white/50 uppercase tracking-wider" style={{ fontSize: '9px', fontWeight: 600 }}>Current</span>
              <span className="font-mono font-bold text-white">
                {fmt(row.actualVal)}<span className="text-white/50 ml-1">({row.actualPct.toFixed(1)}%)</span>
              </span>
            </div>
            <div className="flex items-center justify-between gap-5 mb-1.5">
              <span className="text-white/50 uppercase tracking-wider" style={{ fontSize: '9px', fontWeight: 600 }}>Target</span>
              <span className="font-mono font-bold text-white">
                {fmt(row.targetVal)}<span className="text-white/50 ml-1">({row.targetPct.toFixed(1)}%)</span>
              </span>
            </div>
            <div className="border-t border-white/10 mt-1.5 pt-1.5">
              <div className="flex items-center justify-between gap-5">
                <span className="text-white/50 uppercase tracking-wider" style={{ fontSize: '9px', fontWeight: 600 }}>
                  {isBuy ? 'To Buy' : 'To Sell'}
                </span>
                <span className="font-mono font-black" style={{ color: diffColor }}>
                  {diffSign}{fmt(amtAbs)}
                </span>
              </div>
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
              style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #1A1A1A' }} />
          </div>
        )}
      </div>

      {/* Pct display — hidden on mobile */}
      <div className="hidden sm:block text-right w-24 shrink-0">
        <span className="text-[10px] font-mono text-[#767676]">{row.actualPct.toFixed(1)}%</span>
        <span className="text-[9px] text-[#C8C4BE] mx-0.5">→</span>
        <span className="text-[10px] font-mono font-bold text-[#1A1A1A]">{row.targetPct.toFixed(1)}%</span>
      </div>

      {/* Action chip — always visible, compact on mobile */}
      <div className="shrink-0">
        <span className={`inline-flex items-center gap-1 text-[11px] font-black font-mono px-2 py-1 rounded-lg ${
          isBuy ? 'bg-green-100 text-[#0F766E]' : 'bg-amber-100 text-amber-700'
        }`}>
          <span>{isBuy ? '↑' : '↓'}</span>
          <span>{isBuy ? '+' : '-'}{fmt(amtAbs)}</span>
        </span>
      </div>

      {/* Portfolio % — hidden on mobile */}
      <span className="hidden sm:inline text-[10px] text-[#ABABAB] w-12 text-right shrink-0 font-mono">
        {pctMove.toFixed(1)}%
      </span>
    </div>
  )
}

// ── Rebalancing section component ─────────────────────────────
function RebalanceSection({
  rows, totalVal, topUpAmt, setTopUpAmt, loading,
}: {
  rows: RebalanceRow[]; totalVal: number
  topUpAmt: string; setTopUpAmt: (v: string) => void; loading: boolean
}) {
  const buys  = rows.filter(r => r.action === 'buy').sort((a, b) => b.actionAmt - a.actionAmt)
  const sells = rows.filter(r => r.action === 'sell').sort((a, b) => a.actionAmt - b.actionAmt)
  const holds = rows.filter(r => r.action === 'hold')

  const totalBuy  = buys.reduce((s, r) => s + r.actionAmt, 0)
  const totalSell = sells.reduce((s, r) => s + Math.abs(r.actionAmt), 0)

  const topUp     = parseFloat(topUpAmt) || 0
  const topUpRows = useMemo(() => {
    if (topUp <= 0 || totalVal <= 0) return []
    const newTotal = totalVal + topUp
    return rows
      .map(r => ({ ...r, topUpNeeded: Math.max(0, r.targetPct / 100 * newTotal - r.actualVal) }))
      .filter(r => r.topUpNeeded > 0.5)
      .sort((a, b) => b.topUpNeeded - a.topUpNeeded)
  }, [rows, topUp, totalVal])

  const totalAllocated = topUpRows.reduce((s, r) => s + r.topUpNeeded, 0)
  const unallocated    = Math.max(0, topUp - totalAllocated)

  const barData = rows.map(r => ({
    name:  r.item.replace(' Equity', '').replace(' Stocks', ' Stk').replace('Fixed Deposit', 'FD').replace('UK Savings', 'UK Sav'),
    diff:  +r.diffPct.toFixed(2),
    color: r.color,
  }))

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-[#E0DDD6] shadow-sm p-5 space-y-3">
        <div className="h-4 w-36 bg-[#F0EEE9] rounded animate-pulse" />
        {[1,2,3,4].map(i => <div key={i} className="h-10 rounded-xl bg-[#F5F4F0] animate-pulse" />)}
      </div>
    )
  }

  if (totalVal === 0) return null

  return (
    <div className="flex flex-col gap-4">

      {/* ── Drift chart ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#E0DDD6] shadow-sm p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[12px] font-bold uppercase tracking-widest text-[#767676]">Allocation Drift</h2>
          <span className="text-[10px] text-[#767676]">actual − target (%)</span>
        </div>
        <p className="text-[11px] text-[#ABABAB] mb-3">Amber = overweight · teal = underweight</p>
        <ResponsiveContainer width="100%" height={110}>
          <BarChart data={barData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#767676' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 9, fill: '#767676' }} axisLine={false} tickLine={false} />
            <ReferenceLine y={0} stroke="#C8C4BE" strokeWidth={1} />
            <Bar dataKey="diff" radius={[3, 3, 0, 0]} maxBarSize={36}>
              {barData.map((r, i) => (
                <Cell key={i} fill={r.diff > 0 ? '#D97706' : '#0F766E'} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: '#D97706' }} />
            <span className="text-[10px] text-[#767676]">Overweight — trim</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: '#0F766E' }} />
            <span className="text-[10px] text-[#767676]">Underweight — add</span>
          </div>
        </div>
      </div>

      {/* ── Full rebalance plan ───────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#E0DDD6] shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#F0EEE9]">
          <h2 className="text-[12px] font-bold uppercase tracking-widest text-[#767676]">Full Rebalance Plan</h2>
        </div>

        {/* Summary chips */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 px-5 py-3 border-b border-[#F0EEE9]">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#767676]">To Sell</span>
            <span className="text-[16px] font-black font-mono text-amber-600">{fmt(totalSell)}</span>
          </div>
          <div className="hidden sm:block w-px bg-[#F0EEE9] self-stretch" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#767676]">To Buy</span>
            <span className="text-[16px] font-black font-mono text-[#0F766E]">{fmt(totalBuy)}</span>
          </div>
          <div className="hidden sm:block w-px bg-[#F0EEE9] self-stretch" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#767676]">Net Move</span>
            <span className={`text-[16px] font-black font-mono ${
              Math.abs(totalBuy - totalSell) < 1000 ? 'text-[#1A1A1A]'
              : totalBuy > totalSell ? 'text-[#0F766E]' : 'text-amber-600'
            }`}>
              {totalBuy >= totalSell ? '+' : ''}{fmt(totalBuy - totalSell)}
            </span>
          </div>
          {holds.length > 0 && (
            <>
              <div className="hidden sm:block w-px bg-[#F0EEE9] self-stretch" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#767676]">No Action</span>
                <span className="text-[16px] font-black font-mono text-[#ABABAB]">{holds.length} assets</span>
              </div>
            </>
          )}
        </div>

        {/* Action rows */}
        <div className="divide-y divide-[#F5F4F0]">
          {sells.length > 0 && (
            <div className="px-5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-600 mb-2">Sell / Reduce</p>
              <div className="space-y-2">
                {sells.map(r => <ActionRow key={r.item} row={r} totalVal={totalVal} />)}
              </div>
            </div>
          )}
          {buys.length > 0 && (
            <div className="px-5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#0F766E] mb-2">Buy / Add</p>
              <div className="space-y-2">
                {buys.map(r => <ActionRow key={r.item} row={r} totalVal={totalVal} />)}
              </div>
            </div>
          )}
          {holds.length > 0 && (
            <div className="px-5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#ABABAB] mb-2">Hold (within ±1%)</p>
              <div className="flex flex-wrap gap-1.5">
                {holds.map(r => (
                  <span key={r.item} className="flex items-center gap-1 text-[11px] text-[#767676] bg-[#F5F4F0] rounded-lg px-2.5 py-1">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                    {r.item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Top-up planner ────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#E0DDD6] shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#F0EEE9]">
          <h2 className="text-[12px] font-bold uppercase tracking-widest text-[#767676]">Top-Up Planner</h2>
          <p className="text-[11px] text-[#ABABAB] mt-0.5">
            Enter new money to invest. We'll split it to bring your portfolio closest to targets — no selling required.
          </p>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[#767676]">₹</span>
              <input
                type="number"
                value={topUpAmt}
                onChange={e => setTopUpAmt(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full pl-7 pr-3 py-2.5 border border-[#E0DDD6] rounded-xl text-[13px] font-mono
                           outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E]/20 transition-all"
              />
            </div>
            {topUp > 0 && (
              <button onClick={() => setTopUpAmt('')}
                className="text-[11px] text-[#ABABAB] hover:text-[#767676] transition-colors">
                Clear
              </button>
            )}
          </div>

          {topUp > 0 && topUpRows.length === 0 && (
            <div className="flex items-center gap-2 text-[12px] text-[#0F766E] font-semibold bg-green-50 rounded-xl px-4 py-3">
              <span>✓</span>
              <span>Portfolio is already on target — invest proportionally across all assets.</span>
            </div>
          )}

          {topUp > 0 && topUpRows.length > 0 && (
            <div>
              <div className="space-y-2 mb-3">
                {topUpRows.map(r => {
                  const pct = topUp > 0 ? (r.topUpNeeded / topUp) * 100 : 0
                  return (
                    <div key={r.item} className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 w-36 shrink-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                        <span className="text-[12px] font-semibold text-[#1A1A1A] truncate">{r.item}</span>
                      </div>
                      <div className="flex-1 h-2 bg-[#F0EEE9] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: r.color }} />
                      </div>
                      <span className="text-[12px] font-black font-mono text-[#0F766E] w-24 text-right shrink-0">
                        +{fmt(r.topUpNeeded)}
                      </span>
                      <span className="text-[10px] text-[#767676] w-10 text-right shrink-0">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-[#F0EEE9]">
                <span className="text-[11px] text-[#767676]">
                  {unallocated > 500
                    ? `${fmt(unallocated)} surplus after bringing all assets to target`
                    : 'Full amount allocated to bring portfolio to target'}
                </span>
                <span className="text-[12px] font-bold font-mono text-[#1A1A1A]">
                  Total: {fmt(Math.min(topUp, totalAllocated))}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}


// ── India Stocks Card ──────────────────────────────────────────
type IndiaBroker = 'all' | 'zerodha' | 'aionion'

interface IndiaStocksProps {
  zStocks:    StockHolding[]
  aiStocks:   StockHolding[]
  nsePrices:  Record<string, { price: number; name: string | null; currency: string | null }>
  anyLoading: boolean
}

interface IndiaMergedRow {
  instrument: string
  name:       string | null
  qty:        number
  avgCost:    number
  value:      number
  invested:   number
  merged:     boolean
  brokers:    IndiaBroker[]
}

function indiaAllocColor(pct: number): string {
  return pct >= 10 || pct < 2 ? '#C0392B' : '#0F766E'
}

function indiaFmt(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function IndiaStocksCard({ zStocks, aiStocks, nsePrices, anyLoading }: IndiaStocksProps) {
  const [broker, setBroker] = useState<IndiaBroker>('all')

  const rows = useMemo<IndiaMergedRow[]>(() => {
    const src = broker === 'all'
      ? [...zStocks.map(r => ({ ...r, _b: 'zerodha' as IndiaBroker })),
         ...aiStocks.map(r => ({ ...r, _b: 'aionion' as IndiaBroker }))]
      : broker === 'zerodha'
        ? zStocks.map(r => ({ ...r, _b: 'zerodha' as IndiaBroker }))
        : aiStocks.map(r => ({ ...r, _b: 'aionion' as IndiaBroker }))

    if (broker !== 'all') {
      return src.map(r => {
        const ltp = nsePrices[r.instrument]?.price ?? null
        return {
          instrument: r.instrument,
          name:       nsePrices[r.instrument]?.name ?? null,
          qty:        Number(r.qty),
          avgCost:    Number(r.avg_cost),
          value:      Number(r.qty) * (ltp ?? Number(r.avg_cost)),
          invested:   Number(r.qty) * Number(r.avg_cost),
          merged:     false,
          brokers:    [broker],
        }
      })
    }

    const map: Record<string, { instrument: string; totalQty: number; totalInv: number; brokers: IndiaBroker[] }> = {}
    src.forEach(r => {
      if (!map[r.instrument]) map[r.instrument] = { instrument: r.instrument, totalQty: 0, totalInv: 0, brokers: [] }
      map[r.instrument].totalQty += Number(r.qty)
      map[r.instrument].totalInv += Number(r.qty) * Number(r.avg_cost)
      map[r.instrument].brokers.push(r._b)
    })

    return Object.values(map).map(m => {
      const avgCost = m.totalInv / m.totalQty
      const ltp     = nsePrices[m.instrument]?.price ?? null
      return {
        instrument: m.instrument,
        name:       nsePrices[m.instrument]?.name ?? null,
        qty:        m.totalQty,
        avgCost,
        value:      m.totalQty * (ltp ?? avgCost),
        invested:   m.totalInv,
        merged:     m.brokers.length > 1,
        brokers:    m.brokers,
      }
    })
  }, [broker, zStocks, aiStocks, nsePrices])

  const sorted   = useMemo(() => [...rows].sort((a, b) => a.instrument.localeCompare(b.instrument)), [rows])
  const totalVal  = sorted.reduce((s, r) => s + r.value, 0)
  const totalInv  = sorted.reduce((s, r) => s + r.invested, 0)
  const totalGain = totalVal - totalInv
  const gainPct   = totalInv > 0 ? (totalGain / totalInv) * 100 : 0
  const gainPos   = totalGain >= 0

  if (anyLoading) {
    return (
      <div className="bg-white rounded-2xl border border-[#E0DDD6] shadow-sm overflow-hidden">
        <div className="px-4 py-3.5 border-b border-[#F0EEE9]">
          <h2 className="text-[12px] font-bold uppercase tracking-widest text-[#767676]">🇮🇳 India Stocks</h2>
        </div>
        <div className="divide-y divide-[#F5F4F0]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="h-3.5 w-24 bg-[#F0EEE9] rounded animate-pulse mb-1.5" />
                <div className="h-2.5 w-36 bg-[#F5F4F0] rounded animate-pulse" />
              </div>
              <div className="h-4 w-20 bg-[#F0EEE9] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E0DDD6] shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#F0EEE9] gap-3 flex-wrap">
        <div>
          <h2 className="text-[12px] font-bold uppercase tracking-widest text-[#767676]">🇮🇳 India Stocks</h2>
          <p className="text-[10px] text-[#ABABAB] mt-0.5">Zerodha + Aionion · sorted A–Z</p>
        </div>
        <div className="flex bg-[#F5F4F0] border border-[#E0DDD6] rounded-xl overflow-hidden text-[11px] font-bold shrink-0">
          {(['all', 'zerodha', 'aionion'] as IndiaBroker[]).map(b => (
            <button key={b} onClick={() => setBroker(b)}
              className={`px-3 py-1.5 capitalize transition-colors ${broker === b ? 'bg-[#1A1A1A] text-white rounded-[10px]' : 'text-[#767676] hover:text-[#1A1A1A]'}`}>
              {b === 'all' ? 'All' : b === 'zerodha' ? 'Zerodha' : 'Aionion'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 px-4 py-2 bg-[#FAFAF8] border-b border-[#F0EEE9] flex-wrap">
        {[{ color: '#C0392B', label: '>10% concentrated' }, { color: '#0F766E', label: '2–10% healthy' }, { color: '#C0392B', label: '<2% negligible' }].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: l.color }} />
            <span className="text-[10px] text-[#767676] font-semibold">{l.label}</span>
          </div>
        ))}
      </div>

      <div className="overflow-y-auto flex-1" style={{ maxHeight: '420px' }}>
        {sorted.length === 0 && <p className="text-[12px] text-[#ABABAB] text-center py-8">No holdings found.</p>}
        {sorted.map(r => {
          const gain     = r.value - r.invested
          const gPct     = r.invested > 0 ? (gain / r.invested) * 100 : 0
          const gPos     = gain >= 0
          const allocPct = totalVal > 0 ? (r.value / totalVal) * 100 : 0
          const aColor   = indiaAllocColor(allocPct)
          const isHigh   = allocPct >= 10
          const isLow    = allocPct < 2
          return (
            <div key={`${r.instrument}-${r.brokers.join('-')}`} className="border-b border-[#F5F4F0] last:border-0">
              <div className="flex items-center gap-3 px-4 pt-2.5 pb-1">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-[#1A1A1A]">{r.instrument}</div>
                  {r.name && <div className="text-[11px] text-[#767676] truncate mt-0.5">{r.name}</div>}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {r.merged ? (
                      <>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8]">Zerodha</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F5F3FF] text-[#6D28D9]">Aionion</span>
                        <span className="text-[10px] text-[#ABABAB]">blended avg</span>
                      </>
                    ) : r.brokers[0] === 'zerodha'
                      ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8]">Zerodha</span>
                      : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F5F3FF] text-[#6D28D9]">Aionion</span>
                    }
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[14px] font-black font-mono text-[#1A1A1A]">{indiaFmt(r.value)}</div>
                  <div className={`text-[11px] font-bold font-mono mt-0.5 ${gPos ? 'text-[#0F766E]' : 'text-[#C0392B]'}`}>
                    {gPos ? '+' : ''}{indiaFmt(gain)} ({gPos ? '+' : ''}{gPct.toFixed(1)}%)
                  </div>
                </div>
              </div>
              <div className="px-4 pb-2.5 flex items-center gap-2">
                <span className="text-[11px] font-black font-mono w-10 shrink-0" style={{ color: aColor }}>{allocPct.toFixed(1)}%</span>
                <div className="flex-1 h-[4px] bg-[#F0EEE9] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(allocPct, 100)}%`, background: aColor }} />
                </div>
                {(isHigh || isLow) && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#FEE2E2] text-[#B91C1C] shrink-0">{isHigh ? 'high' : 'low'}</span>
                )}
                <span className="text-[10px] text-[#ABABAB] font-mono shrink-0 w-14 text-right">{indiaFmt(r.value)}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-4 border-t border-[#F0EEE9]">
        {[
          { label: 'Stocks',   value: String(sorted.length),                          color: undefined },
          { label: 'Invested', value: indiaFmt(totalInv),                             color: undefined },
          { label: 'Value',    value: indiaFmt(totalVal),                             color: undefined },
          { label: 'Gain',     value: `${gainPos ? '+' : ''}${gainPct.toFixed(1)}%`, color: gainPos ? '#0F766E' : '#C0392B' },
        ].map(s => (
          <div key={s.label} className="flex flex-col items-center py-2.5 border-r border-[#F0EEE9] last:border-0">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#ABABAB] mb-1">{s.label}</span>
            <span className="text-[12px] font-black font-mono" style={{ color: s.color ?? '#1A1A1A' }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="bg-white border border-[#E0DDD6] rounded-xl shadow-lg px-3 py-2 text-[11px]">
      <div className="font-bold text-[#1A1A1A]">{name}</div>
      <div className="text-[#767676]">{value.toFixed(1)}%</div>
    </div>
  )
}

function MiniDonut({ data, label }: { data: { name: string; value: number; color: string }[]; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#767676] mb-1">{label}</p>
      <ResponsiveContainer width="100%" height={140}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={38} outerRadius={58}
            paddingAngle={2} dataKey="value">
            {data.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
          </Pie>
          <Tooltip content={<PieTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-x-2 gap-y-0.5 mt-1">
        {data.filter(d => d.value > 0.1).map(d => (
          <div key={d.name} className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-[9px] text-[#767676]">{d.name} {d.value.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AllocationPage() {
  const { data: allocations = [], isLoading, error, seedMutation, saveMutation } = useAllocations()
  const p = usePortfolioTotals()
  const [editOpen,   setEditOpen]   = useState(false)
  const [topUpAmt,   setTopUpAmt]   = useState('')

  // ── Compute rebalance rows ────────────────────────────────────
  const rebalanceRows = useMemo<RebalanceRow[]>(() => {
    if (!allocations.length || p.totalVal === 0) return []
    return allocations.map(alloc => {
      const bucket    = p.allocationBuckets.find(b => b.key === alloc.item)
      const color     = ALLOC_COLORS[alloc.item] ?? '#767676'
      const targetPct = alloc.percentage * 100
      const actualVal = bucket?.val ?? 0
      const actualPct = p.totalVal > 0 ? (actualVal / p.totalVal) * 100 : 0
      const targetVal = (targetPct / 100) * p.totalVal
      const diffPct   = actualPct - targetPct
      const actionAmt = targetVal - actualVal   // positive = need to buy, negative = need to sell
      const THRESHOLD = 1                        // ±1% tolerance band
      const action: 'buy' | 'sell' | 'hold' =
        diffPct < -THRESHOLD ? 'buy'
        : diffPct > THRESHOLD ? 'sell'
        : 'hold'
      return { item: alloc.item, color, actualPct, targetPct, diffPct, actualVal, targetVal, actionAmt, action }
    })
  }, [allocations, p.allocationBuckets, p.totalVal])

  if (isLoading) return <PageSpinner />
  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
      <p className="text-sm text-red">{String(error)}</p>
    </div>
  )

  if (!allocations.length) return (
    <div className="flex flex-col items-center justify-center min-h-[420px] gap-5 text-center">
      <div className="w-14 h-14 rounded-2xl bg-teal/10 border border-teal/20 flex items-center justify-center text-3xl">◎</div>
      <div>
        <h3 className="text-base font-bold text-textprim mb-1.5">No allocation set yet</h3>
        <p className="text-sm text-textsec max-w-xs leading-relaxed">
          Define your ideal portfolio mix to see how your holdings compare to your targets.
        </p>
      </div>
      <Button onClick={() => seedMutation.mutate()} loading={seedMutation.isPending}>
        Load default allocation →
      </Button>
    </div>
  )

  const actualPieData = allocations.map(alloc => {
    const bucket = p.allocationBuckets.find(b => b.key === alloc.item)
    const color  = ALLOC_COLORS[alloc.item] ?? '#767676'
    const pct    = p.totalVal > 0 && bucket ? (bucket.val / p.totalVal) * 100 : 0
    return { name: alloc.item, value: pct, color }
  }).filter(d => d.value > 0.1)

  const targetPieData = allocations.map(alloc => ({
    name:  alloc.item,
    value: alloc.percentage * 100,
    color: ALLOC_COLORS[alloc.item] ?? '#767676',
  })).filter(d => d.value > 0.1)

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-xl font-black text-[#1A1A1A] tracking-tight">Allocation</h1>
          <p className="text-[11px] text-[#767676] mt-0.5">Target vs actual portfolio weights</p>
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)} size="sm">
          ✏️ Edit targets
        </Button>
      </div>

      {/* Pie charts + Target vs Actual side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-up">

        {/* ── Two donuts ─────────────────────────────────── */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-[#E0DDD6] shadow-sm p-4">
          <div className="grid grid-cols-2 gap-2">
            <MiniDonut data={actualPieData} label="Actual" />
            <MiniDonut data={targetPieData} label="Target" />
          </div>
        </div>

        {/* ── Target vs Actual compact table ─────────────── */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E0DDD6] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[#F0EEE9] flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#1A1A1A]">Target vs Actual</h2>
            <span className="text-[10px] text-[#767676]">actual / <strong className="text-[#1A1A1A]">target</strong></span>
          </div>
          <div className="px-4 py-1">
            {allocations.map(alloc => {
              const bucket    = p.allocationBuckets.find(b => b.key === alloc.item)
              const color     = ALLOC_COLORS[alloc.item] ?? '#767676'
              const targetPct = alloc.percentage * 100
              const actualPct = p.totalVal > 0 && bucket ? (bucket.val / p.totalVal) * 100 : 0
              const diff      = actualPct - targetPct
              const diffAbs   = Math.abs(diff)
              const over      = diff > 0.5
              const under     = diff < -0.5
              const onTrack   = !over && !under

              return (
                <div key={alloc.id} className="py-1.5 border-b border-[#F5F4F0] last:border-0 flex items-center gap-2">
                  {/* Dot + name */}
                  <div className="flex items-center gap-1.5 w-32 shrink-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-[11px] font-semibold text-[#1A1A1A] truncate">{alloc.item}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="flex-1 relative h-3">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full h-1 rounded-full bg-[#F0EEE9]" />
                    </div>
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full h-1 rounded-full overflow-hidden">
                        <div className="h-full rounded-full opacity-20 transition-all duration-700"
                          style={{ width: `${targetPct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                    <div className="absolute top-1 bottom-1 w-0.5 rounded-full bg-[#C8C4BE]"
                      style={{ left: `calc(${targetPct}% - 1px)` }} />
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full h-1.5 rounded-full overflow-hidden bg-transparent">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(actualPct, 100)}%`, backgroundColor: color, opacity: p.anyLoading ? 0.3 : 1 }} />
                      </div>
                    </div>
                  </div>

                  {/* Pct values */}
                  <div className="text-right w-20 shrink-0">
                    <span className="text-[10px] font-mono text-[#767676]">{p.anyLoading ? '…' : `${actualPct.toFixed(1)}%`}</span>
                    <span className="text-[9px] text-[#C8C4BE] mx-0.5">/</span>
                    <span className="text-[10px] font-mono font-bold text-[#1A1A1A]">{targetPct.toFixed(1)}%</span>
                  </div>

                  {/* Badge */}
                  <div className="w-16 shrink-0 text-right">
                    {!p.anyLoading && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                        onTrack ? 'bg-green-100 text-green-700'
                        : over   ? 'bg-amber-100 text-amber-700'
                        :          'bg-red-100 text-red-600'
                      }`}>
                        {onTrack ? '✓' : over ? `+${diffAbs.toFixed(1)}%` : `-${diffAbs.toFixed(1)}%`}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Rebalancing ──────────────────────────────────────────── */}
      {!p.anyLoading && allocations.length > 0 && (
        <div className="animate-fade-up">
          <div className="flex items-center gap-3 mb-4 mt-1">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#767676]">Rebalancing</h2>
            <div className="flex-1 h-px bg-[#F0EEE9]" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <RebalanceSection
              rows={rebalanceRows}
              totalVal={p.totalVal}
              topUpAmt={topUpAmt}
              setTopUpAmt={setTopUpAmt}
              loading={p.anyLoading}
            />
            <IndiaStocksCard
              zStocks={p.zStocks}
              aiStocks={p.aiStocks}
              nsePrices={p.nsePrices}
              anyLoading={p.anyLoading}
            />
          </div>
        </div>
      )}

      <EditAllocationModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        allocations={allocations}
        onSave={items => saveMutation.mutateAsync(items)}
      />
    </div>
  )
}
