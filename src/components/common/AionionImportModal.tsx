import { useState } from 'react'
import { useAuthStore }   from '../../store/authStore'
import { useQueryClient } from '@tanstack/react-query'
import { replaceAssets }  from '../../services/assetService'
import { useToastStore }  from '../../store/toastStore'

interface AionionHolding {
  symbol:    string
  qty:       number
  avg_cost:  number
  type:      'stock' | 'gold'
}

function parseAionionJson(raw: string): AionionHolding[] | null {
  try {
    const json = JSON.parse(raw)
    const items = Array.isArray(json) ? json : (json.data ?? null)
    if (!Array.isArray(items)) return null

    return items
      .filter((item: any) => item.symbol && item.qty > 0)
      .map((item: any): AionionHolding => ({
        symbol:   (item.symbol ?? '').toUpperCase().trim(),
        qty:      parseFloat(item.qty ?? 0),
        avg_cost: parseFloat(item.raw_avgPrice ?? item.avgPrice ?? 0),
        type:     item.rawInstrumentType === 'GOLD_ETF' ? 'gold' : 'stock',
      }))
      .filter((h: AionionHolding) => h.symbol && h.qty > 0 && h.avg_cost > 0)
  } catch {
    return null
  }
}

interface Props {
  onClose: () => void
  /** if set, only import this type */
  filter?: 'stock' | 'gold'
}

