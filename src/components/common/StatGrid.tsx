import { StatCard } from '../ui/StatCard'
import { INR, calcGain } from '../../lib/utils'

interface StatItem {
  label:       string
  value:       string
  sub?:        string
  icon?:       string
  accentColor?: string
  loading?:    boolean
}

interface Props {
  items:   StatItem[]
  cols?:   2 | 3 | 4 | 5
}

const COL_CLASS: Record<number, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
}

export function StatGrid({ items, cols }: Props) {
  const c = cols ?? (items.length <= 4 ? items.length : 5) as 2|3|4|5
  return (
    <div className={`grid gap-2 ${COL_CLASS[c] ?? COL_CLASS[4]}`}>
      {items.map((item, i) => (
        <StatCard key={item.label} delay={i} {...item} />
      ))}
    </div>
  )
}

/** Build standard 5-tile stat set for invested pages */
export function buildInvestedStats(opts: {
  invested:    number
  value:       number
  actual?:     number
  loading?:    boolean
  liveLabel?:  string
}): StatItem[] {
  const { invested, value, actual, loading, liveLabel } = opts
  const { gain, gainPct, isPositive } = calcGain(value, invested)
  const actGain  = actual != null ? calcGain(value, actual) : null

  return [
    {
      label:       'Invested',
      value:       INR(invested),
      icon:        '₹',
      accentColor: '#0891b2',
      loading,
    },
    {
      label:       'Current Value',
      value:       INR(value),
      sub:         liveLabel,
      icon:        '◈',
      accentColor: value >= invested ? '#059669' : '#dc2626',
      loading,
    },
    {
      label:       'Gain / Loss',
      value:       `${isPositive ? '+' : ''}${INR(gain)}`,
      sub:         `${isPositive ? '+' : ''}${gainPct.toFixed(1)}%`,
      icon:        isPositive ? '▲' : '▼',
      accentColor: isPositive ? '#059669' : '#dc2626',
      loading,
    },
    {
      label:       'Actual Invested',
      value:       actual != null ? INR(actual) : '—',
      icon:        '⊡',
      accentColor: '#d97706',
      loading,
    },
    {
      label:       'Actual Gain',
      value:       actGain != null ? `${actGain.isPositive ? '+' : ''}${INR(actGain.gain)}` : '—',
      sub:         actGain != null ? `${actGain.isPositive ? '+' : ''}${actGain.gainPct.toFixed(1)}%` : undefined,
      icon:        actGain?.isPositive ? '▲' : '▼',
      accentColor: actGain?.isPositive !== false ? '#059669' : '#dc2626',
      loading,
    },
  ]
}
