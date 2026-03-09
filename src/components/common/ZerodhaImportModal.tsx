/**
 * ZerodhaImportModal
 * One-shot import from a Zerodha combined holdings CSV.
 * Parses Stocks, Mutual Funds, and Gold in a single pass and
 * upserts each set into its respective Supabase table.
 */
import { useState, useRef } from 'react'
import { useQueryClient }   from '@tanstack/react-query'
import { useAuthStore }     from '../../store/authStore'
import { useToastStore }    from '../../store/toastStore'
import { replaceAssets }    from '../../services/assetService'
import { Modal }            from '../ui/Modal'
import { Button }           from '../ui/Button'
import { parseCsvRows, cleanNum } from '../../lib/csvParser'
import type { StockHolding, MfHolding, GoldHolding } from '../../types/assets'

// ── Gold lookup ──────────────────────────────────────────────
const GOLD_LOOKUP: { match: RegExp; type: string; yahoo: string }[] = [
  { match: /goldbees/i,     type: 'ETF', yahoo: 'GOLDBEES.NS'    },
  { match: /nippon.*gold/i, type: 'MF',  yahoo: '0P0000XVDS.BO'  },
  { match: /axis.*gold/i,   type: 'ETF', yahoo: 'AXISGOLD.NS'    },
  { match: /hdfc.*gold/i,   type: 'ETF', yahoo: 'HDFCGOLD.NS'    },
  { match: /icici.*gold/i,  type: 'ETF', yahoo: 'ICICIGOLD.NS'   },
  { match: /kotak.*gold/i,  type: 'ETF', yahoo: 'KOTAKGOLD.NS'   },
  { match: /sbi.*gold/i,    type: 'ETF', yahoo: 'SBIGOLD.NS'     },
  { match: /quantum.*gold/i,type: 'MF',  yahoo: '0P0000XV6Q.BO'  },
  { match: /invesco.*gold/i,type: 'MF',  yahoo: ''               },
  { match: /dsp.*gold/i,    type: 'MF',  yahoo: ''               },
]
function lookupGold(name: string) {
  for (const e of GOLD_LOOKUP) if (e.match.test(name)) return { type: e.type, yahoo: e.yahoo }
  return { type: /fund/i.test(name) ? 'MF' : 'ETF', yahoo: '' }
}

// ── MF symbol lookup ─────────────────────────────────────────
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
function lookupMfSymbol(name: string): string | null {
  const key = name.trim().toLowerCase()
  if (FUND_SYMBOL_MAP[key]) return FUND_SYMBOL_MAP[key]
  for (const [k, sym] of Object.entries(FUND_SYMBOL_MAP))
    if (key.includes(k) || k.includes(key)) return sym
  return null
}

// ── Stock row detection ──────────────────────────────────────
const GOLD_ETF_SYMBOLS = new Set([
  'GOLDBEES','GOLDIETF','AXISGOLD','HDFCGOLD','ICICIGOLD','KOTAKGOLD',
  'NIPGOLD','SBIGOLD','QGOLDHALF','BSLGOLDETF','LICMFGOLD','MAFANG',
  'SILVERBEES','SILVERETF','SILVER','SILVERIETF',
])
const ETF_PATTERN = /BEES$|ETF$|FUND$|INDEX$/i

// NCD/Bond symbols from Zerodha start with digits (e.g. 1075MML027, 12ACAPL27B, 985ACAPL26)
// Also filter Sovereign Gold Bonds (SGBSEP28, SGBMAR29, etc.)
const NCD_BOND_PATTERN = /^\d+[A-Z]|^SGB[A-Z]/i

function isStockRow(rawName: string): boolean {
  const name = rawName.trim()
  if (!name || name.includes(' ')) return false
  const upper = name.toUpperCase()
  if (GOLD_ETF_SYMBOLS.has(upper)) return false
  if (ETF_PATTERN.test(upper)) return false
  if (NCD_BOND_PATTERN.test(upper)) return false   // skip NCDs, bonds, SGBs
  return true
}

