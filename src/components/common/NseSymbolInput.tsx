/**
 * NseSymbolInput
 * Type 2+ letters → shows matching NSE symbols with company names.
 * On selection → fetches live price from /api/prices.
 * Shows company name + LTP badge inline below the input.
 */
import { useState, useEffect, useRef } from 'react'
import { fetchNsePrices } from '../../services/priceService'

// Top ~200 NSE symbols with display names
const NSE_SYMBOLS: { sym: string; name: string }[] = [
  { sym: 'ABCAPITAL',    name: 'Aditya Birla Capital' },
  { sym: 'ABFRL',        name: 'Aditya Birla Fashion & Retail' },
  { sym: 'ACC',          name: 'ACC Ltd' },
  { sym: 'ADANIENT',     name: 'Adani Enterprises' },
  { sym: 'ADANIGREEN',   name: 'Adani Green Energy' },
  { sym: 'ADANIPORTS',   name: 'Adani Ports & SEZ' },
  { sym: 'ADANIPOWER',   name: 'Adani Power' },
  { sym: 'ALKEM',        name: 'Alkem Laboratories' },
  { sym: 'AMBUJACEM',    name: 'Ambuja Cements' },
  { sym: 'APOLLOHOSP',   name: 'Apollo Hospitals' },
  { sym: 'APOLLOTYRE',   name: 'Apollo Tyres' },
  { sym: 'ARCE&M',       name: 'Amara Raja Energy & Mobility' },
  { sym: 'ARE&M',        name: 'Amara Raja Energy & Mobility' },
  { sym: 'ASIANPAINT',   name: 'Asian Paints' },
  { sym: 'ASTRAL',       name: 'Astral Ltd' },
  { sym: 'ATUL',         name: 'Atul Ltd' },
  { sym: 'AUBANK',       name: 'AU Small Finance Bank' },
  { sym: 'AUROPHARMA',   name: 'Aurobindo Pharma' },
  { sym: 'AXISBANK',     name: 'Axis Bank' },
  { sym: 'BAJAJ-AUTO',   name: 'Bajaj Auto' },
  { sym: 'BAJAJFINSV',   name: 'Bajaj Finserv' },
  { sym: 'BAJAJHFL',     name: 'Bajaj Housing Finance' },
  { sym: 'BAJFINANCE',   name: 'Bajaj Finance' },
  { sym: 'BALKRISIND',   name: 'Balkrishna Industries' },
  { sym: 'BANDHANBNK',   name: 'Bandhan Bank' },
  { sym: 'BANKBARODA',   name: 'Bank of Baroda' },
  { sym: 'BATAINDIA',    name: 'Bata India' },
  { sym: 'BEL',          name: 'Bharat Electronics' },
  { sym: 'BERGEPAINT',   name: 'Berger Paints' },
  { sym: 'BHARATFORG',   name: 'Bharat Forge' },
  { sym: 'BHARTIARTL',   name: 'Bharti Airtel' },
  { sym: 'BHEL',         name: 'Bharat Heavy Electricals' },
  { sym: 'BIOCON',       name: 'Biocon' },
  { sym: 'BOSCHLTD',     name: 'Bosch Ltd' },
  { sym: 'BPCL',         name: 'Bharat Petroleum' },
  { sym: 'BRITANNIA',    name: 'Britannia Industries' },
  { sym: 'BSE',          name: 'BSE Ltd' },
  { sym: 'CANBK',        name: 'Canara Bank' },
  { sym: 'CGPOWER',      name: 'CG Power & Industrial Solutions' },
  { sym: 'CHOLAFIN',     name: 'Cholamandalam Investment' },
  { sym: 'CIPLA',        name: 'Cipla' },
  { sym: 'COALINDIA',    name: 'Coal India' },
  { sym: 'COFORGE',      name: 'Coforge' },
  { sym: 'COLPAL',       name: 'Colgate-Palmolive India' },
  { sym: 'CONCOR',       name: 'Container Corporation of India' },
  { sym: 'CUMMINSIND',   name: 'Cummins India' },
  { sym: 'DABUR',        name: 'Dabur India' },
  { sym: 'DELHIVERY',    name: 'Delhivery' },
  { sym: 'DELTACORP',    name: 'Delta Corp' },
  { sym: 'DIVISLAB',     name: "Divi's Laboratories" },
  { sym: 'DLF',          name: 'DLF Ltd' },
  { sym: 'DMART',        name: 'Avenue Supermarts (DMart)' },
  { sym: 'DRREDDY',      name: "Dr. Reddy's Laboratories" },
  { sym: 'EICHERMOT',    name: 'Eicher Motors' },
  { sym: 'ESCORTS',      name: 'Escorts Kubota' },
  { sym: 'EXIDEIND',     name: 'Exide Industries' },
  { sym: 'FEDERALBNK',   name: 'Federal Bank' },
  { sym: 'GAIL',         name: 'GAIL India' },
  { sym: 'GLAND',        name: 'Gland Pharma' },
  { sym: 'GLAXO',        name: 'GSK Pharmaceuticals' },
  { sym: 'GMRAIRPORT',   name: 'GMR Airports Infrastructure' },
  { sym: 'GMRINFRA',     name: 'GMR Infrastructure' },
  { sym: 'GODREJCP',     name: 'Godrej Consumer Products' },
  { sym: 'GODREJPROP',   name: 'Godrej Properties' },
  { sym: 'GRANULES',     name: 'Granules India' },
  { sym: 'GRASIM',       name: 'Grasim Industries' },
  { sym: 'GSPL',         name: 'Gujarat State Petronet' },
  { sym: 'HAL',          name: 'Hindustan Aeronautics' },
  { sym: 'HAVELLS',      name: 'Havells India' },
  { sym: 'HCLTECH',      name: 'HCL Technologies' },
  { sym: 'HDFCAMC',      name: 'HDFC AMC' },
  { sym: 'HDFCBANK',     name: 'HDFC Bank' },
  { sym: 'HDFCLIFE',     name: 'HDFC Life Insurance' },
  { sym: 'HEROMOTOCO',   name: 'Hero MotoCorp' },
  { sym: 'HINDALCO',     name: 'Hindalco Industries' },
  { sym: 'HINDPETRO',    name: 'Hindustan Petroleum' },
  { sym: 'HINDUNILVR',   name: 'Hindustan Unilever' },
  { sym: 'HONAUT',       name: 'Honeywell Automation' },
  { sym: 'ICICIBANK',    name: 'ICICI Bank' },
  { sym: 'ICICIGI',      name: 'ICICI Lombard General Insurance' },
  { sym: 'ICICIPRULI',   name: 'ICICI Prudential Life Insurance' },
  { sym: 'IDFCFIRSTB',   name: 'IDFC First Bank' },
  { sym: 'IEX',          name: 'Indian Energy Exchange' },
  { sym: 'INDHOTEL',     name: 'Indian Hotels (Taj)' },
  { sym: 'INDIAMART',    name: 'IndiaMART InterMESH' },
  { sym: 'INDIGO',       name: 'InterGlobe Aviation (IndiGo)' },
  { sym: 'INDUSINDBK',   name: 'IndusInd Bank' },
  { sym: 'INDUSTOWER',   name: 'Indus Towers' },
  { sym: 'INFY',         name: 'Infosys' },
  { sym: 'IOC',          name: 'Indian Oil Corporation' },
  { sym: 'IPCALAB',      name: 'IPCA Laboratories' },
  { sym: 'ITC',          name: 'ITC Ltd' },
  { sym: 'JKCEMENT',     name: 'JK Cement' },
  { sym: 'JSL',          name: 'Jindal Stainless' },
  { sym: 'JSWENERGY',    name: 'JSW Energy' },
  { sym: 'JSWSTEEL',     name: 'JSW Steel' },
  { sym: 'JUBLFOOD',     name: "Jubilant Foodworks (Domino's)" },
  { sym: 'KALYANKJIL',   name: 'Kalyan Jewellers' },
  { sym: 'KOTAKBANK',    name: 'Kotak Mahindra Bank' },
  { sym: 'KPITTECH',     name: 'KPIT Technologies' },
  { sym: 'L&TFH',        name: 'L&T Finance' },
  { sym: 'LICI',         name: 'Life Insurance Corporation' },
  { sym: 'LTIM',         name: 'LTIMindtree' },
  { sym: 'LTTS',         name: 'L&T Technology Services' },
  { sym: 'LT',           name: 'Larsen & Toubro' },
  { sym: 'LUPIN',        name: 'Lupin' },
  { sym: 'M&M',          name: 'Mahindra & Mahindra' },
  { sym: 'M&MFIN',       name: 'Mahindra & Mahindra Financial' },
  { sym: 'MANAPPURAM',   name: 'Manappuram Finance' },
  { sym: 'MARICO',       name: 'Marico' },
  { sym: 'MARUTI',       name: 'Maruti Suzuki' },
  { sym: 'MCX',          name: 'Multi Commodity Exchange' },
  { sym: 'MFSL',         name: 'Max Financial Services' },
  { sym: 'MPHASIS',      name: 'Mphasis' },
  { sym: 'MRF',          name: 'MRF Ltd' },
  { sym: 'MUTHOOTFIN',   name: 'Muthoot Finance' },
  { sym: 'NAM-INDIA',    name: 'Nippon India Mutual Fund AMC' },
  { sym: 'NATIONALUM',   name: 'National Aluminium' },
  { sym: 'NAUKRI',       name: 'Info Edge (Naukri)' },
  { sym: 'NAVINFLUOR',   name: 'Navin Fluorine' },
  { sym: 'NESTLEIND',    name: 'Nestlé India' },
  { sym: 'NIFTY',        name: 'Nifty 50 Index' },
  { sym: 'NMDC',         name: 'NMDC Ltd' },
  { sym: 'NTPC',         name: 'NTPC Ltd' },
  { sym: 'OFSS',         name: 'Oracle Financial Services' },
  { sym: 'OIL',          name: 'Oil India' },
  { sym: 'ONGC',         name: 'Oil & Natural Gas Corporation' },
  { sym: 'PAGEIND',      name: 'Page Industries (Jockey)' },
  { sym: 'PAYTM',        name: 'One97 Communications (Paytm)' },
  { sym: 'PEL',          name: 'Piramal Enterprises' },
  { sym: 'PERSISTENT',   name: 'Persistent Systems' },
  { sym: 'PETRONET',     name: 'Petronet LNG' },
  { sym: 'PFC',          name: 'Power Finance Corporation' },
  { sym: 'PHOENIXLTD',   name: 'Phoenix Mills' },
  { sym: 'PIDILITIND',   name: 'Pidilite Industries (Fevicol)' },
  { sym: 'PIIND',        name: 'PI Industries' },
  { sym: 'PNB',          name: 'Punjab National Bank' },
  { sym: 'POLYCAB',      name: 'Polycab India' },
  { sym: 'POONAWALLA',   name: 'Poonawalla Fincorp' },
  { sym: 'POWERGRID',    name: 'Power Grid Corporation' },
  { sym: 'PRESTIGE',     name: 'Prestige Estates' },
  { sym: 'PVRINOX',      name: 'PVR INOX' },
  { sym: 'RAJESHEXPO',   name: 'Rajesh Exports' },
  { sym: 'RAMCOCEM',     name: 'Ramco Cements' },
  { sym: 'RECLTD',       name: 'REC Ltd' },
  { sym: 'RELIANCE',     name: 'Reliance Industries' },
  { sym: 'RITES',        name: 'RITES Ltd' },
  { sym: 'SAIL',         name: 'Steel Authority of India' },
  { sym: 'SBICARD',      name: 'SBI Cards' },
  { sym: 'SBILIFE',      name: 'SBI Life Insurance' },
  { sym: 'SBIN',         name: 'State Bank of India' },
  { sym: 'SCHAEFFLER',   name: 'Schaeffler India' },
  { sym: 'SHREECEM',     name: 'Shree Cement' },
  { sym: 'SHRIRAMFIN',   name: 'Shriram Finance' },
  { sym: 'SIEMENS',      name: 'Siemens India' },
  { sym: 'SONACOMS',     name: 'Sona BLW Precision' },
  { sym: 'SRF',          name: 'SRF Ltd' },
  { sym: 'SUNPHARMA',    name: 'Sun Pharmaceutical' },
  { sym: 'SUNTV',        name: 'Sun TV Network' },
  { sym: 'SUPREMEIND',   name: 'Supreme Industries' },
  { sym: 'SYNGENE',      name: 'Syngene International' },
  { sym: 'TATACHEM',     name: 'Tata Chemicals' },
  { sym: 'TATACOMM',     name: 'Tata Communications' },
  { sym: 'TATACONSUMER', name: 'Tata Consumer Products' },
  { sym: 'TATAELXSI',    name: 'Tata Elxsi' },
  { sym: 'TATAMOTORS',   name: 'Tata Motors' },
  { sym: 'TATAPOWER',    name: 'Tata Power' },
  { sym: 'TATASTEEL',    name: 'Tata Steel' },
  { sym: 'TCS',          name: 'Tata Consultancy Services' },
  { sym: 'TECHM',        name: 'Tech Mahindra' },
  { sym: 'TIINDIA',      name: 'Tube Investments of India' },
  { sym: 'TITAN',        name: 'Titan Company' },
  { sym: 'TORNTPHARM',   name: 'Torrent Pharmaceuticals' },
  { sym: 'TORNTPOWER',   name: 'Torrent Power' },
  { sym: 'TRENT',        name: 'Trent Ltd (Westside/Zudio)' },
  { sym: 'TVSMOTOR',     name: 'TVS Motor Company' },
  { sym: 'UBL',          name: 'United Breweries' },
  { sym: 'ULTRACEMCO',   name: 'UltraTech Cement' },
  { sym: 'UNIONBANK',    name: 'Union Bank of India' },
  { sym: 'UPL',          name: 'UPL Ltd' },
  { sym: 'VEDL',         name: 'Vedanta Ltd' },
  { sym: 'VOLTAS',       name: 'Voltas' },
  { sym: 'WIPRO',        name: 'Wipro' },
  { sym: 'YESBANK',      name: 'Yes Bank' },
  { sym: 'ZOMATO',       name: 'Zomato' },
  { sym: 'ZYDUSLIFE',    name: 'Zydus Lifesciences' },
]

