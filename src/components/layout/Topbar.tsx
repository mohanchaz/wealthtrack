import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { getInitials } from '../../lib/utils'
import { deleteAllUserData } from '../../services/deleteDataService'
import { useQueryClient } from '@tanstack/react-query'

interface Props { onMenuClick?: () => void }

export function Topbar({ onMenuClick }: Props) {
  const { user, signOut }   = useAuthStore()
  const queryClient         = useQueryClient()
  const fullName            = user?.user_metadata?.full_name ?? user?.email ?? ''
  const firstName           = fullName.split(' ')[0]
  const email               = user?.email ?? ''
  const avatarUrl           = user?.user_metadata?.avatar_url

  const [open, setOpen]           = useState(false)
  const [confirmOpen, setConfirm] = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [delError, setDelError]   = useState('')
  const [delDone, setDelDone]     = useState(false)

  const dropRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleDeleteAll = async () => {
    if (!user) return
    setDeleting(true)
    setDelError('')
    try {
      await deleteAllUserData(user.id)
      queryClient.clear()
      setDelDone(true)
      setTimeout(() => {
        setDelDone(false)
        setConfirm(false)
        setOpen(false)
      }, 1800)
    } catch (e: any) {
      setDelError(e.message ?? 'Something went wrong')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-border bg-surface sticky top-0 z-40">
        {/* Left */}
        <div className="flex items-center gap-3">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="lg:hidden w-8 h-8 flex items-center justify-center rounded-xl text-textmut hover:bg-surface2 hover:text-textprim transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="3" width="14" height="1.5" rx="0.75"/>
                <rect x="1" y="7.25" width="14" height="1.5" rx="0.75"/>
                <rect x="1" y="11.5" width="14" height="1.5" rx="0.75"/>
              </svg>
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-ink text-chalk px-3 py-1.5 rounded-full text-xs font-bold tracking-tight shadow-card">
              <span className="opacity-70">₹</span>
              <span>WealthTrack</span>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-textmut hidden sm:inline">
            Hi, <span className="font-semibold text-textprim">{firstName}</span>
          </span>

          {/* Profile button */}
          <div className="relative" ref={dropRef}>
            <button
              onClick={() => setOpen(o => !o)}
              className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-surface2 transition-colors group"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={firstName}
                  className="w-8 h-8 rounded-full ring-2 ring-border object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-ink flex items-center justify-center text-xs font-bold text-chalk shadow-card">
                  {getInitials(fullName || 'U')}
                </div>
              )}
              <svg
                width="12" height="12" viewBox="0 0 12 12" fill="currentColor"
                className={`text-textmut transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              >
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Dropdown */}
            {open && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-surface rounded-2xl border border-border shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden z-50">

                {/* User info header */}
                <div className="px-4 py-3 border-b border-border bg-surface2">
                  <div className="flex items-center gap-3">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={firstName} className="w-9 h-9 rounded-full object-cover ring-2 ring-border" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-ink flex items-center justify-center text-xs font-bold text-chalk">
                        {getInitials(fullName || 'U')}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-textprim truncate">{fullName || 'User'}</div>
                      <div className="text-[11px] text-textmut truncate">{email}</div>
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                <div className="py-1.5">

                  {/* Settings — placeholder */}
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface2 transition-colors text-left group">
                    <span className="w-7 h-7 rounded-lg bg-surface2 group-hover:bg-border flex items-center justify-center text-sm transition-colors">⚙️</span>
                    <div>
                      <div className="text-[12px] font-semibold text-textprim">Settings</div>
                      <div className="text-[10px] text-textmut">Preferences &amp; display</div>
                    </div>
                  </button>

                  {/* Divider */}
                  <div className="mx-4 my-1.5 border-t border-border" />

                  {/* Delete all data */}
                  <button
                    onClick={() => { setConfirm(true); setOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 transition-colors text-left group"
                  >
                    <span className="w-7 h-7 rounded-lg bg-red-50 group-hover:bg-red-100 flex items-center justify-center text-sm transition-colors">🗑️</span>
                    <div>
                      <div className="text-[12px] font-semibold text-[#C0392B]">Delete all data</div>
                      <div className="text-[10px] text-textmut">Clears portfolio, keeps account</div>
                    </div>
                  </button>

                  {/* Divider */}
                  <div className="mx-4 my-1.5 border-t border-border" />

                  {/* Sign out */}
                  <button
                    onClick={() => { signOut(); setOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface2 transition-colors text-left group"
                  >
                    <span className="w-7 h-7 rounded-lg bg-surface2 group-hover:bg-border flex items-center justify-center text-sm transition-colors">👋</span>
                    <div>
                      <div className="text-[12px] font-semibold text-textprim">Sign out</div>
                      <div className="text-[10px] text-textmut">See you next time</div>
                    </div>
                  </button>
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-border bg-surface2">
                  <p className="text-[9px] text-textmut">
                    © {new Date().getFullYear()} <span className="font-semibold">Chaz Tech Ltd.</span> · WealthTrack v2
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Delete all data confirm modal ──────────────────────── */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
          onClick={() => !deleting && setConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] w-full max-w-sm p-6 animate-fade-up"
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
                  <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center text-xl">🗑️</div>
                  <div>
                    <h3 className="text-[15px] font-black text-[#1A1A1A]">Delete all data?</h3>
                    <p className="text-[11px] text-[#767676] mt-0.5">This cannot be undone</p>
                  </div>
                </div>

                <div className="bg-[#FFF5F5] border border-red-100 rounded-xl px-3.5 py-3 mb-4">
                  <p className="text-[12px] text-[#C0392B] font-semibold mb-1.5">This will permanently delete:</p>
                  <ul className="text-[11px] text-[#767676] space-y-0.5">
                    {[
                      'All stocks, mutual funds, gold holdings',
                      'Fixed deposits, bonds, cash, savings',
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
                    <span className="font-semibold text-[#1A1A1A]">Your account is kept</span> — you can sign back in and start fresh.
                  </p>
                </div>

                {delError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4">
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
                    className="flex-1 h-10 rounded-xl bg-[#C0392B] hover:bg-[#A93226] text-white text-[13px] font-bold transition-all shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 active:scale-[0.98]"
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
    </>
  )
}
