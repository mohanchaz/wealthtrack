import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../store/authStore'

// ── Slideshow data ─────────────────────────────────────────────
const SLIDES = [
  {
    title: 'Your entire wealth,\none clear picture.',
    body: 'Track stocks, mutual funds, gold, crypto, fixed deposits and savings — all in one place. No juggling between apps.',
    stat: '₹21.4L',
    statLabel: 'Average portfolio tracked',
    icon: '◈',
    accent: '#0F766E',
    light: '#99F6E4',
    tags: ['Zerodha', 'Aionion', 'AMC MF', 'Crypto', 'FD'],
  },
  {
    title: 'Book value vs\nactual invested.',
    body: 'Know exactly how much cash you\'ve put in vs what your broker shows. Track real returns on money actually deployed.',
    stat: '₹3.2L',
    statLabel: 'Avg. actual gain tracked',
    icon: '◎',
    accent: '#1D4ED8',
    light: '#BFDBFE',
    tags: ['Actual invested', 'Real returns', 'Cash flow', 'P&L'],
  },
  {
    title: 'Live prices.\nAlways up to date.',
    body: 'NSE live prices for stocks, Yahoo Finance NAVs for mutual funds, and real-time crypto rates — all auto-refreshed.',
    stat: '< 15s',
    statLabel: 'Price refresh interval',
    icon: '⬡',
    accent: '#7C3AED',
    light: '#DDD6FE',
    tags: ['NSE Live', 'Yahoo NAV', 'Crypto', 'FX Rates'],
  },
  {
    title: 'Set targets.\nStay on track.',
    body: 'Define your ideal allocation across equity, debt, gold and international assets. See at a glance where you\'re over or under.',
    stat: '6',
    statLabel: 'Asset classes tracked',
    icon: '○',
    accent: '#D97706',
    light: '#FDE68A',
    tags: ['Equity', 'Debt', 'Gold', 'Foreign', 'Crypto'],
  },
  {
    title: 'Net worth history.\nWatch it grow.',
    body: 'Snapshot your portfolio monthly and watch your wealth journey unfold. Compare net worth, invested, and actual deployed over time.',
    stat: '12mo',
    statLabel: 'Historical tracking',
    icon: '▲',
    accent: '#059669',
    light: '#A7F3D0',
    tags: ['Snapshots', 'Trend chart', 'Month-on-month', 'Growth'],
  },
]

