export const INR = (v: number | null | undefined): string =>
  '₹' + Number(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const INRCompact = (v: number | null | undefined): string => {
  const n = Number(v ?? 0)
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2)}L`
  if (n >= 1_000)       return `₹${(n / 1_000).toFixed(1)}K`
  return INR(n)
}

export const formatDate = (val: string | null | undefined): string => {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d.getTime()) ? val
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const formatPct = (val: number | null | undefined): string =>
  val == null ? '—' : `${(+val).toFixed(2)}%`

export const calcGain = (current: number, invested: number) => {
  const gain    = current - invested
  const gainPct = invested > 0 ? (gain / invested) * 100 : 0
  return { gain, gainPct, isPositive: gain >= 0 }
}

export const getInitials = (name: string): string =>
  name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()

export const uid = () => Math.random().toString(36).slice(2)
