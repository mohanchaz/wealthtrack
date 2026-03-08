import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

const ASSET_PILLS = [
  { label: 'Equity & MF',    color: '#22c55e' },
  { label: 'Gold & SGBs',    color: '#f59e0b' },
  { label: 'EPF / PPF',      color: '#818cf8' },
  { label: 'Fixed Deposits', color: '#3b82f6' },
  { label: 'Crypto',         color: '#14b8a6' },
  { label: 'Bonds',          color: '#f97316' },
  { label: 'Foreign Stocks', color: '#06b6d4' },
  { label: 'Real Estate',    color: '#8b5cf6' },
]

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail } = useAuthStore()

  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [error,      setError]      = useState<string | null>(null)
  const [loadGoogle, setLoadGoogle] = useState(false)
  const [loadEmail,  setLoadEmail]  = useState(false)

  const handleGoogle = async () => {
    setLoadGoogle(true)
    await signInWithGoogle()
    setLoadGoogle(false)
  }

  const handleEmail = async () => {
    if (!email || !password) { setError('Please enter email and password.'); return }
    setError(null)
    setLoadEmail(true)
    const err = await signInWithEmail(email, password)
    setLoadEmail(false)
    if (err) setError(err)
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col overflow-hidden">
      {/* Background mesh */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-accent/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-lavender/4 blur-[100px]" />
        <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] rounded-full bg-teal/3 blur-[80px]" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-lavender flex items-center justify-center text-white font-bold shadow-glow">
            ₹
          </div>
          <span className="font-semibold text-textprim tracking-tight">WealthTrack</span>
        </div>
        <span className="text-xs text-textmut border border-border rounded-full px-3 py-1">
          Personal · Private · Powerful
        </span>
      </nav>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* Left — headline */}
          <div className="flex flex-col gap-6">
            <div className="inline-flex items-center gap-2 self-start bg-accent/10 border border-accent/20 rounded-full px-3.5 py-1.5 text-xs font-medium text-accent animate-fade-up">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />
              Built for Indian Investors
            </div>

            <h1 className="text-4xl lg:text-5xl font-bold text-textprim leading-[1.15] tracking-tight animate-fade-up delay-1">
              Know your{' '}
              <span className="text-gradient-amber italic">true wealth</span>
              <br />at a glance.
            </h1>

            <p className="text-base text-textsec leading-relaxed max-w-sm animate-fade-up delay-2">
              Track net worth, income, expenses and goals across 20+ asset classes.
              No broker credentials. 100% private. Always yours.
            </p>

            {/* Stats */}
            <div className="flex gap-6 animate-fade-up delay-3">
              {[
                { val: '20+',  lbl: 'Asset Classes' },
                { val: '100%', lbl: 'Private' },
                { val: '0',    lbl: 'Broker Access' },
              ].map(s => (
                <div key={s.lbl}>
                  <div className="text-xl font-bold font-mono text-textprim">{s.val}</div>
                  <div className="text-xs text-textmut mt-0.5">{s.lbl}</div>
                </div>
              ))}
            </div>

            {/* Asset pills */}
            <div className="flex flex-wrap gap-2 animate-fade-up delay-4">
              {ASSET_PILLS.map(p => (
                <span
                  key={p.label}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-border bg-surface/50"
                  style={{ color: p.color }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
                  {p.label}
                </span>
              ))}
            </div>
          </div>

          {/* Right — sign-in card */}
          <div className="animate-fade-up delay-2">
            <div className="glass-card rounded-2xl p-7 shadow-card">
              <p className="text-sm font-medium text-textsec mb-5 text-center">
                Sign in to your dashboard
              </p>

              {/* Google */}
              <Button
                variant="secondary"
                className="w-full justify-center gap-3 h-10 text-sm"
                onClick={handleGoogle}
                loading={loadGoogle}
              >
                <GoogleIcon />
                Continue with Google
              </Button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-textmut font-medium tracking-widest">OR</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Email form */}
              <div className="flex flex-col gap-3">
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleEmail()}
                  autoComplete="current-password"
                />
                {error && (
                  <p className="text-xs text-danger text-center">{error}</p>
                )}
                <Button
                  variant="primary"
                  className="w-full justify-center h-10"
                  onClick={handleEmail}
                  loading={loadEmail}
                >
                  Sign in with Email
                </Button>
              </div>

              {/* Privacy note */}
              <div className="flex items-center gap-3 mt-5">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-textmut font-medium tracking-widest">SECURE</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <p className="text-[11px] text-textmut text-center mt-3 leading-relaxed">
                No broker access. No data selling.{' '}
                <span className="text-teal">Your data stays yours.</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <footer className="relative z-10 py-5 text-center text-[11px] text-textmut border-t border-border/50">
        © 2026 WealthTrack · Built for Indian investors · No broker credentials ever required
      </footer>
    </div>
  )
}
