import React, { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../store/authStore'
import { INFolioLogo } from '../../components/INFolioLogo'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  ResponsiveContainer, XAxis, CartesianGrid,
} from 'recharts'

// ── Chart data ─────────────────────────────────────────────────
const nwData   = [14.2, 15.1, 14.8, 16.4, 17.2, 18.9, 19.4, 21.1]
const gainData = [1.2, 2.8, -0.9, 3.1, 2.4, 4.2, 1.8, 3.6]
const months   = ['Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']

// Shared card style — all cards identical width & height
const CARD: React.CSSProperties = {
  width: '100%',
  height: 300,
  borderRadius: 16,
  padding: '16px 18px',
  background: 'rgba(255,255,255,0.7)',
  border: '1px solid rgba(255,255,255,0.6)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}
const LBL: React.CSSProperties  = { fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.45)' }
const INNER: React.CSSProperties = { background: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.65)', borderRadius: 10, padding: '7px 11px' }
const SCELL: React.CSSProperties = { background: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.55)', borderRadius: 9, padding: '6px 8px', textAlign: 'center' }
const SEP: React.CSSProperties   = { borderTop: '1px solid rgba(0,0,0,0.1)', marginTop: 10, paddingTop: 10, flexShrink: 0 }
const RI: React.CSSProperties    = { background: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.55)', borderRadius: 9, padding: '7px 11px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }

function Badge({ children }: { children: React.ReactNode }) {
  return <span style={{ background: '#0F766E', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 999 }}>{children}</span>
}