interface LiveResult {
  symbol:  string
  name:    string
  price:   number | null
  status:  'idle' | 'fetching' | 'found' | 'notfound'
}

interface Props {
  value:    string
  onChange: (symbol: string) => void
  onLive?:  (result: LiveResult) => void
}

export function NseSymbolInput({ value, onChange, onLive }: Props) {
  const [query,       setQuery]       = useState(value)
  const [suggestions, setSuggestions] = useState<typeof NSE_SYMBOLS>([])
  const [open,        setOpen]        = useState(false)
  const [live,        setLive]        = useState<LiveResult>({ symbol: '', name: '', price: null, status: 'idle' })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef     = useRef<HTMLDivElement>(null)

  // Filter suggestions as user types
  useEffect(() => {
    const q = query.trim().toUpperCase()
    if (q.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }
    const matches = NSE_SYMBOLS.filter(s =>
      s.sym.startsWith(q) || s.name.toUpperCase().includes(q)
    ).slice(0, 8)
    setSuggestions(matches)
    setOpen(matches.length > 0)
  }, [query])

  // Fetch live price when query is an exact symbol match or user stops typing
  useEffect(() => {
    const sym = query.trim().toUpperCase()
    if (sym.length < 2) {
      setLive({ symbol: '', name: '', price: null, status: 'idle' })
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLive(l => ({ ...l, status: 'fetching' }))
      try {
        const map = await fetchNsePrices([sym])
        const entry = map[sym]
        if (entry) {
          const result: LiveResult = { symbol: sym, name: entry.name ?? '', price: entry.price, status: 'found' }
          setLive(result)
          onLive?.(result)
        } else {
          setLive({ symbol: sym, name: '', price: null, status: 'notfound' })
          onLive?.({ symbol: sym, name: '', price: null, status: 'notfound' })
        }
      } catch {
        setLive({ symbol: sym, name: '', price: null, status: 'notfound' })
      }
    }, 600)
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectSymbol = async (sym: string, name: string) => {
    setQuery(sym)
    onChange(sym)
    setOpen(false)
    setSuggestions([])
    // Immediately fetch live price for selected symbol
    setLive({ symbol: sym, name, price: null, status: 'fetching' })
    try {
      const map = await fetchNsePrices([sym])
      const entry = map[sym]
      const result: LiveResult = entry
        ? { symbol: sym, name: entry.name ?? name, price: entry.price, status: 'found' }
        : { symbol: sym, name, price: null, status: 'notfound' }
      setLive(result)
      onLive?.(result)
    } catch {
      setLive({ symbol: sym, name, price: null, status: 'notfound' })
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase()
    setQuery(val)
    onChange(val)
  }

  const INR = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div ref={wrapRef} className="relative flex flex-col gap-1.5">
      <label className="text-[10px] font-bold tracking-wider uppercase text-textmut">
        NSE Symbol
      </label>

      {/* Input */}
      <div className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 bg-surface transition-colors
        ${live.status === 'found'     ? 'border-green ring-1 ring-green/20' :
          live.status === 'notfound'  ? 'border-red/50 ring-1 ring-red/10' :
          'border-border focus-within:border-ink/30 focus-within:ring-1 focus-within:ring-ink/10'}`}
      >
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="e.g. INFY"
          className="flex-1 bg-transparent text-sm font-mono font-bold text-textprim outline-none placeholder:text-textfade placeholder:font-normal"
          autoComplete="off"
          spellCheck={false}
        />
        {live.status === 'fetching' && (
          <span className="text-xs text-textmut animate-pulse">checking…</span>
        )}
        {live.status === 'found' && (
          <span className="text-xs text-green font-semibold">✓</span>
        )}
        {live.status === 'notfound' && query.length >= 2 && (
          <span className="text-xs text-red/70">not found</span>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-surface border border-border rounded-xl shadow-lg overflow-hidden">
          {suggestions.map(s => (
            <button
              key={s.sym}
              type="button"
              onMouseDown={() => selectSymbol(s.sym, s.name)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface2 transition-colors text-left"
            >
              <span className="font-mono font-bold text-sm text-textprim w-28 shrink-0">{s.sym}</span>
              <span className="text-xs text-textmut truncate">{s.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Live price badge */}
      {live.status === 'found' && live.price != null && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs font-semibold text-textprim">{live.name || live.symbol}</span>
          <span className="text-xs font-mono font-bold text-green bg-green/10 px-2 py-0.5 rounded-full">
            {INR(live.price)}
          </span>
          <span className="text-[10px] text-textmut">● Live NSE</span>
        </div>
      )}
      {live.status === 'notfound' && query.length >= 2 && (
        <p className="text-xs text-red/70 px-1">Symbol not found on NSE — check the ticker and try again.</p>
      )}
    </div>
  )
}
