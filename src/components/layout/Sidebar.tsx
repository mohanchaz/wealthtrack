import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { NAV_ITEMS, NAV_BOTTOM, type NavItem } from '../../constants/navItems'

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
      className="transition-transform duration-200"
      style={{ transform: open ? 'rotate(90deg)' : 'none' }}
    >
      <path d="M3 2l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function NavNode({ item, depth = 0, onClose }: { item: NavItem; depth?: number; onClose?: () => void }) {
  const location = useLocation()
  const navigate  = useNavigate()
  const hasChildren = !!item.children?.length

  const isSectionActive = location.pathname === item.path ||
    location.pathname.startsWith(item.path + '/') ||
    !!(item.children?.some(c =>
      location.pathname === c.path ||
      c.children?.some(gc => location.pathname === gc.path)
    ))

  const alwaysOpen = item.id === 'assets'
  const [open, setOpen] = useState(alwaysOpen || isSectionActive)

  const pad = depth === 0 ? 'px-3 py-2.5' : depth === 1 ? 'pl-8 pr-3 py-2' : 'pl-12 pr-3 py-1.5'
  const base = `w-full flex items-center gap-2.5 rounded-xl text-sm transition-all duration-150 ${pad}`

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => { navigate(item.path); setOpen(true) }}
          className={`${base} ${
            location.pathname === item.path
              ? 'bg-ink text-chalk font-semibold shadow-card'
              : isSectionActive
                ? 'text-textprim font-semibold hover:bg-surface2'
                : 'text-textmut hover:text-textprim hover:bg-surface2'
          } group`}
        >
          {depth === 0 && (
            <span className="w-5 h-5 flex items-center justify-center text-xs text-textfade group-hover:text-textmut transition-colors">
              {item.icon}
            </span>
          )}
          <span className="flex-1 text-left font-semibold">{item.label}</span>
          <span
            onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
            className="p-1 rounded hover:bg-surface3 transition-colors"
          >
            <ChevronIcon open={open} />
          </span>
        </button>
        {open && (
          <div className="mt-0.5 space-y-0.5">
            {item.children!.map(child => (
              <NavNode key={child.id} item={child} depth={depth + 1} onClose={onClose} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <NavLink
      to={item.path}
      onClick={onClose}
      className={({ isActive }) => `
        ${base}
        ${isActive
          ? 'bg-ink text-chalk font-semibold shadow-card'
          : 'text-textmut hover:text-textprim hover:bg-surface2'
        }
      `}
    >
      {depth === 0 && (
        <span className="w-5 h-5 flex items-center justify-center text-xs">{item.icon}</span>
      )}
      {depth > 0 && (
        <span className="w-1 h-1 rounded-full bg-current opacity-40 shrink-0" />
      )}
      <span>{item.label}</span>
    </NavLink>
  )
}

export function Sidebar({ onClose }: { onClose?: () => void }) {
  return (
    <aside className="flex flex-col h-full bg-surface border-r border-border w-56 shrink-0">
      {/* Main nav — scrollable */}
      <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-0.5">
        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-textfade">
          Overview
        </p>
        <NavNode item={NAV_ITEMS[0]} onClose={onClose} />

        <div className="my-3 border-t border-border" />

        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-textfade">
          Assets
        </p>
        {NAV_ITEMS.slice(1).map(item => (
          <NavNode key={item.id} item={item} onClose={onClose} />
        ))}
      </nav>

      {/* Bottom pinned items */}
      <div className="px-2.5 pb-2 space-y-0.5 border-t border-border pt-2">
        {NAV_BOTTOM.map(item => (
          <NavNode key={item.id} item={item} onClose={onClose} />
        ))}
      </div>

      {/* Footer badge */}
      <div className="p-3 border-t border-border">
        <div className="rounded-xl bg-surface2 border border-border px-3 py-2.5 text-[10px] text-textmut">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse-dot" />
            <span className="font-semibold text-textsec">Secure &amp; Private</span>
          </div>
          No broker credentials ever stored
        </div>
      </div>
    </aside>
  )
}
