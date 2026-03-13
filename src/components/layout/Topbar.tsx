import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { getInitials } from '../../lib/utils'
import { INFolioLogo } from '../INFolioLogo'

interface Props { onMenuClick?: () => void }

export function Topbar({ onMenuClick }: Props) {
  const { user, signOut } = useAuthStore()
  const navigate          = useNavigate()
  const fullName          = user?.user_metadata?.full_name ?? user?.email ?? ''
  const firstName         = fullName.split(' ')[0]
  const email             = user?.email ?? ''
  const avatarUrl         = user?.user_metadata?.avatar_url

  const [open, setOpen] = useState(false)
  const dropRef         = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const go = (path: string) => { setOpen(false); navigate(path) }

  return (
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
        <div className="flex items-center gap-2">
            <INFolioLogo iconOnly height={32} />
            <span className="hidden sm:block text-sm font-bold text-ink tracking-tight">INFolio</span>
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
            className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-surface2 transition-colors"
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
              width="12" height="12" viewBox="0 0 12 12"
              className={`text-textmut transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            >
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Dropdown */}
          {open && (
            <div className="absolute right-0 top-full mt-2 w-60 bg-surface rounded-2xl border border-border shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden z-50">

              {/* User header */}
              <div className="px-4 py-3 border-b border-border bg-surface2">
                <div className="flex items-center gap-3">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={fullName} className="w-9 h-9 rounded-full object-cover ring-2 ring-border shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-ink flex items-center justify-center text-xs font-bold text-chalk shrink-0">
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
                <button
                  onClick={() => go('/settings')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface2 transition-colors text-left group"
                >
                  <span className="w-7 h-7 rounded-lg bg-surface2 group-hover:bg-border flex items-center justify-center text-sm transition-colors shrink-0">⚙️</span>
                  <div>
                    <div className="text-[12px] font-semibold text-textprim">Settings</div>
                    <div className="text-[10px] text-textmut">Account, data & privacy</div>
                  </div>
                </button>

                <div className="mx-4 my-1.5 border-t border-border" />

                <button
                  onClick={() => { signOut(); setOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface2 transition-colors text-left group"
                >
                  <span className="w-7 h-7 rounded-lg bg-surface2 group-hover:bg-border flex items-center justify-center text-sm transition-colors shrink-0">👋</span>
                  <div>
                    <div className="text-[12px] font-semibold text-textprim">Sign out</div>
                    <div className="text-[10px] text-textmut">See you next time</div>
                  </div>
                </button>
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-border bg-surface2">
                <p className="text-[9px] text-textmut">
                  © {new Date().getFullYear()} <span className="font-semibold">Chaz Tech Ltd.</span> · INFolio
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