// ── Card 1 — Net worth + area chart ────────────────────────────
function Card1() {
  return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, flexShrink: 0 }}>
        <div>
          <div style={{ ...LBL, marginBottom: 3 }}>TOTAL NET WORTH</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#0a2e2b', lineHeight: 1 }}>₹21.1L</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
            <Badge>▲ +48.6%</Badge>
            <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.5)' }}>since Aug 2024</span>
          </div>
        </div>
        <div style={{ ...INNER, textAlign: 'right', flexShrink: 0 }}>
          <div style={{ ...LBL, marginBottom: 2 }}>TODAY</div>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#0F766E' }}>+₹3,240</div>
          <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.45)' }}>+0.15%</div>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={months.map((m, i) => ({ m, v: nwData[i] }))} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="c1g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#0F766E" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#0F766E" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="m" tick={{ fill: 'rgba(0,0,0,0.4)', fontSize: 8 }} axisLine={false} tickLine={false} />
            <Area type="monotone" dataKey="v" stroke="#0F766E" strokeWidth={2.5} fill="url(#c1g)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ ...SEP, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }}>
        {([['Invested','₹19.3L','#0a2e2b'],['Gain','+₹1.8L','#0F766E'],['XIRR','18.4%','#0F766E'],['Assets','9 types','#0a2e2b']] as [string,string,string][]).map(([l,v,c]) => (
          <div key={l} style={SCELL}>
            <div style={{ ...LBL, marginBottom: 2 }}>{l}</div>
            <div style={{ fontSize: 11, fontWeight: 900, color: c }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Card 2 — Asset classes, no broker names ─────────────────────
function Card2() {
  const assets = [
    { name: 'Equity Stocks',  tag: 'NSE · BSE listed',    val: '₹11.5L', pct: '+10.8%', color: '#0F766E', w: 40 },
    { name: 'Mutual Funds',   tag: 'Direct & regular',     val: '₹5.2L',  pct: '+8.1%',  color: '#2563EB', w: 25 },
    { name: 'Fixed Income',   tag: 'FDs · Bonds · Debt',   val: '₹3.7L',  pct: '+7.2%',  color: '#059669', w: 18 },
    { name: 'Gold',           tag: 'Physical · ETF · SGB', val: '₹1.8L',  pct: '+5.3%',  color: '#D97706', w: 9  },
    { name: 'Crypto',         tag: 'BTC · ETH · USDT',     val: '₹1.2L',  pct: '+22.1%', color: '#7C3AED', w: 6  },
  ]
  return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexShrink: 0 }}>
        <div style={LBL}>ASSET CLASSES</div>
        <Badge>₹23.4L total</Badge>
      </div>
      <div style={{ display: 'flex', height: 5, borderRadius: 999, overflow: 'hidden', marginBottom: 10, gap: 1, flexShrink: 0 }}>
        {assets.map(a => <div key={a.name} style={{ width: `${a.w}%`, background: a.color }} />)}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, justifyContent: 'space-between' }}>
        {assets.map(a => (
          <div key={a.name} style={RI}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0a2e2b' }}>{a.name}</div>
                <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.45)' }}>{a.tag}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#0a2e2b' }}>{a.val}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#0F766E' }}>{a.pct}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Card 3 — Monthly P&L bar chart ─────────────────────────────
function Card3() {
  return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexShrink: 0 }}>
        <div>
          <div style={{ ...LBL, marginBottom: 2 }}>MONTHLY GAINS · P&L</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0a2e2b' }}>Consistent upward trend</div>
        </div>
        <Badge>7/8 positive</Badge>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={months.map((m, i) => ({ m, g: gainData[i] }))} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barSize={18}>
            <Bar dataKey="g" radius={[4, 4, 0, 0]}>
              {gainData.map((g, i) => <Cell key={i} fill={g >= 0 ? 'rgba(15,118,110,0.85)' : 'rgba(225,29,72,0.85)'} />)}
            </Bar>
            <XAxis dataKey="m" tick={{ fill: 'rgba(0,0,0,0.45)', fontSize: 8 }} axisLine={false} tickLine={false} />
            <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.05)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ ...SEP, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5 }}>
        {([['Best month','+₹4.2L','#0F766E'],['Total gain','+₹18.2L','#0a2e2b'],['Win rate','87.5%','#0F766E']] as [string,string,string][]).map(([l,v,c]) => (
          <div key={l} style={SCELL}>
            <div style={{ ...LBL, marginBottom: 2 }}>{l}</div>
            <div style={{ fontSize: 12, fontWeight: 900, color: c }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Card 4 — Financial goals ────────────────────────────────────
function Card4() {
  const goals = [
    { name: 'Emergency Fund',    target: '₹5L',  saved: '₹3.8L',  pct: 76, color: '#0F766E', eta: '4 months'  },
    { name: 'House Down Pmt',    target: '₹25L', saved: '₹11.2L', pct: 45, color: '#2563EB', eta: '18 months' },
    { name: 'Retirement Corpus', target: '₹2Cr', saved: '₹21L',   pct: 10, color: '#7C3AED', eta: '22 years'  },
    { name: 'Foreign Trip',      target: '₹2L',  saved: '₹1.6L',  pct: 80, color: '#D97706', eta: '2 months'  },
  ]
  return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexShrink: 0 }}>
        <div style={LBL}>FINANCIAL GOALS</div>
        <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.5)', color: 'rgba(0,0,0,0.5)' }}>4 active</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {goals.map(g => (
          <div key={g.name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#0a2e2b' }}>{g.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.45)' }}>{g.saved}</span>
                <span style={{ fontSize: 8, color: 'rgba(0,0,0,0.25)' }}>/</span>
                <span style={{ fontSize: 10, fontWeight: 900, color: '#0a2e2b' }}>{g.target}</span>
              </div>
            </div>
            <div style={{ position: 'relative', height: 6, borderRadius: 999, background: 'rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${g.pct}%`, background: g.color, borderRadius: 999 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: g.color }}>{g.pct}% saved</span>
              <span style={{ fontSize: 9, color: 'rgba(0,0,0,0.45)' }}>ETA: {g.eta}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Card 5 — Portfolio snapshot tile grid ──────────────────────
function Card5() {
  const alloc = [
    { label: 'Equity (IN)',  val: '₹11.5L', pct: '41%', gain: '+10.8%', color: '#0F766E' },
    { label: 'Mutual Funds', val: '₹5.2L',  pct: '23%', gain: '+8.1%',  color: '#2563EB' },
    { label: 'Fixed Income', val: '₹3.7L',  pct: '16%', gain: '+7.2%',  color: '#059669' },
    { label: 'Gold',         val: '₹1.8L',  pct: '8%',  gain: '+5.3%',  color: '#D97706' },
    { label: 'Crypto',       val: '₹1.2L',  pct: '5%',  gain: '+22.1%', color: '#7C3AED' },
    { label: 'Cash & FD',    val: '₹0.8L',  pct: '4%',  gain: '+6.0%',  color: '#64748B' },
  ]
  return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexShrink: 0 }}>
        <div>
          <div style={{ ...LBL, marginBottom: 2 }}>PORTFOLIO SNAPSHOT</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0a2e2b' }}>6 asset classes tracked</div>
        </div>
        <Badge>₹24.2L total</Badge>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, alignContent: 'space-between' }}>
        {alloc.map(a => (
          <div key={a.label} style={{ background: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.55)', borderRadius: 9, padding: '8px 10px', borderTop: `3px solid ${a.color}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(0,0,0,0.45)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#0a2e2b', lineHeight: 1, marginBottom: 3 }}>{a.val}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(0,0,0,0.4)' }}>{a.pct}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#0F766E' }}>{a.gain}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Slides config ──────────────────────────────────────────────
const SLIDES = [
  {
    title: 'Your entire wealth,\none clear picture.',
    body: 'Track stocks, mutual funds, gold, crypto, FDs and savings — all in one place. Watch your net worth grow month on month.',
    accent: '#0F766E', light: '#99F6E4',
    card: <Card1 />,
  },
  {
    title: 'Every asset class,\none dashboard.',
    body: 'Stocks, mutual funds, gold, fixed income, crypto — tracked live with real-time NSE/BSE prices.',
    accent: '#0F766E', light: '#99F6E4',
    card: <Card2 />,
  },
  {
    title: 'Month-on-month\ngains, visualised.',
    body: 'Know exactly which months were winners. Teal for gains, red for dips.',
    accent: '#0F766E', light: '#99F6E4',
    card: <Card3 />,
  },
  {
    title: 'Set goals.\nStay the course.',
    body: 'Define financial goals and track how your portfolio is pacing toward each one.',
    accent: '#1D4ED8', light: '#BFDBFE',
    card: <Card4 />,
  },
  {
    title: 'Your full portfolio,\nat a glance.',
    body: 'See every asset class — value, allocation percentage, and gain — in one clean snapshot.',
    accent: '#7C3AED', light: '#DDD6FE',
    card: <Card5 />,
  },
]

// ── Google icon ────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

// ── Access Denied Screen ───────────────────────────────────────
function AccessDeniedScreen() {
  const { signOut, clearAccessDenied } = useAuthStore()

  const handleTryAgain = async () => {
    clearAccessDenied()
    await signOut()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F4F0] px-6">
      <div className="w-full max-w-[400px] text-center animate-fade-up">
        <div className="mb-8 flex justify-center">
          <INFolioLogo variant="light" height={30} />
        </div>

        <div className="bg-white rounded-2xl border border-[#E0DDD6] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)] p-8 mb-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
            <span className="text-3xl">🔒</span>
          </div>

          <h2 className="text-[22px] font-black text-[#1A1A1A] tracking-tight mb-2">
            Access Restricted
          </h2>
          <p className="text-[13px] text-[#767676] leading-relaxed mb-6">
            This app is private. Your account hasn't been authorised to access WealthTrack.
            Please contact the owner to request access.
          </p>

          <div className="bg-[#F5F4F0] rounded-xl px-4 py-3 mb-6 text-left">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#ABABAB] mb-1">Why am I seeing this?</p>
            <p className="text-[12px] text-[#767676]">
              Only pre-approved accounts can sign in. Your Google account or email address isn't on the access list yet.
            </p>
          </div>

          <button
            onClick={handleTryAgain}
            className="w-full h-11 rounded-xl bg-[#1A1A1A] hover:bg-[#333333] text-white text-[13px] font-bold transition-all shadow-[0_4px_14px_rgba(0,0,0,0.18)] flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            ← Try a different account
          </button>
        </div>

        <p className="text-[10px] text-[#BFBFBF]">
          Developed by <span className="font-semibold text-[#767676]">Chaz Tech Ltd.</span>
          {' · '}© {new Date().getFullYear()} All rights reserved.
        </p>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail, accessDenied } = useAuthStore()
  const [email, setEmail]         = useState('')
  const [password, setPass]       = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [slide, setSlide]         = useState(0)
  const [animating, setAnimating] = useState(false)

  const goTo = useCallback((n: number) => {
    if (animating) return
    setAnimating(true)
    setTimeout(() => { setSlide(n); setAnimating(false) }, 320)
  }, [animating])

  useEffect(() => {
    const t = setInterval(() => goTo((slide + 1) % SLIDES.length), 5500)
    return () => clearInterval(t)
  }, [slide, goTo])

  // All hooks must be called before any conditional return (React rules of hooks)
  if (accessDenied) return <AccessDeniedScreen />

  const handleSubmit = async () => {
    if (!email || !password) { setError('Please enter your email and password.'); return }
    setLoading(true); setError('')
    try {
      const err = await signInWithEmail(email, password)
      if (err) setError(err)
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const current = SLIDES[slide]

  return (
    <div className="min-h-screen flex" style={{ fontFamily: 'Mulish, system-ui, sans-serif' }}>

      {/* ── LEFT PANEL ─────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[55%] relative overflow-hidden p-10"
        style={{ background: 'linear-gradient(145deg, #0A2E2B 0%, #0D4F4A 40%, #0F5F58 70%, #0B3D48 100%)' }}>

        {/* Blobs */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-[0.07] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${current.accent}30 0%, transparent 70%)`, transform: 'translate(-30%,30%)', transition: 'background 0.8s' }} />
        <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${current.accent}14 0%, transparent 60%)`, transform: 'translate(-50%,-50%)', transition: 'background 0.8s' }} />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <INFolioLogo variant="hero" height={32} />
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
              style={{ background: '#0F766E33', color: '#99F6E4', border: '1px solid #0F766E55' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#99F6E4] animate-pulse" />
              Live prices
            </div>
          </div>

          {/* Headline */}
          <div style={{ opacity: animating ? 0 : 1, transform: animating ? 'translateY(10px)' : 'translateY(0)', transition: 'all 0.32s ease' }}>
            <h2 className="text-[36px] font-black text-white leading-tight mb-3"
              style={{ letterSpacing: '-0.02em', whiteSpace: 'pre-line' }}>
              {current.title}
            </h2>
            <p className="text-[14px] leading-relaxed max-w-md" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {current.body}
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="relative z-10 flex-1 flex items-center py-6">
          <div className="w-full max-w-md"
            style={{ opacity: animating ? 0 : 1, transform: animating ? 'translateY(8px)' : 'translateY(0)', transition: 'all 0.32s ease' }}>
            {current.card}
          </div>
        </div>

        {/* Dots + trust badges */}
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-7">
            {SLIDES.map((_, i) => (
              <button key={i} onClick={() => goTo(i)}
                className="transition-all duration-300 rounded-full"
                style={{ width: i === slide ? 24 : 6, height: 6, background: i === slide ? current.light : 'rgba(255,255,255,0.2)' }} />
            ))}
          </div>
          <div className="flex gap-6">
            {[
              { icon: '🔒', label: 'No broker credentials', sub: 'Read-only tracking' },
              { icon: '🇮🇳', label: 'India focused',         sub: 'NSE · BSE · INR'   },
              { icon: '📵', label: 'No ads, ever',           sub: 'Private & secure'  },
            ].map(b => (
              <div key={b.label} className="flex items-center gap-2">
                <span className="text-lg">{b.icon}</span>
                <div>
                  <div className="text-[11px] font-bold text-white/70">{b.label}</div>
                  <div className="text-[10px] text-white/35">{b.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-[#F5F4F0]">

        <div className="lg:hidden flex items-center justify-center mb-10">
          <INFolioLogo variant="light" height={30} />
        </div>

        <div className="w-full max-w-[380px] animate-fade-up">
          <div className="mb-8">
            <h1 className="text-[28px] font-black text-[#1A1A1A] tracking-tight mb-1.5">Welcome back</h1>
            <p className="text-[14px] text-[#767676]">Sign in to your portfolio dashboard</p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E0DDD6] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)] p-6 mb-4">
            <button onClick={signInWithGoogle}
              className="w-full h-11 rounded-xl border border-[#E0DDD6] bg-white hover:bg-[#F5F4F0] hover:border-[#C8C4BC] text-[13px] font-semibold text-[#1A1A1A] flex items-center justify-center gap-2.5 transition-all mb-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <GoogleIcon />Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-[#E0DDD6]" />
              <span className="text-[11px] text-[#ABABAB] font-medium">or sign in with email</span>
              <div className="flex-1 h-px bg-[#E0DDD6]" />
            </div>

            <div className="flex flex-col gap-3 mb-5">
              <div>
                <label className="text-[11px] font-bold text-[#767676] uppercase tracking-wider mb-1.5 block">Email</label>
                <input type="email" placeholder="you@example.com" value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full h-10 rounded-xl bg-[#F5F4F0] border border-[#E0DDD6] text-[13px] text-[#1A1A1A] placeholder:text-[#ABABAB] outline-none px-3.5 focus:border-[#1A1A1A] focus:ring-2 focus:ring-[#1A1A1A]/10 focus:bg-white transition-all" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-[#767676] uppercase tracking-wider">Password</label>
                  <button className="text-[11px] text-[#767676] hover:text-[#1A1A1A] transition-colors font-medium">Forgot?</button>
                </div>
                <input type="password" placeholder="••••••••" value={password}
                  onChange={e => setPass(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  className="w-full h-10 rounded-xl bg-[#F5F4F0] border border-[#E0DDD6] text-[13px] text-[#1A1A1A] placeholder:text-[#ABABAB] outline-none px-3.5 focus:border-[#1A1A1A] focus:ring-2 focus:ring-[#1A1A1A]/10 focus:bg-white transition-all" />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-[#C0392B]/8 border border-[#C0392B]/20 rounded-xl px-3.5 py-2.5 mb-4">
                <span className="text-[#C0392B] text-xs">⚠</span>
                <p className="text-[12px] text-[#C0392B] font-medium">{error}</p>
              </div>
            )}

            <button onClick={handleSubmit} disabled={loading}
              className="w-full h-11 rounded-xl bg-[#1A1A1A] hover:bg-[#333333] text-white text-[13px] font-bold transition-all shadow-[0_4px_14px_rgba(0,0,0,0.18)] disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]">
              {loading && <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-[#E0DDD6] p-4 mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#ABABAB] mb-3">What you get</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: '📈', text: 'Live stock prices'  }, { icon: '◈',  text: 'Multi-broker view'  },
                { icon: '◎',  text: 'Allocation targets' }, { icon: '📸', text: 'Monthly snapshots'  },
                { icon: '💱', text: 'FX rate tracking'   }, { icon: '🔒', text: 'No data shared'     },
              ].map(f => (
                <div key={f.text} className="flex items-center gap-2">
                  <span className="text-sm">{f.icon}</span>
                  <span className="text-[11px] font-semibold text-[#3D3D3D]">{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center space-y-1">
            <p className="text-[11px] text-[#ABABAB]">
              Your data is private and never shared.
            </p>
            <p className="text-[10px] text-[#BFBFBF]">
              Developed by <span className="font-semibold text-[#767676]">Chaz Tech Ltd.</span>
              {' · '}© {new Date().getFullYear()} All rights reserved.
            </p>
          </div>
        </div>

        <div className="lg:hidden flex items-center gap-2 mt-10">
          {SLIDES.map((_, i) => (
            <div key={i} className="rounded-full transition-all duration-300"
              style={{ width: i === slide ? 20 : 5, height: 5, background: i === slide ? '#1A1A1A' : '#C8C4BC' }} />
          ))}
        </div>
      </div>
    </div>
  )
}
