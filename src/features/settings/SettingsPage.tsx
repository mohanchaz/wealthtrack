import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { deleteAllUserData } from '../../services/deleteDataService'
import { useQueryClient } from '@tanstack/react-query'
import { getInitials } from '../../lib/utils'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-textmut mb-2 px-1">{title}</h2>
      <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
        {children}
      </div>
    </div>
  )
}

function Row({
  icon, label, sub, onClick, danger = false, children,
}: {
  icon: string; label: string; sub?: string; onClick?: () => void
  danger?: boolean; children?: React.ReactNode
}) {
  const base = "flex items-center gap-3.5 px-4 py-3.5 transition-colors border-b border-border last:border-0"
  const hover = danger ? "hover:bg-red-50 cursor-pointer" : onClick ? "hover:bg-surface2 cursor-pointer" : ""
  return (
    <div className={`${base} ${hover}`} onClick={onClick}>
      <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 ${danger ? 'bg-red-50' : 'bg-surface2'}`}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className={`text-[13px] font-semibold ${danger ? 'text-[#C0392B]' : 'text-textprim'}`}>{label}</div>
        {sub && <div className="text-[11px] text-textmut mt-0.5">{sub}</div>}
      </div>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const { user, signOut } = useAuthStore()
  const queryClient = useQueryClient()

  const fullName  = user?.user_metadata?.full_name ?? user?.email ?? ''
  const email     = user?.email ?? ''
  const avatarUrl = user?.user_metadata?.avatar_url

  // Delete modal state
  const [confirmOpen, setConfirm] = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [delError, setDelError]   = useState('')
  const [delDone, setDelDone]     = useState(false)

  const handleDeleteAll = async () => {
    if (!user) return
    setDeleting(true)
    setDelError('')
    try {
      await deleteAllUserData(user.id)
      queryClient.clear()
      setDelDone(true)
      setTimeout(() => { setDelDone(false); setConfirm(false) }, 2000)
    } catch (e: any) {
      setDelError(e.message ?? 'Something went wrong')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-2 py-4 sm:px-4" style={{ fontFamily: 'Mulish, system-ui, sans-serif' }}>

      <div className="mb-6">
        <h1 className="text-[22px] font-black text-textprim tracking-tight">Settings</h1>
        <p className="text-[13px] text-textmut mt-0.5">Manage your account and data</p>
      </div>

      {/* Profile */}
      <Section title="Account">
        <div className="flex items-center gap-4 px-4 py-4 border-b border-border">
          {avatarUrl ? (
            <img src={avatarUrl} alt={fullName} className="w-12 h-12 rounded-full ring-2 ring-border object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-ink flex items-center justify-center text-sm font-bold text-chalk shadow-card">
              {getInitials(fullName || 'U')}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[15px] font-black text-textprim truncate">{fullName || 'User'}</div>
            <div className="text-[12px] text-textmut truncate">{email}</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse-dot" />
              <span className="text-[10px] font-semibold text-textsec">Signed in with Google</span>
            </div>
          </div>
        </div>
        <Row icon="👋" label="Sign out" sub="You'll be redirected to the login page" onClick={signOut} />
      </Section>

      {/* About */}
      <Section title="About">
        <Row icon="₹" label="WealthTrack v2" sub="Personal portfolio tracker for India" />
        <Row icon="🏢" label="Developed by Chaz Tech Ltd." sub="© 2026 All rights reserved" />
        <Row icon="🔒" label="Privacy" sub="Auth-only cookies · No tracking · No ads" />
      </Section>

      {/* Danger zone */}
      <Section title="Danger Zone">
        <Row
          icon="🗑️"
          label="Delete all data"
          sub="Permanently removes all portfolio data. Your account is kept."
          danger
          onClick={() => setConfirm(true)}
        >
          <span className="text-[11px] font-bold text-[#C0392B] bg-red-50 border border-red-100 px-2 py-0.5 rounded-lg shrink-0">
            Irreversible
          </span>
        </Row>
      </Section>

      {/* ── Delete confirm modal ──────────────────────────────── */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
          onClick={() => !deleting && setConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}
          >
            {delDone ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">✅</div>
                <h3 className="text-[15px] font-black text-[#1A1A1A] mb-1">All data cleared</h3>
                <p className="text-[12px] text-[#767676]">Your account is intact. Start fresh anytime.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center text-xl shrink-0">🗑️</div>
                  <div>
                    <h3 className="text-[15px] font-black text-[#1A1A1A]">Delete all data?</h3>
                    <p className="text-[11px] text-[#767676] mt-0.5">This cannot be undone</p>
                  </div>
                </div>

                <div className="bg-[#FFF5F5] border border-red-100 rounded-xl px-3.5 py-3 mb-4">
                  <p className="text-[12px] text-[#C0392B] font-semibold mb-1.5">This will permanently delete:</p>
                  <ul className="text-[11px] text-[#767676] space-y-0.5">
                    {[
                      'All stocks, mutual funds & gold holdings',
                      'Fixed deposits, bonds, cash & savings',
                      'Crypto & foreign stock holdings',
                      'Allocation targets',
                      'All monthly snapshots & history',
                    ].map(item => (
                      <li key={item} className="flex items-center gap-1.5">
                        <span className="text-red-400 text-[9px]">✕</span>{item}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-[#767676] mt-2 pt-2 border-t border-red-100">
                    <span className="font-semibold text-[#1A1A1A]">Your account is kept</span> — sign back in and start fresh.
                  </p>
                </div>

                {delError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-4">
                    <span className="text-red-500 text-xs">⚠</span>
                    <p className="text-[11px] text-[#C0392B]">{delError}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirm(false)}
                    disabled={deleting}
                    className="flex-1 h-10 rounded-xl border border-[#E0DDD6] bg-[#F5F4F0] text-[#767676] text-[13px] font-semibold hover:bg-[#EFEDE8] transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAll}
                    disabled={deleting}
                    className="flex-1 h-10 rounded-xl bg-[#C0392B] hover:bg-[#A93226] text-white text-[13px] font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    {deleting && <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                    {deleting ? 'Deleting…' : 'Yes, delete all'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