// ── Main parser — returns all three buckets from one CSV ──────
interface ParseResult {
  stocks: Omit<StockHolding, 'id' | 'user_id'>[]
  mfs:    Omit<MfHolding,    'id' | 'user_id'>[]
  gold:   Omit<GoldHolding,  'id' | 'user_id'>[]
}

function parseZerodhaAll(text: string): ParseResult | null {
  const rows = parseCsvRows(text)
  if (!rows.length) return null
  const keys   = Object.keys(rows[0])
  const find   = (...n: string[]) => keys.find(k => n.some(x => k.toLowerCase().includes(x.toLowerCase()))) ?? null
  const kName  = find('instrument', 'fund name', 'scheme', 'name')
  const kQty   = find('qty', 'units', 'quantity')
  const kAvg   = find('avg. cost', 'avg cost', 'avg nav', 'average nav', 'avg')
  if (!kName || !kQty || !kAvg) return null

  const stocks: Omit<StockHolding, 'id' | 'user_id'>[] = []
  const mfSeen = new Map<string, { qty: number; avg_cost: number }>()
  const gold:   Omit<GoldHolding,  'id' | 'user_id'>[] = []

  for (const r of rows) {
    const rawName = (r[kName] ?? '').trim()
    if (!rawName) continue
    const qty = cleanNum(r[kQty] ?? '')
    const avg = cleanNum(r[kAvg] ?? '')

    // ── Gold ──
    if (/gold/i.test(rawName)) {
      if (qty <= 0) continue
      const { type, yahoo } = lookupGold(rawName)
      gold.push({ holding_name: rawName, holding_type: type, qty, avg_cost: avg, yahoo_symbol: yahoo })
      continue
    }

    // ── Stock ──
    if (isStockRow(rawName)) {
      if (qty <= 0) continue
      stocks.push({ instrument: rawName.toUpperCase(), qty, avg_cost: avg })
      continue
    }

    // ── Mutual Fund (has spaces, mixed case, not gold) ──
    const isMf = rawName.includes(' ') && !/^[A-Z0-9&\-\.]+$/.test(rawName)
    if (isMf) {
      if (qty <= 0 && avg <= 0) continue
      const existing = mfSeen.get(rawName)
      if (existing) {
        const totalQty = existing.qty + qty
        mfSeen.set(rawName, {
          qty: totalQty,
          avg_cost: totalQty > 0
            ? (existing.qty * existing.avg_cost + qty * avg) / totalQty
            : avg,
        })
      } else {
        mfSeen.set(rawName, { qty, avg_cost: avg })
      }
    }
  }

  const mfs = Array.from(mfSeen.entries()).map(([fund_name, { qty, avg_cost }]) => ({
    fund_name,
    qty,
    avg_cost,
    nav_symbol: lookupMfSymbol(fund_name) ?? undefined,
  })) as Omit<MfHolding, 'id' | 'user_id'>[]

  return { stocks, mfs, gold }
}

// ── Component ────────────────────────────────────────────────
interface Props { onClose: () => void }

