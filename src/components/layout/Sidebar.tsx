import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { NAV_ITEMS, type NavItem } from '../../constants/navItems'

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
  const location     = useLocation()
  const [open, setOpen] = useState(() =>
    item.children?.some(c =>
      c.path === location.pathname ||
      c.children?.some(gc => gc.path === location.pathname)
    ) ?? false
  )
  const hasChildren = !!item.children?.length

  const pad = depth === 0 ? 'px-3 py-2' : depth === 1 ? 'pl-9 pr-3 py-1.5' : 'pl-[52px] pr-3 py-1.5'
  const base = `w-full flex items-center gap-2.5 rounded-xl text-sm transition-all duration-150 ${pad}`

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setOpen(o => !o)}
          className={`${base} text-textmut hover:text-textsec hover:bg-surface2 group`}
        >
          {depth === 0 && (
            <span className="w-6 h-6 flex items-center justify-center text-xs text-textmut group-hover:text-teal transition-colors">
              {item.icon}
            </span>
          )}
          <span className="flex-1 text-left font-semibold">{item.label}</span>
          <ChevronIcon open={open} />
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
          ? 'bg-teal/10 text-teal font-semibold border border-teal/15'
          : 'text-textmut hover:text-textsec hover:bg-surface2 border border-transparent'
        }
      `}
    >
      {depth === 0 && (
        <span className="w-6 h-6 flex items-center justify-center text-xs">{item.icon}</span>
      )}
      {depth > 0 && (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50 shrink-0" />
      )}
      <span>{item.label}</span>
    </NavLink>
  )
}

export function Sidebar({ onClose }: { onClose?: () => void }) {
  return (
    <aside className="flex flex-col h-full bg-white border-r border-border w-56 shrink-0">
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-textfade">
          Overview
        </p>
        {NAV_ITEMS.slice(0, 2).map(item => (
          <NavNode key={item.id} item={item} onClose={onClose} />
        ))}

        <div className="my-3 border-t border-border" />

        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-textfade">
          Wealth
        </p>
        {NAV_ITEMS.slice(2).map(item => (
          <NavNode key={item.id} item={item} onClose={onClose} />
        ))}
      </nav>

      {/* Footer badge */}
      <div className="p-3 border-t border-border">
        <div className="rounded-xl bg-teal/5 border border-teal/15 px-3 py-2.5 text-[10px] text-textmut">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse-dot" />
            <span className="font-bold text-textsec">Secure &amp; Private</span>
          </div>
          No broker credentials ever stored
        </div>
      </div>
    </aside>
  )
}
