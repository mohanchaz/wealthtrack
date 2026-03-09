import { useState, useMemo } from 'react'
import { useAuthStore }      from '../../store/authStore'
import { useAssets }         from '../../hooks/useAssets'
import { useActualInvested } from '../../hooks/useActualInvested'
import { useYahooPrices, useFxRates } from '../../hooks/useLivePrices'
import { useToastStore }     from '../../store/toastStore'
import { AssetPageLayout } from '../../components/common/AssetPageLayout'
import { PageShell }         from '../../components/common/PageShell'
import { StatGrid }          from '../../components/common/StatGrid'
import { AssetTable }        from '../../components/common/AssetTable'
import { ActualInvestedPanel } from '../../components/common/ActualInvestedPanel'
import { Modal }             from '../../components/ui/Modal'
import { Button }            from '../../components/ui/Button'
import { Input }             from '../../components/ui/Input'
import { INR, calcGain }     from '../../lib/utils'
import type { CryptoHolding } from '../../types/assets'

/** Strip -GBP suffix for display ticker */
const cryptoTicker = (yahooSym: string) => yahooSym.replace(/-GBP$/, '')

function EditModal({ row, onClose, onSave }: { row: Partial<CryptoHolding>; onClose: () => void; onSave: (d: Partial<CryptoHolding>) => Promise<void> }) {
  const [sym,    setSym]    = useState(row.yahoo_symbol ?? '')
  const [qty,    setQty]    = useState(String(row.qty ?? ''))
  const [avgGbp, setAvgGbp] = useState(String(row.avg_price_gbp ?? ''))
  const [saving, setSaving] = useState(false)
  const handleSave = async () => {
    if (!sym || !qty || !avgGbp) return
    setSaving(true)
    await onSave({ ...row, yahoo_symbol: sym.toUpperCase(), qty: parseFloat(qty), avg_price_gbp: parseFloat(avgGbp) })
    setSaving(false)
  }
  return (
    <Modal open onClose={onClose} title={row.id ? 'Edit Holding' : 'Add Crypto'}
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={handleSave} loading={saving}>💾 Save</Button></>}
    >
      <div className="flex flex-col gap-4">
        <Input label="Yahoo Symbol" value={sym} onChange={e => setSym(e.target.value)} placeholder="e.g. BTC-GBP, ETH-GBP" helpText="Use Yahoo Finance format: SYMBOL-GBP" />
        <Input label="Quantity" type="number" step="0.00000001" value={qty} onChange={e => setQty(e.target.value)} />
        <Input label="Avg Price (£)" type="number" step="0.01" value={avgGbp} onChange={e => setAvgGbp(e.target.value)} helpText="Price paid in GBP" />
      </div>
    </Modal>
  )
}

