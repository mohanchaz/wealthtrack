import { useAuthStore } from '../../store/authStore'
import { getInitials } from '../../lib/utils'

interface Props { onMenuClick?: () => void }

export function Topbar({ onMenuClick }: Props) {
  const { user, signOut } = useAuthStore()
  const fullName  = user?.user_metadata?.full_name ?? user?.email ?? ''
  const firstName = fullName.split(' ')[0]
  const avatarUrl = user?.user_metadata?.avatar_url

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-border bg-white/90 backdrop-blur-md sticky top-0 z-40 shadow-sm">
      {/* Left */}
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-xl text-textmut hover:bg-surface2 hover:text-textsec transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="3" width="14" height="1.5" rx="0.75"/>
              <rect x="1" y="7.25" width="14" height="1.5" rx="0.75"/>
              <rect x="1" y="11.5" width="14" height="1.5" rx="0.75"/>
            </svg>
          </button>
        )}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal to-cyan flex items-center justify-center text-sm font-bold text-white shadow-sm">
            ₹
          </div>
          <span className="font-bold text-sm text-textprim tracking-tight hidden sm:inline">
            WealthTrack
          </span>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-textmut hidden sm:inline">
          Hi, <span className="font-semibold text-textsec">{firstName}</span>
        </span>

        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={firstName}
            className="w-8 h-8 rounded-full ring-2 ring-border object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal to-cyan flex items-center justify-center text-xs font-bold text-white shadow-sm">
            {getInitials(fullName || 'U')}
          </div>
        )}

        <button
          onClick={signOut}
          className="text-xs text-textmut hover:text-textsec transition-colors px-2.5 py-1.5 rounded-lg hover:bg-surface2 font-medium"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
