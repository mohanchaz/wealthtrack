import type { ReactNode } from 'react'
import { Button } from '../ui/Button'

interface Action {
  label:    ReactNode
  onClick:  () => void
  variant?: 'primary' | 'secondary' | 'outline'
}

interface Props {
  title:      string
  subtitle?:  string
  badge?:     ReactNode
  actions?:   Action[]
  children:   ReactNode
}

/** Consistent page wrapper: header + action buttons + content */
export function PageShell({ title, subtitle, badge, actions = [], children }: Props) {
  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-extrabold text-textprim tracking-tight">{title}</h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-xs text-textmut mt-0.5">{subtitle}</p>
          )}
        </div>
        {actions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {actions.map((a, i) => (
              <Button
                key={i}
                variant={a.variant ?? (i === actions.length - 1 ? 'primary' : 'secondary')}
                size="sm"
                onClick={a.onClick}
              >
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {children}
    </div>
  )
}
