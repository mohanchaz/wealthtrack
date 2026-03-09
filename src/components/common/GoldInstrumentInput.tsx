/**
 * GoldInstrumentInput
 * Type 2+ chars → dropdown of known gold instruments with type badge.
 * On select → fetches live price via Yahoo Finance.
 */
import { useState, useEffect, useRef } from 'react'
import { fetchYahooPrices } from '../../services/priceService'

export interface GoldOption {
  name:  string       // display / instrument name
  yahoo: string       // yahoo symbol (empty = no live price)
  type:  'ETF' | 'MF' | 'SGB' | 'Physical'
}

export const GOLD_OPTIONS: GoldOption[] = [
  // ── ETFs ────────────────────────────────────────────────────
  { name: 'GOLDBEES',                        yahoo: 'GOLDBEES.NS',   type: 'ETF' },
  { name: 'Nippon India ETF Gold BeES',      yahoo: 'GOLDBEES.NS',   type: 'ETF' },
  { name: 'AXISGOLD',                        yahoo: 'AXISGOLD.NS',   type: 'ETF' },
  { name: 'Axis Gold ETF',                   yahoo: 'AXISGOLD.NS',   type: 'ETF' },
  { name: 'HDFCGOLD',                        yahoo: 'HDFCGOLD.NS',   type: 'ETF' },
  { name: 'HDFC Gold ETF',                   yahoo: 'HDFCGOLD.NS',   type: 'ETF' },
  { name: 'ICICIGOLD',                       yahoo: 'ICICIGOLD.NS',  type: 'ETF' },
  { name: 'ICICI Prudential Gold ETF',       yahoo: 'ICICIGOLD.NS',  type: 'ETF' },
  { name: 'KOTAKGOLD',                       yahoo: 'KOTAKGOLD.NS',  type: 'ETF' },
  { name: 'Kotak Gold ETF',                  yahoo: 'KOTAKGOLD.NS',  type: 'ETF' },
  { name: 'SBIGOLD',                         yahoo: 'SBIGOLD.NS',    type: 'ETF' },
  { name: 'SBI Gold ETF',                    yahoo: 'SBIGOLD.NS',    type: 'ETF' },
  { name: 'QGOLDHALF',                       yahoo: 'QGOLDHALF.NS',  type: 'ETF' },
  { name: 'Quantum Gold ETF',                yahoo: 'QGOLDHALF.NS',  type: 'ETF' },
  { name: 'BSLGOLDETF',                      yahoo: 'BSLGOLDETF.NS', type: 'ETF' },
  { name: 'Aditya Birla Sun Life Gold ETF',  yahoo: 'BSLGOLDETF.NS', type: 'ETF' },
  { name: 'INVESOGOLD',                      yahoo: 'INVESOGOLD.NS', type: 'ETF' },
  { name: 'Invesco India Gold ETF',          yahoo: 'INVESOGOLD.NS', type: 'ETF' },
  // ── Gold Savings MFs (FOFs) ──────────────────────────────────
  { name: 'Nippon India Gold Savings Fund',  yahoo: '0P0000XVDS.BO', type: 'MF' },
  { name: 'Axis Gold Fund',                  yahoo: '0P0001EKFM.BO', type: 'MF' },
  { name: 'HDFC Gold Fund',                  yahoo: '0P0000XVDT.BO', type: 'MF' },
  { name: 'ICICI Prudential Gold Savings',   yahoo: '0P0000XVDV.BO', type: 'MF' },
  { name: 'Kotak Gold Fund',                 yahoo: '0P0000XVDU.BO', type: 'MF' },
  { name: 'SBI Gold Fund',                   yahoo: '0P0001AF3P.BO', type: 'MF' },
  { name: 'Quantum Gold Savings Fund',       yahoo: '0P0000XV6Q.BO', type: 'MF' },
  { name: 'DSP World Gold Fund',             yahoo: '0P0000XVDW.BO', type: 'MF' },
  // ── SGBs ────────────────────────────────────────────────────
  { name: 'Sovereign Gold Bond (SGB)',       yahoo: '',              type: 'SGB' },
  // ── Physical ────────────────────────────────────────────────
  { name: 'Physical Gold',                   yahoo: 'GC=F',          type: 'Physical' },
  { name: 'Gold Jewellery',                  yahoo: '',              type: 'Physical' },
]

