import { type ReactNode } from 'react'
import { Spinner } from './Spinner'

interface Props {
  label:      string
  value:      string
  sub?:       string
  icon?:      string
  accentColor?: string
  loading?:   boolean
  delay?:     number
}

export function StatCard({ label, value, sub, icon, accentColor = '#3b82f6', loading, delay = 0 }: Props) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border bg-surface p-5 flex flex-col gap-3 group hover:border-border2 transition-all duration-200 animate-fade-up"
      style={{ animationDelay: `${delay * 0.05}s` }}
    >
      {/* Subtle gradient blob */}
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-[0.07] blur-2xl transition-opacity duration-300 group-hover:opacity-[0.12]"
        style={{ background: accentColor }}
      />

      <div className="flex items-start justify-between relative z-10">
        <span className="text-xs font-medium text-textsec uppercase tracking-wider">{label}</span>
        {icon && (
          <span
            className="text-sm w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `${accentColor}18`, color: accentColor }}
          >
            {icon}
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-7 w-32 skeleton" />
      ) : (
        <span
          className="text-2xl font-semibold font-mono tabular-nums tracking-tight relative z-10"
          style={{ color: accentColor }}
        >
          {value}
        </span>
      )}

      {sub && (
        <span className="text-xs text-textmut relative z-10 truncate">{sub}</span>
      )}
    </div>
  )
}