// ── Mini portfolio card (inside slideshow) ─────────────────────
function MiniCard({ slide, idx }: { slide: typeof SLIDES[0]; idx: number }) {
  return (
    <div
      className="animate-fade-up"
      style={{ animationDelay: `${idx * 80}ms` }}
    >
      {/* Stat pill */}
      <div
        className="inline-flex items-center gap-2 rounded-full px-4 py-2 mb-6 text-sm font-bold"
        style={{ background: `${slide.accent}22`, color: slide.light, border: `1px solid ${slide.accent}44` }}
      >
        <span className="text-lg">{slide.icon}</span>
        <span className="font-mono text-xl">{slide.stat}</span>
        <span className="text-xs font-semibold opacity-70">{slide.statLabel}</span>
      </div>

      {/* Mini portfolio preview */}
      <div
        className="rounded-2xl p-5 mb-6"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>NET WORTH</div>
            <div className="text-2xl font-black font-mono text-white mt-0.5">₹21.11L</div>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
            style={{ background: `${slide.accent}44`, color: slide.light }}
          >
            ▲ +1.24%
          </div>
        </div>

        {/* Allocation bar */}
        <div className="flex h-1.5 rounded-full overflow-hidden mb-3 gap-px">
          {[
            { w: 38, c: '#0F766E' }, { w: 22, c: '#1D4ED8' }, { w: 14, c: '#D97706' },
            { w: 12, c: '#7C3AED' }, { w: 8,  c: '#059669' }, { w: 6,  c: '#E11D48' },
          ].map((s, i) => (
            <div key={i} className="transition-all duration-700" style={{ width: `${s.w}%`, background: s.c }} />
          ))}
        </div>

        {/* Mini asset rows */}
        {[
          { label: 'Zerodha Stocks', val: '₹8.4L',  dot: '#0F766E' },
          { label: 'Mutual Funds',   val: '₹5.2L',  dot: '#1D4ED8' },
          { label: 'Fixed Deposits', val: '₹3.8L',  dot: '#059669' },
        ].map((r, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.dot }} />
              <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>{r.label}</span>
            </div>
            <span className="text-[11px] font-bold font-mono text-white">{r.val}</span>
          </div>
        ))}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {slide.tags.map(tag => (
          <span
            key={tag}
            className="text-[10px] font-bold px-2.5 py-1 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Google icon ────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

// ── Main ───────────────────────────────────────────────────────
export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail } = useAuthStore()
  const [email, setEmail]         = useState('')
  const [password, setPass]       = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [slide, setSlide]         = useState(0)
  const [animating, setAnimating] = useState(false)
  const [tab, setTab]             = useState<'signin' | 'magic'>('signin')

  const goTo = useCallback((n: number) => {
    if (animating) return
    setAnimating(true)
    setTimeout(() => {
      setSlide(n)
      setAnimating(false)
    }, 300)
  }, [animating])

  useEffect(() => {
    const t = setInterval(() => {
      goTo((slide + 1) % SLIDES.length)
    }, 5000)
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

      {/* ── LEFT PANEL — slideshow ──────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[55%] relative overflow-hidden p-10"
        style={{
          background: 'linear-gradient(145deg, #0A2E2B 0%, #0D4F4A 40%, #0F5F58 70%, #0B3D48 100%)',
          transition: 'background 0.6s ease',
        }}
      >
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-[0.07] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-[0.05] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #99F6E4 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }} />
        <div
          className="absolute top-1/2 left-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${current.accent}22 0%, transparent 65%)`,
            transform: 'translate(-50%, -50%)',
            transition: 'background 0.8s ease',
          }}
        />

        {/* Top — logo + tagline */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-full text-sm font-bold tracking-tight border border-white/15">
              <span className="opacity-60">₹</span>
              <span>WealthTrack</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: '#0F766E33', color: '#99F6E4', border: '1px solid #0F766E55' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#99F6E4] animate-pulse" />
              Live prices
            </div>
          </div>

          {/* Slide headline */}
          <div
            className="mb-8"
            style={{ opacity: animating ? 0 : 1, transform: animating ? 'translateY(12px)' : 'translateY(0)', transition: 'all 0.3s ease' }}
          >
            <h2
              className="text-[38px] font-black text-white leading-tight mb-4"
              style={{ letterSpacing: '-0.02em', whiteSpace: 'pre-line' }}
            >
              {current.title}
            </h2>
            <p className="text-[15px] leading-relaxed max-w-md" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {current.body}
            </p>
          </div>
        </div>

        {/* Middle — animated card */}
        <div
          className="relative z-10 flex-1 flex items-center"
          style={{ opacity: animating ? 0 : 1, transition: 'opacity 0.3s ease' }}
        >
          <div className="w-full max-w-sm">
            <MiniCard slide={current} idx={slide} />
          </div>
        </div>

        {/* Bottom — slide dots + trust badges */}
        <div className="relative z-10">
          {/* Dots */}
          <div className="flex items-center gap-2 mb-8">
            {SLIDES.map((s, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className="transition-all duration-300 rounded-full"
                style={{
                  width:   i === slide ? 24 : 6,
                  height:  6,
                  background: i === slide ? current.light : 'rgba(255,255,255,0.2)',
                }}
              />
            ))}
          </div>

          {/* Trust badges */}
          <div className="flex gap-6">
            {[
              { icon: '🔒', label: 'No broker credentials', sub: 'Read-only tracking' },
              { icon: '🇮🇳', label: 'India focused', sub: 'NSE · BSE · INR' },
              { icon: '📵', label: 'No ads, ever', sub: 'Private & secure' },
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

      {/* ── RIGHT PANEL — login form ────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-[#F5F4F0] relative">

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 bg-[#1A1A1A] text-white px-5 py-2.5 rounded-full text-sm font-bold tracking-tight mb-10 shadow-[0_4px_14px_rgba(0,0,0,0.18)]">
          <span className="opacity-60">₹</span>
          <span>WealthTrack</span>
        </div>

        <div className="w-full max-w-[380px] animate-fade-up">

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-[28px] font-black text-[#1A1A1A] tracking-tight mb-1.5">Welcome back</h1>
            <p className="text-[14px] text-[#767676]">Sign in to your portfolio dashboard</p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl border border-[#E0DDD6] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)] p-6 mb-4">

            {/* Google SSO */}
            <button
              onClick={signInWithGoogle}
              className="w-full h-11 rounded-xl border border-[#E0DDD6] bg-white hover:bg-[#F5F4F0] hover:border-[#C8C4BC] text-[13px] font-semibold text-[#1A1A1A] flex items-center justify-center gap-2.5 transition-all duration-150 mb-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <GoogleIcon />
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-[#E0DDD6]" />
              <span className="text-[11px] text-[#ABABAB] font-medium">or sign in with email</span>
              <div className="flex-1 h-px bg-[#E0DDD6]" />
            </div>

            {/* Email + Password */}
            <div className="flex flex-col gap-3 mb-5">
              <div>
                <label className="text-[11px] font-bold text-[#767676] uppercase tracking-wider mb-1.5 block">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full h-10 rounded-xl bg-[#F5F4F0] border border-[#E0DDD6] text-[13px] text-[#1A1A1A] placeholder:text-[#ABABAB] outline-none px-3.5 focus:border-[#1A1A1A] focus:ring-2 focus:ring-[#1A1A1A]/10 focus:bg-white transition-all"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-[#767676] uppercase tracking-wider">Password</label>
                  <button className="text-[11px] text-[#767676] hover:text-[#1A1A1A] transition-colors font-medium">Forgot?</button>
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPass(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  className="w-full h-10 rounded-xl bg-[#F5F4F0] border border-[#E0DDD6] text-[13px] text-[#1A1A1A] placeholder:text-[#ABABAB] outline-none px-3.5 focus:border-[#1A1A1A] focus:ring-2 focus:ring-[#1A1A1A]/10 focus:bg-white transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-[#C0392B]/8 border border-[#C0392B]/20 rounded-xl px-3.5 py-2.5 mb-4">
                <span className="text-[#C0392B] text-xs">⚠</span>
                <p className="text-[12px] text-[#C0392B] font-medium">{error}</p>
              </div>
            )}

            {/* Sign in button */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full h-11 rounded-xl bg-[#1A1A1A] hover:bg-[#333333] text-white text-[13px] font-bold transition-all shadow-[0_4px_14px_rgba(0,0,0,0.18)] disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {loading
                ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                : null
              }
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </div>

          {/* What you get — small feature list */}
          <div className="bg-white rounded-2xl border border-[#E0DDD6] p-4 mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#ABABAB] mb-3">What you get</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: '📈', text: 'Live stock prices' },
                { icon: '◈',  text: 'Multi-broker view' },
                { icon: '◎',  text: 'Allocation targets' },
                { icon: '📸', text: 'Monthly snapshots' },
                { icon: '💱', text: 'FX rate tracking' },
                { icon: '🔒', text: 'No data shared' },
              ].map(f => (
                <div key={f.text} className="flex items-center gap-2">
                  <span className="text-sm">{f.icon}</span>
                  <span className="text-[11px] font-semibold text-[#3D3D3D]">{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-[11px] text-[#ABABAB]">
            Your data is private and never shared.&nbsp;
            <span className="text-[#767676] font-semibold">WealthTrack v2</span>
          </p>
        </div>

        {/* Mobile-only slide dots */}
        <div className="lg:hidden flex items-center gap-2 mt-10">
          {SLIDES.map((s, i) => (
            <div key={i} className="rounded-full transition-all duration-300"
              style={{ width: i === slide ? 20 : 5, height: 5, background: i === slide ? '#1A1A1A' : '#C8C4BC' }} />
          ))}
        </div>
      </div>
    </div>
  )
}