export function ZerodhaImportModal({ onClose }: Props) {
  const userId = useAuthStore(s => s.user?.id)!
  const toast  = useToastStore(s => s.show)
  const qc     = useQueryClient()

  const fileRef              = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [preview,  setPreview]  = useState<ParseResult | null>(null)
  const [error,    setError]    = useState('')
  const [saving,   setSaving]   = useState(false)

  const handleFile = (file: File) => {
    setFileName(file.name)
    setError('')
    setPreview(null)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const result = parseZerodhaAll(text)
      if (!result) {
        setError('Could not parse CSV — make sure it\'s a Zerodha holdings export.')
        return
      }
      if (!result.stocks.length && !result.mfs.length && !result.gold.length) {
        setError('No holdings found in this CSV.')
        return
      }
      setPreview(result)
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleImport = async () => {
    if (!preview || !userId) return
    setSaving(true)
    try {
      const ops: Promise<void>[] = []
      if (preview.stocks.length)
        ops.push(
          replaceAssets('zerodha_stocks', userId, preview.stocks.map(r => ({ ...r, user_id: userId }))),
        )
      if (preview.mfs.length)
        ops.push(
          replaceAssets('mf_holdings', userId, preview.mfs.map(r => ({ ...r, user_id: userId }))),
        )
      if (preview.gold.length)
        ops.push(
          replaceAssets('gold_holdings', userId, preview.gold.map(r => ({ ...r, user_id: userId }))),
        )
      await Promise.all(ops)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['zerodha_stocks', userId] }),
        qc.invalidateQueries({ queryKey: ['mf_holdings',    userId] }),
        qc.invalidateQueries({ queryKey: ['gold_holdings',  userId] }),
      ])
      const parts = [
        preview.stocks.length ? `${preview.stocks.length} stock${preview.stocks.length !== 1 ? 's' : ''}` : '',
        preview.mfs.length    ? `${preview.mfs.length} fund${preview.mfs.length !== 1 ? 's' : ''}` : '',
        preview.gold.length   ? `${preview.gold.length} gold holding${preview.gold.length !== 1 ? 's' : ''}` : '',
      ].filter(Boolean)
      toast(`Imported ${parts.join(', ')} ✅`, 'success')
      onClose()
    } catch (err) {
      toast('Import failed — please try again', 'error')
    } finally {
      setSaving(false)
    }
  }

  const total = (preview?.stocks.length ?? 0) + (preview?.mfs.length ?? 0) + (preview?.gold.length ?? 0)

  return (
    <Modal
      open
      onClose={onClose}
      title="Import from Zerodha"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleImport}
            disabled={!preview || saving}
          >
            {saving ? 'Importing…' : `Import ${total > 0 ? total + ' holdings' : ''}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Instruction */}
        <p className="text-sm text-textmut leading-relaxed">
          Export your holdings from Zerodha Kite → <span className="font-medium text-textprim">Portfolio → Holdings → Download</span>.
          The same CSV covers Stocks, Mutual Funds, and Gold — we split them automatically.
        </p>

        {/* Drop zone */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-ink/30 hover:bg-surface2/50 transition-all group"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          {fileName ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl">📄</span>
              <span className="font-semibold text-textprim text-sm">{fileName}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="text-3xl opacity-40 group-hover:opacity-60 transition-opacity">↑</span>
              <span className="text-sm font-medium text-textprim">Drop CSV here or click to browse</span>
              <span className="text-xs text-textmut">Zerodha combined holdings (.csv)</span>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red bg-red/5 border border-red/20 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Preview breakdown */}
        {preview && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-2.5 bg-surface2 border-b border-border">
              <span className="text-xs font-semibold text-textprim uppercase tracking-wider">Preview — {total} holdings found</span>
            </div>
            <div className="divide-y divide-border">
              <PreviewRow
                icon="📈"
                label="Stocks"
                count={preview.stocks.length}
                items={preview.stocks.map(s => s.instrument)}
              />
              <PreviewRow
                icon="🏦"
                label="Mutual Funds"
                count={preview.mfs.length}
                items={preview.mfs.map(m => m.fund_name)}
              />
              <PreviewRow
                icon="🥇"
                label="Gold"
                count={preview.gold.length}
                items={preview.gold.map(g => g.holding_name)}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

function PreviewRow({ icon, label, count, items }: {
  icon: string; label: string; count: number; items: string[]
}) {
  const [expanded, setExpanded] = useState(false)
  if (count === 0) return (
    <div className="flex items-center gap-3 px-4 py-3 opacity-40">
      <span className="text-base">{icon}</span>
      <span className="text-sm text-textmut flex-1">{label}</span>
      <span className="text-xs text-textmut">0 found</span>
    </div>
  )
  return (
    <div>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface2 transition-colors text-left"
      >
        <span className="text-base">{icon}</span>
        <span className="text-sm font-semibold text-textprim flex-1">{label}</span>
        <span className="text-xs font-medium text-green bg-green/10 px-2 py-0.5 rounded-full">{count}</span>
        <span className="text-xs text-textmut ml-1">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <span key={i} className="text-[10px] bg-surface2 border border-border text-textmut px-2 py-0.5 rounded-full font-mono">
              {item.length > 30 ? item.slice(0, 28) + '…' : item}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
