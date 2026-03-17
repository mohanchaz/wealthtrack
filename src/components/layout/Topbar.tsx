import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { getInitials } from '../../lib/utils'
import { INFolioLogo } from '../INFolioLogo'

interface Props { onMenuClick?: () => void }

function ProfileAvatar({ name, url, size = 8 }: { name: string; url?: string; size?: number }) {
  const sz = `w-${size} h-${size}`
  if (url) return <img src={url} alt={name} className={`${sz} rounded-full ring-2 ring-border object-cover`} />
  return (
    <div className={`${sz} rounded-full bg-ink flex items-center justify-center text-xs font-bold text-chalk shadow-card`}>
      {getInitials(name || 'U')}
    </div>
  )
}

export function Topbar({ onMenuClick }: Props) {
  const { user, signOut, sharedProfiles, activeProfileId, switchProfile } = useAuthStore()
  const navigate  = useNavigate()
  const fullName  = user?.user_metadata?.full_name ?? user?.email ?? ''
  const firstName = fullName.split(' ')[0]
  const email     = user?.email ?? ''
  const avatarUrl = user?.user_metadata?.avatar_url

  const [open,        setOpen]        = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const dropRef    = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  const activeProfile  = sharedProfiles.find(p => p.owner_id === activeProfileId)
  const profileLabel   = (p: { owner_name: string; owner_email: string; owner_id: string }) =>
    p.owner_name || p.owner_email || 'Shared portfolio'
  const isViewingShared = !!activeProfileId

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const go = (path: string) => { setOpen(false); navigate(path) }

  return (
    <>
      {/* Read-only banner */}
      {isViewingShared && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-2 flex items-center gap-3 text-[12px] text-amber-800">
          <span className="text-base">👁</span>
          <span>Viewing <strong>{activeProfile ? profileLabel(activeProfile) : 'shared'}'s</strong> portfolio — read-only mode</span>
          <button
            onClick={() => switchProfile(null)}
            className="ml-auto text-[11px] font-semibold px-3 py-1 rounded-lg border border-amber-300 hover:bg-amber-100 transition-colors"
          >
            Back to mine
          </button>
        </div>
      )}

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
          <button onClick={() => navigate('/dashboard')} className="flex items-center hover:opacity-80 transition-opacity">
            <INFolioLogo variant="light" height={32} />
          </button>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">

          {/* Profile switcher — only shown if shared profiles exist */}
          {sharedProfiles.length > 0 && (
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(o => !o)}
                className={`flex items-center gap-2 rounded-xl px-3 py-1.5 border transition-colors text-[12px] font-semibold
                  ${isViewingShared
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-border bg-surface2 text-textprim hover:bg-border'}`}
              >
                <span className="hidden sm:inline">
                  {isViewingShared && activeProfile ? profileLabel(activeProfile) : 'My portfolio'}
                </span>
                <svg width="12" height="12" viewBox="0 0 12 12" className={`transition-transform ${profileOpen ? 'rotate-180' : ''}`}>
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                </svg>
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-surface rounded-2xl border border-border shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden z-50">
                  <div className="px-4 py-2 border-b border-border">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-textmut">Switch portfolio</p>
                  </div>

                  {/* Own portfolio */}
                  <button
                    onClick={() => { switchProfile(null); setProfileOpen(false) }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface2 transition-colors text-left ${!isViewingShared ? 'bg-surface2' : ''}`}
                  >
                    <ProfileAvatar name={fullName} url={avatarUrl} size={7} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-textprim truncate">My portfolio</div>
                      <div className="text-[10px] text-textmut truncate">{email}</div>
                    </div>
                    {!isViewingShared && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 7l3 3 5-6" stroke="#0F766E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>

                  <div className="mx-4 my-1 border-t border-border" />

                  {/* Shared profiles */}
                  {sharedProfiles.map(p => (
                    <button
                      key={p.owner_id}
                      onClick={() => { switchProfile(p.owner_id); setProfileOpen(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface2 transition-colors text-left ${activeProfileId === p.owner_id ? 'bg-surface2' : ''}`}
                    >
                      <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-800 shrink-0">
                        {getInitials(p.owner_name || p.owner_email)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-textprim truncate">{p.owner_name || p.owner_email}</div>
                        <div className="text-[10px] text-textmut truncate">{p.owner_email}</div>
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 shrink-0">read-only</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <span className="text-sm text-textmut hidden sm:inline">
            Hi, <span className="font-semibold text-textprim">{firstName}</span>
          </span>

          {/* Profile / account dropdown */}
          <div className="relative" ref={dropRef}>
            <button
              onClick={() => setOpen(o => !o)}
              className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-surface2 transition-colors"
            >
              <ProfileAvatar name={fullName} url={avatarUrl} />
              <svg width="12" height="12" viewBox="0 0 12 12" className={`text-textmut transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-2 w-60 bg-surface rounded-2xl border border-border shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-border bg-surface2">
                  <div className="flex items-center gap-3">
                    <ProfileAvatar name={fullName} url={avatarUrl} size={9} />
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-textprim truncate">{fullName || 'User'}</div>
                      <div className="text-[11px] text-textmut truncate">{email}</div>
                    </div>
                  </div>
                </div>

                <div className="py-1.5">
                  <button onClick={() => go('/settings')} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface2 transition-colors text-left group">
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
    </>
  )
}