export default function CryptoPage() {
  const userId = useAuthStore(s => s.user?.id)!; const toast = useToastStore(s => s.show)
  const { data: rows = [], isLoading } = useAssets<CryptoHolding>('crypto_holdings')
  const aiHook = useActualInvested('crypto_actual_invested')
  const { data: fx } = useFxRates()
  const gbpUsd = fx?.gbpUsd ?? 1.27; const usdInr = fx?.usdInr ?? 83.5; const gbpInr = fx?.gbpInr ?? gbpUsd * usdInr

  const yahooSymbols = useMemo(() => rows.map(r => r.yahoo_symbol), [rows])
  const { data: priceMap = {}, isFetching: pf, refetch } = useYahooPrices(yahooSymbols)
  const [editRow, setEditRow] = useState<Partial<CryptoHolding> | null>(null)
  const { upsertMutation, deleteMutation } = useAssets<CryptoHolding>('crypto_holdings')

  // Crypto is GBP-priced; convert to INR via GBP→USD→INR chain
  const getLTPGbp = (r: CryptoHolding): number | null => priceMap[r.yahoo_symbol]?.price ?? null
  const gbpToInr  = (gbp: number) => gbp * gbpInr

  const totalInvestedGbp = useMemo(() => rows.reduce((s, r) => s + r.qty * r.avg_price_gbp, 0), [rows])
  const totalValueGbp    = useMemo(() => rows.reduce((s, r) => { const ltp=getLTPGbp(r); return s + (ltp!=null ? r.qty*ltp : r.qty*r.avg_price_gbp) }, 0), [rows, priceMap])
  const totalInvestedInr = gbpToInr(totalInvestedGbp)
  const totalValueInr    = gbpToInr(totalValueGbp)
  const actual = aiHook.data?.reduce((s, e) => s + e.amount, 0)
  const liveLabel = pf ? '🔄 Fetching…' : Object.keys(priceMap).length ? `🟢 Live · ${new Date().toLocaleTimeString('en-IN')}` : undefined
  const { gain: gainInr, gainPct, isPositive } = calcGain(totalValueInr, totalInvestedInr)
  const actGain = actual ? calcGain(totalValueInr, actual) : null

  const stats = [
    { label: 'Invested (₹)', value: INR(totalInvestedInr),   icon: '₹', accentColor: '#0891b2', loading: isLoading },
    { label: 'Invested (£)', value: `£${totalInvestedGbp.toFixed(2)}`, icon: '£', accentColor: '#0891b2', loading: isLoading },
    { label: 'Value (₹)',    value: INR(totalValueInr), sub: liveLabel, icon: '◈', accentColor: '#0d9488', loading: isLoading },
    { label: 'Value (£)',    value: `£${totalValueGbp.toFixed(2)}`,    icon: '◈', accentColor: '#0d9488', loading: isLoading },
    { label: 'Gain / Loss',  value: `${isPositive?'+':''}${INR(gainInr)}`, sub: `${isPositive?'+':''}${gainPct.toFixed(1)}%`, icon: isPositive?'▲':'▼', accentColor: isPositive?'#059669':'#dc2626', loading: isLoading },
    { label: 'Actual Invested', value: actual ? INR(actual) : '—', icon: '⊡', accentColor: '#d97706', loading: isLoading },
    { label: 'Actual Gain',  value: actGain ? `${actGain.isPositive?'+':''}${INR(actGain.gain)}` : '—', icon: actGain?.isPositive?'▲':'▼', accentColor: actGain?.isPositive!==false?'#059669':'#dc2626', loading: isLoading },
  ]

  const handleSave = async (d: Partial<CryptoHolding>) => {
    try {
      const existing = rows.find(r => r.id === d.id)
      const prev_qty = existing ? existing.qty : d.qty
      await upsertMutation.mutateAsync({ ...d, prev_qty, user_id: userId } as Record<string,unknown>)
      toast('Saved ✅','success'); setEditRow(null)
    } catch (e) { toast((e as Error).message,'error') }
  }

  const cols = [
    { key: 'ticker', header: 'Coin', render: (r: CryptoHolding) => (
      <div>
        <div className="font-bold">{cryptoTicker(r.yahoo_symbol)}</div>
        <div className="text-[10px] text-textmut font-mono">{r.yahoo_symbol}</div>
      </div>
    )},
    { key: 'qty', header: 'Qty', align: 'right' as const, render: (r: CryptoHolding) => {
      const qty = Number(r.qty); const diff = r.prev_qty != null ? qty - Number(r.prev_qty) : null
      return (
        <div className="text-right">
          {qty === 0 ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red/10 text-red">EXITED</span>
            : <div>{qty.toLocaleString('en-IN', { maximumFractionDigits: 8 })}</div>}
          {diff !== null && diff !== 0 && <div className={`text-[10px] font-semibold ${diff > 0 ? 'text-green' : 'text-red'}`}>{diff > 0 ? '+' : ''}{diff.toLocaleString('en-IN', { maximumFractionDigits: 8 })}</div>}
        </div>
      )
    }},
    { key: 'avg_price_gbp', header: 'Avg (£)',        align: 'right' as const, render: (r: CryptoHolding) => `£${r.avg_price_gbp.toFixed(2)}` },
    { key: 'ltp_gbp',       header: 'Live (£)',       align: 'right' as const, render: (r: CryptoHolding) => { const ltp=getLTPGbp(r); return <span className="font-bold">{ltp!=null?`£${ltp.toFixed(2)}`:'—'}</span> }},
    { key: 'invested_inr',  header: 'Invested (₹)',   align: 'right' as const, render: (r: CryptoHolding) => INR(gbpToInr(r.qty*r.avg_price_gbp)) },
    { key: 'value_inr',     header: 'Value (₹)',      align: 'right' as const, render: (r: CryptoHolding) => { const ltp=getLTPGbp(r); const val=gbpToInr(ltp!=null?r.qty*ltp:r.qty*r.avg_price_gbp); const inv=gbpToInr(r.qty*r.avg_price_gbp); return <span className={`font-bold ${val>=inv?"text-green":"text-red"}`}>{INR(val)}</span> }},
    { key: 'gain',          header: 'Gain / Loss',    align: 'right' as const, render: (r: CryptoHolding) => {
      const ltp=getLTPGbp(r); const inv=gbpToInr(r.qty*r.avg_price_gbp); const val=gbpToInr(ltp!=null?r.qty*ltp:r.qty*r.avg_price_gbp)
      const {gain,gainPct,isPositive}=calcGain(val,inv)
      return <span className={`font-bold ${isPositive?'text-green':'text-red'}`}>{isPositive?'+':''}{INR(gain)}<br /><span className="text-[10px] font-medium opacity-80">{isPositive?'+':''}{gainPct.toFixed(1)}%</span></span>
    }},
  ]

  return (
    <PageShell title="Crypto" subtitle={`${rows.length} holding${rows.length!==1?'s':''}`}
      actions={[{ label: '+ Add Crypto', onClick: () => setEditRow({}), variant: 'primary' }, { label: '🔄', onClick: () => refetch(), variant: 'outline' }]}
    >
      <AssetPageLayout
        stats={<StatGrid items={stats} cols={4} />}
        mainTable={<AssetTable columns={cols} data={rows} rowKey={r => r.id} loading={isLoading} emptyText="No crypto holdings — click + Add Crypto" 
            onEditRow={r => setEditRow(r)}
            onDeleteRows={async ids => { for (const id of ids) await deleteMutation.mutateAsync(id); toast(`Deleted ${ids.length}`, 'success') }}
          />}
        actualInvested={<ActualInvestedPanel table="crypto_actual_invested" />}
      />
      {editRow !== null && <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleSave} />}
    </PageShell>
  )
}
