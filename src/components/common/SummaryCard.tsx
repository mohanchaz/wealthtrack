interface SummaryCardProps {
  label: string
  value: string
  sub?: string
  color?: string
  delay?: number
}

export function SummaryCard({ label, value, sub, color = 'var(--accent)', delay = 0 }: SummaryCardProps) {
  return (
    <div
      className="summary-card anim-fadeup"
      style={{ '--card-accent': color } as React.CSSProperties}
      style2={{ animationDelay: `${delay * 0.07}s` }}
    >
      <div className="summary-card-label">
        <div className="summary-card-label-dot" style={{ background: color }} />
        {label}
      </div>
      <div className="summary-card-value" style={{ color }}>{value}</div>
      {sub && <div className="summary-card-sub">{sub}</div>}
    </div>
  )
}
