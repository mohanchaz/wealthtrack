import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { NAV_ITEMS, type NavItem } from '../../constants/navItems'

interface NavNodeProps {
  item:     NavItem
  depth?:   number
  onClose?: () => void
}

function NavNode({ item, depth = 0, onClose }: NavNodeProps) {
  const location   = useLocation()
  const [open, setOpen] = useState(() =>
    item.children?.some(c =>
      c.path === location.pathname ||
      c.children?.some(gc => gc.path === location.pathname)
    ) ?? false
  )

  const hasChildren = !!item.children?.length

  const baseClasses = `
    w-full flex items-center gap-2.5 rounded-lg text-sm transition-all duration-150
    ${depth === 0 ? 'px-3 py-2' : depth === 1 ? 'pl-9 pr-3 py-1.5' : 'pl-[52px] pr-3 py-1.5'}
  `

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setOpen(o => !o)}
          className={`${baseClasses} text-textsec hover:text-textprim hover:bg-surface2 group`}
        >
          {depth === 0 && (
            <span className="w-5 h-5 flex items-center justify-center text-xs opacity-60 group-hover:opacity-100">
              {item.icon}
            </span>
          )}
          <span className="flex-1 text-left font-medium">{item.label}</span>
          <span
            className="text-[10px] opacity-40 transition-transform duration-200"
            style={{ transform: open ? 'rotate(90deg)' : 'none' }}
          >
            ›
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
        ${baseClasses}
        ${isActive
          ? 'bg-accent/10 text-accent font-medium'
          : 'text-textsec hover:text-textprim hover:bg-surface2'
        }
      `}
    >
      {depth === 0 && (
        <span className="w-5 h-5 flex items-center justify-center text-xs opacity-70">
          {item.icon}
        </span>
      )}
      {depth > 0 && (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 shrink-0" />
      )}
      <span>{item.label}</span>
    </NavLink>
  )
}

interface Props {
  onClose?: () => void
}

export function Sidebar({ onClose }: Props) {
  return (
    <aside className="flex flex-col h-full bg-bg2 border-r border-border w-56 shrink-0">
      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-textmut">
          Overview
        </p>
        {NAV_ITEMS.slice(0, 2).map(item => (
          <NavNode key={item.id} item={item} onClose={onClose} />
        ))}

        <div className="my-3 border-t border-border" />

        <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-textmut">
          Wealth
        </p>
        {NAV_ITEMS.slice(2).map(item => (
          <NavNode key={item.id} item={item} onClose={onClose} />
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <div className="rounded-lg bg-surface2 border border-border px-3 py-2 text-[10px] text-textmut">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse-dot" />
            <span className="font-medium text-textsec">Secure & Private</span>
          </div>
          No broker credentials ever stored
        </div>
      </div>
    </aside>
  )
}
