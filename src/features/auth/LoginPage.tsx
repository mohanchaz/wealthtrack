import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../store/authStore'
import { INFolioLogo } from '../../components/INFolioLogo'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  ResponsiveContainer, XAxis, CartesianGrid,
} from 'recharts'

// ── Chart data ─────────────────────────────────────────────────
const netWorthHistory = [
  { m: 'Aug', v: 14.2 }, { m: 'Sep', v: 15.1 }, { m: 'Oct', v: 14.8 },
  { m: 'Nov', v: 16.4 }, { m: 'Dec', v: 17.2 }, { m: 'Jan', v: 18.9 },
  { m: 'Feb', v: 19.4 }, { m: 'Mar', v: 21.1 },
]

const monthlyGain = [
  { m: 'Aug', g: 1.2 }, { m: 'Sep', g: 2.8 }, { m: 'Oct', g: -0.9 },
  { m: 'Nov', g: 3.1 }, { m: 'Dec', g: 2.4 }, { m: 'Jan', g: 4.2 },
  { m: 'Feb', g: 1.8 }, { m: 'Mar', g: 3.6 },
]

// ── Card 1 — Area chart: net worth growth ──────────────────────
function Card1() {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>NET WORTH GROWTH</div>
          <div className="text-2xl font-black font-mono text-white">₹21.11L</div>
        </div>
        <div className="text-right">
          <div className="px-2.5 py-1 rounded-full text-[11px] font-bold mb-1" style={{ background: '#0F766E44', color: '#99F6E4' }}>▲ +48.6%</div>
          <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>8 months</div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={100}>
        <AreaChart data={netWorthHistory} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0F766E" stopOpacity={0.5}/>
              <stop offset="95%" stopColor="#0F766E" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke="#99F6E4" strokeWidth={2} fill="url(#aGrad)" dot={false} />
          <XAxis dataKey="m" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex justify-between mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        {[{ l: 'Started', v: '₹14.2L' }, { l: 'Now', v: '₹21.1L' }, { l: 'Gain', v: '+₹6.9L' }].map(s => (
          <div key={s.l} className="text-center">
            <div className="text-[9px] font-bold uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.l}</div>
            <div className="text-[13px] font-black font-mono text-white">{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Card 2 — Asset breakdown list (no chart) ───────────────────
function Card2() {
  const assets = [
    { label: 'Zerodha Stocks',   val: '₹8.4L',  pct: 40, color: '#0F766E', icon: '📈', gain: '+12.4%' },
    { label: 'Mutual Funds',     val: '₹5.2L',  pct: 25, color: '#1D4ED8', icon: '◈',  gain: '+8.1%'  },
    { label: 'Fixed Deposits',   val: '₹3.8L',  pct: 18, color: '#059669', icon: '🏦', gain: '+7.2%'  },
    { label: 'Gold',             val: '₹1.9L',  pct: 9,  color: '#D97706', icon: '🏅', gain: '+5.3%'  },
    { label: 'Crypto',           val: '₹1.8L',  pct: 8,  color: '#7C3AED', icon: '₿',  gain: '+22.1%' },
  ]
  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
      <div className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>YOUR PORTFOLIO BREAKDOWN</div>
      {/* Allocation strip */}
      <div className="flex h-2 rounded-full overflow-hidden mb-4 gap-px">
        {assets.map(a => <div key={a.label} style={{ width: `${a.pct}%`, background: a.color }} />)}
      </div>
      <div className="space-y-2.5">
        {assets.map(a => (
          <div key={a.label} className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
              style={{ background: `${a.color}22`, border: `1px solid ${a.color}40` }}>
              {a.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-semibold text-white truncate">{a.label}</span>
                <span className="text-[11px] font-black font-mono text-white ml-2">{a.val}</span>
              </div>
              <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full" style={{ width: `${a.pct * 2}%`, background: a.color }} />
              </div>
            </div>
            <span className="text-[10px] font-bold shrink-0" style={{ color: '#99F6E4' }}>{a.gain}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Card 3 — Bar chart: monthly P&L ───────────────────────────
function Card3() {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
      <div className="flex items-center justify-between mb-1">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>MONTHLY GAINS · P&L</div>
          <div className="text-sm font-bold text-white">Consistent upward trend</div>
        </div>
        <div className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: '#1D4ED844', color: '#BFDBFE' }}>7/8 positive</div>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={monthlyGain} margin={{ top: 10, right: 0, bottom: 0, left: 0 }} barSize={16}>
          <Bar dataKey="g" radius={[4, 4, 0, 0]}>
            {monthlyGain.map((e, i) => <Cell key={i} fill={e.g >= 0 ? '#1D4ED8' : '#E11D48'} fillOpacity={0.85} />)}
          </Bar>
          <XAxis dataKey="m" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} />
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex justify-between mt-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        {[{ l: 'Best month', v: '+₹4.2L' }, { l: 'Total gain', v: '+₹18.2L' }, { l: 'Win rate', v: '87.5%' }].map(s => (
          <div key={s.l} className="text-center">
            <div className="text-[9px] font-bold uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.l}</div>
            <div className="text-[12px] font-black font-mono text-white">{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Card 4 — Actual vs book stats (no chart) ───────────────────
function Card4() {
  const items = [
    { label: 'Book invested',   val: '₹21.1L', sub: 'Avg price × qty',    color: '#D97706', icon: '📒' },
    { label: 'Actual deployed', val: '₹19.3L', sub: 'Real cash put in',   color: '#99F6E4', icon: '💸' },
    { label: 'Actual gain',     val: '+₹1.8L', sub: 'On cash deployed',   color: '#99F6E4', icon: '📈' },
    { label: 'Actual return',   val: '9.3%',   sub: 'True ROI on cash',   color: '#A7F3D0', icon: '✦'  },
  ]
  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
      <div className="text-[9px] font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>BOOK VALUE VS ACTUAL CASH</div>
      <div className="grid grid-cols-2 gap-3">
        {items.map(item => (
          <div key={item.label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-base">{item.icon}</span>
              <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>{item.label}</span>
            </div>
            <div className="text-[18px] font-black font-mono" style={{ color: item.color }}>{item.val}</div>
            <div className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{item.sub}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <span className="text-[11px]">💡</span>
        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>Actual invested differs from book value due to stock averaging and SIP timing.</span>
      </div>
    </div>
  )
}

// ── Card 5 — Target allocation targets (no chart) ──────────────
function Card5() {
  const targets = [
    { label: 'Equity',   actual: 38, target: 40, color: '#0F766E' },
    { label: 'Debt',     actual: 30, target: 25, color: '#1D4ED8' },
    { label: 'Gold',     actual: 14, target: 15, color: '#D97706' },
    { label: 'Foreign',  actual: 10, target: 12, color: '#7C3AED' },
    { label: 'Crypto',   actual: 8,  target: 8,  color: '#E11D48' },
  ]
  const getStatus = (a: number, t: number) => {
    const d = a - t
    if (Math.abs(d) <= 1) return { label: '✓', bg: '#0F766E20', color: '#99F6E4' }
    if (d > 0)            return { label: `+${d}%`, bg: '#D9770620', color: '#FDE68A' }
    return                       { label: `${d}%`,  bg: '#E11D4820', color: '#FCA5A5' }
  }
  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>ALLOCATION TARGETS</div>
        <div className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
          actual / <strong className="text-white">target</strong>
        </div>
      </div>
      <div className="space-y-3">
        {targets.map(t => {
          const status = getStatus(t.actual, t.target)
          return (
            <div key={t.label} className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 w-16 shrink-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
                <span className="text-[11px] font-semibold text-white">{t.label}</span>
              </div>
              <div className="flex-1 relative h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                {/* target ghost */}
                <div className="absolute inset-y-0 left-0 opacity-25 rounded-full" style={{ width: `${t.target * 2}%`, background: t.color }} />
                {/* actual */}
                <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: `${t.actual * 2}%`, background: t.color }} />
                {/* target tick */}
                <div className="absolute inset-y-0 w-0.5 rounded-full" style={{ left: `${t.target * 2}%`, background: 'rgba(255,255,255,0.5)' }} />
              </div>
              <div className="flex items-center gap-1.5 w-20 justify-end shrink-0">
                <span className="text-[10px] font-mono text-white/60">{t.actual}%</span>
                <span className="text-[8px] text-white/30">/</span>
                <span className="text-[10px] font-mono font-bold text-white">{t.target}%</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: status.bg, color: status.color }}>{status.label}</span>
              </div>
            </div>
          )
        })}
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
    body: 'Zerodha, Aionion, AMC mutual funds, crypto, gold, cash and bonds — all summarised with live gain tracking.',
    accent: '#0F766E', light: '#99F6E4',
    card: <Card2 />,
  },
  {
    title: 'Month-on-month\ngains, visualised.',
    body: 'Know exactly which months were winners. Track P&L trends with colour-coded bars — green for gains, red for dips.',
    accent: '#1D4ED8', light: '#BFDBFE',
    card: <Card3 />,
  },
  {
    title: 'Book value vs\nactual invested.',
    body: 'Know exactly how much cash you\'ve deployed vs what your broker shows. Track your true return on real money.',
    accent: '#D97706', light: '#FDE68A',
    card: <Card4 />,
  },
  {
    title: 'Set targets.\nStay on track.',
    body: 'Define your ideal allocation mix across equity, debt, gold and foreign. See at a glance where you\'re over or under.',
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

  // Show access denied screen if the user signed in but is not on the allowlist
  if (accessDenied) return <AccessDeniedScreen />

  const goTo = useCallback((n: number) => {
    if (animating) return
    setAnimating(true)
    setTimeout(() => { setSlide(n); setAnimating(false) }, 320)
  }, [animating])

  useEffect(() => {
    const t = setInterval(() => goTo((slide + 1) % SLIDES.length), 5500)
    return () => clearInterval(t)
  }, [slide, goTo])

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
