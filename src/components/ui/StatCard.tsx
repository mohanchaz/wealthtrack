interface Props {
  label:        string
  value:        string
  sub?:         string
  icon?:        string
  accentColor?: string
  loading?:     boolean
  delay?:       number
}

export function StatCard({ label, value, sub, icon, accentColor = '#1A1A1A', loading, delay = 0 }: Props) {
  // Determine if this is a gain (green) or loss (red) card for coloured value text
  const isGreen = accentColor === '#059669' || accentColor === '#1A7A3C'
  const isRed   = accentColor === '#dc2626' || accentColor === '#C0392B'
  const valueColor = isGreen ? '#1A7A3C' : isRed ? '#C0392B' : '#1A1A1A'

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4 flex flex-col gap-2 shadow-card card-hover animate-fade-up"
      style={{ animationDelay: `${delay * 0.06}s` }}
    >
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-bold text-textmut uppercase tracking-widest">{label}</span>
        {icon && (
          <span className="text-xs w-7 h-7 rounded-lg flex items-center justify-center font-bold bg-surface2 text-textmut">
            {icon}
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-8 w-36 skeleton" />
      ) : (
        <span
          className="text-lg sm:text-2xl font-mono font-bold tabular-nums tracking-tight break-all"
          style={{ color: valueColor }}
        >
          {value}
        </span>
      )}

      {sub && (
        <span className="text-xs text-textmut truncate leading-relaxed">{sub}</span>
      )}

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl" style={{ background: valueColor, opacity: 0.15 }} />
    </div>
  )
}
