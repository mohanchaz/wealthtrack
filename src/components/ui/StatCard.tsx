interface Props {
  label:       string
  value:       string
  sub?:        string
  icon?:       string
  accentColor?: string
  loading?:    boolean
  delay?:      number
}

export function StatCard({ label, value, sub, icon, accentColor = '#0d9488', loading, delay = 0 }: Props) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border bg-white p-5 flex flex-col gap-3 shadow-card card-hover animate-fade-up"
      style={{ animationDelay: `${delay * 0.06}s` }}
    >
      {/* Subtle coloured corner glow */}
      <div
        className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-[0.12] blur-2xl pointer-events-none"
        style={{ background: accentColor }}
      />

      <div className="flex items-start justify-between relative z-10">
        <span className="text-[11px] font-bold text-textmut uppercase tracking-widest">{label}</span>
        {icon && (
          <span
            className="text-sm w-8 h-8 rounded-xl flex items-center justify-center font-bold"
            style={{ background: `${accentColor}14`, color: accentColor }}
          >
            {icon}
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-8 w-36 skeleton" />
      ) : (
        <span
          className="text-2xl font-mono font-bold tabular-nums tracking-tight relative z-10"
          style={{ color: accentColor }}
        >
          {value}
        </span>
      )}

      {sub && (
        <span className="text-xs text-textmut relative z-10 truncate leading-relaxed">{sub}</span>
      )}
    </div>
  )
}
