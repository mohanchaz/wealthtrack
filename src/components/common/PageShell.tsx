import type { ReactNode } from 'react'
import { Button } from '../ui/Button'

interface Action {
  label:    ReactNode
  onClick:  () => void
  variant?: 'primary' | 'secondary' | 'outline' | 'import' | 'teal'
}

interface Props {
  title:        string
  subtitle?:    string
  badge?:       ReactNode
  actions?:     Action[]
  redeemGuide?: ReactNode
  children:     ReactNode
}

export function PageShell({ title, subtitle, badge, actions = [], redeemGuide, children }: Props) {
  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg font-bold text-textprim tracking-tight">{title}</h1>
            {subtitle && (
              <span className="text-xs font-semibold text-textmut bg-surface2 border border-border px-2 py-0.5 rounded-full tabular-nums">
                {subtitle}
              </span>
            )}
            {badge}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {/* RedeemGuide sits here — before buttons, as plain teal text not inside button container */}
          {redeemGuide}
          {actions.length > 0 && (
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
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
      </div>

      {children}
    </div>
  )
}
