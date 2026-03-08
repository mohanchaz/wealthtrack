import { useAuthStore } from '../../store/authStore'
import { getInitials } from '../../lib/utils'

interface Props { onMenuClick?: () => void }

export function Topbar({ onMenuClick }: Props) {
  const { user, signOut } = useAuthStore()

  const fullName  = user?.user_metadata?.full_name ?? user?.email ?? ''
  const firstName = fullName.split(' ')[0]
  const avatarUrl = user?.user_metadata?.avatar_url

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-40">
      {/* Left — logo + hamburger */}
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-textsec hover:bg-surface2 hover:text-textprim transition-colors"
          >
            ☰
          </button>
        )}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-lavender flex items-center justify-center text-xs font-bold text-white shadow-glow">
            ₹
          </div>
          <span className="font-semibold text-sm tracking-tight text-textprim hidden sm:inline">
            WealthTrack
          </span>
        </div>
      </div>

      {/* Right — user info + logout */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-textsec hidden sm:inline">
          Hi, <span className="font-medium text-textprim">{firstName}</span>
        </span>

        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={firstName}
            className="w-7 h-7 rounded-full ring-2 ring-border2 object-cover"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-lavender flex items-center justify-center text-[10px] font-bold text-white">
            {getInitials(fullName || 'U')}
          </div>
        )}

        <button
          onClick={signOut}
          className="text-xs text-textmut hover:text-textsec transition-colors px-2 py-1 rounded-md hover:bg-surface2"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