export function AionionImportModal({ onClose, filter }: Props) {
  const userId   = useAuthStore(s => s.user?.id)!
  const toast    = useToastStore(s => s.show)
  const qc       = useQueryClient()
  const [raw,      setRaw]      = useState('')
  const [parsed,   setParsed]   = useState<AionionHolding[] | null>(null)
  const [parseErr, setParseErr] = useState('')
  const [importing, setImporting] = useState(false)

  const title = filter === 'gold' ? 'Aionion Gold' : filter === 'stock' ? 'Aionion Stocks' : 'Aionion'

  function handleParse() {
    setParseErr('')
    if (!raw.trim()) { setParseErr('Paste the JSON first.'); return }
    const result = parseAionionJson(raw.trim())
    if (!result) { setParseErr('Could not parse — make sure you pasted the full JSON response.'); return }
    const filtered = filter ? result.filter(h => h.type === filter) : result
    if (filtered.length === 0) { setParseErr(`No ${filter ?? ''} holdings found in the pasted data.`); return }
    setParsed(filtered)
  }

  async function handleImport() {
    if (!parsed) return
    setImporting(true)
    try {
      const stocks = parsed.filter(h => h.type === 'stock')
      const gold   = parsed.filter(h => h.type === 'gold')

      if (stocks.length && (!filter || filter === 'stock')) {
        await replaceAssets('aionion_stocks', userId, stocks.map(h => ({
          user_id:    userId,
          instrument: h.symbol,
          qty:        h.qty,
          avg_cost:   h.avg_cost,
        })))
        qc.invalidateQueries({ queryKey: ['aionion_stocks', userId] })
      }

      if (gold.length && (!filter || filter === 'gold')) {
        await replaceAssets('aionion_gold', userId, gold.map(h => ({
          user_id:    userId,
          instrument: h.symbol,
          qty:        h.qty,
          avg_cost:   h.avg_cost,
        })))
        qc.invalidateQueries({ queryKey: ['aionion_gold', userId] })
      }

      const total = ((!filter || filter === 'stock') ? stocks.length : 0) +
                    ((!filter || filter === 'gold')  ? gold.length  : 0)
      toast(`${total} ${title} holdings imported ✅`, 'success')
      onClose()
    } catch (e: any) {
      toast(e.message ?? 'Import failed', 'error')
    } finally {
      setImporting(false)
    }
  }

  const displayed = parsed ?? []
  const stocks    = displayed.filter(h => h.type === 'stock')
  const gold      = displayed.filter(h => h.type === 'gold')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] w-full max-w-lg flex flex-col max-h-[88vh]"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EEE9]">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-teal-50 flex items-center justify-center text-sm">📥</div>
              <h3 className="text-[15px] font-black text-[#1A1A1A]">Import from Aionion</h3>
            </div>
            <p className="text-[11px] text-[#767676] mt-0.5">Paste the JSON from pv.aionioncapital.com/api/users/portfolio</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#ABABAB] hover:text-[#1A1A1A] hover:bg-[#F5F4F0] transition-colors text-lg leading-none">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!parsed ? (
            <>
              {/* Instructions */}
              <div className="bg-[#F0FBF9] border border-[#D1FAE5] rounded-xl px-4 py-3 mb-4">
                <p className="text-[11px] font-semibold text-[#065F46] mb-2">How to get the JSON</p>
                <ol className="text-[11px] text-[#047857] space-y-1 list-decimal list-inside leading-relaxed">
                  <li>Open Aionion in another tab and log in</li>
                  <li>Visit: <code className="bg-teal-100 px-1 rounded text-[10px] font-mono">pv.aionioncapital.com/api/users/portfolio?clientCode=YOUR_CODE</code></li>
                  <li>Press <kbd className="bg-white border border-teal-200 rounded px-1 text-[10px]">Ctrl+A</kbd> then <kbd className="bg-white border border-teal-200 rounded px-1 text-[10px]">Ctrl+C</kbd> to copy all</li>
                  <li>Paste below and click Preview</li>
                </ol>
              </div>

              <div className="mb-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#767676] mb-1.5 block">
                  Paste JSON here
                </label>
                <textarea
                  value={raw}
                  onChange={e => { setRaw(e.target.value); setParseErr('') }}
                  placeholder='{"success":true,"data":[...]}' 
                  rows={8}
                  className="w-full rounded-xl bg-[#F5F4F0] border border-[#E0DDD6] text-[11px] text-[#1A1A1A] font-mono placeholder:text-[#ABABAB] outline-none px-3.5 py-3 focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 focus:bg-white transition-all resize-none"
                />
              </div>

              {parseErr && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 mt-2">
                  <span className="text-red-500 text-xs mt-0.5">⚠</span>
                  <p className="text-[12px] text-[#C0392B]">{parseErr}</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-semibold text-[#1A1A1A]">
                  {displayed.length} holding{displayed.length !== 1 ? 's' : ''} found
                  {stocks.length > 0 && gold.length > 0 && (
                    <span className="text-[11px] text-[#767676] font-normal ml-2">
                      ({stocks.length} stock{stocks.length !== 1 ? 's' : ''} · {gold.length} gold)
                    </span>
                  )}
                </p>
                <button onClick={() => { setParsed(null); setRaw('') }}
                  className="text-[11px] text-[#767676] hover:text-[#1A1A1A] underline underline-offset-2">
                  ← Paste again
                </button>
              </div>

              {/* Preview table */}
              <div className="rounded-xl border border-[#E0DDD6] overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2 bg-[#F5F4F0] border-b border-[#E0DDD6]">
                  {['Symbol', 'Type', 'Qty', 'Avg Price'].map(h => (
                    <span key={h} className="text-[9px] font-bold uppercase tracking-widest text-[#767676]">{h}</span>
                  ))}
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-[#F0EEE9]">
                  {displayed.map((h, i) => (
                    <div key={h.symbol} className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2 text-[12px] ${i % 2 === 1 ? 'bg-[#FAFAF8]' : ''}`}>
                      <span className="font-bold text-[#1A1A1A] font-mono">{h.symbol}</span>
                      <span className={`text-center text-[9px] font-bold px-1.5 py-0.5 rounded self-center ${
                        h.type === 'gold' ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {h.type === 'gold' ? 'Gold' : 'Equity'}
                      </span>
                      <span className="text-right text-[#1A1A1A] font-mono">{h.qty.toFixed(4)}</span>
                      <span className="text-right text-[#1A1A1A] font-mono">₹{h.avg_cost.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-[#767676] mt-2">
                ⚠ This will <strong>replace</strong> your existing {title} holdings with the above data.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#F0EEE9] flex gap-2">
          <button onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-[#E0DDD6] bg-[#F5F4F0] text-[#767676] text-[13px] font-semibold hover:bg-[#EFEDE8] transition-all">
            Cancel
          </button>
          {!parsed ? (
            <button onClick={handleParse} disabled={!raw.trim()}
              className="flex-1 h-10 rounded-xl bg-[#0F766E] text-white text-[13px] font-bold hover:bg-[#0D4F4A] transition-all disabled:opacity-40">
              Preview →
            </button>
          ) : (
            <button onClick={handleImport} disabled={importing}
              className="flex-1 h-10 rounded-xl bg-[#0F766E] text-white text-[13px] font-bold hover:bg-[#0D4F4A] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {importing && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />}
              {importing ? 'Importing…' : `Import ${displayed.length} holdings`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