const TYPE_COLORS: Record<string, string> = {
  ETF:      'bg-amber/15 text-amber-700',
  MF:       'bg-teal/15 text-teal',
  SGB:      'bg-purple-100 text-purple-700',
  Physical: 'bg-surface2 text-textmut',
}

interface LiveResult {
  name:   string
  yahoo:  string
  price:  number | null
  status: 'idle' | 'fetching' | 'found' | 'notfound'
}

interface Props {
  value:    string
  onChange: (name: string) => void
  onLive?:  (result: LiveResult) => void
}

export function GoldInstrumentInput({ value, onChange, onLive }: Props) {
  const [query,       setQuery]       = useState(value)
  const [suggestions, setSuggestions] = useState<GoldOption[]>([])
  const [open,        setOpen]        = useState(false)
  const [live,        setLive]        = useState<LiveResult>({ name: '', yahoo: '', price: null, status: 'idle' })
  const wrapRef = useRef<HTMLDivElement>(null)

  // Filter suggestions
  useEffect(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) { setSuggestions([]); setOpen(false); return }
    const matches = GOLD_OPTIONS.filter(o =>
      o.name.toLowerCase().includes(q)
    ).slice(0, 8)
    // Deduplicate by yahoo symbol
    const seen = new Set<string>()
    const deduped = matches.filter(o => {
      const k = o.yahoo || o.name
      if (seen.has(k)) return false
      seen.add(k); return true
    })
    setSuggestions(deduped)
    setOpen(deduped.length > 0)
  }, [query])

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const fetchPrice = async (opt: GoldOption) => {
    if (!opt.yahoo) {
      const r: LiveResult = { name: opt.name, yahoo: '', price: null, status: 'notfound' }
      setLive(r); onLive?.(r); return
    }
    setLive(l => ({ ...l, status: 'fetching' }))
    try {
      const map = await fetchYahooPrices([opt.yahoo])
      const key = opt.yahoo.replace(/\.(NS|BO)$/, '').replace(/=F$/, '')
      // Try both key forms
      const entry = map[key] ?? map[opt.yahoo]
      const r: LiveResult = entry
        ? { name: opt.name, yahoo: opt.yahoo, price: entry.price, status: 'found' }
        : { name: opt.name, yahoo: opt.yahoo, price: null,        status: 'notfound' }
      setLive(r); onLive?.(r)
    } catch {
      setLive({ name: opt.name, yahoo: opt.yahoo, price: null, status: 'notfound' })
    }
  }

  const selectOption = (opt: GoldOption) => {
    setQuery(opt.name)
    onChange(opt.name)
    setOpen(false)
    setSuggestions([])
    fetchPrice(opt)
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    onChange(e.target.value)
    setLive({ name: '', yahoo: '', price: null, status: 'idle' })
  }

  const INR = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div ref={wrapRef} className="relative flex flex-col gap-1.5">
      <label className="text-[10px] font-bold tracking-wider uppercase text-textmut">
        Instrument / Name
      </label>

      <div className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 bg-surface transition-colors
        ${live.status === 'found'    ? 'border-green ring-1 ring-green/20' :
          live.status === 'notfound' ? 'border-amber/50' :
          'border-border focus-within:border-ink/30 focus-within:ring-1 focus-within:ring-ink/10'}`}
      >
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="e.g. GOLDBEES or Nippon India Gold"
          className="flex-1 bg-transparent text-sm text-textprim outline-none placeholder:text-textfade"
          autoComplete="off"
        />
        {live.status === 'fetching' && (
          <span className="text-xs text-textmut animate-pulse">fetching…</span>
        )}
        {live.status === 'found' && (
          <span className="text-xs text-green font-semibold">✓</span>
        )}
      </div>

      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-surface border border-border rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((opt, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => selectOption(opt)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface2 transition-colors text-left"
            >
              <span className="text-sm text-textprim flex-1 truncate">{opt.name}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLORS[opt.type]}`}>
                {opt.type}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Live price badge */}
      {live.status === 'found' && live.price != null && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs font-mono font-bold text-green bg-green/10 px-2 py-0.5 rounded-full">
            {INR(live.price)}
          </span>
          <span className="text-[10px] text-textmut">● Live · {live.yahoo}</span>
        </div>
      )}
      {live.status === 'found' && live.price == null && (
        <p className="text-xs text-textmut px-1">No live price available for this instrument.</p>
      )}
      {live.status === 'notfound' && !live.yahoo && (
        <p className="text-xs text-textmut px-1">No live price available — value tracked at avg cost.</p>
      )}
    </div>
  )
}
