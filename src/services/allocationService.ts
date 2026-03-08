import { supabase } from '../lib/supabase'
import type { IdealAllocation } from '../types'

export async function loadAllocations(userId: string): Promise<IdealAllocation[]> {
  const { data, error } = await supabase
    .from('ideal_allocations')
    .select('*')
    .eq('user_id', userId)
    .order('percentage', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function saveAllocations(
  userId:  string,
  items:   { name: string; pct: number }[],
): Promise<void> {
  const { error: delErr } = await supabase
    .from('ideal_allocations')
    .delete()
    .eq('user_id', userId)
  if (delErr) throw new Error(delErr.message)

  const rows = items.map(r => ({
    user_id:    userId,
    item:       r.name,
    type:       'Asset',
    category:   'Custom',
    percentage: +(r.pct / 100).toFixed(4),
  }))
  const { error: insErr } = await supabase.from('ideal_allocations').insert(rows)
  if (insErr) throw new Error(insErr.message)
}

const DEFAULT_ALLOCATIONS = [
  { item: 'India Equity MF',     percentage: 0.360 },
  { item: 'India Equity Stocks', percentage: 0.275 },
  { item: 'Foreign Equity/ETF',  percentage: 0.100 },
  { item: 'Gold',                percentage: 0.100 },
  { item: 'Bonds',               percentage: 0.060 },
  { item: 'Fixed Deposit',       percentage: 0.060 },
  { item: 'Cash',                percentage: 0.040 },
  { item: 'Crypto',              percentage: 0.005 },
]

export async function seedDefaultAllocations(userId: string): Promise<void> {
  const rows = DEFAULT_ALLOCATIONS.map(a => ({
    user_id:  userId,
    ...a,
    type:     'Asset',
    category: 'Default',
  }))
  const { error } = await supabase.from('ideal_allocations').insert(rows)
  if (error) throw new Error(error.message)
}
